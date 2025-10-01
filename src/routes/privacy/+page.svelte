<script lang="ts">
	import SEO from "$lib/components/SEO.svelte";
	import logo from "$lib/assets/logo.png";
</script>

<SEO
	title="Privacy Policy - Khadka Foods"
	description="Read our Privacy Policy to understand how we collect, use, and protect your personal information at Khadka Foods."
	keywords={[
		"privacy policy",
		"data protection",
		"GDPR",
		"privacy",
		"Khadka Foods",
	]}
	canonical="https://khadkafoods.com/privacy"
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
							class="absolute inset-0 rounded-full bg-secondary/20 blur-xl"
						></div>
						<img
							src={logo}
							alt="Khadka Foods Logo"
							class="relative h-20 w-20 rounded-full shadow-xl ring-4 ring-base-100"
						/>
					</div>
				</div>
				<h1
					class="text-4xl font-bold tracking-tight text-secondary md:text-5xl mb-3"
				>
					Privacy Policy
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
						<h2>1. Information We Collect</h2>
						<p>
							We collect information you provide directly to us,
							such as when you create an account, make a purchase,
							subscribe to our newsletter, or contact us for
							support. This may include:
						</p>
						<ul>
							<li>
								Name, email address, and contact information
							</li>
							<li>Billing and shipping addresses</li>
							<li>
								Payment information (processed securely by our
								payment processors)
							</li>
							<li>Order history and preferences</li>
							<li>Communications with us</li>
						</ul>

						<h2>2. How We Use Your Information</h2>
						<p>We use the information we collect to:</p>
						<ul>
							<li>Process and fulfill your orders</li>
							<li>Provide customer service and support</li>
							<li>
								Send you important updates about your orders
							</li>
							<li>
								Send marketing communications (with your
								consent)
							</li>
							<li>Improve our products and services</li>
							<li>Prevent fraud and maintain security</li>
							<li>Comply with legal obligations</li>
						</ul>

						<h2>3. Information Sharing</h2>
						<p>
							We do not sell, trade, or otherwise transfer your
							personal information to third parties without your
							consent, except as described in this policy:
						</p>
						<ul>
							<li>
								<strong>Service Providers:</strong> We may share
								information with trusted third-party service providers
								who assist us in operating our website, conducting
								our business, or servicing you
							</li>
							<li>
								<strong>Legal Requirements:</strong> We may disclose
								information if required by law or to protect our
								rights and safety
							</li>
							<li>
								<strong>Business Transfers:</strong> In the event
								of a merger, acquisition, or sale of assets, your
								information may be transferred
							</li>
						</ul>

						<h2>4. Data Security</h2>
						<p>
							We implement appropriate technical and
							organizational security measures to protect your
							personal information against unauthorized access,
							alteration, disclosure, or destruction. This
							includes:
						</p>
						<ul>
							<li>SSL/TLS encryption for data transmission</li>
							<li>Secure payment processing</li>
							<li>Regular security assessments</li>
							<li>Employee training on data protection</li>
						</ul>

						<h2>5. Cookies and Tracking</h2>
						<p>
							We use cookies and similar technologies to enhance
							your browsing experience, analyze site traffic, and
							personalize content. You can control cookie settings
							through your browser preferences.
						</p>

						<h2>6. Your Rights</h2>
						<p>You have the right to:</p>
						<ul>
							<li>
								Access the personal information we hold about
								you
							</li>
							<li>
								Correct inaccurate or incomplete information
							</li>
							<li>
								Request deletion of your personal information
							</li>
							<li>
								Object to or restrict processing of your
								information
							</li>
							<li>Data portability</li>
							<li>
								Withdraw consent for marketing communications
							</li>
						</ul>

						<h2>7. Third-Party Links</h2>
						<p>
							Our website may contain links to third-party
							websites. We are not responsible for the privacy
							practices or content of these external sites. We
							encourage you to review the privacy policies of any
							third-party sites you visit.
						</p>

						<h2>8. Children's Privacy</h2>
						<p>
							Our services are not intended for children under 13.
							We do not knowingly collect personal information
							from children under 13. If we become aware that we
							have collected personal information from a child
							under 13, we will take steps to delete such
							information.
						</p>

						<h2>9. International Data Transfers</h2>
						<p>
							Your information may be transferred to and processed
							in countries other than your own. We ensure
							appropriate safeguards are in place to protect your
							information during such transfers.
						</p>

						<h2>10. Data Retention</h2>
						<p>
							We retain your personal information for as long as
							necessary to provide our services, comply with legal
							obligations, resolve disputes, and enforce our
							agreements. When information is no longer needed, we
							securely delete or anonymize it.
						</p>

						<h2>11. Changes to This Policy</h2>
						<p>
							We may update this Privacy Policy from time to time.
							We will notify you of any changes by posting the new
							Privacy Policy on this page and updating the "Last
							updated" date.
						</p>

						<h2>12. Contact Us</h2>
						<p>
							If you have any questions about this Privacy Policy
							or our data practices, please contact us through our
							website or use the contact information provided in
							our About page.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
