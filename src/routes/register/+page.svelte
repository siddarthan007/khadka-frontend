<script lang="ts">
	import { goto } from '$app/navigation';
	import { register, getCurrentCustomer } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { normalizeUSPhone } from '$lib/us';
	import { SiGoogle } from '@icons-pack/svelte-simple-icons';
	import { startGoogleOAuth } from '$lib/auth';

	let first_name: string = $state('');
	let last_name: string = $state('');
	let email: string = $state('');
	let password: string = $state('');
	let loading: boolean = $state(false);
	let googleLoading: boolean = $state(false);
	let showPassword: boolean = $state(false);
	let errorMsg: string | null = $state(null);
	let phone: string = $state('');

	onMount(async () => {
		const me = await getCurrentCustomer();
		if (me) {
			await goto('/account');
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
		const me = await register({
			first_name,
			last_name,
			email,
			password,
			phone: normalizeUSPhone(phone)
		});
		loading = false;
		if (me) {
			await goto('/account');
		} else {
			errorMsg = 'Registration failed';
		}
	}

	async function handleGoogleRegister() {
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
	<title>Register • KhadkaFoods - Create Your Account</title>
	<meta name="description" content="Create your KhadkaFoods account to enjoy personalized shopping, order tracking, and exclusive deals on premium groceries and essentials." />
	<meta name="keywords" content="register, sign up, create account, customer registration, join KhadkaFoods, account creation" />
	<meta name="robots" content="noindex, nofollow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Register • KhadkaFoods - Create Your Account" />
	<meta property="og:description" content="Create your KhadkaFoods account to enjoy personalized shopping and exclusive deals." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/register" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Register • KhadkaFoods - Create Your Account" />
	<meta name="twitter:description" content="Create your KhadkaFoods account to enjoy personalized shopping and exclusive deals." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/register" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<h1
			class="mb-6 bg-gradient-to-r from-secondary to-primary bg-clip-text text-3xl font-bold tracking-tight text-transparent"
		>
			Create account
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
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<label class="form-control w-full">
						<div class="label"><span class="label-text">First name</span></div>
						<input
							class="input-bordered input w-full input-primary"
							type="text"
							bind:value={first_name}
							autocomplete="given-name"
						/>
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Last name</span></div>
						<input
							class="input-bordered input w-full input-primary"
							type="text"
							bind:value={last_name}
							autocomplete="family-name"
						/>
					</label>
				</div>
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
					<div class="label"><span class="label-text">Mobile</span></div>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						type="tel"
						inputmode="numeric"
						pattern="[0-9\-\+\(\)\s]*"
						placeholder="(555) 555-5555"
						bind:value={phone}
						autocomplete="tel"
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
						type="submit">Create account</Button
					>
					<a class="link" href="/login">Already have an account?</a>
				</div>
				<div class="divider text-sm">or</div>
				<Button
					class="btn w-full btn-primary"
					type="button"
					disabled={googleLoading}
					onclick={handleGoogleRegister}
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
