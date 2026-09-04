import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HardwareCard } from '@/components/HardwareCard';
import { revealDelay } from '@/lib/motion';
import { hardware } from '@/lib/data4u';

export function HardwareGrid({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <section id="equipamentos" className="section grid-rules" aria-labelledby="hw-title">
      <div className="container-d4u">
        {withHeader ? (
          <SectionHeader
            eyebrow="Equipamentos"
            title={<span id="hw-title">Equipamentos para completar sua solução.</span>}
            lead="O sistema decide quem entra. O equipamento cumpre a decisão — e devolve o registro para a gestão."
            action={
              <Button href="/equipamentos" variant="secondary">
                Ver todos os equipamentos
                <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
              </Button>
            }
          />
        ) : (
          <h2 id="hw-title" className="sr-only">
            Equipamentos disponíveis
          </h2>
        )}

        <div className="hw-grid">
          {hardware.map((item, i) => (
            <div key={item.slug} className="reveal" style={revealDelay(i * 80)}>
              <HardwareCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
