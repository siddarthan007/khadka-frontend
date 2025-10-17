<script lang="ts">
	import { onMount } from "svelte";
	import SEO from "$lib/components/SEO.svelte";
	import { cart as cartStore } from "$lib/stores/cart";
	import { ensureCart, getCart, clearCart } from "$lib/cart";
	import { Button } from "$lib/components/ui/button";
	import { get } from "svelte/store";
	import { getCurrentCustomer } from "$lib/auth";
	import { listAddresses } from "$lib/customer-api";
	import { getStoreClient } from "$lib/medusa";
	import { showToast } from "$lib/stores/toast";
	import { US_STATES } from "$lib/us";
	import { isValidEmail, sanitizeInput } from "$lib/security";
	import type { HttpTypes } from "@medusajs/types";
	import { env as publicEnv } from "$env/dynamic/public";
	import { loadStripe } from "@stripe/stripe-js";
	import type { Appearance } from "@stripe/stripe-js";
	import StripePaymentElement from "$lib/components/StripePaymentElement.svelte";
	import { Motion, AnimateSharedLayout } from "svelte-motion";
	import { formatCurrency } from "$lib/utils";
	import { logger } from "$lib/logger";
	import { CheckCircle2, ShieldCheck } from "@lucide/svelte";
	import { createDialog, melt } from "@melt-ui/svelte";
	import {
		trackBeginCheckout,
		trackAddShippingInfo,
		trackAddPaymentInfo,
		trackPurchase,
		formatCartItemsForAnalytics,
		calculateCartValue,
	} from "$lib/utils/analytics";

	let email: string = $state("");
	let shipping = $state({
		first_name: "",
		last_name: "",
		address_1: "",
		address_2: "",
		city: "",
		country_code: "us",
		province: "",
		postal_code: "",
		phone: "",
		company: "",
		address_name: "",
	});
	let billingSameAsShipping: boolean = $state(true);
	let billing = $state({
		first_name: "",
		last_name: "",
		address_1: "",
		address_2: "",
		city: "",
		country_code: "us",
		province: "",
		postal_code: "",
		phone: "",
		company: "",
		address_name: "",
	});
	let loading: boolean = $state(false);
	let saveAddress: boolean = $state(true);
	let errorMsg: string | null = $state(null);
	let isGuestCheckout: boolean = $state(true);

	// Shipping options
	let shippingOptions: HttpTypes.StoreCartShippingOption[] = $state([]);
	let shippingOptionsLoading: boolean = $state(false);
	let selectedShippingOptionId: string | null = $state(null);
	let calculatedPrices: Record<string, number> = $state({});
	let calculationErrors: Record<string, string> = $state({});

	function getShippingDisplayAmount(
		opt: HttpTypes.StoreCartShippingOption,
	): number {
		// For calculated price types, use the calculatedPrices map
		if (opt.price_type === "calculated") {
			return calculatedPrices[opt.id] ?? 0;
		}
		// For flat price types, use amount
		return opt.amount ?? 0;
	}

	// Payment
	let stripePromise: Promise<any> | null = $state(null); // holds the promise from loadStripe
	let stripeInstance: any = $state(null); // resolved Stripe instance
	let elements: any = $state(null);
	let paymentElementRef: any = $state(null);
	let ready: boolean = $state(false);
	let paymentClientSecret: string | null = $state(null);
	let paymentLoading: boolean = $state(false);
	let paymentError: string | null = $state(null);
	let paymentReady: boolean = $state(false);
	const stripeProviderCache = new Map<string, string | null>();

	const {
		elements: {
			portalled: orderDialogPortalled,
			overlay: orderDialogOverlay,
			content: orderDialogContent,
			title: orderDialogTitle,
			description: orderDialogDescription,
		},
		states: { open: orderDialogOpen },
	} = createDialog({
		preventScroll: true,
		closeOnOutsideClick: false,
		escapeBehavior: "ignore",
		role: "alertdialog",
	});

	// Detect current theme for Stripe appearance
	function getStripeAppearance(): Appearance {
		const root =
			typeof document !== "undefined" ? document.documentElement : null;
		const isDark = Boolean(
			root?.classList.contains("dark") ||
				root?.dataset.theme === "dark" ||
				root?.getAttribute("data-theme") === "dark",
		);
		const prefersReducedMotion =
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
		const computed = root ? getComputedStyle(root) : null;

		const fallbackLight = {
			colorPrimary: "oklch(0.7 0.17 145)",
			colorPrimaryText: "oklch(0.984 0.003 247.858)",
			colorBackground: "oklch(1 0 0)",
			colorSurface: "oklch(1 0 0)",
			colorText: "oklch(0.129 0.042 264.695)",
			colorTextSecondary: "oklch(0.554 0.046 257.417)",
			colorTextPlaceholder: "oklch(0.704 0.04 256.788)",
			colorIcon: "oklch(0.704 0.04 256.788)",
			colorDanger: "oklch(0.577 0.245 27.325)",
			colorDangerText: "oklch(0.984 0.003 247.858)",
			colorSuccess: "oklch(0.7 0.17 145)",
			colorBorder: "oklch(0.929 0.013 255.508)",
			colorMuted: "oklch(0.968 0.007 247.896)",
			inputBackground: "oklch(1 0 0)",
			inputBorder: "oklch(0.929 0.013 255.508)",
			radius: "10px",
		};
		const fallbackDark = {
			colorPrimary: "oklch(0.75 0.17 145)",
			colorPrimaryText: "oklch(0.984 0.003 247.858)",
			colorBackground: "oklch(0.129 0.042 264.695)",
			colorSurface: "oklch(0.208 0.042 265.755)",
			colorText: "oklch(0.984 0.003 247.858)",
			colorTextSecondary: "oklch(0.704 0.04 256.788)",
			colorTextPlaceholder: "oklch(0.551 0.027 264.364)",
			colorIcon: "oklch(0.704 0.04 256.788)",
			colorDanger: "oklch(0.704 0.191 22.216)",
			colorDangerText: "oklch(0.984 0.003 247.858)",
			colorSuccess: "oklch(0.75 0.17 145)",
			colorBorder: "oklch(1 0 0 / 10%)",
			colorMuted: "oklch(0.279 0.041 260.031)",
			inputBackground: "oklch(1 0 0 / 15%)",
			inputBorder: "oklch(1 0 0 / 18%)",
			radius: "10px",
		};
		const fallbacks = isDark ? fallbackDark : fallbackLight;

		const readVar = (name: string, fallbackValue: string) =>
			computed?.getPropertyValue(name)?.trim() || fallbackValue;
		const withAlpha = (color: string, alpha: number) => {
			const normalized = color.trim();
			if (/oklch\([^\)]+\)/.test(normalized)) {
				return normalized.replace(/\)$/, ` / ${alpha})`);
			}
			const percentage = Math.round(alpha * 100);
			return `color-mix(in srgb, ${normalized} ${percentage}%, transparent)`;
		};

		const radius = readVar(
			"--radius-lg",
			readVar("--radius", fallbacks.radius),
		);
		const background = readVar(
			"--color-background",
			readVar("--color-base-100", fallbacks.colorBackground),
		);
		const surface = readVar(
			"--color-card",
			readVar("--color-base-200", fallbacks.colorSurface),
		);
		const border = readVar(
			"--color-border",
			readVar("--border", fallbacks.colorBorder),
		);
		const muted = readVar(
			"--color-muted",
			readVar("--color-base-200", fallbacks.colorMuted),
		);
		const mutedForeground = readVar(
			"--color-muted-foreground",
			fallbacks.colorTextSecondary,
		);
		const textColor = readVar(
			"--color-card-foreground",
			readVar("--color-base-content", fallbacks.colorText),
		);
		const primary = readVar("--color-primary", fallbacks.colorPrimary);
		const primaryForeground = readVar(
			"--color-primary-foreground",
			readVar("--color-primary-content", fallbacks.colorPrimaryText),
		);
		const success = readVar("--color-success", fallbacks.colorSuccess);
		const danger = readVar(
			"--color-error",
			readVar("--destructive", fallbacks.colorDanger),
		);
		const dangerText = readVar(
			"--color-base-content",
			fallbacks.colorDangerText,
		);
		const inputBorder = readVar(
			"--color-input",
			readVar("--input-border", fallbacks.inputBorder),
		);
		const inputBackground = readVar(
			"--color-card",
			fallbacks.inputBackground,
		);

		return {
			theme: isDark ? "night" : "stripe",
			variables: {
				colorPrimary: primary,
				colorPrimaryText: primaryForeground,
				colorBackground: background,
				colorText: textColor,
				colorTextSecondary: readVar(
					"--muted-foreground",
					mutedForeground,
				),
				colorTextPlaceholder: readVar(
					"--muted-foreground",
					fallbacks.colorTextPlaceholder,
				),
				colorDanger: danger,
				colorDangerText: dangerText,
				colorSuccess: success,
				colorIcon: readVar("--muted-foreground", fallbacks.colorIcon),
				borderRadius: radius,
				spacingUnit: "4px",
				fontFamily: "'Inter', system-ui, sans-serif",
				fontWeightMedium: "600",
				fontWeightBold: "700",
			},
			rules: {
				".Input": {
					border: `2px solid ${inputBorder}`,
					backgroundColor: inputBackground,
					borderRadius: radius,
					paddingInline: "14px",
					paddingBlock: "11px",
					color: textColor,
					boxShadow: "none",
					transition: prefersReducedMotion
						? "none"
						: "border 120ms ease, box-shadow 120ms ease, transform 120ms ease",
				},
				".Input::placeholder": {
					color: readVar(
						"--muted-foreground",
						fallbacks.colorTextPlaceholder,
					),
				},
				".Input:focus": {
					border: `2px solid ${primary}`,
					boxShadow: prefersReducedMotion
						? "none"
						: `0 0 0 4px ${withAlpha(primary, 0.14)}`,
					transform: prefersReducedMotion
						? "none"
						: "translateY(-1px)",
				},
				".Input--invalid": {
					border: `2px solid ${danger}`,
					boxShadow: prefersReducedMotion
						? "none"
						: `0 0 0 3px ${withAlpha(danger, 0.18)}`,
				},
				".Block": {
					backgroundColor: surface,
					borderRadius: radius,
					border: `1px solid ${border}`,
					boxShadow: isDark
						? "0 12px 22px -18px rgba(10, 10, 20, 0.7)"
						: "0 14px 32px -20px rgba(15, 23, 42, 0.18)",
				},
				".Label": {
					color: textColor,
					fontWeight: "600",
					letterSpacing: "0.01em",
				},
				".Tab": {
					backgroundColor: "transparent",
					borderRadius: `calc(${radius} - 4px)`,
					border: `1px solid ${withAlpha(border, 0.9)}`,
					color: textColor,
					transition: prefersReducedMotion
						? "none"
						: "color 120ms ease, border-color 120ms ease, background-color 120ms ease, transform 120ms ease",
					paddingInline: "12px",
					paddingBlock: "10px",
				},
				".Tab:hover": {
					backgroundColor: withAlpha(primary, 0.08),
					borderColor: withAlpha(primary, 0.35),
				},
				".Tab--selected": {
					backgroundColor: withAlpha(primary, isDark ? 0.32 : 0.12),
					borderColor: primary,
					color: primary,
					boxShadow: prefersReducedMotion
						? "none"
						: `0 6px 18px -12px ${withAlpha(primary, 0.55)}`,
				},
				".ActionButton": {
					borderRadius: radius,
					border: `1px solid ${withAlpha(border, 0.9)}`,
					paddingInline: "18px",
					paddingBlock: "10px",
					fontWeight: "600",
					letterSpacing: "0.01em",
				},
				".ActionButton--primary": {
					backgroundColor: primary,
					color: primaryForeground,
					border: `1px solid ${withAlpha(primary, 0.6)}`,
					boxShadow: prefersReducedMotion
						? "none"
						: `0 10px 32px -18px ${withAlpha(primary, 0.65)}`,
				},
				".ActionButton--primary:hover": {
					backgroundColor: withAlpha(primary, isDark ? 0.52 : 0.22),
					borderColor: withAlpha(primary, 0.75),
					color: primaryForeground,
				},
				".ActionButton--secondary": {
					backgroundColor: muted,
					color: readVar(
						"--muted-foreground",
						mutedForeground,
					),
				},
				".Link": {
					color: primary,
					textDecoration: "none",
					fontWeight: "500",
				},
				".Link:hover": {
					textDecoration: "underline",
				},
				".Error": {
					color: danger,
					fontWeight: "500",
				},
			},
		};
	}

	let stripeAppearance: Appearance = $state(getStripeAppearance());

	// Stepper
	let step: "address" | "shipping" | "payment" = $state("address");
	let addressComplete: boolean = $state(false);
	let shippingComplete: boolean = $state(false);
	type AddressSection = "shipping" | "billing";
	type RequiredFieldKey =
		| "first_name"
		| "last_name"
		| "address_1"
		| "city"
		| "province"
		| "postal_code";
	const EMPTY_ADDRESS_ERRORS: Record<RequiredFieldKey, string> = {
		first_name: "",
		last_name: "",
		address_1: "",
		city: "",
		province: "",
		postal_code: "",
	};
	const ADDRESS_LABELS: Record<RequiredFieldKey, string> = {
		first_name: "First name",
		last_name: "Last name",
		address_1: "Address line 1",
		city: "City",
		province: "State",
		postal_code: "Postal code",
	};
	let addressErrors = $state({
		email: "",
		shipping: { ...EMPTY_ADDRESS_ERRORS },
		billing: { ...EMPTY_ADDRESS_ERRORS },
	});

	// Saved addresses
	let savedAddresses: HttpTypes.StoreCustomerAddress[] = $state([]);
	let selectedShippingAddressId: string | "new" = $state("new");
	let selectedBillingAddressId: string | "new" = $state("new");

	// Sync billing address when same as shipping
	$effect(() => {
		if (billingSameAsShipping) {
			billing = { ...shipping };
			selectedBillingAddressId = selectedShippingAddressId;
		}
	});

	function applyAddressToShipping(
		a: Partial<HttpTypes.StoreCustomerAddress> | undefined | null,
	) {
		if (!a) return;
		shipping = {
			first_name: a.first_name ?? "",
			last_name: a.last_name ?? "",
			address_1: a.address_1 ?? "",
			address_2: a.address_2 ?? "",
			city: a.city ?? "",
			country_code: (a.country_code ?? "us").toLowerCase(),
			province: a.province ?? "",
			postal_code: a.postal_code ?? "",
			phone: (a as any).phone ?? "",
			company: (a as any).company ?? "",
			address_name: (a as any).address_name ?? "",
		};
	}

	function applyAddressToBilling(
		a: Partial<HttpTypes.StoreCustomerAddress> | undefined | null,
	) {
		if (!a) return;
		billing = {
			first_name: a.first_name ?? "",
			last_name: a.last_name ?? "",
			address_1: a.address_1 ?? "",
			address_2: a.address_2 ?? "",
			city: a.city ?? "",
			country_code: (a.country_code ?? "us").toLowerCase(),
			province: a.province ?? "",
			postal_code: a.postal_code ?? "",
			phone: (a as any).phone ?? "",
			company: (a as any).company ?? "",
			address_name: (a as any).address_name ?? "",
		};
	}

	function resetAddressErrors(section?: AddressSection) {
		if (!section) {
			addressErrors.email = "";
			resetAddressErrors("shipping");
			resetAddressErrors("billing");
			return;
		}
		for (const key of Object.keys(
			addressErrors[section],
		) as RequiredFieldKey[]) {
			addressErrors[section][key] = "";
		}
	}

	type AddressFormState = {
		first_name: string;
		last_name: string;
		address_1: string;
		address_2: string;
		city: string;
		country_code: string;
		province: string;
		postal_code: string;
		phone: string;
		company: string;
		address_name: string;
	};

	function sanitizeAddress(address: AddressFormState): AddressFormState {
		const normalized: AddressFormState = { ...address };
		for (const key of Object.keys(
			normalized,
		) as (keyof AddressFormState)[]) {
			const value = normalized[key];
			if (typeof value === "string") {
				normalized[key] = sanitizeInput(value).trim();
			}
		}
		normalized.country_code =
			normalized.country_code?.toLowerCase()?.trim() || "us";
		if (normalized.postal_code) {
			normalized.postal_code = normalized.postal_code
				.replace(/\s+/g, "")
				.toUpperCase();
		}
		return normalized;
	}

	function validateAndNormalizeAddresses(): {
		isValid: boolean;
		sanitizedShipping: AddressFormState;
		sanitizedBilling: AddressFormState;
	} {
		let isValid = true;
		resetAddressErrors();

		const normalizedEmail = sanitizeInput(email).trim();
		email = normalizedEmail;
		if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
			addressErrors.email = "Enter a valid email address.";
			isValid = false;
		}

		const sanitizedShipping = sanitizeAddress(shipping as AddressFormState);
		shipping = sanitizedShipping;
		for (const key of Object.keys(ADDRESS_LABELS) as RequiredFieldKey[]) {
			if (!sanitizedShipping[key]) {
				addressErrors.shipping[key] =
					`${ADDRESS_LABELS[key]} is required.`;
				isValid = false;
			}
		}
		if (
			sanitizedShipping.postal_code &&
			!/^[0-9A-Z-]{3,10}$/.test(sanitizedShipping.postal_code)
		) {
			addressErrors.shipping.postal_code = "Enter a valid postal code.";
			isValid = false;
		}

		let sanitizedBilling: AddressFormState = billingSameAsShipping
			? { ...sanitizedShipping }
			: sanitizeAddress(billing as AddressFormState);

		if (!billingSameAsShipping) {
			billing = sanitizedBilling;
			for (const key of Object.keys(
				ADDRESS_LABELS,
			) as RequiredFieldKey[]) {
				if (!sanitizedBilling[key]) {
					addressErrors.billing[key] =
						`${ADDRESS_LABELS[key]} is required.`;
					isValid = false;
				}
			}
			if (
				sanitizedBilling.postal_code &&
				!/^[0-9A-Z-]{3,10}$/.test(sanitizedBilling.postal_code)
			) {
				addressErrors.billing.postal_code =
					"Enter a valid postal code.";
				isValid = false;
			}
		} else {
			billing = { ...sanitizedShipping };
		}

		if (!sanitizedShipping.province) {
			addressErrors.shipping.province = "Please select a state.";
			isValid = false;
		}
		if (!billingSameAsShipping && !sanitizedBilling.province) {
			addressErrors.billing.province = "Please select a state.";
			isValid = false;
		}

		return {
			isValid,
			sanitizedShipping,
			sanitizedBilling,
		};
	}

	function clearFieldError(section: AddressSection, key: RequiredFieldKey) {
		if (addressErrors[section][key]) {
			addressErrors[section][key] = "";
		}
		addressComplete = false;
	}

	function onSelectShippingAddress(id: string | "new") {
		selectedShippingAddressId = id;
		if (id === "new") return;
		const sel = savedAddresses.find((x) => x.id === id);
		applyAddressToShipping(sel);
		if (billingSameAsShipping) {
			applyAddressToBilling(sel);
			selectedBillingAddressId = id;
		}
		const isDefaultSelected = !!(sel as any)?.is_default_shipping;
		saveAddress = !isDefaultSelected;
		addressComplete = false;
	}

	function onSelectBillingAddress(id: string | "new") {
		selectedBillingAddressId = id;
		if (id === "new") return;
		const sel = savedAddresses.find((x) => x.id === id);
		applyAddressToBilling(sel);
		addressComplete = false;
	}

	onMount(async () => {
		// Watch for theme changes and update Stripe appearance
		const observer = new MutationObserver(() => {
			stripeAppearance = getStripeAppearance();
		});

		if (typeof document !== "undefined") {
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class", "data-theme"],
			});
		}

		await ensureCart();
		const cartPromise = getCart();
		const customerPromise = getCurrentCustomer().catch(
			() => null,
		) as Promise<Awaited<ReturnType<typeof getCurrentCustomer>> | null>;
		const [cartSnapshot, me] = await Promise.all([
			cartPromise,
			customerPromise,
		]);
		if (me) {
			isGuestCheckout = false;
			email = me.email ?? "";
			const resp = await listAddresses().catch(() => null);
			const addresses = ((resp as any)?.addresses ??
				(me as any).shipping_addresses ??
				[]) as HttpTypes.StoreCustomerAddress[];
			savedAddresses = addresses;
			if (savedAddresses.length > 0) {
				const resolvedShipping =
					savedAddresses.find(
						(addr: any) => addr?.is_default_shipping,
					) ?? savedAddresses[0];
				if (resolvedShipping) {
					selectedShippingAddressId = resolvedShipping.id ?? "new";
					applyAddressToShipping(resolvedShipping);
				}

				const defaultBilling = savedAddresses.find(
					(addr: any) => addr?.is_default_billing,
				);
				if (defaultBilling && !billingSameAsShipping) {
					selectedBillingAddressId = defaultBilling.id ?? "new";
					applyAddressToBilling(defaultBilling);
				} else if (billingSameAsShipping) {
					selectedBillingAddressId = selectedShippingAddressId;
				}

				const isDefaultShippingSelected = Boolean(
					(resolvedShipping as any)?.is_default_shipping,
				);
				saveAddress = !isDefaultShippingSelected;
			}
		}

		// Track begin_checkout event
		const c = cartSnapshot ?? get(cartStore);
		if (c && c.items && c.items.length > 0) {
			try {
				const items = formatCartItemsForAnalytics(c.items as any[]);
				const value = calculateCartValue(c);
				trackBeginCheckout(
					value,
					c.currency_code?.toUpperCase() || "USD",
					items,
				);
			} catch (e) {
				logger.warn("Analytics tracking failed:", e);
			}
		}
	});

	async function continueToShipping() {
		const ok = await saveAddressesToCart();
		if (!ok) return;
		shippingComplete = false;
		await fetchShippingOptions();
		step = "shipping";
	}

	async function fetchShippingOptions() {
		shippingOptionsLoading = true;
		calculationErrors = {}; // Clear previous errors
		try {
			const sdk = getStoreClient() as any;
			const c = get(cartStore);
			if (!c?.id) return;

			const { shipping_options } =
				await sdk.store.fulfillment.listCartOptions({
					cart_id: c.id,
				});
			shippingOptions = shipping_options || [];

			// Calculate prices for shipping options with price_type === "calculated"
			const promises = shippingOptions
				.filter((opt) => opt.price_type === "calculated")
				.map((opt) =>
					sdk.store.fulfillment.calculate(opt.id, {
						cart_id: c.id,
						data: {
							// pass any custom data needed by fulfillment provider
						},
					}),
				);

			if (promises.length) {
				Promise.allSettled(promises).then((results) => {
					const pricesMap: Record<string, number> = {};
					const errorsMap: Record<string, string> = {};
					results.forEach((result, index) => {
						const opt = shippingOptions.filter((o) => o.price_type === "calculated")[index];
						if (!opt) return;
						
						if (result.status === "fulfilled") {
							const shippingOption = (result as any).value?.shipping_option;
							if (shippingOption?.id) {
								pricesMap[shippingOption.id] = shippingOption.amount ?? 0;
							}
						} else {
							// Handle rejected promise (e.g., unserviceable area)
							const error = (result as any).reason;
							let errorMessage = "Unable to calculate shipping";
							
							// Try to extract error message from Medusa error response
							if (error?.message) {
								errorMessage = error.message;
							} else if (error?.response?.data?.message) {
								errorMessage = error.response.data.message;
							} else if (typeof error === 'string') {
								errorMessage = error;
							}
							
							errorsMap[opt.id] = errorMessage;
							logger.warn(`Shipping calculation failed for ${opt.id}:`, error);
						}
					});
					calculatedPrices = pricesMap;
					calculationErrors = errorsMap;
				});
			}
		} catch (err: any) {
			logger.error("Failed to fetch shipping options:", err);
			showToast("Failed to load shipping options", { type: "error" });
			shippingOptions = [];
		} finally {
			shippingOptionsLoading = false;
		}
	}

	async function continueToPayment() {
		const applied = await applyShippingMethod();
		if (!applied) return;

		// Track add_shipping_info event
		try {
			const c = get(cartStore);
			if (c && c.items && c.items.length > 0) {
				const items = formatCartItemsForAnalytics(c.items as any[]);
				const value = calculateCartValue(c);
				const selectedOption = shippingOptions.find(
					(opt) => opt.id === selectedShippingOptionId,
				);
				trackAddShippingInfo(
					value,
					c.currency_code?.toUpperCase() || "USD",
					items,
					selectedOption?.name || "Standard Shipping",
				);
			}
		} catch (e) {
			logger.warn("Analytics tracking failed:", e);
		}

		step = "payment";
		const ok = await setupPayment();
		if (!ok) {
			shippingComplete = false;
			if (paymentError) {
				showToast(paymentError, { type: "error" });
			}
			step = "shipping";
			return;
		}
		shippingComplete = true;

		// Track add_payment_info event
		try {
			const c = get(cartStore);
			if (c && c.items && c.items.length > 0) {
				const items = formatCartItemsForAnalytics(c.items as any[]);
				const value = calculateCartValue(c);
				trackAddPaymentInfo(
					value,
					c.currency_code?.toUpperCase() || "USD",
					items,
					"card",
				);
			}
		} catch (e) {
			logger.warn("Analytics tracking failed:", e);
		}
	}

	async function applyShippingMethod() {
		if (!selectedShippingOptionId) {
			showToast("Please select a shipping method", { type: "error" });
			return false;
		}

		try {
			const sdk = getStoreClient() as any;
			const c = get(cartStore);
			if (!c?.id) return false;

			await sdk.store.cart.addShippingMethod(c.id, {
				option_id: selectedShippingOptionId,
			});

			await getCart();
			return true;
		} catch (err: any) {
			errorMsg = err?.message || "Failed to apply shipping method";
			logger.error("Failed to apply shipping method:", err);
			showToast(errorMsg!, { type: "error" });
			return false;
		}
	}

	async function saveAddressesToCart() {
		const sdk = getStoreClient() as any;
		const c = get(cartStore);
		if (!c?.id) return false;
		const { isValid, sanitizedShipping, sanitizedBilling } =
			validateAndNormalizeAddresses();
		if (!isValid) {
			addressComplete = false;
			errorMsg = "Please fix the highlighted fields.";
			showToast(errorMsg as string, { type: "error" });
			return false;
		}
		try {
			const stripAddr = (a: any) => {
				const { address_name, company, ...rest } = a || {};
				return rest;
			};
			await sdk.store.cart.update(c.id, {
				email,
				shipping_address: stripAddr(sanitizedShipping),
				billing_address: billingSameAsShipping
					? stripAddr(sanitizedShipping)
					: stripAddr(sanitizedBilling),
			});
			addressComplete = true;
			return true;
		} catch (err: any) {
			errorMsg = err?.message || "Failed to save addresses";
			showToast(errorMsg!, { type: "error" });
			addressComplete = false;
			return false;
		}
	}

	// Setup payment session per Medusa docs: https://docs.medusajs.com/resources/commerce-modules/payment/stripe
	async function setupPayment() {
		paymentLoading = true;
		paymentError = null;
		try {
			const sdk = getStoreClient() as any;
			let c = get(cartStore);
			if (!c?.id) {
				await ensureCart();
				await getCart();
				c = get(cartStore);
			}
			if (!c?.id) {
				paymentError = "Cart not initialized";
				return false;
			}
			if ((c.total || 0) <= 0) {
				paymentReady = false;
				return true;
			}
			const pk = publicEnv.PUBLIC_STRIPE_KEY;
			if (!pk) {
				paymentError = "Stripe publishable key missing";
				return false;
			}
			if (!stripePromise) {
				stripePromise = loadStripe(pk);
				stripePromise
					.then((inst) => {
						stripeInstance = inst;
					})
					.catch((e) =>
						logger.error("[checkout] loadStripe failed", e),
					);
			}

			const regionKey =
				((c as any)?.region_id as string | undefined) ?? "default";
			let providerId = stripeProviderCache.get(regionKey) ?? undefined;
			if (providerId === undefined) {
				const listParams: any = {};
				if ((c as any).region_id)
					listParams.region_id = (c as any).region_id;
				const { payment_providers = [] } =
					await sdk.store.payment.listPaymentProviders(listParams);
				providerId =
					(
						payment_providers.find((p: any) =>
							(p.id || "").toLowerCase().includes("stripe"),
						) || {}
					).id || null;
				stripeProviderCache.set(regionKey, providerId ?? null);
			}
			if (!providerId) {
				paymentError = "Stripe provider unavailable";
				return false;
			}

			const effectiveProviderId = providerId;

			if (!c.total || c.total <= 0) {
				paymentError = "Cart total must be greater than 0 for payment";
				return false;
			}

			if (!c.items || c.items.length === 0) {
				paymentError = "Cart must have at least one item for payment";
				return false;
			}

			// Initiate payment session (creates payment_collection if missing)
			let initiateResp: any = null;
			const hasCustomer = Boolean((c as any)?.customer_id);
			const initiatePayload: Record<string, any> = {
				provider_id: effectiveProviderId,
				data: hasCustomer ? { setup_future_usage: "off_session" } : {},
			};
			try {
				initiateResp = await sdk.store.payment.initiatePaymentSession(
					c,
					initiatePayload,
				);
			} catch (e: any) {
				logger.error("[checkout] initiatePaymentSession failed", {
					cartId: c.id,
					providerId,
					message: e?.message,
					status: e?.response?.status,
					backendMessage: e?.response?.data?.message,
					stack: e?.stack,
				});
				paymentError = "Failed to initiate Stripe payment session";
				return false;
			}

			// Try to locate payment collection from initiate response directly first
			let paymentCollection =
				initiateResp?.payment_collection ||
				initiateResp?.cart?.payment_collection;
			if (!paymentCollection) {
				// Retrieve cart with broader fields including nested sessions
				const fieldStr =
					"id,*payment_collection,*payment_collection.payment_sessions";
				const { cart: refreshedA } = await sdk.store.cart.retrieve(
					c.id,
					{ fields: fieldStr },
				);
				paymentCollection = (refreshedA as any)?.payment_collection;
				// If still missing, wait briefly and retry once (handles eventual consistency)
				if (!paymentCollection) {
					await new Promise((r) => setTimeout(r, 400));
					const { cart: refreshedB } = await sdk.store.cart.retrieve(
						c.id,
						{ fields: fieldStr },
					);
					paymentCollection = (refreshedB as any)?.payment_collection;
				}
			}

			if (!paymentCollection) {
				logger.error(
					"[checkout] payment_collection still missing after initiation",
					{
						cartId: c.id,
						providerId,
						initiateKeys: Object.keys(initiateResp || {}),
					},
				);
				paymentError =
					"Stripe payment session not created - backend did not return payment collection";
				return false;
			}

			const sessions = paymentCollection?.payment_sessions || [];
			const stripeSession = sessions.find((s: any) =>
				(s.provider_id || "").toLowerCase().includes("stripe"),
			);
			if (!stripeSession) {
				logger.error(
					"[checkout] no stripe session in payment_collection",
					{
						cartId: c.id,
						providerId,
						paymentCollectionId: paymentCollection?.id,
						sessionProviders: sessions.map(
							(s: any) => s.provider_id,
						),
					},
				);
				paymentError =
					"Stripe payment session not created - check backend configuration";
				return false;
			}

			paymentClientSecret =
				stripeSession?.data?.client_secret ||
				stripeSession?.data?.clientSecret ||
				stripeSession?.data?.payment_intent?.client_secret ||
				stripeSession?.data?.paymentIntent?.client_secret ||
				stripeSession?.data?.pi?.client_secret ||
				stripeSession?.data?.intent?.client_secret ||
				null;

			if (!paymentClientSecret) {
				logger.error(
					"[checkout] stripe session missing client secret",
					{
						stripeSessionId: stripeSession?.id,
						stripeSessionDataKeys: Object.keys(
							stripeSession?.data || {},
						),
					},
				);
				paymentError =
					"Client secret missing - check Stripe configuration on backend";
				return false;
			}
			paymentReady = true;
			return true;
		} catch (err: any) {
			paymentError = err?.message || "Payment initialization failed";
			return false;
		} finally {
			paymentLoading = false;
		}
	}

	async function submitCheckout() {
		errorMsg = null;
		loading = true;
		orderDialogOpen.set(true);
		const sdk = getStoreClient() as any;
		try {
			const c = get(cartStore);
			if (!c?.id) return;

			if ((c.total || 0) <= 0) {
				const { cart } = await sdk.store.cart.complete(c.id);
				if ((cart as any)?.completed_at) {
					showToast("Order placed successfully", { type: "success" });
					// Clear cart after successful order placement
					try {
						await clearCart();
					} catch (e) {
						logger.warn("Failed to clear cart:", e);
					}
					window.location.href = "/checkout/success";
				} else {
					errorMsg =
						"Failed to complete free order. Please contact support.";
					showToast(errorMsg as string, { type: "error" });
				}
				return;
			}

			const ok = await saveAddressesToCart();
			if (!ok) return;

			if (!selectedShippingOptionId) {
				await fetchShippingOptions();
			}
			if (selectedShippingOptionId) {
				await applyShippingMethod();
			}

			if ((c.total || 0) > 0 && !paymentReady) {
				const okPayment = await setupPayment();
				if (!okPayment)
					throw new Error(paymentError || "Payment not ready");
			}

			if ((c.total || 0) > 0 && !paymentClientSecret)
				throw new Error("Payment not initialized");

			const stripeInstance = await stripePromise;
			if ((c.total || 0) > 0 && !stripeInstance)
				throw new Error("Stripe not ready");
			// Wait briefly for element mount if necessary
			if ((c.total || 0) > 0) {
				let attempts = 0;
				while (attempts < 10 && (!elements || !ready)) {
					await new Promise((r) => setTimeout(r, 100));
					attempts++;
				}
				if (!elements || !ready) {
					throw new Error("Stripe payment element not mounted");
				}
			}

			const returnUrl = `${publicEnv.PUBLIC_BASE_URL || window.location.origin}/checkout/success`;

			if ((c.total || 0) > 0) {
				const { error: submitError } = await elements.submit();
				if (submitError) {
					paymentError =
						submitError.message ||
						"Failed to submit payment details";
					throw new Error(paymentError!);
				}
			}

			if ((c.total || 0) > 0) {
				const { error } = await stripeInstance.confirmPayment({
					elements,
					confirmParams: { return_url: returnUrl },
					redirect: "if_required",
				});
				if (error) {
					logger.error("[checkout] confirmPayment error", {
						code: error.type,
						message: error.message,
						cartId: c.id,
					});
					paymentError =
						error.message || "Payment confirmation failed.";
					throw new Error(paymentError!);
				}
			}

			const meResp = await sdk.store.customer
				.retrieve()
				.catch(() => null);
			if (saveAddress && meResp?.customer) {
				const stripAddr = (a: any) => {
					const { address_name, company, ...rest } = a || {};
					return { ...rest };
				};
				await sdk.store.customer
					.createAddress({
						...stripAddr(shipping),
						is_default_shipping: false,
						is_default_billing: false,
					})
					.catch(() => {});
				showToast("Address saved to account", { type: "success" });
			}

			// Complete cart -> may return { type: 'order', order } or { type: 'cart', cart, error }
			let completion: any = null;
			try {
				completion = await sdk.store.cart.complete(c.id);
			} catch (e: any) {
				logger.error("[checkout] cart.complete threw", e?.message, e);
				throw new Error(
					e?.message || "Failed to finalize order after payment",
				);
			}

			if (completion?.type === "order" && completion.order) {
				showToast("Order placed successfully", { type: "success" });

				// Track purchase event
				try {
					const order = completion.order;
					const items = formatCartItemsForAnalytics(
						order.items || c.items || [],
					);
					const value = calculateCartValue(order);
					const shipping = order.shipping_total || 0;
					const tax = order.tax_total || 0;
					trackPurchase(
						order.id,
						value,
						order.currency_code?.toUpperCase() ||
							c.currency_code?.toUpperCase() ||
							"USD",
						items,
						shipping,
						tax,
					);
				} catch (e) {
					logger.warn("Analytics tracking failed:", e);
				}

				// Optionally store order id for success page usage
				try {
					localStorage.setItem("last_order_id", completion.order.id);
				} catch {}

				// Clear cart after successful order
				try {
					await clearCart();
				} catch (e) {
					logger.warn("Failed to clear cart:", e);
				}

				window.location.href = "/checkout/success";
				return;
			}

			// Fallback: sometimes completion can return a cart if something prevented order creation
			if (completion?.type === "cart") {
				const compCart = completion.cart;
				const backendError =
					completion.error || compCart?.metadata?.completion_error;
				logger.error(
					"[checkout] completion returned cart (not order)",
					{
						cartId: compCart?.id,
						backendError,
						paymentCollection: compCart?.payment_collection?.id,
						paymentSessions:
							compCart?.payment_collection?.payment_sessions?.map(
								(s: any) => ({
									id: s.id,
									status: s.status,
									provider: s.provider_id,
								}),
							),
					},
				);
				// If payment session authorized but not completed, attempt a short poll for order creation
				let polledOrder: any = null;
				if (
					compCart?.payment_collection?.payment_sessions?.some(
						(s: any) =>
							["authorized", "pending"].includes(s.status),
					)
				) {
					for (let i = 0; i < 5; i++) {
						await new Promise((r) => setTimeout(r, 400));
						try {
							const refreshed = await sdk.store.cart.retrieve(
								compCart.id,
								{ fields: "id" },
							);
							// There's no direct way to fetch order by cart here without separate lookup; break if completed_at set
							if ((refreshed as any)?.cart?.completed_at) {
								polledOrder = refreshed.cart;
								break;
							}
						} catch {}
					}
				}
				if (polledOrder?.completed_at) {
					showToast("Order placed successfully", { type: "success" });
					// Clear cart after successful order placement
					try {
						await clearCart();
					} catch (e) {
						logger.warn("Failed to clear cart:", e);
					}
					window.location.href = "/checkout/success";
					return;
				}
				errorMsg =
					backendError ||
					"Payment succeeded but order could not be finalized. Please contact support.";
				showToast(errorMsg as string, { type: "error" });
				return;
			}

			// Unknown shape
			logger.error(
				"[checkout] unexpected completion response",
				completion,
			);
			throw new Error("Unexpected checkout completion response");
		} catch (e) {
			errorMsg =
				paymentError || (e as any)?.message || "Checkout failed.";
			showToast(errorMsg as string, { type: "error" });
		} finally {
			loading = false;
			orderDialogOpen.set(false);
		}
	}
</script>

<SEO
	title="Checkout - Khadka Foods"
	description="Complete your order securely at Khadka Foods. Fast checkout with multiple payment options."
	keywords={["checkout", "payment", "order", "Khadka Foods"]}
	canonical="https://khadkafoods.com/checkout"
/>
<section class="w-full py-10">
	<div class="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>

		<div class="card border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<!-- Stepper nav -->
				<AnimateSharedLayout>
					<div
						class="relative mx-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-4 rounded-full border border-base-300 bg-base-300/50 p-2 shadow-inner dark:bg-base-300/30 sm:flex-nowrap sm:gap-6"
					>
						<button
							class="relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition hover:bg-base-300/30 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-base-100/10 sm:flex-none sm:px-6"
							onclick={() => (step = "address")}
						>
							{#if step === "address"}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100 shadow-md dark:border-base-content/20 dark:bg-base-100/95"
									></div>
								</Motion>
							{/if}
							{#if addressComplete && step !== "address"}
								<CheckCircle2
									class="relative z-10 h-4 w-4 text-success"
								/>
							{/if}
							<span
								class="relative z-10 text-center font-semibold"
								>Address</span
							>
						</button>
						<button
							class="relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition hover:bg-base-300/30 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-base-100/10 sm:flex-none sm:px-6"
							onclick={async () => {
								if (!addressComplete) return;
								if (
									!shippingOptions.length &&
									!shippingOptionsLoading
								) {
									await fetchShippingOptions();
								}
								step = "shipping";
							}}
							disabled={!addressComplete}
						>
							{#if step === "shipping"}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100 shadow-md dark:border-base-content/20 dark:bg-base-100/95"
									></div>
								</Motion>
							{/if}
							{#if shippingComplete && step !== "shipping"}
								<CheckCircle2
									class="relative z-10 h-4 w-4 text-success"
								/>
							{/if}
							<span
								class="relative z-10 text-center font-semibold"
								>Shipping</span
							>
						</button>
						<button
							class="relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition hover:bg-base-300/30 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-base-100/10 sm:flex-none sm:px-6"
							onclick={() => {
								if (!shippingComplete) return;
								step = "payment";
							}}
							disabled={!shippingComplete ||
								((get(cartStore)?.total || 0) > 0 &&
									!paymentReady)}
						>
							{#if step === "payment"}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100 shadow-md dark:border-base-content/20 dark:bg-base-100/95"
									></div>
								</Motion>
							{/if}
							<span
								class="relative z-10 text-center font-semibold"
								>Payment</span
							>
						</button>
					</div>
				</AnimateSharedLayout>

				{#if step === "address"}
					<h2 class="card-title">Contact</h2>
					<label class="form-control w-full">
						<div class="label">
							<span class="label-text">Email</span>
						</div>
						<input
							class="input-bordered input w-full border-base-300 input-primary rounded-xl"
							class:input-error={Boolean(addressErrors.email)}
							type="email"
							bind:value={email}
							placeholder="you@example.com"
							oninput={() => {
								addressErrors.email = "";
								addressComplete = false;
							}}
						/>
						{#if addressErrors.email}
							<p class="mt-1 text-sm text-error">
								{addressErrors.email}
							</p>
						{/if}
					</label>

					{#if savedAddresses.length > 0}
						<h2 class="mt-2 card-title">Select shipping address</h2>
						<div class="grid gap-2">
							{#each savedAddresses as a (a.id)}
								<label
									class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
								>
									<input
										type="radio"
										class="radio mt-1 radio-primary"
										name="shipping-address-select"
										checked={selectedShippingAddressId ===
											a.id}
										onchange={() =>
											onSelectShippingAddress(a.id!)}
									/>
									<div class="min-w-0 flex-1 overflow-hidden">
										<div class="font-medium break-words">
											{(a as any).address_name ||
												`${a.first_name} ${a.last_name}`}
										</div>
										<div
											class="flex flex-wrap items-center gap-1.5 mt-1"
										>
											{#if (a as any).is_default_shipping}
												<span
													class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-primary-content shadow badge-primary whitespace-nowrap"
													>Default Shipping</span
												>
											{/if}
											{#if (a as any).is_default_billing}
												<span
													class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-secondary-content shadow badge-secondary whitespace-nowrap"
													>Default Billing</span
												>
											{/if}
										</div>
										{#if (a as any).company}
											<div
												class="text-sm opacity-70 break-words mt-1"
											>
												{(a as any).company}
											</div>
										{/if}
										<div
											class="text-sm opacity-70 break-words"
										>
											{a.first_name}
											{a.last_name}
										</div>
										<div
											class="text-sm opacity-70 break-words"
										>
											{a.address_1}{#if a.address_2}, {a.address_2}{/if},
											{a.city}
										</div>
										<div
											class="text-sm opacity-70 break-words"
										>
											{a.province}, {a.postal_code}, {a.country_code}
										</div>
										{#if (a as any).phone}
											<div
												class="text-sm opacity-70 break-words"
											>
												{(a as any).phone}
											</div>
										{/if}
									</div>
								</label>
							{/each}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-base-300 p-3 hover:border-primary/50"
							>
								<input
									type="radio"
									class="radio radio-primary"
									name="shipping-address-select"
									checked={selectedShippingAddressId ===
										"new"}
									onchange={() =>
										onSelectShippingAddress("new")}
								/>
								<div class="opacity-80">
									Use a new shipping address
								</div>
							</label>
						</div>

						{#if !billingSameAsShipping}
							<h2 class="mt-2 card-title">
								Select billing address
							</h2>
							<div class="grid gap-2">
								{#each savedAddresses as a (a.id)}
									<label
										class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
									>
										<input
											type="radio"
											class="radio mt-1 radio-primary"
											name="billing-address-select"
											checked={selectedBillingAddressId ===
												a.id}
											onchange={() =>
												onSelectBillingAddress(a.id!)}
										/>
										<div
											class="min-w-0 flex-1 overflow-hidden"
										>
											<div
												class="font-medium break-words"
											>
												{(a as any).address_name ||
													`${a.first_name} ${a.last_name}`}
											</div>
											<div
												class="flex flex-wrap items-center gap-1.5 mt-1"
											>
												{#if (a as any).is_default_shipping}
													<span
														class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-primary-content shadow badge-primary whitespace-nowrap"
														>Default Shipping</span
													>
												{/if}
												{#if (a as any).is_default_billing}
													<span
														class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-secondary-content shadow badge-secondary whitespace-nowrap"
														>Default Billing</span
													>
												{/if}
											</div>
											{#if (a as any).company}
												<div
													class="text-sm opacity-70 break-words mt-1"
												>
													{(a as any).company}
												</div>
											{/if}
											<div
												class="text-sm opacity-70 break-words"
											>
												{a.first_name}
												{a.last_name}
											</div>
											<div
												class="text-sm opacity-70 break-words"
											>
												{a.address_1}{#if a.address_2}, {a.address_2}{/if},
												{a.city}
											</div>
											<div
												class="text-sm opacity-70 break-words"
											>
												{a.province}, {a.postal_code}, {a.country_code}
											</div>
											{#if (a as any).phone}
												<div
													class="text-sm opacity-70 break-words"
												>
													{(a as any).phone}
												</div>
											{/if}
										</div>
									</label>
								{/each}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-base-300 p-3 hover:border-primary/50"
								>
									<input
										type="radio"
										class="radio radio-primary"
										name="billing-address-select"
										checked={selectedBillingAddressId ===
											"new"}
										onchange={() =>
											onSelectBillingAddress("new")}
									/>
									<div class="opacity-80">
										Use a new billing address
									</div>
								</label>
							</div>
						{/if}
					{/if}

					<h2 class="mt-2 card-title">Shipping address</h2>
					<input
						class="input-bordered input w-full border-base-300 input-primary rounded-xl"
						placeholder="Address name (optional)"
						bind:value={shipping.address_name}
					/>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div class="flex flex-col gap-1">
							<input
								class="input-bordered input border-base-300 input-primary rounded-xl"
								class:input-error={Boolean(
									addressErrors.shipping.first_name,
								)}
								placeholder="First name"
								bind:value={shipping.first_name}
								oninput={() =>
									clearFieldError("shipping", "first_name")}
							/>
							{#if addressErrors.shipping.first_name}
								<p class="text-sm text-error">
									{addressErrors.shipping.first_name}
								</p>
							{/if}
						</div>
						<div class="flex flex-col gap-1">
							<input
								class="input-bordered input border-base-300 input-primary rounded-xl"
								class:input-error={Boolean(
									addressErrors.shipping.last_name,
								)}
								placeholder="Last name"
								bind:value={shipping.last_name}
								oninput={() =>
									clearFieldError("shipping", "last_name")}
							/>
							{#if addressErrors.shipping.last_name}
								<p class="text-sm text-error">
									{addressErrors.shipping.last_name}
								</p>
							{/if}
						</div>
					</div>
					<input
						class="input-bordered input w-full border-base-300 input-primary rounded-xl"
						placeholder="Company (optional)"
						bind:value={shipping.company}
					/>
					<div class="flex flex-col gap-1">
						<input
							class="input-bordered input w-full border-base-300 input-primary rounded-xl"
							class:input-error={Boolean(
								addressErrors.shipping.address_1,
							)}
							placeholder="Address 1"
							bind:value={shipping.address_1}
							oninput={() =>
								clearFieldError("shipping", "address_1")}
						/>
						{#if addressErrors.shipping.address_1}
							<p class="text-sm text-error">
								{addressErrors.shipping.address_1}
							</p>
						{/if}
					</div>
					<input
						class="input-bordered input w-full border-base-300 input-primary rounded-xl"
						placeholder="Address 2"
						bind:value={shipping.address_2}
					/>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div class="flex flex-col gap-1">
							<input
								class="input-bordered input border-base-300 input-primary rounded-xl"
								class:input-error={Boolean(
									addressErrors.shipping.city,
								)}
								placeholder="City"
								bind:value={shipping.city}
								oninput={() =>
									clearFieldError("shipping", "city")}
							/>
							{#if addressErrors.shipping.city}
								<p class="text-sm text-error">
									{addressErrors.shipping.city}
								</p>
							{/if}
						</div>
						<div class="flex flex-col gap-1">
							<select
								class="select-bordered select rounded-xl"
								class:select-error={Boolean(
									addressErrors.shipping.province,
								)}
								bind:value={shipping.province}
								onchange={() =>
									clearFieldError("shipping", "province")}
							>
								<option value="" disabled>Select state</option>
								{#each US_STATES as s}
									<option value={s.code}>{s.name}</option>
								{/each}
							</select>
							{#if addressErrors.shipping.province}
								<p class="text-sm text-error">
									{addressErrors.shipping.province}
								</p>
							{/if}
						</div>
					</div>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
						<div class="flex flex-col gap-1">
							<input
								class="input-bordered input border-base-300 input-primary rounded-xl"
								class:input-error={Boolean(
									addressErrors.shipping.postal_code,
								)}
								placeholder="Postal code"
								bind:value={shipping.postal_code}
								oninput={() =>
									clearFieldError("shipping", "postal_code")}
							/>
							{#if addressErrors.shipping.postal_code}
								<p class="text-sm text-error">
									{addressErrors.shipping.postal_code}
								</p>
							{/if}
						</div>
						<input
							class="input-bordered input bg-base-200/60 opacity-100 input-primary rounded-xl dark:bg-base-300/20 dark:text-base-content/80"
							placeholder="US"
							value={(
								shipping.country_code || "us"
							).toUpperCase()}
							disabled
						/>
						<input
							class="input-bordered input border-base-300 input-primary rounded-xl"
							placeholder="Phone"
							bind:value={shipping.phone}
						/>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								class="checkbox checkbox-primary"
								bind:checked={billingSameAsShipping}
								onchange={() => {
									if (billingSameAsShipping) {
										applyAddressToBilling(shipping);
									}
									resetAddressErrors("billing");
									addressComplete = false;
								}}
							/>
							<span class="label-text"
								>Billing address same as shipping</span
							>
						</label>
					</div>

					{#if !isGuestCheckout && !(selectedShippingAddressId !== "new" && (savedAddresses.find((x) => x.id === selectedShippingAddressId) as any)?.is_default_shipping)}
						<div class="form-control">
							<label
								class="label cursor-pointer justify-start gap-3"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									bind:checked={saveAddress}
								/>
								<span class="label-text"
									>Save this address to my account</span
								>
							</label>
						</div>
					{/if}

					{#if !billingSameAsShipping}
						<h2 class="mt-2 card-title">Billing address</h2>
						<input
							class="input-bordered input w-full border-base-300 input-primary rounded-xl"
							placeholder="Address name (optional)"
							bind:value={billing.address_name}
						/>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div class="flex flex-col gap-1">
								<input
									class="input-bordered input border-base-300 input-primary rounded-xl"
									class:input-error={Boolean(
										addressErrors.billing.first_name,
									)}
									placeholder="First name"
									bind:value={billing.first_name}
									oninput={() =>
										clearFieldError(
											"billing",
											"first_name",
										)}
								/>
								{#if addressErrors.billing.first_name}
									<p class="text-sm text-error">
										{addressErrors.billing.first_name}
									</p>
								{/if}
							</div>
							<div class="flex flex-col gap-1">
								<input
									class="input-bordered input border-base-300 input-primary rounded-xl"
									class:input-error={Boolean(
										addressErrors.billing.last_name,
									)}
									placeholder="Last name"
									bind:value={billing.last_name}
									oninput={() =>
										clearFieldError("billing", "last_name")}
								/>
								{#if addressErrors.billing.last_name}
									<p class="text-sm text-error">
										{addressErrors.billing.last_name}
									</p>
								{/if}
							</div>
						</div>
						<input
							class="input-bordered input w-full border-base-300 input-primary rounded-xl"
							placeholder="Company (optional)"
							bind:value={billing.company}
						/>
						<div class="flex flex-col gap-1">
							<input
								class="input-bordered input w-full border-base-300 input-primary rounded-xl"
								class:input-error={Boolean(
									addressErrors.billing.address_1,
								)}
								placeholder="Address 1"
								bind:value={billing.address_1}
								oninput={() =>
									clearFieldError("billing", "address_1")}
							/>
							{#if addressErrors.billing.address_1}
								<p class="text-sm text-error">
									{addressErrors.billing.address_1}
								</p>
							{/if}
						</div>
						<input
							class="input-bordered input w-full border-base-300 input-primary rounded-xl"
							placeholder="Address 2"
							bind:value={billing.address_2}
						/>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div class="flex flex-col gap-1">
								<input
									class="input-bordered input border-base-300 input-primary rounded-xl"
									class:input-error={Boolean(
										addressErrors.billing.city,
									)}
									placeholder="City"
									bind:value={billing.city}
									oninput={() =>
										clearFieldError("billing", "city")}
								/>
								{#if addressErrors.billing.city}
									<p class="text-sm text-error">
										{addressErrors.billing.city}
									</p>
								{/if}
							</div>
							<div class="flex flex-col gap-1">
								<select
									class="select-bordered select rounded-xl"
									class:select-error={Boolean(
										addressErrors.billing.province,
									)}
									bind:value={billing.province}
									onchange={() =>
										clearFieldError("billing", "province")}
								>
									<option value="" disabled
										>Select state</option
									>
									{#each US_STATES as s}
										<option value={s.code}>{s.name}</option>
									{/each}
								</select>
								{#if addressErrors.billing.province}
									<p class="text-sm text-error">
										{addressErrors.billing.province}
									</p>
								{/if}
							</div>
						</div>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
							<div class="flex flex-col gap-1">
								<input
									class="input-bordered input border-base-300 input-primary rounded-xl"
									class:input-error={Boolean(
										addressErrors.billing.postal_code,
									)}
									placeholder="Postal code"
									bind:value={billing.postal_code}
									oninput={() =>
										clearFieldError(
											"billing",
											"postal_code",
										)}
								/>
								{#if addressErrors.billing.postal_code}
									<p class="text-sm text-error">
										{addressErrors.billing.postal_code}
									</p>
								{/if}
							</div>
							<input
								class="input-bordered input bg-base-200/60 opacity-100 input-primary rounded-xl dark:bg-base-300/20 dark:text-base-content/80"
								placeholder="US"
								value={(
									billing.country_code || "us"
								).toUpperCase()}
								disabled
							/>
							<input
								class="input-bordered input border-base-300 input-primary rounded-xl"
								placeholder="Phone"
								bind:value={billing.phone}
							/>
						</div>
					{/if}

					<!-- Address step actions -->
					<div class="flex justify-end pt-2">
						<Button
							class="btn btn-primary"
							onclick={continueToShipping}
							>Continue to shipping</Button
						>
					</div>
				{/if}

				{#if step === "shipping"}
					<h2 class="mt-2 card-title">Shipping method</h2>
					{#if shippingOptionsLoading}
						<div
							class="loading loading-md loading-spinner text-primary"
						></div>
					{:else if shippingOptions.length > 0}
						<div class="mt-2 grid gap-2">
							{#each shippingOptions as opt (opt.id)}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
									class:opacity-50={!!calculationErrors[opt.id]}
									class:cursor-not-allowed={!!calculationErrors[opt.id]}
									class:hover:border-base-300={!!calculationErrors[opt.id]}
								>
									<input
										type="radio"
										class="radio radio-primary"
										name="shipping-option"
										checked={selectedShippingOptionId ===
											opt.id}
										disabled={!!calculationErrors[opt.id]}
										onchange={() => {
											selectedShippingOptionId = opt.id!;
											shippingComplete = false;
										}}
									/>
									<div
										class="flex w-full items-center justify-between"
									>
										<div>
											<div class="font-medium">
												{opt.name}
											</div>
											{#if calculationErrors[opt.id]}
												<div class="text-xs text-error mt-1">
													{calculationErrors[opt.id]}
												</div>
											{/if}
										</div>
										<div class="text-right text-sm">
											{#if calculationErrors[opt.id]}
												<span class="font-medium text-error"
													>Unavailable</span
												>
											{:else if opt.price_type === "calculated" && !calculatedPrices[opt.id]}
												<span class="opacity-80"
													>Calculating...</span
												>
											{:else if getShippingDisplayAmount(opt) <= 0}
												<span
													class="font-medium text-success"
													>+ Free</span
												>
											{:else}
												<span
													class="font-medium text-success"
													>+ {formatCurrency(
														getShippingDisplayAmount(opt),
														get(cartStore)
															?.currency_code ||
															"USD",
													)}</span
												>
											{/if}
										</div>
									</div>
								</label>
							{/each}
						</div>
						<div class="flex justify-between pt-2">
							<Button
								class="btn btn-primary"
								onclick={() => (step = "address")}>Back</Button
							>
							<Button
								class="btn btn-primary"
								onclick={continueToPayment}
								disabled={!selectedShippingOptionId ||
									!!calculationErrors[selectedShippingOptionId]}
								>Continue to payment</Button
							>
						</div>
					{:else}
						<div class="text-sm opacity-70">
							No shipping options for this address.
						</div>
						<div class="pt-2">
							<Button
								class="btn btn-primary"
								onclick={() => (step = "address")}>Back</Button
							>
						</div>
					{/if}
				{/if}

				{#if step === "payment"}
					<h2
						class="mt-2 card-title flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"
					>
						<span>Payment</span>
						{#if (get(cartStore)?.total || 0) > 0}
							<div class="flex items-baseline gap-1">
								<span class="text-base font-semibold sm:text-lg"
									>Total due:</span
								>
								<span
									class="text-base font-semibold text-primary sm:text-lg"
								>
									{formatCurrency(
										get(cartStore)?.total || 0,
										get(cartStore)?.currency_code || "usd",
									)}
								</span>
							</div>
						{/if}
					</h2>
					{#if paymentError}
						<div class="alert alert-error">
							<span>{paymentError}</span>
						</div>
					{/if}
					{#if paymentLoading}
						<div
							class="rounded-2xl border border-base-300 bg-base-200/70 p-6 text-center shadow-sm dark:bg-base-300/30"
						>
							<div
								class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
							>
								<ShieldCheck class="h-7 w-7" />
							</div>
							<div class="mt-4 space-y-1">
								<p class="text-base font-semibold">
									Securing your checkout…
								</p>
								<p class="text-sm opacity-70">
									We’re syncing with Stripe to keep your
									payment safe.
								</p>
							</div>
							<progress
								class="progress progress-primary mt-5 w-full"
							></progress>
						</div>
					{:else if (get(cartStore)?.total || 0) <= 0}
						<div class="alert alert-info">
							<span>No payment required for this order.</span>
						</div>
					{:else if paymentClientSecret && paymentReady}
						{#if stripeInstance}
							<StripePaymentElement
								stripe={stripeInstance}
								clientSecret={paymentClientSecret}
								appearance={stripeAppearance}
								bind:elements
								bind:paymentElementRef
								bind:ready
								onchange={() => {
									/* could track completion state */
								}}
							/>
						{:else}
							<div
								class="flex items-center gap-2 text-sm opacity-70"
							>
								<span class="loading loading-sm loading-spinner"
								></span> Loading Stripe...
							</div>
						{/if}
					{:else}
						<div class="alert alert-warning">
							<span
								>Payment not ready. You can retry submission.</span
							>
						</div>
					{/if}
					<div class="flex justify-between pt-2">
						<Button
							class="btn btn-primary"
							onclick={() => (step = "shipping")}>Back</Button
						>
						<Button
							class={"btn btn-primary " +
								(loading ? "loading" : "")}
							disabled={loading ||
								((get(cartStore)?.total || 0) > 0 &&
									!paymentReady)}
							onclick={submitCheckout}
						>
							Place order
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if $orderDialogOpen}
	<div use:melt={$orderDialogPortalled}>
		<div
			use:melt={$orderDialogOverlay}
			class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150 dark:bg-black/70"
		></div>
		<div
			use:melt={$orderDialogContent}
			class="fixed left-1/2 top-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200 rounded-3xl border-2 border-base-300/60 bg-base-100 p-0 text-base-content shadow-[0_25px_50px_-12px_rgba(15,23,42,0.45)] transition-colors dark:border-base-300/40 dark:bg-base-200 dark:text-base-content dark:shadow-[0_25px_45px_-15px_rgba(2,6,23,0.8)]"
		>
			<div
				class="flex w-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.3xl)-0.5rem)]"
			>
				<div
					class="relative flex flex-col items-center gap-4 bg-base-200 px-8 py-10 text-center dark:bg-base-300 border-b border-base-300/60 dark:border-base-300/40"
				>
					<div class="relative h-16 w-16">
						<div
							class="absolute inset-0 rounded-full border-4 border-primary/30 dark:border-primary/25"
						></div>
						<div
							class="absolute inset-3 flex items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner shadow-primary/20 dark:bg-primary/20"
						>
							<ShieldCheck class="h-7 w-7" />
						</div>
					</div>
					<div class="space-y-2">
						<p
							use:melt={$orderDialogTitle}
							class="text-xl font-semibold"
						>
							Finishing up your order…
						</p>
						<p
							use:melt={$orderDialogDescription}
							class="text-sm text-base-content/70 dark:text-base-content/60"
						>
							Please stay on this page while we confirm payment
							with Stripe.
						</p>
					</div>
				</div>
				<div class="bg-base-100 px-8 pb-8 pt-4 dark:bg-base-200">
					<progress class="progress progress-primary w-full"
					></progress>
				</div>
			</div>
		</div>
	</div>
{/if}
