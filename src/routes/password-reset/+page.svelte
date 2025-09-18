<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { requestPasswordReset } from '$lib/auth';

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

<svelte:head>
	<title>Password Reset • KhadkaFoods - Reset Your Password</title>
	<meta name="description" content="Reset your KhadkaFoods account password. Enter your email address to receive a secure password reset link." />
	<meta name="keywords" content="password reset, forgot password, reset password, account recovery, password recovery" />
	<meta name="robots" content="noindex, nofollow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Password Reset • KhadkaFoods - Reset Your Password" />
	<meta property="og:description" content="Reset your KhadkaFoods account password. Enter your email address to receive a secure password reset link." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/password-reset" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Password Reset • KhadkaFoods - Reset Your Password" />
	<meta name="twitter:description" content="Reset your KhadkaFoods account password. Enter your email address to receive a secure password reset link." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/password-reset" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Password reset</h1>
		<form class="card border border-base-300 bg-base-100 shadow-xl" onsubmit={onSubmit}>
			<div class="card-body space-y-3">
				{#if errorMsg}
					<div class="alert alert-error"><span>{errorMsg}</span></div>
				{/if}
				{#if info}
					<div class="alert alert-info"><span>{info}</span></div>
				{/if}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Email</span></div>
					<input
						class="input-bordered input w-full input-primary"
						type="email"
						bind:value={email}
						autocomplete="email"
						required
					/>
				</label>
				<Button
					class={'btn btn-primary ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">Request reset</Button
				>
			</div>
		</form>
	</div>
</section>
