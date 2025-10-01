<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { resetPassword } from '$lib/auth';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let password: string = $state('');
	let confirmPassword: string = $state('');
	let loading: boolean = $state(false);
	let info: string | null = $state(null);
	let errorMsg: string | null = $state(null);

	async function onSubmit(e: Event) {
		e.preventDefault();
		errorMsg = null;
		info = null;
		const url = page.url;
		const token = url.searchParams.get('token') || '';
		const email = url.searchParams.get('email') || '';
		if (!token || !email) {
			errorMsg = 'Invalid reset link';
			return;
		}
		if (!password) {
			errorMsg = 'Password is required';
			return;
		}
		if (!confirmPassword) {
			errorMsg = 'Confirm password is required';
			return;
		}
		if (password !== confirmPassword) {
			errorMsg = 'Passwords do not match';
			return;
		}
		loading = true;
		const ok = await resetPassword(email, password, token);
		loading = false;
		if (ok) {
			info = 'Password reset successfully. Redirecting to login...';
			setTimeout(() => goto('/login'), 1200);
		} else {
			errorMsg = 'Could not reset password';
		}
	}
</script>

<SEO
	title="Set New Password - KhadkaFoods"
	description="Set a new password for your KhadkaFoods account."
	keywords={['reset password', 'new password', 'change password', 'KhadkaFoods']}
	canonical="https://khadkafoods.com/reset-password"
/>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Set new password</h1>
		<form class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl" onsubmit={onSubmit}>
			<div class="card-body space-y-3">
				{#if errorMsg}
					<div class="alert alert-error"><span>{errorMsg}</span></div>
				{/if}
				{#if info}
					<div class="alert alert-success"><span>{info}</span></div>
				{/if}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">New password</span></div>
					<PasswordInput bind:value={password} />
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Confirm new password</span></div>
					<PasswordInput bind:value={confirmPassword} />
				</label>
				<Button
					class={'btn btn-primary ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">Update password</Button
				>
			</div>
		</form>
	</div>
</section>
