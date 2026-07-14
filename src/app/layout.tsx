import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteChrome } from "@/components/layout/site-chrome";
import { NewsletterSignup } from "@/components/newsletter-signup";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Loddiswell Playing Fields & Village Hall Trust",
    template: "%s | Loddiswell Community Trust",
  },
  description:
    "Community facilities for Loddiswell Parish - Village Hall, Pavilion, Playing Fields, Tennis Courts. Book facilities, find events, and join our community lottery.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Loddiswell Playing Fields & Village Hall Trust",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CommunityOrganization",
  name: "Loddiswell Playing Fields & Village Hall Trust",
  description:
    "Community trust managing the Village Hall, Pavilion, Playing Fields, Tennis Courts, and Play Park in Loddiswell, South Hams, Devon.",
  url: "https://loddiswellcommunitytrust.org",
  email: "hello@loddiswellcommunitytrust.org",
  telephone: "07942335210",
  address: {
    "@type": "PostalAddress",
    streetAddress: "South Brent Road",
    addressLocality: "Loddiswell",
    addressRegion: "Devon",
    postalCode: "TQ7 4RH",
    addressCountry: "GB",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 50.32,
    longitude: -3.775,
  },
  areaServed: {
    "@type": "Place",
    name: "Loddiswell Parish, South Hams, Devon",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteChrome>
          <Header />
        </SiteChrome>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteChrome>
          <NewsletterSignup />
          <Footer />
        </SiteChrome>
      </body>
    </html>
  );
}
