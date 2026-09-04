/**
 * Biometrisches Gesichtsnetz — rein gezeichnet, kein Foto.
 *
 * Die Punktwolke ist ein gekacheltes SVG-Muster, kein Feld aus
 * Einzelkreisen: ein Dreiecksraster im <pattern>, beschnitten auf die
 * Silhouette und über eine Maske zur Mitte hin ausgeblendet. Dieselbe
 * Wirkung wie dreihundert einzelne <circle>, aber acht Elemente statt
 * dreihundert — das Markup der Startseite wird dadurch rund 45 KB kleiner.
 *
 * Darüber liegen die Landmarken. Sie machen aus der Wolke erst ein Gesicht
 * und bleiben deshalb einzeln gezeichnet.
 */

const landmarks = [
  { x: 82, y: 90 },
  { x: 118, y: 90 },
  { x: 100, y: 108 },
  { x: 88, y: 126 },
  { x: 112, y: 126 },
  { x: 100, y: 143 },
  { x: 68, y: 80 },
  { x: 132, y: 80 },
  { x: 73, y: 118 },
  { x: 127, y: 118 },
];

const links: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 3],
  [2, 4],
  [3, 4],
  [3, 5],
  [4, 5],
  [6, 0],
  [7, 1],
  [6, 8],
  [7, 9],
  [8, 3],
  [9, 4],
  [8, 5],
  [9, 5],
];

/** Die Landmarken-Verbindungen als ein einziger Pfad. */
const linkPath = links
  .map(([a, b]) => `M${landmarks[a].x} ${landmarks[a].y}L${landmarks[b].x} ${landmarks[b].y}`)
  .join('');

export function FaceMesh({
  className,
  scanning = true,
  /* Zwei Netze auf derselben Seite dürfen sich Muster und Maske nicht
     gegenseitig überschreiben. Die Kennung kommt deshalb von außen — ein
     hochgezählter Modulzähler wäre auf Server und Client verschieden und
     würde die Hydration auseinanderlaufen lassen. */
  uid = 'fm',
}: {
  className?: string;
  scanning?: boolean;
  uid?: string;
}) {

  return (
    <svg
      viewBox="0 0 200 186"
      className={className}
      role="img"
      aria-label="Representação esquemática de identificação por reconhecimento facial"
    >
      <defs>
        {/* Dreiecksraster: zwei versetzte Punkte je Kachel. */}
        <pattern
          id={`${uid}-dots`}
          width="4.3"
          height="4.5"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.08" cy="1.13" r="0.78" fill="var(--color-brand-300)" />
          <circle cx="3.23" cy="3.38" r="0.78" fill="var(--color-brand-300)" />
        </pattern>

        {/* Maske: dunkel in der Mitte, hell an der Kante — dadurch liest man
            die Kontur, ohne sie zu zeichnen. */}
        <radialGradient id={`${uid}-fade`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="45%" stopColor="#3d3d3d" />
          <stop offset="78%" stopColor="#a8a8a8" />
          <stop offset="100%" stopColor="#ffffff" />
        </radialGradient>
        <mask id={`${uid}-mask`}>
          <ellipse cx="100" cy="98" rx="43" ry="53" fill={`url(#${uid}-fade)`} />
        </mask>

        <radialGradient id={`${uid}-core`} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-brand-400)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${uid}-scanline`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0" />
          <stop offset="80%" stopColor="var(--color-signal)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="96" rx="72" ry="78" fill={`url(#${uid}-core)`} />

      <rect
        x="52"
        y="40"
        width="96"
        height="116"
        fill={`url(#${uid}-dots)`}
        mask={`url(#${uid}-mask)`}
      />

      {/* Landmarken-Netz */}
      <path
        d={linkPath}
        stroke="var(--color-signal)"
        strokeWidth="0.6"
        strokeOpacity="0.55"
        fill="none"
      />
      <g fill="var(--color-signal)">
        {landmarks.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" />
        ))}
      </g>

      {/* Erkennungsrahmen */}
      <path
        d="M52 62V48h14M134 48h14v14M148 148v14h-14M66 162H52v-14"
        stroke="var(--color-brand-300)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {scanning ? (
        <rect
          className="anim-scan-face"
          x="52"
          y="44"
          width="96"
          height="26"
          fill={`url(#${uid}-scanline)`}
        />
      ) : null}
    </svg>
  );
}
