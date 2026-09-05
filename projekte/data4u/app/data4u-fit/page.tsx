import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';
import { PhoneTrio } from '@/components/mockups/PhoneTrio';
import { FitScreens } from '@/components/mockups/FitScreens';
import { Figure } from '@/components/ui/Figure';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { revealDelay } from '@/lib/motion';

export const metadata: Metadata = {
  title: 'Data4U Fit — Sistema de gestão para academias',
  description:
    'Gestão e controle de acesso para academias, clubes e studios: administrativo e financeiro, treinos, avaliação física, CRM, app mobile e reconhecimento facial.',
  alternates: { canonical: '/data4u-fit' },
};

/** Die drei Module, die im Kopf-Mockup nicht sichtbar sind. */
function ModulesSection() {
  return (
    <section className="section act-dark grid-rules" aria-labelledby="modulos-title">
      <div className="container-d4u">
        <SectionHeader
          eyebrow="Na tela"
          title={<span id="modulos-title">Financeiro, treino e avaliação no mesmo cadastro.</span>}
          lead="O que o aluno faz na catraca, no aplicativo e na avaliação física alimenta a mesma base — a recepção não digita nada duas vezes."
        />

        <Figure
          className="reveal mt-12"
          style={revealDelay(120)}
          padded={false}
          caption="Módulos do Data4U Fit — representação da interface. Os campos de valor ficam vazios: não há dados de clientes nesta página."
        >
          <FitScreens />
        </Figure>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <ProductPage
      slug="data4u-fit"
      extraSection={<ModulesSection />}
      secondaryEyebrow="Data4U Mobile"
      secondaryTitle="O aluno entra, treina e acompanha pelo celular."
      secondaryText="Acesso por QR Code ou identificação facial, ficha de treino com vídeos demonstrativos e registro de entrada — tudo no aplicativo, sem passar pela recepção."
      secondaryVisual={
        <div id="aplicativo" className="scroll-mt-32">
          <PhoneTrio />
        </div>
      }
    />
  );
}
