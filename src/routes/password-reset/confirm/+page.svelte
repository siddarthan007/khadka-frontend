<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { resetPassword } from '$lib/auth'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'

  let password: string = $state('')
  let loading: boolean = $state(false)
  let info: string | null = $state(null)
  let errorMsg: string | null = $state(null)

  async function onSubmit(e: Event) {
    e.preventDefault()
    errorMsg = null
    info = null
    const url = $page.url
    const token = url.searchParams.get('token') || ''
    const email = url.searchParams.get('email') || ''
    if (!token || !email) { errorMsg = 'Invalid reset link'; return }
    if (!password) { errorMsg = 'Password is required'; return }
    loading = true
    const ok = await resetPassword(email, password, token)
    loading = false
    if (ok) {
      info = 'Password reset successfully. Redirecting to login...'
      setTimeout(() => goto('/login'), 1200)
    } else {
      errorMsg = 'Could not reset password'
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
    <h1 class="text-3xl font-bold tracking-tight mb-6">Set new password</h1>
    <form class="card bg-base-100 border border-base-300 shadow-xl" onsubmit={onSubmit}>
      <div class="card-body space-y-3">
        {#if errorMsg}
          <div class="alert alert-error"><span>{errorMsg}</span></div>
        {/if}
        {#if info}
          <div class="alert alert-success"><span>{info}</span></div>
        {/if}
        <label class="form-control w-full">
          <div class="label"><span class="label-text">New password</span></div>
          <input class="input input-bordered input-primary w-full" type="password" bind:value={password} autocomplete="new-password" required />
        </label>
        <Button class={"btn btn-primary " + (loading ? 'loading' : '')} disabled={loading} type="submit">Update password</Button>
      </div>
    </form>
  </div>
  </section>


