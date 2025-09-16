<script lang="ts">
  import { goto } from '$app/navigation'
  import { login, getCurrentCustomer } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'
  import { onMount } from 'svelte'
  import PasswordInput from '$lib/components/ui/password-input.svelte'

  let email: string = $state('')
  let password: string = $state('')
  let loading: boolean = $state(false)
  let showPassword: boolean = $state(false)
  let errorMsg: string | null = $state(null)

  onMount(async () => {
    const me = await getCurrentCustomer()
    if (me) {
      await goto('/account')
    }
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    errorMsg = null
    if (!email || !password) {
      errorMsg = 'Email and password are required'
      return
    }
    loading = true
    const me = await login(email, password)
    loading = false
    if (me) {
      await goto('/account')
    } else {
      errorMsg = 'Invalid credentials'
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
    <h1 class="text-3xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Login</h1>
    <form class="card bg-base-100/80 backdrop-blur border border-base-300 shadow-xl transition-all hover:shadow-2xl" onsubmit={onSubmit}>
      <div class="card-body space-y-3">
        {#if errorMsg}
          <div class="alert alert-error">
            <span>{errorMsg}</span>
          </div>
        {/if}
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Email</span></div>
          <input class="input input-bordered input-primary border-base-300 w-full" type="email" placeholder="you@example.com" bind:value={email} autocomplete="email" required />
        </label>
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Password</span></div>
          <PasswordInput bind:value={password} />
        </label>
        <div class="pt-2 flex items-center gap-2">
          <Button class={"btn btn-primary " + (loading ? 'loading' : '')} disabled={loading} type="submit">Sign in</Button>
          <a class="link" href="/register">Create account</a>
        </div>
        <div>
          <a class="link link-hover text-sm" href="/password-reset">Forgot password?</a>
        </div>
      </div>
    </form>
  </div>
  </section>


