import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Users, History } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about the Loddiswell Playing Field & Village Hall Trust - our history, mission, and the trustees who keep our community facilities running.",
};

const trustees = [
  { name: "Trustee 1", role: "Chair" },
  { name: "Trustee 2", role: "Vice Chair" },
  { name: "Trustee 3", role: "Treasurer" },
  { name: "Trustee 4", role: "Secretary" },
  { name: "Trustee 5", role: "Trustee" },
  { name: "Trustee 6", role: "Trustee" },
];

export default function AboutPage() {
  return (
    <div>
      {/* Page Header */}
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">About the Trust</h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl">
            The Loddiswell Playing Fields and Village Hall Trust was formed to
            maintain and manage community facilities for the benefit of
            Loddiswell Parish inhabitants.
          </p>
        </div>
      </section>

      {/* History & Mission */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <History
                  className="h-8 w-8 text-green-600"
                  aria-hidden="true"
                />
                <h2 className="text-2xl font-bold">Our History</h2>
              </div>
              <div className="prose text-muted-foreground space-y-4">
                <p>
                  Loddiswell is a parish and village in the South Hams district
                  of Devon, with a history stretching back to Roman times. The
                  village was recorded in the Domesday Book in 1086, and its name
                  is a corruption of &quot;Saint Loda&apos;s well.&quot;
                </p>
                <p>
                  The Trust was established to ensure the village&apos;s
                  community facilities — the Village Hall, Pavilion, Playing
                  Fields, Tennis Courts, and Play Park — are properly maintained
                  and available for everyone to use and enjoy.
                </p>
                <p>
                  Run entirely by volunteers, the Trust committee meets regularly
                  to oversee the upkeep of these vital community spaces and plan
                  improvements for the future.
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users
                  className="h-8 w-8 text-green-600"
                  aria-hidden="true"
                />
                <h2 className="text-2xl font-bold">Our Mission</h2>
              </div>
              <div className="prose text-muted-foreground space-y-4">
                <p>
                  Our mission is to maintain and improve the playing fields,
                  village hall, and associated facilities for the recreational
                  and social benefit of the people of Loddiswell Parish.
                </p>
                <p>We aim to:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    Keep all facilities in good repair and fit for purpose
                  </li>
                  <li>
                    Make facilities accessible and affordable for all community
                    members
                  </li>
                  <li>
                    Support local clubs, groups, and events that bring the
                    community together
                  </li>
                  <li>
                    Plan and deliver improvements that benefit future generations
                  </li>
                  <li>
                    Raise funds to ensure the long-term sustainability of our
                    facilities
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trustees */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8">Our Trustees</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            The Trust is managed by a dedicated committee of volunteers from the
            local community. They give their time freely to ensure our facilities
            are well-maintained and available for everyone.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustees.map((trustee) => (
              <div
                key={trustee.name}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium text-foreground">{trustee.name}</p>
                <p className="text-sm text-muted-foreground">{trustee.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <FileText
              className="h-8 w-8 text-green-600"
              aria-hidden="true"
            />
            <h2 className="text-2xl font-bold">Documents</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Meeting minutes, AGM documents, and policies are available below.
            These are regularly updated by the Trust committee.
          </p>
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-muted-foreground">
              Documents will be available here once uploaded by the Trust
              committee.
            </p>
          </div>
        </div>
      </section>

      {/* Get Involved CTA */}
      <section className="py-16 bg-green-700 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Get Involved</h2>
          <p className="mt-4 text-green-100 max-w-xl mx-auto">
            Whether you&apos;d like to volunteer, join a club, or support the
            Trust through our community lottery, there are many ways to get
            involved.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-green-700 no-underline hover:bg-green-50 transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/lottery"
              className="inline-flex items-center rounded-md border border-green-300 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-green-600 transition-colors"
            >
              Join the Lottery
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
