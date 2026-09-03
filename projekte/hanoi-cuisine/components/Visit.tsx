import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { restaurant } from '@/lib/restaurant';
import { Reveal, SplitHeading } from './Reveal';

/** Akt 08 — die harten Fakten. Alles anklickbar, alles überprüfbar. */
export function Visit() {
  return (
    <section id="besuch" className="relative z-10 bg-paper text-ink">
      <div className="mx-auto max-w-[1600px] px-6 py-32 md:px-12 md:py-48">
        <Reveal>
          <p className="eyebrow text-son">08 — Besuch</p>
        </Reveal>

        <SplitHeading
          text="Brühl 54, gleich hinter dem Bahnhof."
          className="mt-8 max-w-[14ch] font-display text-[clamp(2rem,5vw,4.6rem)] text-ink"
        />

        <div className="mt-20 grid gap-14 md:grid-cols-2">
          <Reveal>
            <h3 className="eyebrow flex items-center gap-2 text-ink/40">
              <Clock size={13} strokeWidth={1.6} /> Öffnungszeiten
            </h3>
            <dl className="mt-6 border-t border-ink/10">
              {restaurant.hours.map((h) => (
                <div
                  key={h.label}
                  className="flex items-baseline justify-between gap-6 border-b border-ink/10 py-4"
                >
                  <dt className="text-ink/70">{h.label}</dt>
                  <dd className="font-display text-xl tabular-nums text-ink">
                    {h.open} – {h.close}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-ink/45">
              Durchgehend warme Küche. Für größere Gruppen lohnt der Anruf.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <h3 className="eyebrow flex items-center gap-2 text-ink/40">
              <MapPin size={13} strokeWidth={1.6} /> Adresse &amp; Kontakt
            </h3>

            <address className="mt-6 not-italic">
              <a
                href={restaurant.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="group block font-display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight text-ink transition-colors hover:text-son"
              >
                {restaurant.street}
                <span className="block text-ink/50 transition-colors group-hover:text-son/70">
                  {restaurant.postalCode} {restaurant.city}
                </span>
              </a>

              <div className="mt-8 flex flex-col gap-3">
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-3 text-ink/70 transition-colors hover:text-son"
                >
                  <Phone size={16} strokeWidth={1.5} />
                  {restaurant.phoneDisplay}
                </a>
                <a
                  href={`mailto:${restaurant.email}`}
                  className="flex items-center gap-3 text-ink/70 transition-colors hover:text-son"
                >
                  <Mail size={16} strokeWidth={1.5} />
                  {restaurant.email}
                </a>
              </div>
            </address>

            <a
              href={restaurant.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm text-ink transition-colors hover:border-son hover:text-son"
            >
              <MapPin size={15} strokeWidth={1.5} /> Route öffnen
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
