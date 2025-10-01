<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { login, getCurrentCustomer } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { SiGoogle } from '@icons-pack/svelte-simple-icons';
	import { startGoogleOAuth } from '$lib/auth';
	import SEO from '$lib/components/SEO.svelte';
	import { loadRecaptcha, getRecaptchaToken } from '$lib/utils/recaptcha';
	import { trackLogin } from '$lib/utils/analytics';
	import { logger } from '$lib/logger';

	let email: string = $state('');
	let password: string = $state('');
	let loading: boolean = $state(false);
	let googleLoading: boolean = $state(false);
	let showPassword: boolean = $state(false);
	let errorMsg: string | null = $state(null);

	onMount(async () => {
		const me = await getCurrentCustomer();
		if (me) {
			await goto('/account');
		}

		// Load reCAPTCHA
		await loadRecaptcha().catch(logger.warn);

		// Handle OAuth error messages from URL parameters
		const url = page.url;
		const auth = url.searchParams.get('auth');
		const message = url.searchParams.get('message');

		if (auth === 'oauth_error' && message) {
			try {
				errorMsg = decodeURIComponent(message);
			} catch {
				errorMsg = 'OAuth authentication failed';
			}
		} else if (auth === 'state_mismatch') {
			errorMsg = 'Authentication state mismatch. Please try again.';
		}
	});

	async function onSubmit(e: Event) {
		e.preventDefault();
		errorMsg = null;
		if (!email || !password) {
			errorMsg = 'Email and password are required';
			return;
		}
		loading = true;

		try {
			// Get reCAPTCHA token
			const recaptchaToken = await getRecaptchaToken('login').catch(() => null);

			// Verify reCAPTCHA token
			if (recaptchaToken) {
				const verifyResponse = await fetch('/api/verify-recaptcha', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: recaptchaToken, action: 'login' })
				});

				const verifyResult = await verifyResponse.json();
				if (!verifyResult.success) {
					errorMsg = 'Security verification failed. Please try again.';
					loading = false;
					return;
				}
			}

			// Proceed with login
			const me = await login(email, password);
			if (me) {
				trackLogin('email');
				await goto('/account');
			} else {
				errorMsg = 'Invalid credentials';
			}
		} catch (error) {
			logger.error('Login error:', error);
			errorMsg = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleGoogleLogin() {
		googleLoading = true;
		errorMsg = null;
		try {
			await startGoogleOAuth('/account');
			trackLogin('google');
		} catch (e) {
			googleLoading = false;
			errorMsg = 'Unable to start Google sign-in';
		}
	}
</script>

<SEO
	title="Login • KhadkaFoods"
	description="Sign in to your KhadkaFoods account to access your orders, saved addresses, and personalized shopping experience."
	keywords={['login', 'sign in', 'account', 'customer login']}
	canonical="https://khadkafoods.com/login"
	ogType="website"
/>

<section class="w-full min-h-screen flex items-center justify-center py-12">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<div class="text-center mb-8">
			<h1 class="mb-3 text-4xl font-black tracking-tight text-primary">
				Welcome Back
			</h1>
			<p class="text-base-content/60">Sign in to your account to continue</p>
		</div>
		<form
			class="card border-2 border-base-300/50 bg-base-100 shadow-2xl backdrop-blur-sm hover:shadow-3xl transition-all duration-500 rounded-3xl"
			onsubmit={onSubmit}
		>
			<div class="card-body space-y-5 p-6 sm:p-8">
				{#if errorMsg}
					<div class="alert alert-error shadow-lg rounded-xl">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						<span>{errorMsg}</span>
					</div>
				{/if}
				<label class="form-control w-full">
					<div class="label"><span class="label-text font-semibold">Email Address</span></div>
					<input
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary focus:outline-none transition-all rounded-xl"
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						autocomplete="email"
						required
					/>
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text font-semibold">Password</span></div>
					<PasswordInput bind:value={password} />
				</label>
				<div class="text-left mb-2">
					<a class="link link-hover text-sm text-primary font-medium" href="/password-reset">Forgot your password?</a>
				</div>
				<Button
					class={'btn btn-primary w-full rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">
					{#if loading}
						<span class="loading loading-spinner"></span>
					{:else}
						Sign In
					{/if}
				</Button>
				<div class="text-center text-sm text-base-content/70">
					Don't have an account? <a class="link link-hover link-primary font-semibold" href="/register">Create one</a>
				</div>
				<div class="divider text-sm text-base-content/50">OR CONTINUE WITH</div>
				<Button
					class="btn btn-outline btn-neutral w-full rounded-xl border-2 hover:border-base-content hover:bg-base-content hover:text-base-100 transition-all duration-300 shadow-md hover:shadow-lg"
					type="button"
					disabled={googleLoading}
					onclick={handleGoogleLogin}
				>
					{#if googleLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						<span class="mr-2"><SiGoogle size={20} /></span>
						Continue with Google
					{/if}
				</Button>
			</div>
		</form>
	</div>
</section>
