import { ArrowUpRight } from 'lucide-react';
import { rating, reviewSources } from '@/lib/restaurant';
import { Reveal, SplitHeading } from './Reveal';

/**
 * Akt 07 — Social Proof, ohne erfundene Stimmen.
 *
 * Es steht hier bewusst kein erdachtes Zitat und keine Zahl ohne Beleg. Die
 * Sektion führt Gäste direkt zu den echten Profilen; sobald `rating` in
 * lib/restaurant.ts gepflegt ist, erscheint die Statistik automatisch.
 */
export function Reviews() {
  return (
    <section id="bewertungen" className="relative z-10 bg-lacquer-2">
      <div className="mx-auto max-w-[1600px] px-6 py-32 md:px-12 md:py-44">
        <Reveal>
          <p className="eyebrow text-gold/70">07 — Gäste</p>
        </Reveal>

        <div className="mt-8 grid gap-16 md:grid-cols-12">
          <div className="md:col-span-7">
            <SplitHeading
              text="Tausende Gäste haben schon geschrieben, wie es war."
              className="max-w-[15ch] font-display text-[clamp(2rem,4.6vw,4.2rem)] text-paper"
            />

            {rating && (
              <Reveal className="mt-12 flex items-baseline gap-5" delay={0.1}>
                <span className="font-display text-[clamp(3.5rem,9vw,7rem)] leading-none text-gold">
                  {rating.score.toLocaleString('de-DE', { minimumFractionDigits: 1 })}
                </span>
                <span className="text-paper/50">
                  von 5 · {rating.count.toLocaleString('de-DE')} Bewertungen auf {rating.source}
                </span>
              </Reveal>
            )}
          </div>

          <Reveal className="md:col-span-5" delay={0.15}>
            <p className="prose-vi text-lg text-paper/60">
              Am häufigsten schreiben Gäste über die Größe der Karte und darüber,
              was ein Abend hier kostet. Lesen Sie selbst — ungefiltert, direkt
              bei der Quelle.
            </p>

            <ul className="mt-10 divide-y divide-paper/10 border-y border-paper/10">
              {reviewSources.map((source) => (
                <li key={source.name}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between py-5 text-paper/80 transition-colors hover:text-gold"
                  >
                    <span className="font-display text-2xl">{source.name}</span>
                    <ArrowUpRight
                      size={20}
                      strokeWidth={1.4}
                      className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
