import { Plus } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { revealDelay } from '@/lib/motion';

export type FaqItem = { q: string; a: string };

/**
 * Als <details>/<summary> gebaut: funktioniert ohne JavaScript, ist von Haus
 * aus tastaturbedienbar und der Antworttext steht im HTML — also auch für
 * Suchmaschinen lesbar.
 */
export function Faq({
  items,
  title = 'Perguntas frequentes',
  eyebrow = 'FAQ',
  lead,
}: {
  items: FaqItem[];
  title?: string;
  eyebrow?: string;
  lead?: string;
}) {
  return (
    <section className="section grid-rules" aria-labelledby="faq-title">
      <div className="container-d4u">
        <div className="faq-layout">
          <SectionHeader
            eyebrow={eyebrow}
            title={<span id="faq-title">{title}</span>}
            lead={lead}
            className="faq-head"
          />

          <div className="faq-list">
            {items.map((item, i) => (
              <details key={item.q} className="faq-item reveal" style={revealDelay(i * 60)}>
                <summary>
                  <span>{item.q}</span>
                  <Plus size={18} strokeWidth={2.2} aria-hidden />
                </summary>
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** FAQPage-Auszeichnung für die Suchergebnisse. */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
