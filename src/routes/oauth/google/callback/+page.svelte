<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { handleGoogleOAuthCallback } from '$lib/auth';
  import SEO from '$lib/components/SEO.svelte';

  let loading: boolean = $state(true);
  let errorMsg: string | null = $state(null);

  onMount(async () => {
    const url = page.url;
    const ok = await handleGoogleOAuthCallback(url.searchParams);
    if (ok) {
      // Prefer intended path from localStorage set by startGoogleOAuth
      let returnTo = '/account';
      try {
        const stored = localStorage.getItem('oauth_intended_path');
        if (stored && stored.startsWith('/')) returnTo = stored;
        localStorage.removeItem('oauth_intended_path');
      } catch {}
      await goto(returnTo);
      return;
    }
    loading = false;
    errorMsg = 'Authentication failed. Please try again.';
  });
</script>

<SEO 
	title="Authenticating - Khadka Foods"
	description="Completing your Google authentication"
  noindex={true}
/>

<section class="w-full py-10">
	<div class="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
		<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl">
			<div class="card-body p-6">
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
