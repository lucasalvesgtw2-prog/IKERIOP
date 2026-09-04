import type { Metadata } from 'next';
import { ArrowRight, Mail, MonitorSmartphone, Phone, Ticket, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CTASection } from '@/components/CTASection';
import { contact, supportChannels } from '@/lib/data4u';
import { revealDelay } from '@/lib/motion';

const icons = {
  ticket: Ticket,
  monitor: MonitorSmartphone,
  wrench: Wrench,
} as const;

export const metadata: Metadata = {
  title: 'Suporte',
  description:
    'Atendimento por chamado, suporte por acesso remoto e visita técnica em Brasília e entorno. Demais cidades são atendidas por telefone e acesso remoto.',
  alternates: { canonical: '/suporte' },
};

export default function Page() {
  return (
    <>
      <RevealProvider />

      <PageHero
        eyebrow="Suporte"
        title="Quando o acesso para, alguém atende."
        lead="O atendimento é organizado por chamado: cada solicitação recebe um registro e pode ser acompanhada até a solução."
        crumbs={[{ label: 'Suporte' }]}
        actions={
          <>
            <a href={contact.phoneHref} className="btn btn-primary btn-lg">
              <Phone size={17} strokeWidth={2.2} aria-hidden />
              {contact.phone}
            </a>
            <a href={`mailto:${contact.email}`} className="btn btn-secondary btn-lg">
              <Mail size={17} strokeWidth={2.2} aria-hidden />
              {contact.email}
            </a>
          </>
        }
      />

      <section className="section grid-rules" aria-labelledby="canais-title">
        <div className="container-d4u">
          <SectionHeader
            eyebrow="Como atendemos"
            title={<span id="canais-title">Três formas de resolver.</span>}
            lead="A escolha depende do problema — e de onde a sua operação está."
          />

          <div className="support-grid">
            {supportChannels.map((c, i) => {
              const Icon = icons[c.icon];
              return (
                <article
                  key={c.title}
                  className="card card-hover support-card reveal"
                  style={revealDelay(i * 90)}
                >
                  <span className="support-icon" aria-hidden>
                    <Icon size={20} strokeWidth={1.9} />
                  </span>
                  <h3 className="t-h3 mt-5">{c.title}</h3>
                  <p className="t-body mt-3">{c.text}</p>
                </article>
              );
            })}
          </div>

          <p className="support-note reveal">
            O suporte remoto usa o TeamViewer instalado no computador do cliente.
            Visitas técnicas atendem Brasília e entorno; as demais cidades são
            atendidas por telefone e acesso remoto.
          </p>
        </div>
      </section>

      <CTASection
        title="Precisa de ajuda com um sistema Data4U?"
        text="Abra um chamado pelo telefone ou pelo e-mail e descreva o que está acontecendo. Quanto mais detalhe, mais rápido o retorno."
      />
    </>
  );
}
