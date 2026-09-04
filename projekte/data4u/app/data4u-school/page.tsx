import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';
import { IntegrationMap } from '@/components/mockups/IntegrationMap';

export const metadata: Metadata = {
  title: 'Data4U School — Controle de acesso para escolas',
  description:
    'Controle de entrada e saída de alunos e funcionários, com envio de SMS aos pais de alunos menores de idade e integração com outros sistemas escolares.',
  alternates: { canonical: '/data4u-school' },
};

export default function Page() {
  return (
    <ProductPage
      slug="data4u-school"
      secondaryEyebrow="Capacidades técnicas"
      secondaryTitle="Cartão, tag ou biometria — na catraca da escola."
      secondaryText="A identificação do aluno acontece no equipamento instalado na entrada. O registro segue para o sistema e, de lá, para o SMS do responsável."
      secondaryVisual={<IntegrationMap />}
    />
  );
}
