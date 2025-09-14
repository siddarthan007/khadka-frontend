import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Formats a price whether provided in minor or major units.
// Heuristics:
// - For zero-decimal currencies, treat values as major units (no division)
// - If the value is an integer >= 100, treat as minor units (divide by 100)
// - If the value has decimals, treat as major units
// - If the value is an integer < 100, assume major units to avoid $0.04 for $4
export function formatCurrency(amountUnknownUnits: number, currencyCode?: string, locale?: string): string {
	const currency = (currencyCode || 'USD').toUpperCase();
	const amount = typeof amountUnknownUnits === 'number' ? amountUnknownUnits : 0;
	const ZERO_DECIMAL_CURRENCIES = new Set([
		'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF','HUF','IDR','LAK','TWD'
	]);

	const toMajorUnits = (val: number): number => {
		if (ZERO_DECIMAL_CURRENCIES.has(currency)) return val;
		if (!Number.isInteger(val)) return val;
		if (val >= 100) return val / 100;
		return val;
	};

	try {
		const major = toMajorUnits(amount);
		return new Intl.NumberFormat(locale ?? 'en-US', {
			style: 'currency',
			currency
		}).format(major);
	} catch {
		const major = toMajorUnits(amount);
		return `$${major.toFixed(2)}`;
	}
}

export function formatCalculatedPrice(cp: any, locale?: string): string {
	if (!cp) return '';
	// According to Medusa docs, calculated_amount is the main price field in minor units
	const amount = Number(cp.calculated_amount ?? cp.amount ?? cp.unit_price ?? 0);
	const currency = cp.currency_code ?? cp.currency ?? 'USD';
	return formatCurrency(amount, currency, locale);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
