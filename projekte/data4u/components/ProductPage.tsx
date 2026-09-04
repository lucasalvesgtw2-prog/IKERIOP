import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { ChallengeAnswer, CapabilityGrid, UseCaseStrip, BenefitGrid } from '@/components/Narrative';
import { ProductFeature } from '@/components/ProductFeature';
import { Faq, FaqJsonLd } from '@/components/Faq';
import { CTASection } from '@/components/CTASection';
import { ProductMockup } from '@/components/mockups/ProductMockup';
import { productContent } from '@/lib/pages';
import { solutionBySlug } from '@/lib/data4u';

/**
 * Erzählung einer Produktseite — dieselbe Reihenfolge für alle vier
 * Systeme, damit die Seiten wie Teile eines Produkts wirken:
 * Kopf → Problem und Antwort → Recursos → Benefícios und Visual →
 * Einsatzorte → FAQ → Abschluss-CTA.
 */
export function ProductPage({
  slug,
  secondaryVisual,
  secondaryTitle,
  secondaryText,
  secondaryEyebrow,
}: {
  slug: string;
  secondaryVisual: ReactNode;
  secondaryTitle: string;
  secondaryText: string;
  secondaryEyebrow: string;
}) {
  const product = solutionBySlug(slug);
  const content = productContent[slug];

  return (
    <>
      <RevealProvider />
      <FaqJsonLd items={content.faq} />

      <PageHero
        eyebrow={product.eyebrow}
        title={product.headline}
        lead={product.intro}
        crumbs={[{ label: 'Produtos', href: '/#solucoes' }, { label: product.name }]}
        actions={
          <>
            <Button href="/fale-conosco#formulario" size="lg">
              Solicitar orçamento
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="#recursos" variant="secondary" size="lg">
              Ver recursos
            </Button>
          </>
        }
        visual={<ProductMockup variant={product.visual} />}
      />

      <ChallengeAnswer problem={content.problem} solution={content.solution} />

      <div id="recursos">
        <CapabilityGrid
          title={`O que o ${product.name} faz.`}
          lead="Os módulos abaixo trabalham sobre o mesmo cadastro — o que entra em um aparece nos outros."
          items={content.capabilities}
        />
      </div>

      <ProductFeature
        eyebrow={secondaryEyebrow}
        title={secondaryTitle}
        text={secondaryText}
        visual={secondaryVisual}
        actions={
          <Button href="/fale-conosco#formulario">
            Falar com especialista
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
          </Button>
        }
        reverse
      />

      <section className="section act-muted grid-rules" aria-labelledby="beneficios-title">
        <div className="container-d4u">
          <h2 id="beneficios-title" className="t-h2 reveal max-w-2xl">
            O que muda na operação.
          </h2>
          <div className="mt-10">
            <BenefitGrid items={content.benefits} />
          </div>
        </div>
      </section>

      <UseCaseStrip title="Onde é usado" items={content.useCases} />

      <Faq items={content.faq} lead={`Dúvidas frequentes sobre o ${product.name}.`} />

      <CTASection
        title={`Quer ver o ${product.name} funcionando no seu cenário?`}
        text="Conte como é a sua operação hoje. A partir daí montamos a proposta com software e equipamento."
      />
    </>
  );
}
