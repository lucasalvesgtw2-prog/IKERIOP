import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { ProductFeature } from '@/components/ProductFeature';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SolutionCard } from '@/components/SolutionCard';
import { Faq, FaqJsonLd } from '@/components/Faq';
import { CTASection } from '@/components/CTASection';
import { IntegrationMap } from '@/components/mockups/IntegrationMap';
import { hardwareArt } from '@/components/mockups/HardwareArt';
import { ScanCorners } from '@/components/ui/ScanFrame';
import { hardwareFaq } from '@/lib/pages';
import { hardwareBySlug, solutions } from '@/lib/data4u';
import { revealDelay } from '@/lib/motion';

/**
 * Erzählung einer Equipmentseite. Gleiche Bühne wie die Produktseiten —
 * nur dass hier das Gerät die Hauptrolle spielt und die Systeme, mit denen
 * es arbeitet, am Ende stehen.
 */
export function HardwarePage({ slug }: { slug: string }) {
  const item = hardwareBySlug(slug);
  const Art = hardwareArt[item.art];
  const faq = hardwareFaq[slug] ?? [];

  return (
    <>
      <RevealProvider />
      {faq.length ? <FaqJsonLd items={faq} /> : null}

      <PageHero
        eyebrow={item.eyebrow}
        title={item.headline}
        lead={item.intro}
        crumbs={[{ label: 'Equipamentos', href: '/equipamentos' }, { label: item.name }]}
        actions={
          <>
            <Button href="/fale-conosco#formulario" size="lg">
              {item.cta}
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="/fale-conosco" variant="secondary" size="lg">
              Falar com especialista
            </Button>
          </>
        }
        visual={
          <div className="hw-stage scan-frame">
            <ScanCorners />
            <Art className="hw-stage-art" />
          </div>
        }
      />

      <section className="section grid-rules" aria-labelledby="caracteristicas-title">
        <div className="container-d4u">
          <div className="hw-detail">
            <div>
              <SectionHeader
                eyebrow="Características"
                title={<span id="caracteristicas-title">O que este equipamento entrega.</span>}
              />
              <ul className="feature-list reveal mt-8" style={revealDelay(80)}>
                {item.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <aside className="hw-note reveal" style={revealDelay(140)}>
              <p className="solution-eyebrow">Projeto sob medida</p>
              <p className="t-body mt-3">
                A configuração depende do local: quantos pontos de acesso, qual
                forma de identificação e qual sistema vai comandar o equipamento.
                Conte o seu cenário e montamos a especificação.
              </p>
              <p className="mt-5">
                <Button href="/fale-conosco#formulario" variant="secondary" size="sm">
                  Solicitar orçamento
                  <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
                </Button>
              </p>
            </aside>
          </div>
        </div>
      </section>

      <ProductFeature
        tone="muted"
        eyebrow="Integração"
        title="O equipamento executa. O sistema decide."
        text="A regra de acesso vive no software da Data4U. O equipamento é o ponto em que essa regra vira entrada liberada ou bloqueada — e devolve o registro para a gestão."
        visual={<IntegrationMap />}
        actions={
          <Button href="/#como-funciona" variant="secondary">
            Ver como funciona
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
          </Button>
        }
      />

      <section className="section grid-rules" aria-labelledby="sistemas-title">
        <div className="container-d4u">
          <SectionHeader
            eyebrow="Sistemas compatíveis"
            title={<span id="sistemas-title">Escolha o sistema que vai comandar.</span>}
            lead="O mesmo equipamento atende operações diferentes. O que muda é o software por trás dele."
          />
          <div className="solutions-grid">
            {solutions.map((s, i) => (
              <div key={s.slug} className="reveal" style={revealDelay(i * 80)}>
                <SolutionCard solution={s} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {faq.length ? (
        <Faq items={faq} lead={`Dúvidas frequentes sobre ${item.name.toLowerCase()}.`} />
      ) : null}

      <CTASection
        title="Vamos especificar o equipamento certo para o seu acesso?"
        text="Fale com a Data4U e receba uma proposta com software, equipamento e instalação."
      />
    </>
  );
}
