import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for the Loddiswell Playing Field & Village Hall Trust website.",
};

export default function PrivacyPage() {
  return (
    <div>
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="prose max-w-none space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-3">1. Who We Are</h2>
              <p className="text-muted-foreground">
                This website is operated by the Loddiswell Playing Fields and Village Hall Trust. Our contact email is{" "}
                <a href="mailto:hello@loddiswellcommunitytrust.org">
                  hello@loddiswellcommunitytrust.org
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">2. What Data We Collect</h2>
              <p className="text-muted-foreground">We may collect the following personal data:</p>
              <ul className="mt-2 space-y-2 text-muted-foreground list-disc list-inside">
                <li>Name and email address (via the contact form)</li>
                <li>Name, email, and payment details (for lottery ticket purchases, processed securely via Stripe)</li>
                <li>Booking enquiry details</li>
                <li>Website usage data via cookies (see section 6)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">3. How We Use Your Data</h2>
              <p className="text-muted-foreground">We use your personal data to:</p>
              <ul className="mt-2 space-y-2 text-muted-foreground list-disc list-inside">
                <li>Respond to your enquiries and messages</li>
                <li>Process lottery ticket purchases and manage your entry</li>
                <li>Manage facility bookings</li>
                <li>Send you information about community events (only if you have opted in)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">4. Data Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell, trade, or rent your personal data to third parties. We may share data with trusted service providers who assist us in operating the website (e.g., Stripe for payment processing, Vercel for website hosting). These providers are contractually obligated to protect your data.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain personal data only for as long as necessary for the purposes for which it was collected. Contact form submissions are retained for up to 12 months. Lottery subscriber data is retained for the duration of participation plus 12 months. You can request deletion of your data at any time.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">6. Cookies</h2>
              <p className="text-muted-foreground">
                This website uses essential cookies that are necessary for the website to function properly. We do not use tracking or advertising cookies. Essential cookies include authentication tokens for site administrators.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">7. Your Rights</h2>
              <p className="text-muted-foreground">
                Under UK data protection law (UK GDPR), you have the right to:
              </p>
              <ul className="mt-2 space-y-2 text-muted-foreground list-disc list-inside">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request transfer of your data</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:hello@loddiswellcommunitytrust.org">
                  hello@loddiswellcommunitytrust.org
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Last updated: February 2026
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
