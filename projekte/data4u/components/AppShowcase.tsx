import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PhoneTrio } from '@/components/mockups/PhoneTrio';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Figure } from '@/components/ui/Figure';
import { revealDelay } from '@/lib/motion';

/**
 * Wie im Hero: linksbündiger Kopf, darunter eine gerahmte Abbildung mit
 * Bildunterschrift. Ein zentrierter Block mit zentriertem Visual wäre die
 * Form, die jede Vorlage benutzt — dieselbe Abbildungslogik über die ganze
 * Seite hinweg ist die ruhigere und die eigenere Lösung.
 */
export function AppShowcase() {
  return (
    <section id="aplicativo" className="section act-dark grid-rules app-section">
      <div className="container-d4u">
        <SectionHeader
          eyebrow="Data4U Mobile"
          title="Uma experiência completa também no celular."
          lead="O aluno entra por QR Code ou reconhecimento facial, acompanha a ficha de treino e recebe o registro de acesso — sem passar pela recepção."
          action={
            <Button href="/data4u-fit#aplicativo" variant="secondary">
              Conheça o aplicativo
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </Button>
          }
        />

        <Figure
          className="app-figure reveal"
          style={revealDelay(160)}
          caption="Aplicativo Data4U — treino, acesso por QR Code e registro de entrada. Representação da interface."
        >
          <PhoneTrio />
        </Figure>
      </div>
    </section>
  );
}
