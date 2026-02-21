import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for the Loddiswell Playing Field & Village Hall Trust website.",
};

export default function TermsPage() {
  return (
    <div>
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Terms & Conditions</h1>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="prose max-w-none space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                These terms and conditions govern your use of the Loddiswell Playing Field & Village Hall Trust website. By using this website, you accept these terms in full.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">2. Use of Website</h2>
              <p className="text-muted-foreground">
                This website is provided for the benefit of the Loddiswell community. You must not use the website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">3. Facility Hire</h2>
              <p className="text-muted-foreground">
                All facility bookings are subject to the Trust&apos;s hire terms and conditions, which are provided at the time of booking. The Trust reserves the right to refuse or cancel bookings at its discretion.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">4. Community Lottery</h2>
              <p className="text-muted-foreground">
                The Loddiswell Community Lottery is operated by the Loddiswell Playing Fields and Village Hall Trust. Lottery tickets cost £12 each per year. Participants must be 16 years or older. The Trust reserves the right to amend lottery rules with reasonable notice.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">5. Intellectual Property</h2>
              <p className="text-muted-foreground">
                Unless otherwise stated, the Trust owns the intellectual property rights in the website and material on the website. All content is protected by copyright.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                The information on this website is provided free of charge, and you acknowledge that it would be unreasonable to hold us liable in respect of this website and the information on this website. We will not be liable for any loss or damage arising from the use of this website.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">7. Changes to Terms</h2>
              <p className="text-muted-foreground">
                The Trust may revise these terms from time to time. Revised terms will apply to the use of this website from the date of publication. Please check this page regularly to ensure you are familiar with the current version.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">8. Contact</h2>
              <p className="text-muted-foreground">
                If you have any questions about these terms, please contact us at{" "}
                <a href="mailto:hello@loddiswellcommunitytrust.org">
                  hello@loddiswellcommunitytrust.org
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
