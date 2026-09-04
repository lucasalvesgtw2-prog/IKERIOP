import type { Metadata } from 'next';
import { HardwarePage } from '@/components/HardwarePage';

export const metadata: Metadata = {
  title: 'Catracas — Controle de acesso informatizado',
  description:
    'Catracas para controle de acesso em clubes, escolas, academias e indústrias, com identificação por cartão, tag ou biometria e mecanismo em aço inox.',
  alternates: { canonical: '/catracas' },
};

export default function Page() {
  return <HardwarePage slug="catracas" />;
}
