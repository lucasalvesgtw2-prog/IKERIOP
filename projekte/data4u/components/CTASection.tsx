import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { revealDelay } from '@/lib/motion';
import { contact, whatsappHref } from '@/lib/data4u';

/**
 * Abschluss-CTA. Wenn eine offizielle WhatsApp-Nummer in lib/data4u.ts
 * hinterlegt ist, wird WhatsApp hier zum hervorgehobenen dritten Kanal —
 * sonst tritt der Telefonanruf an seine Stelle. Es wird keine Nummer
 * erfunden, nur damit ein Button existiert.
 */
export function CTASection({
  title = 'Vamos encontrar a solução ideal para o seu negócio?',
  text = 'Fale com a Data4U e descubra como modernizar sua gestão e seu controle de acesso.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="cta act-dark grid-rules" aria-labelledby="cta-title">
      <div className="container-d4u relative">
        <div className="cta-inner">
          <h2 id="cta-title" className="t-h1 reveal">
            {title}
          </h2>
          <p className="t-lead reveal mt-5" style={revealDelay(80)}>
            {text}
          </p>

          <div className="cta-actions reveal" style={revealDelay(160)}>
            <Button href="/fale-conosco" size="lg">
              Falar com especialista
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
            </Button>
            <Button href="/fale-conosco#formulario" variant="secondary" size="lg">
              Solicitar orçamento
            </Button>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                className="btn btn-lg cta-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} strokeWidth={2.2} aria-hidden />
                WhatsApp
              </a>
            ) : (
              <a href={contact.phoneHref} className="btn btn-lg btn-ghost cta-phone">
                <Phone size={17} strokeWidth={2.2} aria-hidden />
                {contact.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
