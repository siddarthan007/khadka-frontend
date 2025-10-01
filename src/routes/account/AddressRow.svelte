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

<div class="card border-2 border-base-300/50 bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
	{#if !editing}
		<div class="card-body p-5">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0 flex-1 space-y-2">
					<div class="flex items-center gap-2 flex-wrap">
						<div class="truncate font-bold text-lg">
							{(a as any).address_name || `${a.first_name} ${a.last_name}`}
						</div>
						{#if (a as any).is_default_shipping}
							<span
								class="badge badge-primary badge-sm px-3 py-2.5 rounded-full text-xs font-semibold shadow-md"
							>
								<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								Default Shipping
							</span>
						{/if}
						{#if (a as any).is_default_billing}
							<span
								class="badge badge-secondary badge-sm px-3 py-2.5 rounded-full text-xs font-semibold shadow-md"
							>
								<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
								Default Billing
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2 text-sm text-base-content/70">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
						<span>
							{a.first_name}
							{a.last_name}
							{#if (a as any).company}
								• {(a as any).company}
							{/if}
						</span>
					</div>
					<div class="flex items-start gap-2 text-sm text-base-content/70">
						<svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
						<div>
							<div>{a.address_1}</div>
							{#if a.address_2}<div>{a.address_2}</div>{/if}
							<div>{a.city}, {a.province} {a.postal_code}</div>
							<div>{a.country_code}</div>
						</div>
					</div>
					{#if (a as any).phone}
						<div class="flex items-center gap-2 text-sm text-base-content/70">
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
							<span>{(a as any).phone}</span>
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button
						variant="ghost"
						size="icon"
						class="rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300"
						aria-label="Edit address"
						title="Edit"
						onclick={startEdit}
					>
						<Pencil class="size-4" />
					</Button>
					<Button
						variant="secondary"
						size="icon"
						class="rounded-xl hover:bg-error/10 hover:text-error transition-all duration-300"
						aria-label="Delete address"
						title="Delete"
						onclick={onDelete}
					>
						<Trash2 class="size-4" />
					</Button>
				</div>
			</div>
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
				class="card-body grid w-full gap-4 md:grid-cols-2 p-6"
				onsubmit={(e) => {
					e.preventDefault();
					onSave();
				}}
			>
				<div class="md:col-span-2">
					<label for="address-name-{a.id}" class="label">
						<span class="label-text font-semibold">Address Label</span>
					</label>
					<input
						id="address-name-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Address name (optional)"
						bind:value={local.address_name}
					/>
				</div>
				<div>
					<label for="first-name-{a.id}" class="label">
						<span class="label-text font-semibold">First Name</span>
					</label>
					<input
						id="first-name-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="First name"
						bind:value={local.first_name}
					/>
				</div>
				<div>
					<label for="last-name-{a.id}" class="label">
						<span class="label-text font-semibold">Last Name</span>
					</label>
					<input
						id="last-name-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Last name"
						bind:value={local.last_name}
					/>
				</div>
				<div class="md:col-span-2">
					<label for="company-{a.id}" class="label">
						<span class="label-text font-semibold">Company</span>
					</label>
					<input
						id="company-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Company (optional)"
						bind:value={local.company}
					/>
				</div>
				<div class="md:col-span-2">
					<label for="address1-{a.id}" class="label">
						<span class="label-text font-semibold">Street Address</span>
					</label>
					<input
						id="address1-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Address line 1"
						bind:value={local.address_1}
					/>
				</div>
				<div class="md:col-span-2">
					<input
						id="address2-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Address line 2 (optional)"
						bind:value={local.address_2}
					/>
				</div>
				<div>
					<label for="city-{a.id}" class="label">
						<span class="label-text font-semibold">City</span>
					</label>
					<input
						id="city-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="City"
						bind:value={local.city}
					/>
				</div>
				<div>
					<label for="province-{a.id}" class="label">
						<span class="label-text font-semibold">State</span>
					</label>
					<select id="province-{a.id}" class="select select-bordered select-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" bind:value={local.province}>
						<option value="" disabled>Select state</option>
						{#each US_STATES as s}
							<option value={s.code}>{s.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="postal-{a.id}" class="label">
						<span class="label-text font-semibold">Postal Code</span>
					</label>
					<input
						id="postal-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Postal code"
						bind:value={local.postal_code}
					/>
				</div>
				<div>
					<label for="country-{a.id}" class="label">
						<span class="label-text font-semibold">Country</span>
					</label>
					<input
						id="country-{a.id}"
						class="input input-bordered w-full bg-base-200/50 rounded-xl"
						placeholder="US"
						bind:value={local.country_code}
						disabled
					/>
				</div>
				<div class="md:col-span-2">
					<label for="phone-{a.id}" class="label">
						<span class="label-text font-semibold">Phone</span>
					</label>
					<input
						id="phone-{a.id}"
						class="input input-bordered input-primary w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl"
						placeholder="Phone"
						bind:value={local.phone}
					/>
				</div>
				<label class="flex cursor-pointer items-center gap-3 md:col-span-2 p-4 rounded-xl bg-base-200/30 hover:bg-base-200/50 transition-colors border-2 border-transparent hover:border-primary/20">
					<input
						type="checkbox"
						class="checkbox checkbox-primary checkbox-lg"
						bind:checked={isDefaultShipping}
					/>
					<span class="label-text font-medium">Set as default shipping address</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3 md:col-span-2 p-4 rounded-xl bg-base-200/30 hover:bg-base-200/50 transition-colors border-2 border-transparent hover:border-primary/20">
					<input
						type="checkbox"
						class="checkbox checkbox-primary checkbox-lg"
						bind:checked={isDefaultBilling}
					/>
					<span class="label-text font-medium">Set as default billing address</span>
				</label>
				<div class="flex justify-end gap-3 md:col-span-2 pt-4">
					<Button variant="ghost" size="sm" type="button" class="rounded-xl" onclick={() => (editing = false)}>
						Cancel
					</Button>
					<Button variant="default" size="sm" type="button" class="rounded-xl shadow-md hover:shadow-lg transition-all" onclick={onSave}>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
						Save
					</Button>
				</div>
			</form>
		</Motion>
	{/if}
</div>
