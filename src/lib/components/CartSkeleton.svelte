<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<div class="w-full space-y-4 {className}">
	{#each Array(3) as _, i (i)}
		<div class="card bg-base-100 shadow-lg animate-pulse">
			<div class="card-body p-4">
				<div class="flex gap-4">
					<!-- Image skeleton -->
					<div class="relative h-24 w-24 flex-shrink-0 bg-gray-300 dark:bg-gray-700 rounded">
						<div class="shimmer"></div>
					</div>

					<div class="flex-1 space-y-3">
						<!-- Title skeleton -->
						<div class="h-5 bg-gray-300 dark:bg-gray-700 rounded w-2/3">
							<div class="shimmer"></div>
						</div>

						<!-- Text skeleton -->
						<div class="space-y-2">
							<div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full">
								<div class="shimmer"></div>
							</div>
							<div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-4/5">
								<div class="shimmer"></div>
							</div>
						</div>

						<!-- Price skeleton -->
						<div class="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/4">
							<div class="shimmer"></div>
						</div>
					</div>
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
