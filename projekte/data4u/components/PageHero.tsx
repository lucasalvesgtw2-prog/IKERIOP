import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { revealDelay } from '@/lib/motion';

export type Crumb = { label: string; href?: string };

/**
 * Kopf jeder Unterseite. Gleiche dunkle Bühne wie der Hero der Startseite —
 * so bleibt die Navigation in ihrem transparenten Zustand immer lesbar und
 * die Seiten wirken wie Teile desselben Produkts.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  crumbs,
  actions,
  visual,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  visual?: React.ReactNode;
}) {
  return (
    <section className="page-hero act-dark" aria-labelledby="page-title">
      <div className="container-d4u grid-rules relative">
        {crumbs?.length ? (
          <nav aria-label="Trilha de navegação" className="crumbs reveal">
            <ol>
              <li>
                <Link href="/">Início</Link>
                <ChevronRight size={13} strokeWidth={2.2} aria-hidden />
              </li>
              {crumbs.map((c, i) => (
                <li key={c.label} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                  {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
                  {i < crumbs.length - 1 ? (
                    <ChevronRight size={13} strokeWidth={2.2} aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="page-hero-grid" data-has-visual={visual ? 'true' : undefined}>
          <div className="page-hero-copy">
            {eyebrow ? (
              <p className="eyebrow reveal" style={revealDelay(40)}>
                {eyebrow}
              </p>
            ) : null}
            <h1 id="page-title" className="t-h1 reveal mt-4" style={revealDelay(80)}>
              {title}
            </h1>
            {lead ? (
              <p className="t-lead reveal mt-5" style={revealDelay(140)}>
                {lead}
              </p>
            ) : null}
            {actions ? (
              <div className="feature-actions reveal" style={revealDelay(200)}>
                {actions}
              </div>
            ) : null}
          </div>

          {visual ? (
            <div className="page-hero-visual reveal" style={revealDelay(180)}>
              {visual}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
