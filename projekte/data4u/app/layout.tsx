import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ContactDock } from '@/components/ContactDock';
import { addressLines, company, contact } from '@/lib/data4u';
import './globals.css';

/* Beide Familien werden mitgeliefert und selbst ausgeliefert: keine Anfrage
   an Google beim Seitenaufruf und kein Textflackern beim Laden. Inter trägt
   die gesamte Oberfläche, JetBrains Mono nur die technischen Mikro-Labels. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-ui',
});

const description =
  'Software e equipamentos para gestão e controle de acesso: academias, empresas, condomínios e escolas. Biometria, reconhecimento facial, catracas e relógios de ponto.';

export const metadata: Metadata = {
  metadataBase: new URL(company.website),
  title: {
    default: `${company.fullName} — ${company.tagline}`,
    template: `%s — ${company.fullName}`,
  },
  description,
  keywords: [
    'controle de acesso',
    'software para academia',
    'catraca biométrica',
    'reconhecimento facial',
    'controle de acesso para condomínio',
    'relógio de ponto',
    'Brasília',
  ],
  authors: [{ name: company.legalName }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: company.fullName,
    title: `${company.fullName} — ${company.tagline}`,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${company.fullName} — ${company.tagline}`,
    description,
  },
  robots: { index: true, follow: true },
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#060a14' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Organization-Auszeichnung — nur belegte Angaben. */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: company.fullName,
  legalName: company.legalName,
  alternateName: company.foundedAs.name,
  url: company.website,
  foundingDate: String(company.foundedAs.year),
  description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: `${contact.address.street}, ${contact.address.building}`,
    addressLocality: contact.address.city,
    addressRegion: contact.address.state,
    postalCode: contact.address.zip,
    addressCountry: contact.address.country,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: contact.phone,
    email: contact.email,
    contactType: 'sales',
    areaServed: 'BR',
    availableLanguage: ['Portuguese'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable} no-js`}>
      <head>
        {/* Entfernt die no-js-Klasse, bevor der erste Frame gezeichnet wird:
            ohne JavaScript bleiben alle Reveal-Elemente sichtbar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.remove('no-js')`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        <Navbar />
        <main id="conteudo">{children}</main>
        <Footer addressLines={addressLines} />
        <ContactDock />
      </body>
    </html>
  );
}
