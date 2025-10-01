<script lang="ts">
	import { goto } from '$app/navigation';
	import { register, getCurrentCustomer } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { normalizeUSPhone } from '$lib/us';
	import { SiGoogle } from '@icons-pack/svelte-simple-icons';
	import { startGoogleOAuth } from '$lib/auth';
	import { loadRecaptcha, getRecaptchaToken } from '$lib/utils/recaptcha';
	import SEO from '$lib/components/SEO.svelte';
	import { trackSignUp } from '$lib/utils/analytics';
	import { logger } from '$lib/logger';

	let first_name: string = $state('');
	let last_name: string = $state('');
	let email: string = $state('');
	let password: string = $state('');
	let loading: boolean = $state(false);
	let googleLoading: boolean = $state(false);
	let showPassword: boolean = $state(false);
	let errorMsg: string | null = $state(null);
	let phone: string = $state('');
	let recaptchaReady: boolean = $state(false);

	onMount(async () => {
		const me = await getCurrentCustomer();
		if (me) {
			await goto('/account');
		}

		// Load reCAPTCHA if configured
		try {
			await loadRecaptcha();
			recaptchaReady = true;
		} catch (error) {
			// reCAPTCHA not configured, registration will work without it
			recaptchaReady = false;
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
			// Execute reCAPTCHA if ready
			let recaptchaToken: string | undefined;
			if (recaptchaReady) {
				recaptchaToken = await getRecaptchaToken('register');
				
				// Verify reCAPTCHA token server-side
				if (recaptchaToken) {
					const verifyResponse = await fetch('/api/verify-recaptcha', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ token: recaptchaToken, action: 'register' })
					});

					const verifyResult = await verifyResponse.json();
					if (!verifyResult.success) {
						errorMsg = 'Security verification failed. Please try again.';
						loading = false;
						return;
					}
				}
			}

			const me = await register({
				first_name,
				last_name,
				email,
				password,
				phone: normalizeUSPhone(phone)
			}, recaptchaToken);

			if (me) {
				trackSignUp('email');
				await goto('/account');
			} else {
				errorMsg = 'Registration failed';
			}
		} catch (error) {
			logger.error('Registration error:', error);
			errorMsg = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleGoogleRegister() {
		googleLoading = true;
		errorMsg = null;
		try {
			await startGoogleOAuth('/account');
			trackSignUp('google');
		} catch (e) {
			googleLoading = false;
			errorMsg = 'Unable to start Google sign-in';
		}
	}
</script>

<SEO
	title="Register - Khadka Foods"
	description="Create your Khadka Foods account to start shopping premium organic products with exclusive member benefits."
	keywords={['register', 'sign up', 'create account', 'join', 'Khadka Foods']}
	canonical="https://khadkafoods.com/register"
/>

<section class="w-full min-h-screen flex items-center justify-center py-12">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<div class="text-center mb-8">
			<h1 class="mb-3 text-4xl font-black tracking-tight text-primary">
				Join Us Today
			</h1>
			<p class="text-base-content/60">Create your account and start shopping</p>
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
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label class="form-control w-full">
						<div class="label"><span class="label-text font-semibold">First Name</span></div>
						<input
							class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary focus:outline-none transition-all rounded-xl"
							type="text"
							bind:value={first_name}
							autocomplete="given-name"
							placeholder="John"
						/>
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text font-semibold">Last Name</span></div>
						<input
							class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary focus:outline-none transition-all rounded-xl"
							type="text"
							bind:value={last_name}
							autocomplete="family-name"
							placeholder="Doe"
						/>
					</label>
				</div>
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
					<div class="label"><span class="label-text font-semibold">Phone Number</span></div>
					<input
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary focus:outline-none transition-all rounded-xl"
						type="tel"
						inputmode="numeric"
						pattern="[0-9\-\+\(\)\s]*"
						placeholder="(555) 555-5555"
						bind:value={phone}
						autocomplete="tel"
					/>
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text font-semibold">Password</span></div>
					<PasswordInput bind:value={password} />
				</label>
				<Button
					class={'btn btn-primary w-full rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">
					{#if loading}
						<span class="loading loading-spinner"></span>
					{:else}
						Create Account
					{/if}
				</Button>
				<div class="text-center text-sm text-base-content/70">
					Already have an account? <a class="link link-hover link-primary font-semibold" href="/login">Sign in</a>
				</div>
				<div class="divider text-sm text-base-content/50">OR CONTINUE WITH</div>
				<Button
					class="btn btn-outline btn-neutral w-full rounded-xl border-2 hover:border-base-content hover:bg-base-content hover:text-base-100 transition-all duration-300 shadow-md hover:shadow-lg"
					type="button"
					disabled={googleLoading}
					onclick={handleGoogleRegister}
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
