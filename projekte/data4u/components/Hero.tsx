import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AccessTerminal } from '@/components/mockups/AccessTerminal';
import { Figure } from '@/components/ui/Figure';
import { revealDelay } from '@/lib/motion';

/**
 * Der Hero ist als Aufmacher eines technischen Dokuments gebaut, nicht als
 * Werbefläche: flacher Grund, Text links, rechts eine Abbildung mit
 * Bildunterschrift und Legende.
 *
 * Die drei Zustände stehen als nummerierte Legende unter der Abbildung —
 * dort erklären sie den Ablauf. Als schwebende Plaketten über dem Gerät
 * würden sie nur dekorieren und dabei die Anzeige verdecken.
 */
const legend = [
  { n: '01', label: 'Leitura sem contato' },
  { n: '02', label: 'Entrada autorizada' },
  { n: '03', label: 'Registro na gestão' },
];

export function Hero() {
  return (
    <section className="hero act-dark" aria-labelledby="hero-title">
      <div className="container-d4u grid-rules relative">
        <div className="hero-grid">
          {/* --- Text ---------------------------------------------------- */}
          <div className="hero-copy">
            <p className="eyebrow reveal">Tecnologia · Gestão · Segurança</p>

            <h1
              id="hero-title"
              className="t-display reveal mt-6"
              style={revealDelay(70)}
            >
              Controle de acesso inteligente para uma gestão mais eficiente.
            </h1>

            <p className="t-lead reveal mt-7 max-w-xl" style={revealDelay(140)}>
              Soluções completas em software, biometria e gestão para empresas,
              academias, condomínios e escolas.
            </p>

            <div className="hero-actions reveal" style={revealDelay(210)}>
              <Button href="/#solucoes" size="lg">
                Conheça nossas soluções
                <ArrowRight size={17} strokeWidth={2} aria-hidden />
              </Button>
              <Button href="/fale-conosco" variant="secondary" size="lg">
                Fale com um especialista
              </Button>
            </div>

            <p className="hero-note reveal" style={revealDelay(280)}>
              Software e equipamento do mesmo fornecedor — instalados,
              integrados e com suporte.
            </p>
          </div>

          {/* --- Abbildung ------------------------------------------------ */}
          <Figure
            className="reveal"
            style={revealDelay(200)}
            legend={legend}
            caption="Terminal de controle de acesso por reconhecimento facial — representação da interface."
          >
            <AccessTerminal className="hero-terminal" />
          </Figure>
        </div>
      </div>
    </section>
  );
}
