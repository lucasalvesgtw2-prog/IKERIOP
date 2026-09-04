import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';
import { IntegrationMap } from '@/components/mockups/IntegrationMap';

export const metadata: Metadata = {
  title: 'Data4U Access — Controle de acesso para empresas',
  description:
    'Software que une segurança de acesso e gestão empresarial: controle de visitantes, biometria, cartões, controle de vagas e relatórios de indicadores.',
  alternates: { canonical: '/data4u-access' },
};

export default function Page() {
  return (
    <ProductPage
      slug="data4u-access"
      secondaryEyebrow="Capacidades técnicas"
      secondaryTitle="Uma regra, vários equipamentos."
      secondaryText="A forma de identificação e o ponto de execução podem ser diferentes em cada acesso da empresa — a regra que decide continua sendo uma só, cadastrada no sistema."
      secondaryVisual={<IntegrationMap />}
    />
  );
}
