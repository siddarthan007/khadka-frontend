<script lang="ts">
  import { goto } from '$app/navigation'
  import { register, getCurrentCustomer } from '$lib/auth'
  import { Button } from '$lib/components/ui/button'
  import { onMount } from 'svelte'
  import PasswordInput from '$lib/components/ui/password-input.svelte'
  import { normalizeUSPhone } from '$lib/us'

  let first_name: string = $state('')
  let last_name: string = $state('')
  let email: string = $state('')
  let password: string = $state('')
  let loading: boolean = $state(false)
  let showPassword: boolean = $state(false)
  let errorMsg: string | null = $state(null)
  let phone: string = $state('')

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
    const me = await register({ first_name, last_name, email, password, phone: normalizeUSPhone(phone) })
    loading = false
    if (me) {
      await goto('/account')
    } else {
      errorMsg = 'Registration failed'
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
    <h1 class="text-3xl font-bold tracking-tight mb-6 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">Create account</h1>
    <form class="card bg-base-100/80 backdrop-blur border border-base-300 shadow-xl transition-all hover:shadow-2xl" onsubmit={onSubmit}>
      <div class="card-body space-y-3">
        {#if errorMsg}
          <div class="alert alert-error">
            <span>{errorMsg}</span>
          </div>
        {/if}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="form-control w-full">
            <div class="label"><span class="label-text">First name</span></div>
            <input class="input input-bordered input-primary w-full" type="text" bind:value={first_name} autocomplete="given-name" />
          </label>
          <label class="form-control w-full">
            <div class="label"><span class="label-text">Last name</span></div>
            <input class="input input-bordered input-primary w-full" type="text" bind:value={last_name} autocomplete="family-name" />
          </label>
        </div>
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Email</span></div>
          <input class="input input-bordered input-primary border-base-300 w-full" type="email" placeholder="you@example.com" bind:value={email} autocomplete="email" required />
        </label>
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Mobile (US only)</span></div>
          <input class="input input-bordered input-primary border-base-300 w-full" type="tel" inputmode="numeric" pattern="[0-9\-\+\(\)\s]*" placeholder="(555) 555-5555" bind:value={phone} autocomplete="tel" />
        </label>
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Password</span></div>
          <PasswordInput bind:value={password} />
        </label>
        <div class="pt-2 flex items-center gap-2">
          <Button class={"btn btn-primary " + (loading ? 'loading' : '')} disabled={loading} type="submit">Create account</Button>
          <a class="link" href="/login">Already have an account?</a>
        </div>
      </div>
    </form>
  </div>
  </section>


