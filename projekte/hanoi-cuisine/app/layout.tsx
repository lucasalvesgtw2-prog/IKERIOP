import type { Metadata } from 'next';
import { Prata, Be_Vietnam_Pro } from 'next/font/google';
import { addressLine, restaurant } from '@/lib/restaurant';
import './globals.css';

/* Beide Familien werden mitgeliefert und selbst gehostet — keine Anfrage an
   Google beim Seitenaufruf (DSGVO) und kein Textflackern beim Laden.
   Das vietnamesische Subset ist zwingend: ohne es fehlen die Diakritika
   in „Hà Nội", „Phở" und „Bún bò". */
const prata = Prata({
  weight: '400',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-prata',
});

const beVietnam = Be_Vietnam_Pro({
  weight: ['300', '400', '500'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-be-vietnam',
});

const description =
  'Vietnamesische Küche am Brühl in Leipzig — Phở aus fünf Kräutern, handgerollte Sommerrollen und Hot Pot, 150 Meter vom Hauptbahnhof.';

export const metadata: Metadata = {
  metadataBase: new URL('https://hanoi-leipzig.de'),
  title: {
    default: `${restaurant.name} — Vietnamesisches Restaurant in Leipzig`,
    template: `%s — ${restaurant.name}`,
  },
  description,
  keywords: [
    'vietnamesisches Restaurant Leipzig',
    'Phở Leipzig',
    'Hot Pot Leipzig',
    'Brühl Leipzig Restaurant',
    'vegan asiatisch Leipzig',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: restaurant.name,
    title: `${restaurant.name} — Vietnamesisches Restaurant in Leipzig`,
    description,
  },
  twitter: { card: 'summary_large_image', title: restaurant.name, description },
  robots: { index: true, follow: true },
};

/** LocalBusiness/Restaurant-Auszeichnung für die lokale Google-Suche. */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: restaurant.legalName,
  image: `${restaurant.website}/og.jpg`,
  url: restaurant.website,
  telephone: restaurant.phone,
  email: restaurant.email,
  servesCuisine: ['Vietnamesisch', 'Asiatisch'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: restaurant.street,
    postalCode: restaurant.postalCode,
    addressLocality: restaurant.city,
    addressRegion: restaurant.region,
    addressCountry: restaurant.country,
  },
  hasMap: restaurant.maps,
  acceptsReservations: restaurant.reservation,
  sameAs: [restaurant.facebook],
  openingHoursSpecification: restaurant.hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.days.map((d) => `https://schema.org/${
      { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }[d]
    }`),
    opens: h.open,
    closes: h.close,
  })),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${prata.variable} ${beVietnam.variable}`}>
      <head>
        <meta name="theme-color" content="#100c0b" />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <a
          href="#hauptinhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
        >
          Zum Inhalt springen
        </a>
        {children}
        <span className="sr-only">{addressLine}</span>
      </body>
    </html>
  );
}
