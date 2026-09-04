import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { ContactSection } from '@/components/ContactSection';
import { Faq } from '@/components/Faq';
import { addressLines, contact } from '@/lib/data4u';
import { revealDelay } from '@/lib/motion';

export const metadata: Metadata = {
  title: 'Fale conosco',
  description: `Fale com a Data4U Technology em Brasília: ${contact.phone} · ${contact.email} · ${addressLines[0]}, ${addressLines[2]}.`,
  alternates: { canonical: '/fale-conosco' },
};

const faq = [
  {
    q: 'Qual o melhor caminho para pedir um orçamento?',
    a: 'Use o formulário desta página descrevendo a sua operação: quantos pontos de acesso, quantas pessoas circulam e qual estrutura já existe. Se preferir falar direto, o telefone e o e-mail estão logo acima.',
  },
  {
    q: 'A Data4U atende fora de Brasília?',
    a: 'Sim. Visitas técnicas são realizadas em Brasília e entorno; as demais cidades são atendidas por telefone e acesso remoto.',
  },
  {
    q: 'Vocês vendem apenas o software?',
    a: 'A Data4U trabalha com software e equipamento: catracas, leitores biométricos, controladoras e relógios de ponto integrados aos sistemas de gestão.',
  },
  {
    q: 'Já sou cliente e preciso de suporte. Uso este formulário?',
    a: 'Para suporte, selecione o assunto “Suporte técnico” no formulário ou entre em contato pelo telefone — o atendimento é organizado por chamado.',
  },
];

export default function Page() {
  return (
    <>
      <RevealProvider />

      <PageHero
        eyebrow="Contato"
        title="Fale com um especialista da Data4U."
        lead="Conte o seu cenário e indicamos a combinação de software e equipamento que resolve — sem pacote pronto."
        crumbs={[{ label: 'Fale conosco' }]}
        visual={
          <ul className="contact-cards">
            <li className="reveal" style={revealDelay(60)}>
              <span className="contact-card-icon" aria-hidden>
                <Phone size={18} strokeWidth={2} />
              </span>
              <span className="contact-label">Telefone</span>
              <a href={contact.phoneHref} className="contact-card-value">
                {contact.phone}
              </a>
            </li>
            <li className="reveal" style={revealDelay(120)}>
              <span className="contact-card-icon" aria-hidden>
                <Mail size={18} strokeWidth={2} />
              </span>
              <span className="contact-label">E-mail</span>
              <a href={`mailto:${contact.email}`} className="contact-card-value">
                {contact.email}
              </a>
            </li>
            <li className="reveal" style={revealDelay(180)}>
              <span className="contact-card-icon" aria-hidden>
                <MapPin size={18} strokeWidth={2} />
              </span>
              <span className="contact-label">Endereço</span>
              <address className="contact-card-address">
                {addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            </li>
          </ul>
        }
      />

      <div id="formulario" className="scroll-mt-24">
        <ContactSection />
      </div>

      <Faq items={faq} lead="Antes de escrever, talvez a resposta já esteja aqui." />
    </>
  );
}
