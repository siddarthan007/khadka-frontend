import type { PageServerLoad } from './$types';
import { getHeroSlides } from '$lib/server/medusa';
import { listBasicProducts } from '$lib/medusa';

export const load: PageServerLoad = async ({ parent }) => {
	const slides = (await getHeroSlides()) ?? [];
	const parentData = (await parent()) as { collectionItems?: Array<{ title: string; handle: string; emoji?: string }> };
	const collectionItems = parentData?.collectionItems ?? [];
	const { products: initialProducts, count: initialCount } = await listBasicProducts(16, 0);
	// Fallback slides (for local dev if API empty)
	const fallback = [
		{
			image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1600&auto=format&fit=crop',
			title: 'Discover fresh styles',
			accent: 'for every season',
			subtitle: 'Curated collections with free shipping over $75',
			ctaPrimary: { label: 'Shop new arrivals', href: '/store' },
			ctaSecondary: { label: 'Browse categories', href: '/categories' },
			contentPosition: 'center-left',
			textAlign: 'left'
		},
		{
			image: 'https://images.unsplash.com/photo-1520975922131-c3c5ab02438a?q=80&w=1600&auto=format&fit=crop',
			title: 'Essential everyday gear',
			accent: 'built to last',
			subtitle: 'Sustainable materials and timeless design for modern life',
			ctaPrimary: { label: 'Explore bestsellers', href: '/store' },
			ctaSecondary: { label: 'Learn more', href: '/about' },
			contentPosition: 'center',
			textAlign: 'center'
		},
		{
			image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1600&auto=format&fit=crop',
			title: 'Members get more',
			accent: 'join and save',
			subtitle: 'Sign up for exclusive drops and early access',
			ctaPrimary: { label: 'Join now', href: '/account' },
			ctaSecondary: { label: 'View perks', href: '/perks' },
			contentPosition: 'bottom-right',
			textAlign: 'right'
		}
	];

	return {
		slides: slides.length > 0 ? slides : fallback,
		collectionItems,
		initialProducts,
		initialCount
	};
};
