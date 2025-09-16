<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { US_STATES } from '$lib/us'
  import { updateAddress as apiUpdateAddress, deleteAddress as apiDeleteAddress, listAddresses } from '$lib/customer-api'
  import { showToast } from '$lib/stores/toast'
  import type { HttpTypes } from '@medusajs/types'
  import { Motion } from 'svelte-motion'
  import { getCurrentCustomer } from '$lib/auth'
  import { createEventDispatcher } from 'svelte'
  import { Pencil, Trash2 } from '@lucide/svelte'
  const dispatch = createEventDispatcher<{ updated: void; deleted: void }>()
  function startEdit() {
    local = {
      first_name: a.first_name || '',
      last_name: a.last_name || '',
      address_1: a.address_1 || '',
      address_2: a.address_2 || '',
      city: a.city || '',
      province: a.province || '',
      postal_code: a.postal_code || '',
      country_code: a.country_code || 'US',
      phone: (a as any).phone || ''
    }
    isPrimary = !!(a as any).metadata?.is_primary
    editing = true
  }

  let { a, me }: { a: HttpTypes.StoreCustomerAddress; me: HttpTypes.StoreCustomer | null } = $props()

  let editing: boolean = $state(false)
  let local = $state({
    first_name: a.first_name || '',
    last_name: a.last_name || '',
    address_1: a.address_1 || '',
    address_2: a.address_2 || '',
    city: a.city || '',
    province: a.province || '',
    postal_code: a.postal_code || '',
    country_code: a.country_code || 'US',
    phone: (a as any).phone || ''
  })
  let isPrimary: boolean = $state(!!(a as any).metadata?.is_primary)

  async function onSave() {
    try {
      const payload: any = { ...local, country_code: 'US' }
      payload.metadata = { ...(a as any).metadata, is_primary: !!isPrimary }
      const resp = await apiUpdateAddress(a.id!, payload)
      if (isPrimary) {
        try {
          const list = await listAddresses()
          const addresses = (list as any)?.addresses ?? []
          for (const other of addresses) {
            if (other?.id !== a.id && (other as any)?.metadata?.is_primary) {
              await apiUpdateAddress(other.id!, { metadata: { ...(other as any).metadata, is_primary: false } } as any)
            }
          }
        } catch {}
      }
      if ((resp as any)?.customer) {
        me = (resp as any).customer
      } else {
        me = await getCurrentCustomer()
      }
      showToast('Address updated', { type: 'success' })
      editing = false
      try { dispatch('updated'); } catch {}
    } catch {
      showToast('Failed to update address', { type: 'error' })
    }
  }

  async function onDelete() {
    try {
      await apiDeleteAddress(a.id!)
      me = await getCurrentCustomer()
      showToast('Address removed', { type: 'success' })
      try { dispatch('deleted'); } catch {}
    } catch {}
  }
</script>

<div class="rounded-xl border border-base-300 p-3 flex items-start justify-between gap-3">
  {#if !editing}
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
    <div class="flex gap-2">
      <Button variant="ghost" size="icon" class="rounded-md" aria-label="Edit address" title="Edit" onclick={startEdit}>
        <Pencil class="size-4" />
      </Button>
      <Button variant="secondary" size="icon" class="rounded-md" aria-label="Delete address" title="Delete" onclick={onDelete}>
        <Trash2 class="size-4" />
      </Button>
    </div>
  {:else}
    <Motion
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, easing: 'easeOut' }}
      let:motion
    >
      <form use:motion class="w-full grid gap-2 md:grid-cols-2" on:submit|preventDefault={onSave}>
        <input class="input input-bordered input-primary" placeholder="First name" bind:value={local.first_name} />
        <input class="input input-bordered input-primary" placeholder="Last name" bind:value={local.last_name} />
        <input class="input input-bordered input-primary md:col-span-2" placeholder="Address 1" bind:value={local.address_1} />
        <input class="input input-bordered input-primary md:col-span-2" placeholder="Address 2" bind:value={local.address_2} />
        <input class="input input-bordered input-primary" placeholder="City" bind:value={local.city} />
        <select class="select select-bordered" bind:value={local.province}>
          <option value="" disabled>Select state</option>
          {#each US_STATES as s}
            <option value={s.code}>{s.name}</option>
          {/each}
        </select>
        <input class="input input-bordered input-primary" placeholder="Postal code" bind:value={local.postal_code} />
        <input class="input input-bordered input-primary opacity-100 bg-base-200/60 dark:bg-base-300/20 dark:text-base-content/80" placeholder="US" bind:value={local.country_code} disabled />
        <input class="input input-bordered input-primary md:col-span-2" placeholder="Phone" bind:value={(local as any).phone} />
        <label class="label cursor-pointer gap-2 md:col-span-2">
          <input class="checkbox checkbox-primary" type="checkbox" bind:checked={isPrimary} />
          <span class="label-text">Set as default shipping address</span>
        </label>
        <div class="md:col-span-2 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" type="button" onclick={() => editing = false}>Cancel</Button>
          <Button variant="default" size="sm" type="button" onclick={onSave}>Save</Button>
        </div>
      </form>
    </Motion>
  {/if}
</div>

