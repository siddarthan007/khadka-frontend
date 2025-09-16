<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import { getCurrentCustomer, logout, updateProfile } from '$lib/auth'
  import { customer as customerStore } from '$lib/stores/customer'
  import type { HttpTypes } from '@medusajs/types'
  import { getStoreClient } from '$lib/medusa'
  import { showToast } from '$lib/stores/toast'

  let me: HttpTypes.StoreCustomer | null = $state(null)
  let loading: boolean = $state(true)
  let saving: boolean = $state(false)
  let errorMsg: string | null = $state(null)
  let profileSaving: boolean = $state(false)

  let address = $state({
    first_name: '', last_name: '', address_1: '', address_2: '', city: '',
    country_code: 'US', province: '', postal_code: '', phone: ''
  })

  onMount(async () => {
    me = await getCurrentCustomer()
    loading = false
    if (!me) {
      await goto('/login')
      return
    }
  })

  async function addAddress() {
    if (!me) return
    saving = true
    try {
      const sdk = getStoreClient() as any
      await sdk.client.fetch(`/store/customers/me/addresses`, {
        method: 'POST',
        body: { address }
      })
      me = await getCurrentCustomer()
      showToast('Address added', { type: 'success' })
    } catch (e) {
      errorMsg = 'Failed to save address'
      showToast('Failed to save address', { type: 'error' })
    } finally {
      saving = false
    }
  }

  async function removeAddress(id: string) {
    const sdk = getStoreClient() as any
    await sdk.client.fetch(`/store/customers/me/addresses/${id}`, { method: 'DELETE' }).catch(()=>{})
    me = await getCurrentCustomer()
    showToast('Address removed', { type: 'success' })
  }

  async function onLogout() {
    await logout()
    await goto('/login')
  }

  async function saveProfile() {
    if (!me) return
    profileSaving = true
    const updated = await updateProfile({ first_name: me.first_name ?? undefined, last_name: me.last_name ?? undefined })
    profileSaving = false
    if (updated) {
      me = updated
      showToast('Profile updated', { type: 'success' })
    } else {
      showToast('Failed to update profile', { type: 'error' })
    }
  }
</script>

<section class="w-full py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <div class="p-10 text-center">Loading…</div>
    {:else if !me}
      <div class="p-10 text-center">Redirecting…</div>
    {:else}
      <div class="flex items-start gap-6 flex-col md:flex-row">
        <div class="md:w-2/3 w-full space-y-4">
          <div class="card bg-base-100 border border-base-300 shadow-xl">
            <div class="card-body space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="card-title">Profile</h2>
                <Button class="btn btn-error btn-sm" onclick={onLogout}>Logout</Button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label class="form-control">
                  <div class="label"><span class="label-text">First name</span></div>
                  <input class="input input-bordered input-primary" bind:value={me.first_name} />
                </label>
                <label class="form-control">
                  <div class="label"><span class="label-text">Last name</span></div>
                  <input class="input input-bordered input-primary" bind:value={me.last_name} />
                </label>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label class="form-control">
                  <div class="label"><span class="label-text">Email</span></div>
                  <input class="input input-bordered" value={me.email} readonly />
                </label>
                <div></div>
              </div>
              <div>
                <Button class={"btn btn-primary " + (profileSaving ? 'loading' : '')} disabled={profileSaving} onclick={saveProfile}>Save profile</Button>
              </div>
            </div>
          </div>

          <div class="card bg-base-100 border border-base-300 shadow-xl">
            <div class="card-body space-y-3">
              <h2 class="card-title">Saved addresses</h2>
              <div class="grid gap-3">
                {#each ((me as any).shipping_addresses ?? []) as a}
                  <div class="rounded-xl border border-base-300 p-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-medium truncate">{a.first_name} {a.last_name}</div>
                      <div class="text-sm opacity-70 truncate">{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}</div>
                      <div class="text-sm opacity-70 truncate">{a.province}, {a.postal_code}, {a.country_code}</div>
                      {#if a.phone}
                        <div class="text-sm opacity-70 truncate">{a.phone}</div>
                      {/if}
                    </div>
                    <Button class="btn btn-ghost btn-sm" onclick={() => removeAddress(a.id!)}>Remove</Button>
                  </div>
                {/each}
                {#if ((me as any).shipping_addresses ?? []).length === 0}
                  <div class="opacity-70 text-sm">No saved addresses yet.</div>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <div class="md:w-1/3 w-full">
          <div class="card bg-base-100 border border-base-300 shadow-xl">
            <form class="card-body space-y-3" onsubmit={(e)=>{ e.preventDefault(); addAddress(); }}>
              <h2 class="card-title">Add address</h2>
              {#if errorMsg}
                <div class="alert alert-error"><span>{errorMsg}</span></div>
              {/if}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input class="input input-bordered input-primary" placeholder="First name" bind:value={address.first_name} />
                <input class="input input-bordered input-primary" placeholder="Last name" bind:value={address.last_name} />
              </div>
              <input class="input input-bordered input-primary w-full" placeholder="Address 1" bind:value={address.address_1} />
              <input class="input input-bordered input-primary w-full" placeholder="Address 2" bind:value={address.address_2} />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input class="input input-bordered input-primary" placeholder="City" bind:value={address.city} />
                <input class="input input-bordered input-primary" placeholder="Province/State" bind:value={address.province} />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input class="input input-bordered input-primary" placeholder="Postal code" bind:value={address.postal_code} />
                <input class="input input-bordered input-primary" placeholder="Country code (e.g., US)" bind:value={address.country_code} />
              </div>
              <input class="input input-bordered input-primary w-full" placeholder="Phone" bind:value={address.phone} />
              <Button class={"btn btn-primary " + (saving ? 'loading' : '')} disabled={saving} type="submit">Save address</Button>
            </form>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>


