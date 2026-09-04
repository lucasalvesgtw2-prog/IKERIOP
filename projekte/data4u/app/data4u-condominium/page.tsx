import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';
import { IntegrationMap } from '@/components/mockups/IntegrationMap';

export const metadata: Metadata = {
  title: 'Data4U Condominium — Controle de acesso para condomínios',
  description:
    'Controle de moradores, visitantes, funcionários, fornecedores e veículos, com integração a portões, catracas e leitores e avisos automáticos por SMS e e-mail.',
  alternates: { canonical: '/data4u-condominium' },
};

export default function Page() {
  return (
    <ProductPage
      slug="data4u-condominium"
      secondaryEyebrow="Capacidades técnicas"
      secondaryTitle="Integra com a portaria que já existe."
      secondaryText="Portões, catracas, leitores biométricos e leitores de proximidade passam a responder ao mesmo cadastro — e cada passagem vira registro."
      secondaryVisual={<IntegrationMap />}
    />
  );
}
