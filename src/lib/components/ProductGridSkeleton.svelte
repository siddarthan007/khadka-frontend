<script lang="ts">
	interface Props {
		count?: number;
		class?: string;
	}

	let { count = 12, class: className = '' }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 {className}">
	{#each Array(count) as _, i (i)}
		<div class="card bg-base-100 shadow-xl animate-pulse">
			<!-- Image skeleton -->
			<div class="relative aspect-square bg-gray-300 dark:bg-gray-700">
				<div class="shimmer"></div>
			</div>

			<div class="card-body p-4">
				<!-- Title skeleton -->
				<div class="h-5 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2">
					<div class="shimmer"></div>
				</div>

				<!-- Description skeleton -->
				<div class="space-y-2 mb-3">
					<div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full">
						<div class="shimmer"></div>
					</div>
					<div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-5/6">
						<div class="shimmer"></div>
					</div>
				</div>

				<!-- Price skeleton -->
				<div class="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-3">
					<div class="shimmer"></div>
				</div>

				<!-- Button skeleton -->
				<div class="h-10 bg-gray-300 dark:bg-gray-700 rounded">
					<div class="shimmer"></div>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.shimmer {
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.3),
			transparent
		);
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% {
			left: -100%;
		}
		100% {
			left: 100%;
		}
	}

	:global(.dark) .shimmer {
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.1),
			transparent
		);
	}
</style>
