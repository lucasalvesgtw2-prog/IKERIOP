import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PhoneTrio } from '@/components/mockups/PhoneTrio';
import { revealDelay } from '@/lib/motion';

export function AppShowcase() {
  return (
    <section id="aplicativo" className="section act-dark grid-rules app-section">
      <div className="glow-brand app-section-glow" aria-hidden />

      <div className="container-d4u relative">
        <div className="app-head">
          <p className="eyebrow reveal">Data4U Mobile</p>
          <h2 className="t-h2 reveal mt-4" style={revealDelay(60)}>
            Uma experiência completa também no celular.
          </h2>
          <p className="t-lead reveal mt-5" style={revealDelay(120)}>
            O aluno entra por QR Code ou reconhecimento facial, acompanha a
            ficha de treino e recebe o registro de acesso — sem passar pela
            recepção.
          </p>
          <div className="feature-actions reveal justify-center" style={revealDelay(180)}>
            <Button href="/data4u-fit#aplicativo">
              Conheça o aplicativo
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="reveal mt-14" style={revealDelay(200)}>
          <PhoneTrio />
        </div>
      </div>
    </section>
  );
}
