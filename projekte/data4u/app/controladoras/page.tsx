import type { Metadata } from 'next';
import { HardwarePage } from '@/components/HardwarePage';

export const metadata: Metadata = {
  title: 'Controladoras de acesso em rede TCP/IP',
  description:
    'Controladoras com integração total em rede por protocolo TCP/IP para comandar portas, cancelas e fechaduras a partir de um ponto central.',
  alternates: { canonical: '/controladoras' },
};

export default function Page() {
  return <HardwarePage slug="controladoras" />;
}
