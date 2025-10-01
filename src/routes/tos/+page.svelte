<script lang="ts">
	import SEO from "$lib/components/SEO.svelte";
	import logo from "$lib/assets/logo.png";
</script>

<SEO
	title="Terms of Service - KhadkaFoods"
	description="Read our Terms of Service to understand the rules and regulations for using KhadkaFoods services."
	keywords={[
		"terms of service",
		"terms and conditions",
		"user agreement",
		"KhadkaFoods",
	]}
	canonical="https://khadkafoods.com/tos"
/>

<div class="min-h-screen bg-base-100">
	<!-- Header -->
	<section
		class="border-b-2 border-base-300/50 bg-base-200/30 backdrop-blur-sm py-16"
	>
		<div class="mx-auto max-w-4xl px-4 md:px-6">
			<div class="text-center">
				<div class="mb-6 flex justify-center">
					<div class="relative">
						<div
							class="absolute inset-0 rounded-full bg-primary/20 blur-xl"
						></div>
						<img
							src={logo}
							alt="KhadkaFoods Logo"
							class="relative h-20 w-20 rounded-full shadow-xl ring-4 ring-base-100"
						/>
					</div>
				</div>
				<h1
					class="text-4xl font-bold tracking-tight text-primary md:text-5xl mb-3"
				>
					Terms of Service
				</h1>
				<p class="mt-4 text-lg text-base-content/60 font-medium">
					Last updated: {new Date().toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
					})}
				</p>
			</div>
		</div>
	</section>

	<!-- Content -->
	<section class="py-16">
		<div class="mx-auto max-w-4xl px-4 md:px-6">
			<div
				class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl"
			>
				<div class="card-body p-8 md:p-12">
					<div class="prose prose-lg mx-auto max-w-3xl">
						<h2>1. Acceptance of Terms</h2>
						<p>
							By accessing and using KhadkaFoods ("we," "us," or
							"our"), you accept and agree to be bound by the
							terms and provision of this agreement. If you do not
							agree to abide by the above, please do not use this
							service.
						</p>

						<h2>2. Use License</h2>
						<p>
							Permission is granted to temporarily download one
							copy of the materials on KhadkaFoods for personal,
							non-commercial transitory viewing only. This is the
							grant of a license, not a transfer of title, and
							under this license you may not:
						</p>
						<ul>
							<li>Modify or copy the materials</li>
							<li>
								Use the materials for any commercial purpose or
								for any public display
							</li>
							<li>
								Attempt to decompile or reverse engineer any
								software contained on KhadkaFoods
							</li>
							<li>
								Remove any copyright or other proprietary
								notations from the materials
							</li>
						</ul>

						<h2>3. Product Information and Pricing</h2>
						<p>
							We strive to provide accurate product descriptions
							and pricing information. However, we do not warrant
							that product descriptions or other content on our
							site are accurate, complete, reliable, current, or
							error-free. Prices are subject to change without
							notice.
						</p>

						<h2>4. Orders and Payment</h2>
						<p>
							All orders are subject to acceptance and
							availability. We reserve the right to refuse or
							cancel any order for any reason, including but not
							limited to product availability, errors in product
							information, or payment issues. Payment must be
							received in full before order processing begins.
						</p>

						<h2>5. Shipping and Delivery</h2>
						<p>
							We will make reasonable efforts to deliver products
							within the estimated timeframe. However, delivery
							dates are estimates only and we are not liable for
							delays caused by factors beyond our control.
						</p>

						<h2>6. Returns and Refunds</h2>
						<p>
							Items may be returned within 30 days of purchase for
							a full refund, provided they are in their original
							condition and packaging. Custom or personalized
							items are not eligible for return unless defective.
							Refunds will be processed within 5-7 business days
							after receipt of returned items.
						</p>

						<h2>7. User Accounts</h2>
						<p>
							When you create an account with us, you must provide
							information that is accurate, complete, and current
							at all times. You are responsible for safeguarding
							the password and for all activities that occur under
							your account.
						</p>

						<h2>8. Privacy Policy</h2>
						<p>
							Your privacy is important to us. Please review our
							Privacy Policy, which also governs your use of
							KhadkaFoods, to understand our practices.
						</p>

						<h2>9. Limitation of Liability</h2>
						<p>
							In no event shall KhadkaFoods or its suppliers be
							liable for any damages (including, without
							limitation, damages for loss of data or profit, or
							due to business interruption) arising out of the use
							or inability to use the materials on KhadkaFoods,
							even if KhadkaFoods or a KhadkaFoods authorized
							representative has been notified orally or in
							writing of the possibility of such damage.
						</p>

						<h2>10. Governing Law</h2>
						<p>
							These terms and conditions are governed by and
							construed in accordance with the laws of your
							jurisdiction, and you irrevocably submit to the
							exclusive jurisdiction of the courts in that state
							or location.
						</p>

						<h2>11. Changes to Terms</h2>
						<p>
							We reserve the right, at our sole discretion, to
							modify or replace these Terms at any time. If a
							revision is material, we will try to provide at
							least 30 days notice prior to any new terms taking
							effect.
						</p>

						<h2>12. Contact Information</h2>
						<p>
							If you have any questions about these Terms of
							Service, please contact us through our website or
							use the contact information provided in our About
							page.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
