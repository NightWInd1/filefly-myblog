<script lang="ts">
	import { onMount } from "svelte";
	import type { Session } from "@supabase/supabase-js";
	import { supabase } from "@/lib/supabase";

	let email = "";
	let password = "";
	let session: Session | null = null;
	let loading = false;
	let message = "";
	let error = "";

	onMount(() => {
		if (!supabase) return;
		supabase.auth.getSession().then(({ data }) => (session = data.session));
		const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
			session = nextSession;
		});
		return () => data.subscription.unsubscribe();
	});

	async function submit(mode: "signIn" | "signUp") {
		if (!supabase || !email || !password) return;
		loading = true;
		message = "";
		error = "";
		const result =
			mode === "signIn"
				? await supabase.auth.signInWithPassword({ email, password })
				: await supabase.auth.signUp({
						email,
						password,
						options: { emailRedirectTo: `${window.location.origin}/account/` },
					});
		loading = false;
		if (result.error) error = result.error.message;
		else message = mode === "signUp" && !result.data.session ? "请检查邮箱完成验证。" : "登录成功。";
	}

	async function signInWithGithub() {
		if (!supabase) return;
		const { error: authError } = await supabase.auth.signInWithOAuth({
			provider: "github",
			options: { redirectTo: `${window.location.origin}/account/` },
		});
		if (authError) error = authError.message;
	}

	async function signOut() {
		if (!supabase) return;
		const { error: signOutError } = await supabase.auth.signOut();
		if (signOutError) {
			error = signOutError.message;
			return;
		}
		session = null;
		message = "已退出登录。";
	}
</script>

<section class="supabase-panel rounded-2xl p-6">
	<h2 class="mb-4 text-xl font-bold">账户</h2>
	{#if !supabase}
		<p class="text-sm opacity-70">尚未配置 Supabase 环境变量。</p>
	{:else if session}
		<p class="mb-4 text-sm">已登录：{session.user.email}</p>
		<button class="btn-regular" type="button" on:click={signOut}>退出登录</button>
	{:else}
		<div class="grid gap-3">
			<input class="input-regular" bind:value={email} type="email" aria-label="邮箱" placeholder="邮箱" autocomplete="email" />
			<input class="input-regular" bind:value={password} type="password" aria-label="密码" placeholder="密码（至少 6 位）" autocomplete="current-password" />
			<div class="flex flex-wrap gap-2">
				<button class="btn-regular" type="button" disabled={loading} on:click={() => submit("signIn")}>邮箱登录</button>
				<button class="btn-regular" type="button" disabled={loading} on:click={() => submit("signUp")}>注册</button>
				<button class="btn-regular" type="button" on:click={signInWithGithub}>GitHub 登录</button>
			</div>
		</div>
	{/if}
	{#if message}<p class="mt-3 text-sm text-green-600">{message}</p>{/if}
	{#if error}<p class="mt-3 text-sm text-red-500">{error}</p>{/if}
</section>

<style>
	.supabase-panel { background: var(--card-bg, rgba(127, 127, 127, 0.08)); }
	.input-regular { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 0.6rem; background: transparent; padding: 0.65rem 0.8rem; }
	.btn-regular { border-radius: 0.6rem; background: var(--primary); color: var(--primary-content, white); padding: 0.6rem 0.9rem; }
	.btn-regular:disabled { cursor: wait; opacity: 0.6; }
</style>
