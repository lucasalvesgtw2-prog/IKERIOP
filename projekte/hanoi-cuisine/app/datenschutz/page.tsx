import type { Metadata } from 'next';
import { addressLine, restaurant } from '@/lib/restaurant';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Datenschutz',
  robots: { index: false, follow: true },
};

export default function Datenschutz() {
  return (
    <LegalPage title="Datenschutz">
      <h2>Verantwortlich</h2>
      <p>
        {restaurant.legalName}
        <br />
        {addressLine}
        <br />
        <a href={`mailto:${restaurant.email}`} className="underline underline-offset-4">
          {restaurant.email}
        </a>
      </p>

      <h2>Was diese Website tut</h2>
      <p>
        Diese Seite lädt <strong>keine externen Ressourcen</strong>. Die Schriften
        Prata und Be Vietnam Pro werden mitgeliefert und vom eigenen Server
        ausgeliefert — es entsteht keine Verbindung zu Google Fonts. Es werden
        keine Cookies gesetzt, kein Tracking eingebunden und keine Analyse-Dienste
        verwendet. Ein Einwilligungsbanner ist deshalb nicht erforderlich.
      </p>

      <h2>Server-Logfiles</h2>
      <p>
        Beim Aufruf erhebt der Hosting-Anbieter technisch notwendige Zugriffsdaten
        (IP-Adresse, Zeitpunkt, abgerufene Datei, Browsertyp). Rechtsgrundlage ist
        Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO. Den Anbieter und die
        Speicherdauer trägt der Betreiber hier ein.
      </p>

      <h2>Externe Links</h2>
      <p>
        Die Schaltfläche „Online reservieren“ führt zu Quandoo, die Lieferung zu
        Uber Eats, die Bewertungen zu Google und Tripadvisor. Erst mit dem Klick
        verlassen Sie diese Seite; ab dann gelten die Datenschutzbestimmungen des
        jeweiligen Anbieters.
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung, Datenübertragbarkeit und Widerspruch sowie ein
        Beschwerderecht bei einer Aufsichtsbehörde.
      </p>
    </LegalPage>
  );
}
