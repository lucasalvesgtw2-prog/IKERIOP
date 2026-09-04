import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Timeline } from '@/components/Timeline';
import { TrustMarkers } from '@/components/TrustMarkers';
import { revealDelay } from '@/lib/motion';

export function CompanySection() {
  return (
    <section id="empresa" className="section grid-rules" aria-labelledby="empresa-title">
      <div className="container-d4u">
        <div className="company-grid">
          <div>
            <SectionHeader
              eyebrow="Empresa"
              title={<span id="empresa-title">Experiência que evolui com a tecnologia.</span>}
              lead="A Data4U começou escrevendo software sob medida e nunca parou de fazer isso — hoje para gestão e controle de acesso, com o equipamento incluído na conta."
            />

            <div className="mt-10">
              <TrustMarkers />
            </div>

            <div className="feature-actions reveal" style={revealDelay(160)}>
              <Button href="/sobre-nos" variant="secondary">
                Conhecer a empresa
                <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
              </Button>
            </div>
          </div>

          <div className="company-timeline reveal" style={revealDelay(120)}>
            <p className="solution-eyebrow mb-6">Linha do tempo</p>
            <Timeline />
          </div>
        </div>
      </div>
    </section>
  );
}
