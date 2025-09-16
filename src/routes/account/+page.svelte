<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { getCurrentCustomer, logout, updateProfile } from '$lib/auth';
	import { US_STATES, normalizeUSPhone } from '$lib/us';
	import {
		addAddress as apiAddAddress,
		updateAddress as apiUpdateAddress,
		deleteAddress as apiDeleteAddress,
		listAddresses
	} from '$lib/customer-api';
	import { customer as customerStore } from '$lib/stores/customer';
	import type { HttpTypes } from '@medusajs/types';
	import { getStoreClient } from '$lib/medusa';
	import { showToast } from '$lib/stores/toast';
	import AddressRow from './AddressRow.svelte';

	let me: HttpTypes.StoreCustomer | null = $state(null);
	let loading: boolean = $state(true);
	let saving: boolean = $state(false);
	let errorMsg: string | null = $state(null);
	let profileSaving: boolean = $state(false);

	let address = $state({
		first_name: '',
		last_name: '',
		address_1: '',
		address_2: '',
		city: '',
		country_code: 'US',
		province: '',
		postal_code: '',
		phone: '',
		company: '',
		address_name: ''
	});

	async function refreshAddresses() {
		const sdkMe = await getCurrentCustomer();
		me = sdkMe;
		try {
			const list = await listAddresses().catch(() => null);
			const addresses = (list as any)?.addresses;
			if (me && Array.isArray(addresses)) {
				(me as any).shipping_addresses = addresses;
			}
		} catch {}
	}

	onMount(async () => {
		await refreshAddresses();
		loading = false;
		if (!me) {
			await goto('/login');
			return;
		}
	});

	async function addAddress() {
		if (!me) return;
		saving = true;
		try {
			const resp = await apiAddAddress({ ...address, country_code: 'US' });
			if ((resp as any)?.customer) me = (resp as any).customer;
			await refreshAddresses();
			address = {
				first_name: '',
				last_name: '',
				address_1: '',
				address_2: '',
				city: '',
				country_code: 'US',
				province: '',
				postal_code: '',
				phone: '',
				company: '',
				address_name: ''
			};
			showToast('Address added', { type: 'success' });
		} catch (e) {
			errorMsg = 'Failed to save address';
			showToast('Failed to save address', { type: 'error' });
		} finally {
			saving = false;
		}
	}

	async function removeAddress(id: string) {
		await apiDeleteAddress(id).catch(() => {});
		me = await getCurrentCustomer();
		showToast('Address removed', { type: 'success' });
	}

	async function onLogout() {
		await logout();
		await goto('/login');
	}

	async function saveProfile() {
		if (!me) return;
		profileSaving = true;
		const updated = await updateProfile({
			first_name: me.first_name ?? undefined,
			last_name: me.last_name ?? undefined,
			phone: normalizeUSPhone(me.phone || '')
		});
		profileSaving = false;
		if (updated) {
			me = updated;
			showToast('Profile updated', { type: 'success' });
		} else {
			showToast('Failed to update profile', { type: 'error' });
		}
	}
</script>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		{#if loading}
			<div class="flex items-center justify-center py-16">
				<div class="loading loading-lg loading-spinner text-primary"></div>
			</div>
		{:else if !me}
			<div class="p-10 text-center">Redirecting…</div>
		{:else}
			<div class="flex flex-col items-start gap-6 md:flex-row">
				<div class="w-full space-y-4 md:w-2/3">
					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<div class="card-body space-y-3">
							<div class="flex items-center justify-between">
								<h2 class="card-title">Profile</h2>
								<Button class="btn btn-sm btn-primary" onclick={onLogout}>Logout</Button>
							</div>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
								<label class="form-control">
									<div class="label"><span class="label-text">First name</span></div>
									<input class="input-bordered input input-primary" bind:value={me.first_name} />
								</label>
								<label class="form-control">
									<div class="label"><span class="label-text">Last name</span></div>
									<input class="input-bordered input input-primary" bind:value={me.last_name} />
								</label>
							</div>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
								<label class="form-control">
									<div class="label"><span class="label-text">Email</span></div>
									<input class="input-bordered input" value={me.email} readonly />
								</label>
								<label class="form-control">
									<div class="label"><span class="label-text">Mobile</span></div>
									<input
										class="input-bordered input input-primary"
										bind:value={me.phone}
										placeholder="(555) 555-5555"
									/>
								</label>
							</div>
							<div>
								<Button
									class={'btn btn-primary ' + (profileSaving ? 'loading' : '')}
									disabled={profileSaving}
									onclick={saveProfile}>Save profile</Button
								>
							</div>
						</div>
					</div>

					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<div class="card-body space-y-3">
							<h2 class="card-title">Saved addresses</h2>
							<div class="grid gap-3">
								{#each (me as any).shipping_addresses ?? [] as a (a.id)}
									<AddressRow
										bind:me
										{a}
										on:updated={refreshAddresses}
										on:deleted={refreshAddresses}
									/>
								{/each}
								{#if ((me as any).shipping_addresses ?? []).length === 0}
									<div class="text-sm opacity-70">No saved addresses yet.</div>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="w-full md:w-1/3">
					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<form
							class="card-body space-y-3"
							onsubmit={(e) => {
								e.preventDefault();
								addAddress();
							}}
						>
							<h2 class="card-title">Add address</h2>
							{#if errorMsg}
								<div class="alert alert-error"><span>{errorMsg}</span></div>
							{/if}
							<input
								class="input-bordered input w-full input-primary"
								placeholder="Address name (optional)"
								bind:value={address.address_name}
							/>
							<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
								<input
									class="input-bordered input input-primary"
									placeholder="First name"
									bind:value={address.first_name}
								/>
								<input
									class="input-bordered input input-primary"
									placeholder="Last name"
									bind:value={address.last_name}
								/>
							</div>
							<input
								class="input-bordered input w-full input-primary"
								placeholder="Company (optional)"
								bind:value={address.company}
							/>
							<input
								class="input-bordered input w-full input-primary"
								placeholder="Address 1"
								bind:value={address.address_1}
							/>
							<input
								class="input-bordered input w-full input-primary"
								placeholder="Address 2"
								bind:value={address.address_2}
							/>
							<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
								<input
									class="input-bordered input input-primary"
									placeholder="City"
									bind:value={address.city}
								/>
								<select class="select-bordered select" bind:value={address.province}>
									<option value="" disabled>Select state</option>
									{#each US_STATES as s}
										<option value={s.code}>{s.name}</option>
									{/each}
								</select>
							</div>
							<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
								<input
									class="input-bordered input input-primary"
									placeholder="Postal code"
									bind:value={address.postal_code}
								/>
								<input
									class="input-bordered input bg-base-200/60 opacity-100 input-primary dark:bg-base-300/20 dark:text-base-content/80"
									placeholder="US"
									bind:value={address.country_code}
									disabled
								/>
							</div>
							<input
								class="input-bordered input w-full input-primary"
								placeholder="Phone"
								bind:value={address.phone}
							/>
							<Button
								class={'btn btn-primary ' + (saving ? 'loading' : '')}
								disabled={saving}
								type="submit">Save address</Button
							>
						</form>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
