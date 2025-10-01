<script lang="ts">
import { onMount } from 'svelte';
import SEO from '$lib/components/SEO.svelte';
import EmptyState from '$lib/components/EmptyState.svelte';
import VirtualScroll from '$lib/components/VirtualScroll.svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { Button } from '$lib/components/ui/button';
import { logger } from '$lib/logger';
import { getCurrentCustomer, logout, updateProfile } from '$lib/auth';
import { isValidEmail, sanitizeInput } from '$lib/security';
import { US_STATES, normalizeUSPhone } from '$lib/us';
import { addAddress as apiAddAddress, deleteAddress as apiDeleteAddress, listAddresses, listOrders, retrieveOrder } from '$lib/customer-api';
import type { HttpTypes } from '@medusajs/types';
import { getStoreClient } from '$lib/medusa';
import { ensureCart, addLine } from '$lib/cart';
import { showToast } from '$lib/stores/toast';
import AddressRow from './AddressRow.svelte';
import { Tabs, Accordion } from 'bits-ui';
import OrderCard from '$lib/components/OrderCard.svelte';

// VirtualScroll threshold - use virtual scrolling for performance when user has many orders
const VIRTUAL_SCROLL_THRESHOLD = 20;

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
	} catch (e) { logger.warn('hydrateOrder failed', e); }
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
	} catch(e){ logger.error(e); }
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

<SEO
	title="My Account - KhadkaFoods"
	description="Manage your KhadkaFoods account, view orders, and update your profile information."
	keywords={['account', 'profile', 'orders', 'my account', 'KhadkaFoods']}
	canonical="https://khadkafoods.com/account"
/>

<section class="w-full min-h-screen py-12">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
		{#if loading}
			<div class="flex items-center justify-center py-20">
				<div class="loading loading-lg loading-spinner text-primary"></div>
			</div>
		{:else if !me}
			<div class="p-10 text-center">Redirecting…</div>
		{:else}
			<div class="space-y-8">
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1 class="text-4xl font-extrabold tracking-tight text-primary">My Account</h1>
						<p class="mt-2 text-base-content/60">Manage your profile, addresses, and orders</p>
					</div>
					<Button class="btn btn-success rounded-xl shadow-md hover:shadow-lg transition-all duration-300" onclick={onLogout}>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
						Logout
					</Button>
				</div>
				<Tabs.Root bind:value={activeTab} class="w-full">
					<Tabs.List class="flex gap-2 border-b-2 border-base-300/50 mb-6 bg-base-100/50 rounded-t-2xl p-2 backdrop-blur-sm">
						{#each tabs as t}
							<Tabs.Trigger 
								value={t.key} 
								class="relative px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 focus-visible:outline-none data-[state=inactive]:text-base-content/60 data-[state=active]:text-base-content data-[state=active]:bg-primary/10 hover:bg-base-200/50"
							>
								<span>{t.title}</span>
								<span class="absolute left-0 right-0 -bottom-[10px] h-1 bg-primary rounded-full scale-x-0 origin-center transition-transform data-[state=active]:scale-x-100"></span>
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
				</Tabs.Root>

				{#if activeTab === 'account'}
					<div class="flex flex-col items-start gap-8 md:flex-row">
						<div class="w-full space-y-6 md:w-2/3">
							<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
								<div class="card-body space-y-5 p-6">
									<h2 class="card-title text-2xl font-bold flex items-center gap-2">
										<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
										Profile Information
									</h2>
									<div class="grid gap-5 md:grid-cols-2">
										<label class="form-control">
											<div class="label"><span class="label-text font-semibold">First name</span></div>
											<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" bind:value={me.first_name} />
										</label>
										<label class="form-control">
											<div class="label"><span class="label-text font-semibold">Last name</span></div>
											<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" bind:value={me.last_name} />
										</label>
									</div>
									<div class="grid gap-5 md:grid-cols-2">
										<label class="form-control">
											<div class="label"><span class="label-text font-semibold">Email</span></div>
											<input class="input input-bordered bg-base-200/50 dark:bg-base-300/80 dark:text-base-content text-base-content/80 rounded-xl" value={me.email} readonly />
										</label>
										<label class="form-control">
											<div class="label"><span class="label-text font-semibold">Mobile</span></div>
											<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" bind:value={me.phone} placeholder="(555) 555-5555" />
										</label>
									</div>
									<div>
										<Button class={'btn btn-primary rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ' + (profileSaving ? 'loading':'')} disabled={profileSaving} onclick={saveProfile}>
											{#if profileSaving}
												<span class="loading loading-spinner"></span>
											{/if}
											Save profile
										</Button>
									</div>
								</div>
							</div>

							<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
								<div class="card-body space-y-4 p-6">
									<h2 class="card-title text-2xl font-bold flex items-center gap-2">
										<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
										Saved addresses
									</h2>
									<div class="space-y-3">
										{#each (me as any).shipping_addresses ?? [] as a (a.id)}
											<AddressRow bind:me {a} on:updated={refreshAddresses} on:deleted={refreshAddresses} />
										{/each}
										{#if ((me as any).shipping_addresses ?? []).length === 0}
											<div class="text-center py-8 text-base-content/60">
												<svg class="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
												No saved addresses yet.
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<div class="w-full md:w-1/3">
							<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl sticky top-24 rounded-3xl">
								<form class="card-body space-y-4 p-6" onsubmit={(e)=>{ e.preventDefault(); addAddress(); }}>
									<h2 class="card-title text-2xl font-bold flex items-center gap-2">
										<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
										Add Address
									</h2>
									{#if errorMsg}
										<div class="alert alert-error rounded-xl shadow-md">
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
											<span>{errorMsg}</span>
										</div>
									{/if}
									<input class="input input-primary input-bordered w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Address name (optional)" bind:value={address.address_name} />
									<div class="grid gap-3 md:grid-cols-2">
										<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="First name" bind:value={address.first_name} />
										<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Last name" bind:value={address.last_name} />
									</div>
									<input class="input input-primary input-bordered w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Company (optional)" bind:value={address.company} />
									<input class="input input-primary input-bordered w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Address 1" bind:value={address.address_1} />
									<input class="input input-primary input-bordered w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Address 2" bind:value={address.address_2} />
									<div class="grid gap-3 md:grid-cols-2">
										<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="City" bind:value={address.city} />
										<select class="select select-bordered select-primary bg-base-100 border-2 focus:border-primary transition-all rounded-xl" bind:value={address.province}>
											<option value="" disabled>Select state</option>
											{#each US_STATES as s}<option value={s.code}>{s.name}</option>{/each}
										</select>
									</div>
									<div class="grid gap-3 md:grid-cols-2">
										<input class="input input-primary input-bordered bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Postal code" bind:value={address.postal_code} />
										<input class="input input-primary input-bordered bg-base-200 dark:bg-base-300/80 rounded-xl disabled:bg-base-300 dark:disabled:bg-base-200/50 disabled:text-base-content dark:disabled:text-base-content disabled:opacity-70 dark:disabled:opacity-80" placeholder="US" bind:value={address.country_code} disabled />
									</div>
									<input class="input input-primary input-bordered w-full bg-base-100 border-2 focus:border-primary transition-all rounded-xl" placeholder="Phone" bind:value={address.phone} />
									<Button class={'btn btn-primary w-full rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ' + (saving ? 'loading':'')} disabled={saving} type="submit">
										{#if saving}
											<span class="loading loading-spinner"></span>
										{/if}
										Save address
									</Button>
								</form>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'orders'}
					<div class="space-y-6">
						{#if ordersLoading}
							<div class="flex items-center justify-center py-20">
								<div class="loading loading-lg loading-spinner text-primary"></div>
							</div>
						{:else if orders.length === 0}
							<EmptyState
								message="No orders found"
								icon="box"
								description="Your order history will appear here once you make your first purchase"
								actionText="Start Shopping"
								actionHref="/products"
								class="min-h-[500px]"/>
						{:else if orders.length > VIRTUAL_SCROLL_THRESHOLD}
							<!-- Use VirtualScroll for performance when user has many orders -->
							<div class="h-[800px] border-2 border-base-300/50 rounded-3xl overflow-hidden">
								<VirtualScroll
									items={orders}
									itemHeight={200}
									overscan={2}
									class="p-4"
								>
									{#snippet children(order: HttpTypes.StoreOrder)}
										<div class="mb-4">
											<Accordion.Root type="multiple">
												<OrderCard 
													{order} 
													customerEmail={me?.email || null} 
													canCancel={canCancelOrder} 
													onCancel={cancelOrder} 
													hydrate={hydrateOrder} 
													reorder={reorder} 
												/>
											</Accordion.Root>
										</div>
									{/snippet}
								</VirtualScroll>
							</div>
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
