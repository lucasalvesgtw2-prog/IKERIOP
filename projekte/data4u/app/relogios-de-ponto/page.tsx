import type { Metadata } from 'next';
import { HardwarePage } from '@/components/HardwarePage';

export const metadata: Metadata = {
  title: 'Relógios de ponto eletrônico — Portaria 1510',
  description:
    'Relógio de ponto eletrônico desenvolvido para atender às normas da Portaria 1510 do Ministério do Trabalho e Emprego, com identificação por biometria ou cartão.',
  alternates: { canonical: '/relogios-de-ponto' },
};

export default function Page() {
  return <HardwarePage slug="relogios-de-ponto" />;
}
