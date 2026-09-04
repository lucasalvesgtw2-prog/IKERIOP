import { SectionHeader } from '@/components/ui/SectionHeader';
import { revealDelay } from '@/lib/motion';
import { flowSteps } from '@/lib/data4u';

/**
 * Vier Schritte auf einer Linie. Die Linie ist keine Dekoration: sie zeigt,
 * dass Identifikation und Auswertung im selben System liegen.
 */
export function HowItWorks() {
  return (
    <section id="como-funciona" className="section act-muted grid-rules" aria-labelledby="flow-title">
      <div className="container-d4u">
        <SectionHeader
          eyebrow="Como funciona"
          title={<span id="flow-title">Do acesso à gestão, tudo conectado.</span>}
          lead="Cada passagem por uma catraca, porta ou cancela vira registro — e cada registro vira informação para decidir."
        />

        <ol className="flow">
          {flowSteps.map((step, i) => (
            <li key={step.n} className="flow-step reveal" style={revealDelay(i * 110)}>
              <span className="flow-marker" aria-hidden>
                <span className="flow-dot" />
              </span>
              <span className="flow-n">{step.n}</span>
              <h3 className="flow-title">{step.title}</h3>
              <p className="flow-text">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
