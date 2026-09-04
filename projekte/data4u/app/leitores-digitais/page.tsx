import type { Metadata } from 'next';
import { HardwarePage } from '@/components/HardwarePage';

export const metadata: Metadata = {
  title: 'Leitores de digital — Identificação biométrica',
  description:
    'Leitores de impressão digital para controle de acesso: a credencial não é esquecida nem emprestada, e cada leitura gera registro no sistema.',
  alternates: { canonical: '/leitores-digitais' },
};

export default function Page() {
  return <HardwarePage slug="leitores-digitais" />;
}
