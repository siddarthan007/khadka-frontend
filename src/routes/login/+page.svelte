<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { login, getCurrentCustomer } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { SiGoogle } from '@icons-pack/svelte-simple-icons';
	import { startGoogleOAuth } from '$lib/auth';

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

		// Handle OAuth error messages from URL parameters
		const url = $page.url;
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
		const me = await login(email, password);
		loading = false;
		if (me) {
			await goto('/account');
		} else {
			errorMsg = 'Invalid credentials';
		}
	}

	async function handleGoogleLogin() {
		googleLoading = true;
		errorMsg = null;
		try {
			await startGoogleOAuth('/account');
		} catch (e) {
			googleLoading = false;
			errorMsg = 'Unable to start Google sign-in';
		}
	}
</script>

<svelte:head>
	<title>Login • KhadkaFoods - Sign In to Your Account</title>
	<meta name="description" content="Sign in to your KhadkaFoods account to access your order history, manage your profile, and enjoy a personalized shopping experience." />
	<meta name="keywords" content="login, sign in, account login, customer login, authentication, user login" />
	<meta name="robots" content="noindex, nofollow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Login • KhadkaFoods - Sign In to Your Account" />
	<meta property="og:description" content="Sign in to your KhadkaFoods account to access your order history and manage your profile." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/login" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Login • KhadkaFoods - Sign In to Your Account" />
	<meta name="twitter:description" content="Sign in to your KhadkaFoods account to access your order history and manage your profile." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/login" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<h1
			class="mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-3xl font-bold tracking-tight text-transparent"
		>
			Login
		</h1>
		<form
			class="card border border-base-300 bg-base-100/80 shadow-xl backdrop-blur transition-all hover:shadow-2xl"
			onsubmit={onSubmit}
		>
			<div class="card-body space-y-3">
				{#if errorMsg}
					<div class="alert alert-error">
						<span>{errorMsg}</span>
					</div>
				{/if}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Email</span></div>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						autocomplete="email"
						required
					/>
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Password</span></div>
					<PasswordInput bind:value={password} />
				</label>
				<div class="flex items-center gap-2 pt-2">
					<Button
						class={'btn btn-primary ' + (loading ? 'loading' : '')}
						disabled={loading}
						type="submit">Sign in</Button
					>
					<a class="link" href="/register">Create account</a>
				</div>
				<div>
					<a class="link text-sm link-hover" href="/password-reset">Forgot password?</a>
				</div>
				<div class="divider text-sm">or</div>
				<Button
					class="btn w-full btn-primary"
					type="button"
					disabled={googleLoading}
					onclick={handleGoogleLogin}
				>
					{#if googleLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					<span class="mr-1"><SiGoogle size={18} /></span>
					Continue with Google
				</Button>
			</div>
		</form>
	</div>
</section>
