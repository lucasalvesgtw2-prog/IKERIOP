import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { HardwareGrid } from '@/components/HardwareGrid';
import { ProductFeature } from '@/components/ProductFeature';
import { CTASection } from '@/components/CTASection';
import { IntegrationMap } from '@/components/mockups/IntegrationMap';
import { RecognitionStage } from '@/components/mockups/RecognitionStage';
import { HowItWorks } from '@/components/HowItWorks';

export const metadata: Metadata = {
  title: 'Equipamentos para controle de acesso',
  description:
    'Catracas, leitores biométricos, controladoras em rede e relógios de ponto — integrados aos sistemas de gestão da Data4U.',
  alternates: { canonical: '/equipamentos' },
};

export default function Page() {
  return (
    <>
      <RevealProvider />

      <PageHero
        eyebrow="Equipamentos"
        title="Equipamentos para completar sua solução."
        lead="Catraca, leitor, controladora e relógio de ponto vêm do mesmo fornecedor do software — instalados, integrados e com suporte."
        crumbs={[{ label: 'Equipamentos' }]}
        actions={
          <>
            <Button href="/fale-conosco#formulario" size="lg">
              Solicitar orçamento
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="#equipamentos" variant="secondary" size="lg">
              Ver os equipamentos
            </Button>
          </>
        }
        visual={<IntegrationMap />}
      />

      <HardwareGrid withHeader={false} />
      <HowItWorks />

      <ProductFeature
        tone="light"
        eyebrow="Identificação"
        title="Cartão, tag, digital ou rosto — o sistema aceita todos."
        text="A forma de identificação é uma escolha de operação, não uma limitação técnica. Biometria usa uma parte do corpo como senha pessoal: custo baixo e grau de segurança mais alto, porque a credencial não é esquecida nem emprestada."
        bullets={[
          'Cartões de proximidade e tags',
          'Impressão digital',
          'Reconhecimento facial',
          'QR Code pelo aplicativo',
        ]}
        actions={
          <Button href="/leitores-digitais" variant="secondary">
            Ver leitores biométricos
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
          </Button>
        }
        visual={<RecognitionStage />}
        reverse
      />

      <CTASection
        title="Qual equipamento serve para o seu acesso?"
        text="Conte quantos pontos de acesso existem e como as pessoas se identificam hoje. Montamos a especificação completa."
      />
    </>
  );
}
