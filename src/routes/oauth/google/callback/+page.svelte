<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { completeGoogleOAuth } from '$lib/auth';

	let loading: boolean = $state(true);
	let errorMsg: string | null = $state(null);

	onMount(async () => {
		const url = $page.url;
		const returnTo = url.searchParams.get('return_to') || '/account';

		// Check for OAuth provider errors in URL
		const error = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		if (error) {
			loading = false;
			errorMsg = errorDescription || `Authentication failed: ${error}`;
			console.error('OAuth provider error:', { error, errorDescription });
			return;
		}

		const ok = await completeGoogleOAuth(url.searchParams);
		loading = false;
		if (ok) {
			await goto(returnTo);
		} else {
			errorMsg = 'Google sign-in failed. Please try again.';
		}
	});
</script>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<div class="card border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body">
				{#if loading}
					<div class="flex items-center justify-center p-8">
						<div class="loading loading-lg loading-spinner text-primary"></div>
					</div>
				{:else if errorMsg}
					<div class="alert alert-error"><span>{errorMsg}</span></div>
					<a class="link" href="/login">Back to login</a>
				{:else}
					<div class="alert alert-success"><span>Signed in. Redirecting…</span></div>
				{/if}
			</div>
		</div>
	</div>
</section>
