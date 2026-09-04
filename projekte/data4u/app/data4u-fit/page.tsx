import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';
import { PhoneTrio } from '@/components/mockups/PhoneTrio';

export const metadata: Metadata = {
  title: 'Data4U Fit — Sistema de gestão para academias',
  description:
    'Gestão e controle de acesso para academias, clubes e studios: administrativo e financeiro, treinos, avaliação física, CRM, app mobile e reconhecimento facial.',
  alternates: { canonical: '/data4u-fit' },
};

export default function Page() {
  return (
    <ProductPage
      slug="data4u-fit"
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
