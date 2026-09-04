import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { company, contact, hardware, solutions } from '@/lib/data4u';

const columns = [
  {
    title: 'Soluções',
    links: solutions.map((s) => ({ label: s.name, href: s.href })),
  },
  {
    title: 'Equipamentos',
    links: [
      { label: 'Todos os equipamentos', href: '/equipamentos' },
      ...hardware.map((h) => ({ label: h.name, href: h.href })),
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre nós', href: '/sobre-nos' },
      { label: 'Suporte', href: '/suporte' },
      { label: 'Fale conosco', href: '/fale-conosco' },
    ],
  },
];

export function Footer({ addressLines }: { addressLines: string[] }) {
  return (
    <footer className="footer act-dark" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        Rodapé
      </h2>

      <div className="container-d4u">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="nav-brand" aria-label={`${company.fullName} — página inicial`}>
              <Logo />
            </Link>
            <p className="footer-claim">
              Software e equipamentos para gestão e controle de acesso —
              desde {company.foundedAs.year}.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} className="footer-col" aria-label={col.title}>
              <h3 className="footer-col-title">{col.title}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="footer-link">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="footer-col">
            <h3 className="footer-col-title">Contato</h3>
            <ul className="footer-contact">
              <li>
                <Phone size={14} strokeWidth={2} aria-hidden />
                <a href={contact.phoneHref} className="footer-link">
                  {contact.phone}
                </a>
              </li>
              <li>
                <Mail size={14} strokeWidth={2} aria-hidden />
                <a href={`mailto:${contact.email}`} className="footer-link">
                  {contact.email}
                </a>
              </li>
              <li className="items-start">
                <MapPin size={14} strokeWidth={2} aria-hidden className="mt-1" />
                <address className="footer-address">
                  {addressLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bar">
          <p>
            © {new Date().getFullYear()} {company.fullName}
          </p>
          <nav aria-label="Links legais">
            <Link href="/politica-de-privacidade" className="footer-link">
              Política de privacidade
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
