<script lang="ts">
	import { onMount } from "svelte";
	import { supabase } from "@/lib/supabase";

	let { postSlug = "demo" }: { postSlug?: string } = $props();
	type Comment = { id: number; author_name: string | null; content: string; created_at: string };
	let comments = $state<Comment[]>([]);
	let content = $state("");
	let userId = $state<string | null>(null);
	let error = $state("");
	let posting = $state(false);
	let loading = $state(true);
	let refreshComments: (() => Promise<void>) | undefined;

	onMount(() => {
		const client = supabase;
		if (!client) {
			loading = false;
			return;
		}
		let active = true;
		let requestId = 0;
		const refresh = async () => {
			if (!active) return;
			const currentRequest = ++requestId;
			const { data, error: queryError } = await client.from("blog_comments")
				.select("id, author_name, content, created_at")
				.eq("post_slug", postSlug).order("created_at", { ascending: true });
			if (!active || currentRequest !== requestId) return;
			loading = false;
			if (queryError) error = `评论加载失败：${queryError.message}`;
			else comments = data ?? [];
		};
		refreshComments = refresh;
		const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
			if (active) userId = session?.user.id ?? null;
		});
		// Subscribe before loading, then reload on connection to cover changes
		// arriving during the initial query. DELETE events cannot be filtered.
		const channel = client.channel(`blog-comments-${crypto.randomUUID()}`)
			.on("postgres_changes", { event: "*", schema: "public", table: "blog_comments" }, () => { void refresh(); })
			.subscribe((status) => {
				if (active && status === "SUBSCRIBED") void refresh();
				if (active && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) error = "实时连接暂不可用，请刷新页面查看最新评论。";
			});
		void refresh();
		return () => {
			active = false;
			refreshComments = undefined;
			authListener.subscription.unsubscribe();
			void client.removeChannel(channel);
		};
	});

	async function addComment() {
		if (!supabase || !userId || !content.trim() || posting) return;
		posting = true;
		error = "";
		try {
			const { data: { user }, error: authError } = await supabase.auth.getUser();
			if (authError || !user) throw new Error("登录已失效，请重新登录。");
			const name = user.user_metadata.user_name || user.user_metadata.full_name;
			const { error: insertError } = await supabase.from("blog_comments").insert({
				post_slug: postSlug,
				user_id: user.id,
				author_name: typeof name === "string" ? name.slice(0, 80) : "读者",
				content: content.trim(),
			});
			if (insertError) throw insertError;
			content = "";
			await refreshComments?.();
		} catch (postError) {
			error = postError instanceof Error ? postError.message : "评论发布失败，请重试。";
		} finally {
			posting = false;
		}
	}
</script>

<section id="post-comments" class="supabase-panel rounded-2xl p-6">
	<h2 class="mb-4 text-xl font-bold">评论</h2>
	<div class="mb-4 grid gap-2">
		{#each comments as comment (comment.id)}
			<article class="rounded-lg p-3" style="background: color-mix(in srgb, currentColor 7%, transparent)">
				<p class="text-sm font-semibold">{comment.author_name ?? "用户"}</p>
				<p class="text-sm">{comment.content}</p>
			</article>
		{:else}
			<p class="text-sm opacity-70">{loading ? "正在加载评论…" : "还没有评论。"}</p>
		{/each}
	</div>
	{#if userId}
		<div class="flex gap-2">
			<input class="input-regular min-w-0 flex-1" bind:value={content} aria-label="评论内容" placeholder="写下评论" maxlength="5000" disabled={posting} />
			<button class="btn-regular" type="button" onclick={addComment} disabled={posting || !content.trim()}>{posting ? "发布中…" : "发布"}</button>
		</div>
	{:else}
		<p class="text-sm opacity-70"><a href="/account/" class="underline">登录</a>后参与评论。</p>
	{/if}
	{#if error}<p class="mt-3 text-sm text-red-500">{error}</p>{/if}
</section>

<style>
	.supabase-panel { background: var(--card-bg, rgba(127, 127, 127, 0.08)); }
	.input-regular { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 0.6rem; background: transparent; padding: 0.65rem 0.8rem; }
	.btn-regular { border-radius: 0.6rem; background: var(--primary); color: var(--primary-content, white); padding: 0.6rem 0.9rem; }
</style>
