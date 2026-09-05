import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Solution } from '@/lib/data4u';

/**
 * Produktkarte als Datenblatt-Eintrag: laufende Nummer, Segment, Name,
 * ein Satz, dann die Module als schlichte Liste.
 *
 * Bewusst ohne Häkchen-Symbole und ohne Zier-Ecken — der Erkennungsrahmen
 * bleibt den biometrischen Abbildungen vorbehalten, wo er etwas bedeutet.
 * Der gesamte Kachelbereich ist klickbar (Overlay-Link), die sichtbare
 * Aktion bleibt ein echter Textlink: Maus, Tastatur und Screenreader
 * bekommen dasselbe Ziel, ohne verschachtelte Links.
 */
export function SolutionCard({
  solution,
  index,
}: {
  solution: Solution;
  index: number;
}) {
  return (
    <article className="card card-hover solution-card">
      <div className="solution-head">
        <span className="solution-index">{String(index + 1).padStart(2, '0')}</span>
        <p className="solution-eyebrow">{solution.eyebrow}</p>
      </div>

      <h3 className="t-h3 solution-title">{solution.name}</h3>
      <p className="t-body mt-3">{solution.short}</p>

      <ul className="solution-list">
        {solution.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>

      <p className="solution-foot">
        <Link href={solution.href} className="link-arrow solution-link">
          {solution.cta}
          <ArrowRight size={16} strokeWidth={2} aria-hidden />
        </Link>
      </p>
    </article>
  );
}
