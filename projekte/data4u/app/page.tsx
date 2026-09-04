import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { Hero } from '@/components/Hero';
import { TrustBar } from '@/components/TrustBar';
import { SolutionsGrid } from '@/components/SolutionsGrid';
import { ProductFeature } from '@/components/ProductFeature';
import { HowItWorks } from '@/components/HowItWorks';
import { HardwareGrid } from '@/components/HardwareGrid';
import { AppShowcase } from '@/components/AppShowcase';
import { CompanySection } from '@/components/CompanySection';
import { CTASection } from '@/components/CTASection';
import { ContactSection } from '@/components/ContactSection';
import { RecognitionStage } from '@/components/mockups/RecognitionStage';
import { ProductMockup } from '@/components/mockups/ProductMockup';
import { solutionBySlug } from '@/lib/data4u';

export const metadata: Metadata = {
  title: 'Data4U Technology — Controle de acesso e sistemas de gestão',
  description:
    'Controle de acesso inteligente para uma gestão mais eficiente. Software, biometria, reconhecimento facial e equipamentos para academias, empresas, condomínios e escolas.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const fit = solutionBySlug('data4u-fit');

  return (
    <>
      <RevealProvider />

      <Hero />
      <TrustBar />
      <SolutionsGrid />

      {/* --- Reconhecimento facial ------------------------------------- */}
      <ProductFeature
        id="reconhecimento-facial"
        tone="dark"
        eyebrow="iDFace"
        title="Reconhecimento facial. Mais segurança. Menos atrito."
        text="Controle de acesso por biometria facial integrado à sua estrutura existente — sem trocar a catraca, sem fila na recepção e sem cartão para emprestar."
        bullets={[
          'Identificação sem contato',
          'Integra com catracas e portas já instaladas',
          'Convive com digital, cartão e tag',
          'Cada passagem vira registro auditável',
        ]}
        actions={
          <>
            <Button href="/fale-conosco#formulario">
              Solicitar orçamento
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="/#como-funciona" variant="secondary">
              Saiba como funciona
            </Button>
          </>
        }
        visual={<RecognitionStage />}
        reverse
      />

      <HowItWorks />
      <HardwareGrid />

      {/* --- Data4U Fit -------------------------------------------------- */}
      <ProductFeature
        id="software"
        tone="muted"
        eyebrow="Data4U Fit"
        title="Gestão inteligente para academias."
        text="Matrícula, mensalidade, treino, avaliação física e catraca no mesmo sistema — e no mesmo cadastro do aluno."
        bullets={fit.highlights}
        actions={
          <>
            <Button href="/data4u-fit">
              {fit.cta}
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="/fale-conosco#formulario" variant="secondary">
              Solicitar demonstração
            </Button>
          </>
        }
        visual={<ProductMockup variant="dashboard" />}
      />

      <AppShowcase />
      <CompanySection />
      <CTASection />
      <ContactSection />
    </>
  );
}
