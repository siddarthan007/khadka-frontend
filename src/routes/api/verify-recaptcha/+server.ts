import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/logger';
import { env as privateEnv } from '$env/dynamic/private';

const RECAPTCHA_SECRET_KEY = privateEnv.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { token, action } = await request.json();

		if (!token) {
			return json({ success: false, error: 'No token provided' }, { status: 400 });
		}

		if (!RECAPTCHA_SECRET_KEY) {
			logger.warn('reCAPTCHA secret key not configured - skipping verification');
			return json({ success: true, score: 1.0, action });
		}

		// Verify token with Google
		const response = await fetch(RECAPTCHA_VERIFY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: RECAPTCHA_SECRET_KEY,
				response: token
			})
		});

		const data = await response.json();

		if (!data.success) {
			return json(
				{
					success: false,
					error: 'reCAPTCHA verification failed',
					errorCodes: data['error-codes']
				},
				{ status: 400 }
			);
		}

		// Check score threshold (0.5 is recommended for v3)
		const score = data.score || 0;
		const expectedAction = data.action;

		if (score < 0.5) {
			return json(
				{
					success: false,
					error: 'Low reCAPTCHA score - possible bot activity',
					score
				},
				{ status: 403 }
			);
		}

		// Verify action matches
		if (action && expectedAction !== action) {
			return json(
				{
					success: false,
					error: 'Action mismatch',
					expected: action,
					received: expectedAction
				},
				{ status: 400 }
			);
		}

		return json({
			success: true,
			score,
			action: expectedAction
		});
	} catch (error) {
		logger.error('reCAPTCHA verification error:', error);
		return json(
			{ success: false, error: 'Internal verification error' },
			{ status: 500 }
		);
	}
};
