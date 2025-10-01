import { browser } from '$app/environment';
import { logger } from '$lib/logger';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Google reCAPTCHA v3 Integration
 */

declare global {
	interface Window {
		grecaptcha: any;
	}
}

const RECAPTCHA_SITE_KEY = publicEnv.PUBLIC_RECAPTCHA_SITE_KEY || '';

let recaptchaLoaded = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Load reCAPTCHA script
 */
export function loadRecaptcha(): Promise<void> {
	if (!browser) {
		return Promise.resolve();
	}

	if (recaptchaLoaded) {
		return Promise.resolve();
	}

	if (loadingPromise) {
		return loadingPromise;
	}

	if (!RECAPTCHA_SITE_KEY) {
		// reCAPTCHA not configured - skip loading (silent in dev)
		return Promise.resolve();
	}

	loadingPromise = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
		script.async = true;
		script.defer = true;

		script.onload = () => {
			recaptchaLoaded = true;
			resolve();
		};

		script.onerror = () => {
			reject(new Error('Failed to load reCAPTCHA'));
		};

		document.head.appendChild(script);
	});

	return loadingPromise;
}

/**
 * Execute reCAPTCHA and get token
 */
export async function getRecaptchaToken(action: string = 'submit'): Promise<string> {
	if (!browser) {
		throw new Error('reCAPTCHA only works in browser');
	}

	// Load reCAPTCHA if not already loaded
	await loadRecaptcha();

	return new Promise((resolve, reject) => {
		if (!window.grecaptcha || !window.grecaptcha.ready) {
			reject(new Error('reCAPTCHA not ready'));
			return;
		}

		window.grecaptcha.ready(() => {
			window.grecaptcha
				.execute(RECAPTCHA_SITE_KEY, { action })
				.then(resolve)
				.catch(reject);
		});
	});
}

/**
 * Verify reCAPTCHA token on server
 * This should be called from your server-side code
 */
export async function verifyRecaptchaToken(
	token: string,
	secretKey: string
): Promise<{ success: boolean; score?: number; action?: string; error?: string }> {
	try {
		const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: `secret=${secretKey}&response=${token}`
		});

		const data = await response.json();

		return {
			success: data.success,
			score: data.score,
			action: data.action,
				error: data['error-codes']?.[0]
		};
	} catch (error) {
		logger.error('reCAPTCHA verification failed:', error);
		return {
			success: false,
			error: 'Verification failed'
		};
	}
}

/**
 * Check if reCAPTCHA is loaded
 */
export function isRecaptchaLoaded(): boolean {
	return recaptchaLoaded;
}

/**
 * Reset reCAPTCHA
 */
export function resetRecaptcha(): void {
	if (!browser || !window.grecaptcha) return;

	try {
		window.grecaptcha.reset();
	} catch (error) {
		logger.error('Failed to reset reCAPTCHA:', error);
	}
}
