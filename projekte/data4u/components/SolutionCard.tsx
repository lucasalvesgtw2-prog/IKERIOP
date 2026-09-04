import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { Solution } from '@/lib/data4u';
import { ScanCorners } from '@/components/ui/ScanFrame';

/**
 * Produktkarte. Der gesamte Kachelbereich ist klickbar (Overlay-Link), die
 * sichtbare Aktion bleibt aber ein echter Textlink — so bekommen Maus,
 * Tastatur und Screenreader dasselbe Ziel, ohne verschachtelte Links.
 */
export function SolutionCard({ solution }: { solution: Solution }) {
  return (
    <article className="card card-hover solution-card">
      <ScanCorners className="solution-corners" />

      <div className="solution-head">
        <p className="solution-eyebrow">{solution.eyebrow}</p>
        <h3 className="t-h3 solution-title">{solution.name}</h3>
        <p className="t-body mt-3">{solution.short}</p>
      </div>

      <ul className="solution-list">
        {solution.highlights.map((h) => (
          <li key={h}>
            <Check size={14} strokeWidth={2.6} aria-hidden />
            {h}
          </li>
        ))}
      </ul>

      <p className="solution-foot">
        <Link href={solution.href} className="link-arrow solution-link">
          {solution.cta}
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
        </Link>
      </p>
    </article>
  );
}
