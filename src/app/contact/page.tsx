import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline } from "@/lib/cms/render";
import { getSettings } from "@/actions/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("contact");
  return {
    title: title || "Contact",
    description:
      metaDescription ||
      "Get in touch with the Loddiswell Playing Fields & Village Hall Trust. Find us, email us, or call our Bookings Secretary.",
  };
}

export default async function ContactPage() {
  const [{ blocks, heroImageUrl }, settings] = await Promise.all([
    getPageContent("contact"),
    getSettings(),
  ]);

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Get in Touch")}
        title={renderInline(blocks.header_title, "Contact Us")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "Have a question, want to book a facility, or get involved? We'd love to hear from you."
        )}
        heroImageUrl={heroImageUrl ?? undefined}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
                {renderInline(blocks.form_eyebrow, "Write to Us")}
              </p>
              <h2 className="font-serif text-2xl mb-6">
                {renderInline(blocks.form_title, "Send Us a Message")}
              </h2>
              <ContactForm />
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
                  {renderInline(blocks.details_eyebrow, "Contact Details")}
                </p>
                <h2 className="font-serif text-2xl mb-6">
                  {renderInline(blocks.details_title, "Get in Touch")}
                </h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700 flex-shrink-0">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Email</h3>
                      <a
                        href={`mailto:${settings?.emailAddress || "hello@loddiswellcommunitytrust.org"}`}
                        className="text-sm text-muted-foreground hover:text-copper-500"
                      >
                        {settings?.emailAddress || "hello@loddiswellcommunitytrust.org"}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700 flex-shrink-0">
                      <Phone className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium">Bookings Secretary</h3>
                      {settings?.bookingsPhoneNumber && (
                        <a
                          href={`tel:${settings.bookingsPhoneNumber.replace(/\s/g, "")}`}
                          className="text-sm text-muted-foreground hover:text-copper-500"
                        >
                          {settings.bookingsPhoneNumber}
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {renderInline(
                          blocks.phone_note,
                          "For urgent booking enquiries"
                        )}
                      </p>
                    </div>
                  </div>

                  {settings?.villageHallAddress && (
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700 flex-shrink-0">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-medium">Village Hall</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {settings.villageHallAddress}
                        </p>
                      </div>
                    </div>
                  )}

                  {settings?.pavilionAddress && (
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700 flex-shrink-0">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-medium">Playing Fields & Pavilion</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {settings.pavilionAddress}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(settings?.mapLongitude || "-3.80193") - 0.01}%2C${parseFloat(settings?.mapLatitude || "50.325178") - 0.01}%2C${parseFloat(settings?.mapLongitude || "-3.80193") + 0.01}%2C${parseFloat(settings?.mapLatitude || "50.325178") + 0.01}&layer=mapnik&marker=${settings?.mapLatitude || "50.325178"}%2C${settings?.mapLongitude || "-3.80193"}`}
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
