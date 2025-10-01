<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { requestPasswordReset } from '$lib/auth';
	import SEO from '$lib/components/SEO.svelte';

	let email: string = $state('');
	let loading: boolean = $state(false);
	let info: string | null = $state(null);
	let errorMsg: string | null = $state(null);

	async function onSubmit(e: Event) {
		e.preventDefault();
		errorMsg = null;
		info = null;
		if (!email) {
			errorMsg = 'Email is required';
			return;
		}
		loading = true;
		const ok = await requestPasswordReset(email);
		loading = false;
		if (ok) {
			info = "If an account exists, you'll receive reset instructions.";
		} else {
			errorMsg = 'Unable to send reset instructions';
		}
	}
</script>

<SEO
	title="Password Reset - Khadka Foods"
	description="Reset your Khadka Foods account password. Enter your email address to receive a secure password reset link."
	keywords={['password reset', 'forgot password', 'account recovery', 'Khadka Foods']}
	canonical="https://khadkafoods.com/password-reset"
/>

<section class="w-full min-h-screen flex items-center justify-center py-12 px-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-4xl font-extrabold tracking-tight text-primary mb-2">Reset Password</h1>
			<p class="text-base-content/60">Enter your email to receive reset instructions</p>
		</div>
		<form class="card border-2 border-base-300/50 bg-base-100 shadow-2xl rounded-3xl" onsubmit={onSubmit}>
			<div class="card-body space-y-4 p-6 sm:p-8">
				{#if errorMsg}
					<div class="alert alert-error rounded-xl shadow-md">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						<span>{errorMsg}</span>
					</div>
				{/if}
				{#if info}
					<div class="alert alert-success rounded-xl shadow-md">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						<span>{info}</span>
					</div>
				{/if}
				<label for="reset-email" class="form-control w-full">
					<div class="label"><span class="label-text font-semibold">Email Address</span></div>
					<input
						id="reset-email"
						class="input input-bordered w-full input-primary border-2 bg-base-100 focus:border-primary transition-all rounded-xl"
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="your.email@example.com"
						required
					/>
				</label>
				<Button
					class={'btn btn-primary w-full rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 h-12 text-base ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">
					{#if loading}
						<span class="loading loading-spinner"></span>
						Sending...
					{:else}
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
						Send Reset Link
					{/if}
				</Button>
				<div class="text-center pt-2">
					<a href="/login" class="text-sm text-primary hover:text-primary-focus transition-colors">
						← Back to Login
					</a>
				</div>
			</div>
		</form>
	</div>
</section>
