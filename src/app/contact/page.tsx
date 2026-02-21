import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Loddiswell Playing Field & Village Hall Trust. Find us, email us, or call our Bookings Secretary.",
};

export default function ContactPage() {
  return (
    <div>
      {/* Page Header */}
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Contact Us</h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl">
            Have a question, want to book a facility, or get involved? We&apos;d
            love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
              <ContactForm />
            </div>

            {/* Contact Details */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 flex-shrink-0">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Email</h3>
                      <a
                        href="mailto:hello@loddiswellcommunitytrust.org"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        hello@loddiswellcommunitytrust.org
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 flex-shrink-0">
                      <Phone className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Bookings Secretary</h3>
                      <a
                        href="tel:07716162407"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        07716 162407
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        For urgent booking enquiries
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 flex-shrink-0">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Village Hall</h3>
                      <p className="text-sm text-muted-foreground">
                        South Brent Road
                        <br />
                        Loddiswell
                        <br />
                        Nr Kingsbridge
                        <br />
                        Devon, TQ7 4RH
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 flex-shrink-0">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Playing Fields & Pavilion</h3>
                      <p className="text-sm text-muted-foreground">
                        Loddiswell Playing Fields
                        <br />
                        Loddiswell
                        <br />
                        Devon, TQ7 4QH
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Embed */}
              <div className="rounded-xl border border-border overflow-hidden">
                <iframe
                  src="https://www.openstreetmap.org/export/embed.html?bbox=-3.7900%2C50.3100%2C-3.7600%2C50.3300&amp;layer=mapnik&amp;marker=50.3200%2C-3.7750"
                  title="Map showing Loddiswell village location"
                  className="w-full h-64 border-0"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
