import {
  Bell,
  ChevronRight,
  Dumbbell,
  House,
  PlayCircle,
  ScanFace,
  User,
} from 'lucide-react';
import { GhostLine } from './AppWindow';

/* Deterministisches QR-Muster: dieselbe Matrix auf Server und Client, damit
   die Hydration nicht auseinanderläuft. Es ist ein Symbol, kein lesbarer
   Code — deshalb trägt es auch keine Zielinformation.

   Ausgegeben wird ein einziger Pfad statt zweihundert <rect>: waagerechte
   Läufe werden zusammengefasst. Das spart im Markup jedes Telefons rund
   8 KB, ohne dass sich am Bild etwas ändert. */
const QR = (() => {
  const size = 21;
  let a = 20260904;
  const next = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };

  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > size - 8 && y < 7) || (x < 7 && y > size - 8);

  const on: boolean[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x += 1) {
      row.push(inFinder(x, y) ? false : next() > 0.52);
    }
    on.push(row);
  }

  let d = '';
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (!on[y][x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < size && on[y][x + run]) run += 1;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }

  /* Die drei Positionsmarken: äußerer Ring plus Kern, ebenfalls als Pfad. */
  for (const [fx, fy] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ]) {
    d += `M${fx} ${fy}h7v7h-7z`;
    d += `M${fx + 1} ${fy + 1}v5h5v-5z`;
    d += `M${fx + 2} ${fy + 2}h3v3h-3z`;
  }

  return { size, d };
})();

function QrCode({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${QR.size} ${QR.size}`}
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
    >
      <rect width={QR.size} height={QR.size} fill="#fff" />
      <path d={QR.d} fill="var(--color-ink-900)" fillRule="evenodd" />
    </svg>
  );
}

function Phone({
  children,
  label,
  tab,
  className,
}: {
  children: React.ReactNode;
  label: string;
  /* Welcher Reiter unten aktiv ist — dieselbe Ansicht wie oben im Kopf. */
  tab: 0 | 1 | 2;
  className?: string;
}) {
  const tabs = [
    { icon: House, name: 'Início' },
    { icon: ScanFace, name: 'Acesso' },
    { icon: User, name: 'Conta' },
  ];

  return (
    <div className={['phone', className].filter(Boolean).join(' ')}>
      <div className="phone-frame">
        <span className="phone-notch" aria-hidden />
        <div className="phone-screen">
          <div className="phone-head" aria-hidden>
            <span className="phone-brand">
              Data<span className="text-brand-400">4</span>U
            </span>
            <span className="phone-head-label">{label}</span>
          </div>
          <div className="phone-body">{children}</div>
          <div className="phone-tabs" aria-hidden>
            {tabs.map(({ icon: Icon, name }, i) => (
              <span key={name} className="phone-tab" data-active={i === tab || undefined}>
                <Icon size={13} strokeWidth={2} />
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Drei Telefone in leichter Staffelung: Zugang, Treino, Konto. Kein
 * Perspektiv-Trick, nur Versatz und Tiefenschärfe über Schatten — das
 * bleibt auf kleinen Bildschirmen lesbar.
 */
export function PhoneTrio({ className }: { className?: string }) {
  return (
    <div className={['phone-trio', className].filter(Boolean).join(' ')}>
      {/* Links: Treino */}
      <Phone label="Treino" tab={0} className="phone-side phone-left">
        <div className="phone-card" aria-hidden>
          <span className="phone-card-icon">
            <Dumbbell size={14} strokeWidth={2} />
          </span>
          <div className="flex-1">
            <span className="phone-card-title">Ficha de treino</span>
            <GhostLine w="70%" h={6} className="mt-1" />
          </div>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="phone-row" aria-hidden>
            <PlayCircle size={13} strokeWidth={2} className="text-brand-400 shrink-0" />
            <GhostLine w={['64%', '48%', '72%', '56%'][i]} h={6} />
            <ChevronRight size={12} strokeWidth={2} className="ml-auto opacity-40 shrink-0" />
          </div>
        ))}
      </Phone>

      {/* Mitte: Zugang per QR Code */}
      <Phone label="Acesso" tab={1} className="phone-center">
        <p className="phone-lead">Aproxime o código da catraca</p>
        <div className="phone-qr">
          <QrCode className="h-full w-full" />
        </div>
        <div className="phone-alt" aria-hidden>
          <ScanFace size={14} strokeWidth={2} />
          <span>ou use o reconhecimento facial</span>
        </div>
      </Phone>

      {/* Rechts: Konto und Mitteilungen */}
      <Phone label="Minha conta" tab={2} className="phone-side phone-right">
        <div className="phone-card" aria-hidden>
          <span className="phone-avatar" />
          <div className="flex-1">
            <GhostLine w="72%" h={7} />
            <GhostLine w="46%" h={5} className="mt-1.5" />
          </div>
        </div>
        <div className="phone-notice" aria-hidden>
          <Bell size={12} strokeWidth={2} className="shrink-0" />
          <span>Entrada registrada</span>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="phone-row" aria-hidden>
            <GhostLine w={['80%', '62%', '70%'][i]} h={6} />
          </div>
        ))}
      </Phone>
    </div>
  );
}
