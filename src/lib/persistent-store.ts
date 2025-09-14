import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export function persistentStore<T>(key: string, initialValue: T): Writable<T> {
	let savedValue = null;
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(key);
		if (stored) {
			try {
				savedValue = JSON.parse(stored);
			} catch (e) {
				savedValue = null;
			}
		}
	}

	const store = writable<T>(savedValue ?? initialValue);

	if (typeof localStorage !== 'undefined') {
		store.subscribe((value) => {
			localStorage.setItem(key, JSON.stringify(value));
		});
	}

	return store;
}
