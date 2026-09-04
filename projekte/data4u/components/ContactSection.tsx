import { Mail, MapPin, Phone } from 'lucide-react';
import { ContactForm } from '@/components/ContactForm';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { revealDelay } from '@/lib/motion';
import { addressLines, contact } from '@/lib/data4u';

export function ContactSection({
  defaultInterest,
  id = 'contato',
}: {
  defaultInterest?: string;
  id?: string;
}) {
  return (
    <section id={id} className="section act-muted grid-rules" aria-labelledby="contato-title">
      <div className="container-d4u">
        <SectionHeader
          eyebrow="Contato"
          title={<span id="contato-title">Conte o seu cenário. Indicamos a solução.</span>}
          lead="Diga quantas pessoas passam pelo seu acesso, qual estrutura já existe e o que precisa mudar. A partir daí montamos a proposta."
        />

        <div className="contact-grid">
          <div className="contact-form-wrap reveal" style={revealDelay(80)}>
            <ContactForm defaultInterest={defaultInterest} />
          </div>

          <aside className="contact-aside reveal" style={revealDelay(160)}>
            <h3 className="contact-aside-title">Canais diretos</h3>

            <ul className="contact-list">
              <li>
                <span className="contact-icon" aria-hidden>
                  <Phone size={16} strokeWidth={2} />
                </span>
                <span>
                  <span className="contact-label">Telefone</span>
                  <a href={contact.phoneHref} className="contact-value">
                    {contact.phone}
                  </a>
                </span>
              </li>
              <li>
                <span className="contact-icon" aria-hidden>
                  <Mail size={16} strokeWidth={2} />
                </span>
                <span>
                  <span className="contact-label">E-mail</span>
                  <a href={`mailto:${contact.email}`} className="contact-value">
                    {contact.email}
                  </a>
                </span>
              </li>
              <li>
                <span className="contact-icon" aria-hidden>
                  <MapPin size={16} strokeWidth={2} />
                </span>
                <span>
                  <span className="contact-label">Endereço</span>
                  <address className="contact-address">
                    {addressLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </address>
                </span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
