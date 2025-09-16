<script lang="ts">
  import { onMount } from 'svelte'
  import { cart as cartStore } from '$lib/stores/cart'
  import { ensureCart, getCart } from '$lib/cart'
  import { Button } from '$lib/components/ui/button'
  import { get } from 'svelte/store'
  import { getCurrentCustomer } from '$lib/auth'
  import { listAddresses } from '$lib/customer-api'
  import { getStoreClient } from '$lib/medusa'
  import { showToast } from '$lib/stores/toast'
  import { US_STATES } from '$lib/us'
  import type { HttpTypes } from '@medusajs/types'

  let email: string = $state('')
  let shipping = $state({
    first_name: '', last_name: '', address_1: '', address_2: '', city: '',
    country_code: 'US', province: '', postal_code: '', phone: ''
  })
  let billingSameAsShipping: boolean = $state(true)
  let billing = $state({
    first_name: '', last_name: '', address_1: '', address_2: '', city: '',
    country_code: 'US', province: '', postal_code: '', phone: ''
  })
  let loading: boolean = $state(false)
  let saveAddress: boolean = $state(true)
  let errorMsg: string | null = $state(null)
  let overlay: boolean = $state(false)

  // Saved addresses for logged-in customers
  let savedAddresses: HttpTypes.StoreCustomerAddress[] = $state([])
  let selectedAddressId: string | 'new' = $state('new')

  function applyAddressToShipping(a: Partial<HttpTypes.StoreCustomerAddress> | undefined | null) {
    if (!a) return
    shipping = {
      first_name: a.first_name ?? '',
      last_name: a.last_name ?? '',
      address_1: a.address_1 ?? '',
      address_2: a.address_2 ?? '',
      city: a.city ?? '',
      country_code: a.country_code ?? 'US',
      province: a.province ?? '',
      postal_code: a.postal_code ?? '',
      phone: (a as any).phone ?? ''
    }
  }

  function onSelectAddress(id: string | 'new') {
    selectedAddressId = id
    if (id === 'new') return
    const sel = savedAddresses.find((x) => x.id === id)
    applyAddressToShipping(sel)
    const isDefaultSelected = !!(sel as any)?.metadata?.is_primary
    saveAddress = !isDefaultSelected
  }

  onMount(async () => {
    await ensureCart()
    await getCart()
    const me = await getCurrentCustomer()
    if (me) {
      email = me.email ?? ''
      // Prefer listAddress for robustness
      const resp = await listAddresses().catch(() => null)
      savedAddresses = ((resp as any)?.addresses ?? (me as any).shipping_addresses ?? []) as HttpTypes.StoreCustomerAddress[]
      if (savedAddresses.length > 0) {
        const def = savedAddresses.find((addr: any) => addr?.metadata?.is_primary) ?? savedAddresses[0]
        selectedAddressId = def?.id ?? 'new'
        applyAddressToShipping(def)
        // If default is selected, no need to show save-to-account toggle
        const isDefaultSelected = !!(def as any)?.metadata?.is_primary
        saveAddress = !isDefaultSelected
      }
    }
  })

  async function submitCheckout() {
    errorMsg = null
    loading = true
    overlay = true
    const sdk = getStoreClient() as any
    try {
      const c = get(cartStore)
      if (!c?.id) return

      if (!email || !email.includes('@')) {
        errorMsg = 'Please enter a valid email.'
        showToast('Enter a valid email', { type: 'error' })
        loading = false
        return
      }

      // Guest email association
      await sdk.store.cart.update(c.id, { email })
      showToast('Contact email saved', { type: 'success' })

      // Shipping address
      await sdk.store.cart.update(c.id, { shipping_address: shipping })
      showToast('Shipping address added', { type: 'success' })

      // Billing address
      if (!billingSameAsShipping) {
        await sdk.store.cart.update(c.id, { billing_address: billing })
      } else {
        await sdk.store.cart.update(c.id, { billing_address: shipping })
      }
      showToast('Billing address set', { type: 'success' })

      // Initialize payment sessions and select first available
      await sdk.store.cart.createPaymentSessions(c.id)
      const { cart: fresh } = await sdk.store.cart.retrieve(c.id)
      const providers = (fresh as any)?.payment_sessions?.map((p: any) => p.provider_id) ?? []
      const provider = providers[0]
      if (provider) {
        await sdk.store.cart.setPaymentSession(c.id, provider)
        showToast('Payment ready', { type: 'success' })
      }

      const meResp = await sdk.store.customer.retrieve().catch(() => null)
      if (saveAddress && meResp?.customer) {
        await sdk.store.customer.createAddress(shipping).catch(()=>{})
        showToast('Address saved to account', { type: 'success' })
      }

      const { cart } = await sdk.store.cart.complete(c.id)
      if ((cart as any)?.completed_at) {
        showToast('Order placed successfully', { type: 'success' })
        try {
          // @ts-ignore - optional peer for visual flair only
          const party = await import('canvas-confetti').then((m:any)=>m.default || m)
          party({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        } catch {}
        window.location.href = '/'
      } else {
        errorMsg = 'Could not complete checkout.'
        showToast('Could not complete checkout', { type: 'error' })
      }
    } catch (e) {
      errorMsg = 'Checkout failed.'
      showToast('Checkout failed', { type: 'error' })
    } finally {
      loading = false
      overlay = false
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    {#if overlay}
      <div class="fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm flex items-center justify-center">
        <div class="loading loading-spinner loading-lg text-primary"></div>
      </div>
    {/if}
    <h1 class="text-3xl font-bold tracking-tight mb-6">Checkout</h1>

    {#if errorMsg}
      <div class="alert alert-error mb-4"><span>{errorMsg}</span></div>
    {/if}

    <div class="card bg-base-100 border border-base-300 shadow-xl">
      <div class="card-body space-y-4">
        <h2 class="card-title">Contact</h2>
        <label class="form-control w-full">
          <div class="label"><span class="label-text">Email</span></div>
          <input class="input input-bordered input-primary border-base-300 w-full" type="email" bind:value={email} placeholder="you@example.com" />
        </label>

        {#if savedAddresses.length > 0}
          <h2 class="card-title mt-2">Select a saved address</h2>
          <div class="grid gap-2">
            {#each savedAddresses as a (a.id)}
              <label class="flex items-start gap-3 p-3 rounded-lg border border-base-300 hover:border-primary/50 cursor-pointer">
                <input type="radio" class="radio radio-primary mt-1" name="address-select" checked={selectedAddressId === a.id} onchange={() => onSelectAddress(a.id!)} />
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="font-medium truncate">{a.first_name} {a.last_name}</div>
                    {#if (a as any).metadata?.is_primary}
                    <span class="badge badge-primary badge-sm text-primary-content left-2 top-2 px-2.5 py-0.5 rounded-full shadow">Default</span>
                    {/if}
                  </div>
                  <div class="text-sm opacity-70 truncate">{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}</div>
                  <div class="text-sm opacity-70 truncate">{a.province}, {a.postal_code}, {a.country_code}</div>
                  {#if (a as any).phone}
                    <div class="text-sm opacity-70 truncate">{(a as any).phone}</div>
                  {/if}
                </div>
              </label>
            {/each}
            <label class="flex items-center gap-3 p-3 rounded-lg border border-dashed border-base-300 hover:border-primary/50 cursor-pointer">
              <input type="radio" class="radio radio-primary" name="address-select" checked={selectedAddressId === 'new'} onchange={() => onSelectAddress('new')} />
              <div class="opacity-80">Use a new address</div>
            </label>
          </div>
        {/if}

        <h2 class="card-title mt-2">Shipping address</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input class="input input-bordered input-primary border-base-300" placeholder="First name" bind:value={shipping.first_name} />
          <input class="input input-bordered input-primary border-base-300" placeholder="Last name" bind:value={shipping.last_name} />
        </div>
        <input class="input input-bordered input-primary border-base-300 w-full" placeholder="Address 1" bind:value={shipping.address_1} />
        <input class="input input-bordered input-primary border-base-300 w-full" placeholder="Address 2" bind:value={shipping.address_2} />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input class="input input-bordered input-primary border-base-300" placeholder="City" bind:value={shipping.city} />
          <select class="select select-bordered" bind:value={shipping.province}>
            <option value="" disabled>Select state</option>
            {#each US_STATES as s}
              <option value={s.code}>{s.name}</option>
            {/each}
          </select>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input class="input input-bordered input-primary border-base-300" placeholder="Postal code" bind:value={shipping.postal_code} />
          <input class="input input-bordered input-primary opacity-100 bg-base-200/60 dark:bg-base-300/20 dark:text-base-content/80" placeholder="US" bind:value={shipping.country_code} disabled />
          <input class="input input-bordered input-primary border-base-300" placeholder="Phone" bind:value={shipping.phone} />
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" class="checkbox checkbox-primary" bind:checked={billingSameAsShipping} />
            <span class="label-text">Billing address same as shipping</span>
          </label>
        </div>

        {#if !(selectedAddressId !== 'new' && (savedAddresses.find((x)=>x.id===selectedAddressId) as any)?.metadata?.is_primary)}
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="checkbox" class="checkbox checkbox-primary" bind:checked={saveAddress} />
              <span class="label-text">Save this address to my account</span>
            </label>
          </div>
        {/if}

        {#if !billingSameAsShipping}
          <h2 class="card-title mt-2">Billing address</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input class="input input-bordered input-primary border-base-300" placeholder="First name" bind:value={billing.first_name} />
            <input class="input input-bordered input-primary border-base-300" placeholder="Last name" bind:value={billing.last_name} />
          </div>
          <input class="input input-bordered input-primary border-base-300 w-full" placeholder="Address 1" bind:value={billing.address_1} />
          <input class="input input-bordered input-primary border-base-300 w-full" placeholder="Address 2" bind:value={billing.address_2} />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input class="input input-bordered input-primary border-base-300" placeholder="City" bind:value={billing.city} />
            <select class="select select-bordered" bind:value={billing.province}>
              <option value="" disabled>Select state</option>
              {#each US_STATES as s}
                <option value={s.code}>{s.name}</option>
              {/each}
            </select>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input class="input input-bordered input-primary border-base-300" placeholder="Postal code" bind:value={billing.postal_code} />
            <input class="input input-bordered input-primary opacity-100 bg-base-200/60 dark:bg-base-300/20 dark:text-base-content/80" placeholder="US" bind:value={billing.country_code} disabled />
            <input class="input input-bordered input-primary border-base-300" placeholder="Phone" bind:value={billing.phone} />
          </div>
        {/if}

        <div class="pt-2">
          <Button class={"btn btn-primary w-full " + (loading ? 'loading' : '')} disabled={loading} onclick={submitCheckout}>Place order</Button>
        </div>
      </div>
    </div>
  </div>
</section>

{#if overlay}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
{/if}


