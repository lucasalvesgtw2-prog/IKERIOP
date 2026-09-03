import type { Metadata } from 'next';
import { addressLine, restaurant } from '@/lib/restaurant';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Impressum',
  robots: { index: false, follow: true },
};

export default function Impressum() {
  return (
    <LegalPage title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {restaurant.legalName}
        <br />
        {addressLine}
      </p>

      <h2>Kontakt</h2>
      <p>
        Telefon:{' '}
        <a href={`tel:${restaurant.phone}`} className="underline underline-offset-4">
          {restaurant.phoneDisplay}
        </a>
        <br />
        E-Mail:{' '}
        <a href={`mailto:${restaurant.email}`} className="underline underline-offset-4">
          {restaurant.email}
        </a>
      </p>

      {/*
        Diese Angaben kann nur der Betreiber selbst liefern — sie stehen
        bewusst als Platzhalter hier, statt erfunden zu werden.
      */}
      <h2>Noch zu ergänzen</h2>
      <p>
        Vertretungsberechtigte Person, Registereintrag, Umsatzsteuer-Identifikations&shy;nummer
        nach § 27&nbsp;a UStG sowie die zuständige Aufsichtsbehörde ergänzt der
        Betreiber. Ohne diese Angaben ist die Seite nicht abmahnsicher.
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor
        einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalPage>
  );
}
