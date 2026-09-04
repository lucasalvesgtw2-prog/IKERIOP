import type { ReactNode } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { revealDelay } from '@/lib/motion';

/**
 * Problem und Antwort nebeneinander. Das ist der Punkt, an dem eine
 * Produktseite entscheidet, ob der Leser sich wiedererkennt — deshalb steht
 * er direkt hinter dem Seitenkopf und nicht am Ende.
 */
export function ChallengeAnswer({
  problem,
  solution,
}: {
  problem: { title: string; text: string; points: string[] };
  solution: { title: string; text: string };
}) {
  return (
    <section className="section grid-rules" aria-labelledby="desafio-title">
      <div className="container-d4u">
        <div className="ca-grid">
          <article className="ca-panel ca-problem reveal">
            <p className="solution-eyebrow">O cenário de hoje</p>
            <h2 id="desafio-title" className="t-h3 mt-3">
              {problem.title}
            </h2>
            <p className="t-body mt-3">{problem.text}</p>
            <ul className="ca-list ca-list-problem">
              {problem.points.map((p) => (
                <li key={p}>
                  <X size={14} strokeWidth={2.6} aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </article>

          <span className="ca-arrow" aria-hidden>
            <ArrowRight size={18} strokeWidth={2.2} />
          </span>

          <article className="ca-panel ca-answer reveal" style={revealDelay(120)}>
            <p className="solution-eyebrow">Com a Data4U</p>
            <h2 className="t-h3 mt-3">{solution.title}</h2>
            <p className="t-body mt-3">{solution.text}</p>
            <span className="ca-seal">
              <Check size={14} strokeWidth={3} aria-hidden />
              Software e equipamento no mesmo fluxo
            </span>
          </article>
        </div>
      </div>
    </section>
  );
}

/** Funktionsraster — die ausführliche Liste dessen, was das System kann. */
export function CapabilityGrid({
  eyebrow = 'Recursos',
  title,
  lead,
  items,
  tone = 'muted',
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  items: { title: string; text: string }[];
  tone?: 'light' | 'muted';
}) {
  return (
    <section
      className={['section grid-rules', tone === 'muted' ? 'act-muted' : ''].filter(Boolean).join(' ')}
      aria-labelledby="recursos-title"
    >
      <div className="container-d4u">
        <SectionHeader
          eyebrow={eyebrow}
          title={<span id="recursos-title">{title}</span>}
          lead={lead}
        />

        <div className="cap-grid">
          {items.map((item, i) => (
            <article key={item.title} className="cap-card reveal" style={revealDelay(i * 70)}>
              <span className="cap-index" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="cap-title">{item.title}</h3>
              <p className="cap-text">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Einsatzorte als kompakter dunkler Streifen zwischen zwei hellen Akten. */
export function UseCaseStrip({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="usecases act-dark" aria-label="Onde é usado">
      <div className="container-d4u grid-rules">
        <p className="usecases-title reveal">{title}</p>
        <ul className="usecases-list">
          {items.map((item, i) => (
            <li key={item} className="reveal" style={revealDelay(i * 60)}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Nutzenpunkte als Vierergruppe. */
export function BenefitGrid({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ul className="markers">
      {items.map((b, i) => (
        <li key={b.title} className="marker reveal" style={revealDelay(i * 80)}>
          <span className="marker-rule" aria-hidden />
          <h3 className="marker-title">{b.title}</h3>
          <p className="marker-text">{b.text}</p>
        </li>
      ))}
    </ul>
  );
}
