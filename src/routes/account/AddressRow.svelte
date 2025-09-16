<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { US_STATES } from '$lib/us';
	import {
		updateAddress as apiUpdateAddress,
		deleteAddress as apiDeleteAddress,
		listAddresses
	} from '$lib/customer-api';
	import { showToast } from '$lib/stores/toast';
	import type { HttpTypes } from '@medusajs/types';
	import { Motion } from 'svelte-motion';
	import { getCurrentCustomer } from '$lib/auth';
	import { createEventDispatcher } from 'svelte';
	import { Pencil, Trash2 } from '@lucide/svelte';

	const dispatch = createEventDispatcher<{ updated: void; deleted: void }>();

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
			phone: (a as any).phone || '',
			company: (a as any).company || '',
			address_name: (a as any).address_name || ''
		};
		isDefaultShipping = !!(a as any).is_default_shipping;
		isDefaultBilling = !!(a as any).is_default_billing;
		editing = true;
	}

	let {
		a,
		me = $bindable()
	}: { a: HttpTypes.StoreCustomerAddress; me: HttpTypes.StoreCustomer | null } = $props();

	let editing: boolean = $state(false);
	let local = $state({
		first_name: a.first_name || '',
		last_name: a.last_name || '',
		address_1: a.address_1 || '',
		address_2: a.address_2 || '',
		city: a.city || '',
		province: a.province || '',
		postal_code: a.postal_code || '',
		country_code: a.country_code || 'US',
		phone: (a as any).phone || '',
		company: (a as any).company || '',
		address_name: (a as any).address_name || ''
	});
	let isDefaultShipping: boolean = $state(!!(a as any).is_default_shipping);
	let isDefaultBilling: boolean = $state(!!(a as any).is_default_billing);

	async function onSave() {
		try {
			const payload: any = {
				...local,
				country_code: 'US',
				is_default_shipping: !!isDefaultShipping,
				is_default_billing: !!isDefaultBilling
			};
			const resp = await apiUpdateAddress(a.id!, payload);

			// Handle default shipping address logic
			if (isDefaultShipping) {
				try {
					const list = await listAddresses();
					const addresses = (list as any)?.addresses ?? [];
					for (const other of addresses) {
						if (other?.id !== a.id && (other as any)?.is_default_shipping) {
							await apiUpdateAddress(other.id!, { is_default_shipping: false } as any);
						}
					}
				} catch {}
			}

			// Handle default billing address logic
			if (isDefaultBilling) {
				try {
					const list = await listAddresses();
					const addresses = (list as any)?.addresses ?? [];
					for (const other of addresses) {
						if (other?.id !== a.id && (other as any)?.is_default_billing) {
							await apiUpdateAddress(other.id!, { is_default_billing: false } as any);
						}
					}
				} catch {}
			}

			if ((resp as any)?.customer) {
				me = (resp as any).customer;
			} else {
				me = await getCurrentCustomer();
			}
			showToast('Address updated', { type: 'success' });
			editing = false;
			try {
				dispatch('updated');
			} catch {}
		} catch {
			showToast('Failed to update address', { type: 'error' });
		}
	}

	async function onDelete() {
		try {
			await apiDeleteAddress(a.id!);
			me = await getCurrentCustomer();
			showToast('Address removed', { type: 'success' });
			try {
				dispatch('deleted');
			} catch {}
		} catch {}
	}
</script>

<div class="flex items-start justify-between gap-3 rounded-xl border border-base-300 p-3">
	{#if !editing}
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<div class="truncate font-medium">
					{(a as any).address_name || `${a.first_name} ${a.last_name}`}
				</div>
				{#if (a as any).is_default_shipping}
					<span
						class="badge rounded-full badge-sm px-2.5 py-0.5 text-primary-content shadow badge-primary"
					>
						Default Shipping
					</span>
				{/if}
				{#if (a as any).is_default_billing}
					<span
						class="badge rounded-full badge-sm px-2.5 py-0.5 text-secondary-content shadow badge-secondary"
					>
						Default Billing
					</span>
				{/if}
			</div>
			<div class="truncate text-sm opacity-70">
				{a.first_name}
				{a.last_name}
				{#if (a as any).company}
					({(a as any).company})
				{/if}
			</div>
			<div class="truncate text-sm opacity-70">
				{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}
			</div>
			<div class="truncate text-sm opacity-70">
				{a.province}, {a.postal_code}, {a.country_code}
			</div>
			{#if (a as any).phone}
				<div class="truncate text-sm opacity-70">{(a as any).phone}</div>
			{/if}
		</div>
		<div class="flex gap-2">
			<Button
				variant="ghost"
				size="icon"
				class="rounded-md"
				aria-label="Edit address"
				title="Edit"
				onclick={startEdit}
			>
				<Pencil class="size-4" />
			</Button>
			<Button
				variant="secondary"
				size="icon"
				class="rounded-md"
				aria-label="Delete address"
				title="Delete"
				onclick={onDelete}
			>
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
			<form
				use:motion
				class="grid w-full gap-3 md:grid-cols-2"
				onsubmit={(e) => {
					e.preventDefault();
					onSave();
				}}
			>
				<input
					class="input-bordered input input-primary"
					placeholder="Address name (optional)"
					bind:value={local.address_name}
				/>
				<div></div>
				<input
					class="input-bordered input input-primary"
					placeholder="First name"
					bind:value={local.first_name}
				/>
				<input
					class="input-bordered input input-primary"
					placeholder="Last name"
					bind:value={local.last_name}
				/>
				<input
					class="input-bordered input input-primary"
					placeholder="Company (optional)"
					bind:value={local.company}
				/>
				<div></div>
				<input
					class="input-bordered input w-full input-primary md:col-span-2"
					placeholder="Address 1"
					bind:value={local.address_1}
				/>
				<input
					class="input-bordered input w-full input-primary md:col-span-2"
					placeholder="Address 2"
					bind:value={local.address_2}
				/>
				<input
					class="input-bordered input input-primary"
					placeholder="City"
					bind:value={local.city}
				/>
				<select class="select-bordered select" bind:value={local.province}>
					<option value="" disabled>Select state</option>
					{#each US_STATES as s}
						<option value={s.code}>{s.name}</option>
					{/each}
				</select>
				<input
					class="input-bordered input input-primary"
					placeholder="Postal code"
					bind:value={local.postal_code}
				/>
				<input
					class="input-bordered input bg-base-200/60 opacity-100 input-primary dark:bg-base-300/20 dark:text-base-content/80"
					placeholder="US"
					bind:value={local.country_code}
					disabled
				/>
				<input
					class="input-bordered input w-full input-primary md:col-span-2"
					placeholder="Phone"
					bind:value={local.phone}
				/>
				<label class="flex cursor-pointer items-center gap-2 md:col-span-2">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={isDefaultShipping}
					/>
					<span class="label-text">Set as default shipping address</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2 md:col-span-2">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={isDefaultBilling}
					/>
					<span class="label-text">Set as default billing address</span>
				</label>
				<div class="flex justify-end gap-2 md:col-span-2">
					<Button variant="ghost" size="sm" type="button" onclick={() => (editing = false)}>
						Cancel
					</Button>
					<Button variant="default" size="sm" type="button" onclick={onSave}>Save</Button>
				</div>
			</form>
		</Motion>
	{/if}
</div>
