<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { Button } from '$lib/components/ui/button';
import { getCurrentCustomer, logout, updateProfile } from '$lib/auth';
import { US_STATES, normalizeUSPhone } from '$lib/us';
import { addAddress as apiAddAddress, deleteAddress as apiDeleteAddress, listAddresses, listOrders, retrieveOrder } from '$lib/customer-api';
import type { HttpTypes } from '@medusajs/types';
import { getStoreClient } from '$lib/medusa';
import { ensureCart, addLine } from '$lib/cart';
import { showToast } from '$lib/stores/toast';
import AddressRow from './AddressRow.svelte';
import { Tabs, Accordion } from 'bits-ui';
import OrderCard from '$lib/components/OrderCard.svelte';

let me: HttpTypes.StoreCustomer | null = $state(null);
let loading = $state(true);
let saving = $state(false);
let errorMsg: string | null = $state(null);
let profileSaving = $state(false);
let activeTab = $state('account');
let orders: HttpTypes.StoreOrder[] = $state([]);
let ordersLoading = $state(false);

const tabs = [
	{ title: 'Account', key: 'account' },
	{ title: 'Orders', key: 'orders' }
];

let address = $state({
	first_name: '', last_name: '', address_1: '', address_2: '', city: '', country_code: 'US', province: '', postal_code: '', phone: '', company: '', address_name: ''
});

function setActiveTab(tab: string) {
	if (tab === activeTab) return;
	activeTab = tab;
	const url = new URL($page.url);
	url.searchParams.set('page', tab);
	goto(url.pathname + '?' + url.searchParams.toString(), { replaceState: true, noScroll: true });
	if (tab === 'orders') loadOrders();
}

function canCancelOrder(order: any) {
	if (order.status === 'cancelled' || order.status === 'canceled' || order.status === 'completed') return false;
	const fs = order.fulfillment_status;
	if (['shipped','delivered','fulfilled'].includes(fs)) return false;
	if (order.fulfillments?.some((f: any) => f.shipped_at || ['shipped','delivered'].includes(f.status))) return false;
	return true;
}

async function hydrateOrder(id: string) {
	const index = orders.findIndex(o => o.id === id);
	if (index === -1 || (orders[index] as any).__hydrated_full) return;
	try {
		const full = await retrieveOrder(id);
		if (full?.order) {
			orders[index] = { ...orders[index], ...full.order, __hydrated_full: true } as any;
		}
	} catch (e) { console.warn('hydrateOrder failed', e); }
}

async function reorder(orderId: string) {
	try {
		const sdk = getStoreClient() as any; if (!sdk) return;
		const { order } = await sdk.store.order.retrieve(orderId, { fields: 'id,*items' });
		if (!order?.items?.length) {
			showToast('No items to reorder', { type: 'info' });
			return;
		}
		await ensureCart();
		for (const i of order.items) {
			if (!i?.variant_id || !i?.quantity) continue;
			try { await addLine(i.variant_id, i.quantity); } catch {}
		}
		showToast('Order items added to cart', { type: 'success' });
		goto('/cart');
	} catch (e:any) {
		showToast('Failed to reorder items', { type: 'error' });
	}
}

async function cancelOrder(orderId: string) {
	try {
		const res = await fetch('/api/orders/cancel', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ order_id: orderId, email: me?.email })
		});
		if (!res.ok) throw new Error(await res.text());
		const data = await res.json();
		showToast('Order canceled', { type:'success' });
		await loadOrders();
	} catch(e:any){
		showToast(e?.message || 'Failed to cancel order', { type:'error' });
	}
}

async function refreshAddresses() {
	me = await getCurrentCustomer();
	if (!me) return;
	try {
		const list = await listAddresses();
		const addresses = (list as any)?.addresses;
		if (Array.isArray(addresses)) (me as any).shipping_addresses = addresses;
	} catch(e){ console.error(e); }
}

async function loadOrders() {
	ordersLoading = true;
	try {
		const r = await listOrders();
		orders = (r as any)?.orders || [];
		for (const o of orders.slice(0,8)) hydrateOrder(o.id);
	} catch(e:any){
		const status = e?.response?.status ?? e?.status;
		if (status === 401) showToast('Please sign in again to view your orders',{type:'info'});
	} finally { ordersLoading = false; }
}

onMount(async () => {
	const initial = $page.url.searchParams.get('page');
	if (initial && ['account','orders'].includes(initial)) activeTab = initial;

	// Handle OAuth success message
	const auth = $page.url.searchParams.get('auth');
	const provider = $page.url.searchParams.get('provider');
	if (auth === 'success' && provider === 'google') {
		showToast('Successfully signed in with Google!', { type: 'success' });
		// Clean up URL
		const url = new URL($page.url);
		url.searchParams.delete('auth');
		url.searchParams.delete('provider');
		goto(url.pathname + url.search, { replaceState: true });
	}

	await refreshAddresses();
	await loadOrders();
	loading = false;
	if (!me) goto('/login');
});

async function addAddress() {
	if (!me) return; saving = true;
	try {
		await apiAddAddress({ ...address, country_code: 'US' });
		await refreshAddresses();
		address = { first_name:'', last_name:'', address_1:'', address_2:'', city:'', country_code:'US', province:'', postal_code:'', phone:'', company:'', address_name:'' };
		showToast('Address added',{type:'success'});
	} catch { errorMsg='Failed to save address'; showToast('Failed to save address',{type:'error'}); }
	finally { saving = false; }
}

async function removeAddress(id: string){ await apiDeleteAddress(id).catch(()=>{}); await refreshAddresses(); showToast('Address removed',{type:'success'}); }
async function onLogout(){ await logout(); goto('/login'); }
async function saveProfile(){ if(!me) return; profileSaving=true; const updated= await updateProfile({ first_name: me.first_name??undefined, last_name: me.last_name??undefined, phone: normalizeUSPhone(me.phone||'') }); profileSaving=false; if(updated){ me=updated; showToast('Profile updated',{type:'success'});} else showToast('Failed to update profile',{type:'error'}); }
</script>

<svelte:head>
	<title>My Account • KhadkaFoods - Manage Your Profile & Orders</title>
	<meta name="description" content="Manage your KhadkaFoods account. View your order history, update your profile, manage addresses, and track your deliveries." />
	<meta name="keywords" content="account, profile, orders, addresses, customer account, order history, account management" />
	<meta name="robots" content="noindex, nofollow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="My Account • KhadkaFoods - Manage Your Profile & Orders" />
	<meta property="og:description" content="Manage your KhadkaFoods account. View your order history, update your profile, and manage addresses." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/account" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="My Account • KhadkaFoods - Manage Your Profile & Orders" />
	<meta name="twitter:description" content="Manage your KhadkaFoods account. View your order history, update your profile, and manage addresses." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/account" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
		{#if loading}
			<div class="flex items-center justify-center py-16"><div class="loading loading-lg loading-spinner text-primary"></div></div>
		{:else if !me}
			<div class="p-10 text-center">Redirecting…</div>
		{:else}
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<h1 class="text-3xl font-bold">My Account</h1>
					<Button class="btn btn-outline btn-sm" onclick={onLogout}>Logout</Button>
				</div>
				<Tabs.Root bind:value={activeTab} class="w-full">
					<Tabs.List class="flex gap-2 border-b border-base-300 mb-4">
						{#each tabs as t}
							<Tabs.Trigger value={t.key} class="relative px-4 py-2 text-sm font-medium focus-visible:outline-none data-[state=inactive]:text-base-content/60 data-[state=active]:text-base-content">
								<span>{t.title}</span>
								<span class="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-primary rounded-full scale-x-0 origin-center transition-transform data-[state=active]:scale-x-100"></span>
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
				</Tabs.Root>

				{#if activeTab === 'account'}
					<div class="flex flex-col items-start gap-6 md:flex-row">
						<div class="w-full space-y-4 md:w-2/3">
							<div class="card border border-base-300 bg-base-100 shadow-sm">
								<div class="card-body space-y-4">
									<h2 class="card-title">Profile</h2>
									<div class="grid gap-4 md:grid-cols-2">
										<label class="form-control"><div class="label"><span class="label-text">First name</span></div><input class="input input-primary input-bordered" bind:value={me.first_name} /></label>
										<label class="form-control"><div class="label"><span class="label-text">Last name</span></div><input class="input input-primary input-bordered" bind:value={me.last_name} /></label>
									</div>
									<div class="grid gap-4 md:grid-cols-2">
										<label class="form-control"><div class="label"><span class="label-text">Email</span></div><input class="input input-bordered" value={me.email} readonly /></label>
										<label class="form-control"><div class="label"><span class="label-text">Mobile</span></div><input class="input input-primary input-bordered" bind:value={me.phone} placeholder="(555) 555-5555" /></label>
									</div>
									<div>
										<Button class={'btn btn-primary ' + (profileSaving ? 'loading':'')} disabled={profileSaving} onclick={saveProfile}>Save profile</Button>
									</div>
								</div>
							</div>

							<div class="card border border-base-300 bg-base-100 shadow-sm">
								<div class="card-body space-y-3">
									<h2 class="card-title">Saved addresses</h2>
									<div class="space-y-3">
										{#each (me as any).shipping_addresses ?? [] as a (a.id)}
											<AddressRow bind:me {a} on:updated={refreshAddresses} on:deleted={refreshAddresses} />
										{/each}
										{#if ((me as any).shipping_addresses ?? []).length === 0}
											<div class="text-sm opacity-60">No saved addresses yet.</div>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<div class="w-full md:w-1/3">
							<div class="card border border-base-300 bg-base-100 shadow-sm">
								<form class="card-body space-y-3" onsubmit={(e)=>{ e.preventDefault(); addAddress(); }}>
									<h2 class="card-title">Add address</h2>
									{#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div>{/if}
									<input class="input input-primary input-bordered w-full" placeholder="Address name (optional)" bind:value={address.address_name} />
									<div class="grid gap-2 md:grid-cols-2">
										<input class="input input-primary input-bordered" placeholder="First name" bind:value={address.first_name} />
										<input class="input input-primary input-bordered" placeholder="Last name" bind:value={address.last_name} />
									</div>
									<input class="input input-primary input-bordered w-full" placeholder="Company (optional)" bind:value={address.company} />
									<input class="input input-primary input-bordered w-full" placeholder="Address 1" bind:value={address.address_1} />
									<input class="input input-primary input-bordered w-full" placeholder="Address 2" bind:value={address.address_2} />
									<div class="grid gap-2 md:grid-cols-2">
										<input class="input input-primary input-bordered" placeholder="City" bind:value={address.city} />
										<select class="select select-bordered" bind:value={address.province}>
											<option value="" disabled>Select state</option>
											{#each US_STATES as s}<option value={s.code}>{s.name}</option>{/each}
										</select>
									</div>
									<div class="grid gap-2 md:grid-cols-2">
										<input class="input input-primary input-bordered" placeholder="Postal code" bind:value={address.postal_code} />
										<input class="input input-primary input-bordered bg-base-200/60 dark:bg-base-300/30" placeholder="US" bind:value={address.country_code} disabled />
									</div>
										<input class="input input-primary input-bordered w-full" placeholder="Phone" bind:value={address.phone} />
									<Button class={'btn btn-primary ' + (saving ? 'loading':'')} disabled={saving} type="submit">Save address</Button>
								</form>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'orders'}
					<div class="space-y-4">
						{#if ordersLoading}
							<div class="flex items-center justify-center py-16"><div class="loading loading-lg loading-spinner text-primary"></div></div>
						{:else if orders.length === 0}
							<div class="py-16 text-center"><div class="text-lg opacity-70">No orders found</div><div class="mt-2 text-sm opacity-50">Your order history will appear here</div></div>
						{:else}
							<Accordion.Root type="multiple" class="flex flex-col gap-4">
								{#each orders as order (order.id)}
									<OrderCard {order} customerEmail={me?.email || null} canCancel={canCancelOrder} onCancel={cancelOrder} hydrate={hydrateOrder} reorder={reorder} />
								{/each}
							</Accordion.Root>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
