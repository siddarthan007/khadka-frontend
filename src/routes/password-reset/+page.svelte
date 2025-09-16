<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { requestPasswordReset } from '$lib/auth'

  let email: string = $state('')
  let loading: boolean = $state(false)
  let info: string | null = $state(null)
  let errorMsg: string | null = $state(null)

  async function onSubmit(e: Event) {
    e.preventDefault()
    errorMsg = null
    info = null
    if (!email) { errorMsg = 'Email is required'; return }
    loading = true
    const ok = await requestPasswordReset(email)
    loading = false
    if (ok) {
      info = "If an account exists, you'll receive reset instructions."
    } else {
      errorMsg = 'Unable to send reset instructions'
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
    <h1 class="text-3xl font-bold tracking-tight mb-6">Password reset</h1>
    <form class="card bg-base-100 border border-base-300 shadow-xl" onsubmit={onSubmit}>
      <div class="card-body space-y-3">
        {#if errorMsg}
          <div class="alert alert-error"><span>{errorMsg}</span></div>
        {/if}
        {#if info}
          <div class="alert alert-info"><span>{info}</span></div>
        {/if}
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Email</span></div>
          <input class="input input-bordered input-primary w-full" type="email" bind:value={email} autocomplete="email" required />
        </label>
        <Button class={"btn btn-primary " + (loading ? 'loading' : '')} disabled={loading} type="submit">Request reset</Button>
      </div>
    </form>
  </div>
  </section>


