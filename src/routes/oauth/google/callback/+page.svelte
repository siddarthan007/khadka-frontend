<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { handleGoogleOAuthCallback } from '$lib/auth';

  let loading: boolean = $state(true);
  let errorMsg: string | null = $state(null);

  onMount(async () => {
    const url = $page.url;
    const returnTo = url.searchParams.get('return_to') || '/account';
    const ok = await handleGoogleOAuthCallback(url.searchParams);
    if (ok) {
      await goto(returnTo);
      return;
    }
    loading = false;
    errorMsg = 'Authentication failed. Please try again.';
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
