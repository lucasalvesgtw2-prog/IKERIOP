import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RevealProvider } from '@/components/ui/Reveal';
import { PageHero } from '@/components/PageHero';
import { Timeline } from '@/components/Timeline';
import { TrustMarkers } from '@/components/TrustMarkers';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CTASection } from '@/components/CTASection';
import { UseCaseStrip } from '@/components/Narrative';
import { RecognitionStage } from '@/components/mockups/RecognitionStage';
import { company } from '@/lib/data4u';
import { revealDelay } from '@/lib/motion';

export const metadata: Metadata = {
  title: 'Sobre nós',
  description: `Fundada em ${company.foundedAs.year} como ${company.foundedAs.name} e rebatizada ${company.renamedTo.name} em ${company.renamedTo.year}, a Data4U desenvolve software para gestão e controle de acesso.`,
  alternates: { canonical: '/sobre-nos' },
};

export default function Page() {
  return (
    <>
      <RevealProvider />

      <PageHero
        eyebrow="Empresa"
        title="Experiência que evolui com a tecnologia."
        lead={`A empresa nasceu em ${company.foundedAs.year} como ${company.foundedAs.name} e adotou o nome ${company.renamedTo.name} em ${company.renamedTo.year}. Desde então, desenvolve software para gestão e controle de acesso.`}
        crumbs={[{ label: 'Empresa' }]}
        actions={
          <Button href="/fale-conosco" size="lg">
            Falar com a Data4U
            <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
          </Button>
        }
        visual={<RecognitionStage />}
      />

      <section className="section grid-rules" aria-labelledby="historia-title">
        <div className="container-d4u">
          <div className="company-grid">
            <div>
              <SectionHeader
                eyebrow="História"
                title={<span id="historia-title">Software sob medida, desde o começo.</span>}
                lead="A atividade principal continua sendo a mesma de 1988: desenvolver programas de computador sob demanda. O que mudou foi o que esses programas comandam — hoje, o acesso de pessoas e veículos e a gestão que vem junto."
              />
              <div className="mt-10">
                <TrustMarkers />
              </div>
            </div>

            <div className="company-timeline reveal" style={revealDelay(120)}>
              <p className="solution-eyebrow mb-6">Linha do tempo</p>
              <Timeline />
            </div>
          </div>
        </div>
      </section>

      <UseCaseStrip
        title="Segmentos atendidos"
        items={['Academias e clubes', 'Empresas', 'Condomínios', 'Escolas', 'Instituições']}
      />

      <CTASection />
    </>
  );
}
