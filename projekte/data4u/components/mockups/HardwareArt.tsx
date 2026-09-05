/**
 * Technische Zeichnungen der Geräte.
 *
 * Solange keine freigegebenen Produktfotos von Data4U vorliegen, wird das
 * Equipment als saubere Strichzeichnung dargestellt statt mit Stockfotos.
 * Das passt zur Präzision der Marke und lässt sich später eins zu eins
 * durch ein Foto ersetzen: jede Zeichnung sitzt in derselben Kachel mit
 * festem Seitenverhältnis, das Layout springt also nicht.
 */

type Props = { className?: string };

const svg = 'h-full w-full';

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 260 200"
      className={svg}
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="hw-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="0.88" />
          <stop offset="100%" stopColor="var(--color-surface)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Bodenlinie — gibt allen vier Zeichnungen dieselbe Standfläche. */}
      <line
        x1="26"
        y1="176"
        x2="234"
        y2="176"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.25"
        strokeDasharray="3 5"
      />
      {children}
    </svg>
  );
}

/** Catraca: Säule, Kopf mit Leser, drei Sperrarme. */
export function TurnstileArt({ className }: Props) {
  return (
    <div className={className}>
      <Frame label="Desenho técnico de uma catraca de controle de acesso">
        <g stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.65">
          {/* Säule */}
          <path d="M104 176V96a12 12 0 0 1 12-12h28a12 12 0 0 1 12 12v80" fill="url(#hw-face)" />
          {/* Kopf */}
          <rect x="96" y="56" width="68" height="34" rx="12" fill="url(#hw-face)" />
          {/* Sperrarme, 120° zueinander */}
          <path d="M164 74h56" strokeWidth="4" strokeOpacity="0.75" />
          <path d="M96 74H40" strokeWidth="4" strokeOpacity="0.32" />
          <path d="M130 90v52" strokeWidth="4" strokeOpacity="0.32" />
          {/* Fuß */}
          <path d="M92 176h76" strokeWidth="2.4" />
        </g>
        {/* Leserfeld */}
        <rect
          x="112"
          y="64"
          width="36"
          height="18"
          rx="5"
          fill="var(--color-brand-500)"
          fillOpacity="0.18"
          stroke="var(--color-brand-500)"
          strokeWidth="1.4"
        />
        <circle cx="130" cy="73" r="3.2" fill="var(--color-brand-500)" />
        <circle cx="130" cy="73" r="8" stroke="var(--color-brand-400)" strokeWidth="1.2" strokeOpacity="0.6" />
      </Frame>
    </div>
  );
}

/** Leitor de digital: Wandgerät mit Fingerabdruck-Sensor. */
export function ReaderArt({ className }: Props) {
  return (
    <div className={className}>
      <Frame label="Desenho técnico de um leitor biométrico de impressão digital">
        <rect
          x="88"
          y="34"
          width="84"
          height="124"
          rx="16"
          fill="url(#hw-face)"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeOpacity="0.65"
        />
        {/* Statusleiste */}
        <rect x="104" y="50" width="52" height="6" rx="3" fill="currentColor" fillOpacity="0.16" />
        {/* Sensorfeld */}
        <rect
          x="104"
          y="68"
          width="52"
          height="58"
          rx="10"
          fill="var(--color-brand-500)"
          fillOpacity="0.12"
          stroke="var(--color-brand-500)"
          strokeWidth="1.4"
        />
        {/* Fingerabdruck: konzentrische Bögen */}
        <g stroke="var(--color-brand-500)" strokeWidth="1.5" strokeOpacity="0.85">
          <path d="M130 112a10 10 0 0 1-4-8v-6a4 4 0 0 1 8 0v4" />
          <path d="M118 108v-10a12 12 0 0 1 24 0v8" />
          <path d="M112 106V96a18 18 0 0 1 36 0v10" />
        </g>
        {/* Tasten */}
        <g fill="currentColor" fillOpacity="0.18">
          <circle cx="114" cy="141" r="3.4" />
          <circle cx="130" cy="141" r="3.4" />
          <circle cx="146" cy="141" r="3.4" />
        </g>
        {/* Wandhalter */}
        <path d="M130 158v18" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.35" />
      </Frame>
    </div>
  );
}

/** Controladora: Gehäuse mit Klemmen, Netzwerkport und Verkabelung. */
export function ControllerArt({ className }: Props) {
  return (
    <div className={className}>
      <Frame label="Desenho técnico de uma controladora de acesso em rede">
        <rect
          x="56"
          y="54"
          width="148"
          height="88"
          rx="12"
          fill="url(#hw-face)"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeOpacity="0.65"
        />
        {/* Klemmleiste oben */}
        <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.35">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={70 + i * 15} y="62" width="10" height="10" rx="2" />
          ))}
        </g>
        {/* Netzwerkport */}
        <rect
          x="70"
          y="106"
          width="30"
          height="22"
          rx="4"
          stroke="var(--color-brand-500)"
          strokeWidth="1.4"
          fill="var(--color-brand-500)"
          fillOpacity="0.12"
        />
        <path d="M78 106v-6h14v6" stroke="var(--color-brand-500)" strokeWidth="1.4" />
        {/* LED-Reihe */}
        <g>
          <circle cx="120" cy="117" r="3" fill="var(--color-success)" />
          <circle cx="134" cy="117" r="3" fill="var(--color-brand-500)" />
          <circle cx="148" cy="117" r="3" fill="currentColor" fillOpacity="0.22" />
        </g>
        {/* Beschriftungsfeld */}
        <rect x="162" y="106" width="30" height="22" rx="4" fill="currentColor" fillOpacity="0.10" />
        {/* Leitungen zu Tür, Schranke, Catraca */}
        <g stroke="var(--color-brand-400)" strokeWidth="1.4" strokeOpacity="0.65" strokeDasharray="4 4">
          <path d="M56 98H30v58" />
          <path d="M204 98h26v58" />
        </g>
        <g fill="var(--color-brand-400)" fillOpacity="0.55">
          <circle cx="30" cy="160" r="3.2" />
          <circle cx="230" cy="160" r="3.2" />
        </g>
      </Frame>
    </div>
  );
}

/** Relógio de ponto: Wandgerät mit Display, Tastatur und Beleg. */
export function ClockArt({ className }: Props) {
  return (
    <div className={className}>
      <Frame label="Desenho técnico de um relógio de ponto eletrônico">
        <rect
          x="72"
          y="30"
          width="116"
          height="112"
          rx="16"
          fill="url(#hw-face)"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeOpacity="0.65"
        />
        {/* Display */}
        <rect
          x="88"
          y="44"
          width="84"
          height="30"
          rx="6"
          fill="var(--color-brand-500)"
          fillOpacity="0.14"
          stroke="var(--color-brand-500)"
          strokeWidth="1.3"
        />
        <g fill="var(--color-brand-500)" fillOpacity="0.75">
          <rect x="98" y="55" width="22" height="8" rx="2" />
          <rect x="126" y="55" width="12" height="8" rx="2" />
          <rect x="144" y="55" width="18" height="8" rx="2" />
        </g>
        {/* Tastatur */}
        <g stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={96 + c * 24} y={84 + r * 13} width="16" height="9" rx="2.5" />
            )),
          )}
        </g>
        {/* Beleg */}
        <path
          d="M104 142h52l-4 34-8-5-8 5-8-5-8 5-8-5-8 5z"
          fill="var(--color-surface)"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.4"
        />
        <g stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.28">
          <path d="M114 152h32" />
          <path d="M114 160h22" />
        </g>
      </Frame>
    </div>
  );
}

export const hardwareArt = {
  turnstile: TurnstileArt,
  reader: ReaderArt,
  controller: ControllerArt,
  clock: ClockArt,
} as const;
