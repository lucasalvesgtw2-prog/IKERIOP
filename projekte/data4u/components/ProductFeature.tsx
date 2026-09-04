import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { revealDelay } from '@/lib/motion';

/**
 * Zweispaltiger Produktblock: Text links, Visual rechts — mit `reverse`
 * andersherum. Wird von der Startseite und von allen Produktseiten benutzt,
 * damit die Seiten wie Teile desselben Produkts wirken.
 */
export function ProductFeature({
  eyebrow,
  title,
  text,
  bullets,
  actions,
  visual,
  reverse = false,
  tone = 'light',
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  bullets?: string[];
  actions?: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  tone?: 'light' | 'dark' | 'muted';
  id?: string;
}) {
  const toneClass =
    tone === 'dark' ? 'act-dark' : tone === 'muted' ? 'act-muted' : '';

  return (
    <section
      id={id}
      className={['section grid-rules feature', toneClass].filter(Boolean).join(' ')}
    >
      <div className="container-d4u">
        <div className="feature-grid" data-reverse={reverse || undefined}>
          <div className="feature-copy">
            {eyebrow ? <p className="eyebrow reveal">{eyebrow}</p> : null}
            <h2 className="t-h2 reveal mt-4" style={revealDelay(60)}>
              {title}
            </h2>
            {text ? (
              <p className="t-lead reveal mt-5" style={revealDelay(120)}>
                {text}
              </p>
            ) : null}

            {bullets?.length ? (
              <ul className="feature-list reveal" style={revealDelay(180)}>
                {bullets.map((b) => (
                  <li key={b}>
                    <Check size={15} strokeWidth={2.6} aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}

            {actions ? (
              <div className="feature-actions reveal" style={revealDelay(240)}>
                {actions}
              </div>
            ) : null}
          </div>

          <div className="feature-visual reveal" style={revealDelay(140)}>
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
}
