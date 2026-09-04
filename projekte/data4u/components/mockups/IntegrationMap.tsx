import {
  Clock,
  Fingerprint,
  IdCard,
  ScanFace,
  ServerCog,
  SquareParking,
  DoorClosed,
} from 'lucide-react';

/**
 * Integrationsdiagramm: in der Mitte das System, außen die Punkte, an denen
 * es wirkt. Zeigt in einem Bild, was die Textliste sonst in sechs Zeilen
 * erklärt — welche Geräte an derselben Regel hängen.
 */
const nodes = [
  { icon: ScanFace, label: 'Reconhecimento facial', side: 'left' },
  { icon: Fingerprint, label: 'Leitor biométrico', side: 'left' },
  { icon: IdCard, label: 'Cartão e tag', side: 'left' },
  { icon: DoorClosed, label: 'Portas e catracas', side: 'right' },
  { icon: SquareParking, label: 'Cancelas e portões', side: 'right' },
  { icon: Clock, label: 'Relógio de ponto', side: 'right' },
] as const;

export function IntegrationMap({ className }: { className?: string }) {
  const left = nodes.filter((n) => n.side === 'left');
  const right = nodes.filter((n) => n.side === 'right');

  return (
    <div className={['imap-shell', className].filter(Boolean).join(' ')}>
      <div className="imap">
        <div className="imap-col">
          <p className="imap-col-label">Identificação</p>
          {left.map(({ icon: Icon, label }) => (
            <span key={label} className="imap-node">
              <Icon size={15} strokeWidth={1.9} aria-hidden />
              {label}
            </span>
          ))}
        </div>

        <div className="imap-core">
          <span className="imap-core-box">
            <ServerCog size={20} strokeWidth={1.8} aria-hidden />
            <strong>Sistema Data4U</strong>
            <span>Regras, registro e relatórios</span>
          </span>
        </div>

        <div className="imap-col">
          <p className="imap-col-label">Execução</p>
          {right.map(({ icon: Icon, label }) => (
            <span key={label} className="imap-node">
              <Icon size={15} strokeWidth={1.9} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
