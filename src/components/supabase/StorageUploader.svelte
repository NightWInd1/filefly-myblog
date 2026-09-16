<script lang="ts">
	import { onMount } from "svelte";
	import { supabase } from "@/lib/supabase";

	let userId: string | null = null;
	let fileInput: HTMLInputElement;
	let uploading = false;
	let message = "";
	let error = "";

	onMount(() => {
		if (!supabase) return;
		supabase.auth.getSession().then(({ data }) => (userId = data.session?.user.id ?? null));
		const { data } = supabase.auth.onAuthStateChange((_event, session) => (userId = session?.user.id ?? null));
		return () => data.subscription.unsubscribe();
	});

	async function upload() {
		const file = fileInput?.files?.[0];
		if (!supabase || !userId || !file) return;
		uploading = true;
		message = "";
		error = "";
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
		const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
		try {
			const { error: uploadError } = await supabase.storage.from("user-uploads").upload(path, file, { upsert: false });
			if (uploadError) throw uploadError;
			const { error: rowError } = await supabase.from("user_files").insert({ user_id: userId, bucket: "user-uploads", path });
			if (rowError) {
				const { error: cleanupError } = await supabase.storage.from("user-uploads").remove([path]);
				if (cleanupError) throw new Error(`上传记录保存失败，文件仍保存在存储中：${rowError.message}`);
				throw rowError;
			}
			message = "文件上传成功。";
			fileInput.value = "";
		} catch (uploadError) {
			error = uploadError instanceof Error ? uploadError.message : "上传失败，请重试。";
		} finally {
			uploading = false;
		}
	}
</script>

<section class="supabase-panel rounded-2xl p-6">
	<h2 class="mb-2 text-xl font-bold">文件存储</h2>
	<p class="mb-4 text-sm opacity-70">登录后可将文件上传到 Supabase Storage 私有存储桶。</p>
	{#if !userId}
		<p class="text-sm opacity-70">请先登录。</p>
	{:else}
		<div class="flex flex-wrap items-center gap-3">
			<input bind:this={fileInput} type="file" aria-label="选择上传文件" disabled={uploading} />
			<button class="btn-regular" type="button" disabled={uploading} on:click={upload}>{uploading ? "上传中…" : "上传文件"}</button>
		</div>
	{/if}
	{#if message}<p class="mt-3 text-sm text-green-600">{message}</p>{/if}
	{#if error}<p class="mt-3 text-sm text-red-500">{error}</p>{/if}
</section>

<style>
	.supabase-panel { background: var(--card-bg, rgba(127, 127, 127, 0.08)); }
	.btn-regular { border-radius: 0.6rem; background: var(--primary); color: var(--primary-content, white); padding: 0.6rem 0.9rem; }
	.btn-regular:disabled { cursor: wait; opacity: 0.6; }
</style>
