import { SectionHeader } from '@/components/ui/SectionHeader';
import { SolutionCard } from '@/components/SolutionCard';
import { revealDelay } from '@/lib/motion';
import { solutions } from '@/lib/data4u';

export function SolutionsGrid() {
  return (
    <section id="solucoes" className="section grid-rules" aria-labelledby="solucoes-title">
      <div className="container-d4u">
        <SectionHeader
          eyebrow="Soluções"
          title={<span id="solucoes-title">Soluções para diferentes desafios.</span>}
          lead="Uma plataforma completa para transformar gestão, segurança e controle de acesso — com o sistema certo para cada operação."
        />

        <div className="solutions-grid">
          {solutions.map((s, i) => (
            <div key={s.slug} className="reveal" style={revealDelay(i * 90)}>
              <SolutionCard solution={s} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
