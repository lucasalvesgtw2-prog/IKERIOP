/**
 * Wortmarke. Solange keine Logodatei von Data4U vorliegt, ist die Marke rein
 * typografisch gesetzt: das „4" trägt die Markenfarbe, davor steht die
 * Rasterblende als Bildzeichen. Eine gelieferte SVG-Datei ersetzt später
 * genau diese Komponente — an allen Stellen gleichzeitig.
 */
export function Logo({
  className,
  mark = true,
}: {
  className?: string;
  mark?: boolean;
}) {
  return (
    <span
      className={['inline-flex items-center gap-2.5 select-none', className]
        .filter(Boolean)
        .join(' ')}
    >
      {mark ? <LogoMark /> : null}
      <span className="text-[1.0625rem] font-semibold tracking-[-0.03em] leading-none">
        Data<span className="text-brand-500">4</span>U
      </span>
    </span>
  );
}

/** Bildzeichen: vier Quadranten, einer davon erkannt. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={['h-7 w-7 shrink-0', className].filter(Boolean).join(' ')}
      aria-hidden
      focusable="false"
    >
      <rect
        x="1"
        y="1"
        width="26"
        height="26"
        rx="7.5"
        className="fill-brand-500"
      />
      <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M8 11V9.6A1.6 1.6 0 0 1 9.6 8H11" />
        <path d="M17 8h1.4A1.6 1.6 0 0 1 20 9.6V11" />
        <path d="M20 17v1.4a1.6 1.6 0 0 1-1.6 1.6H17" />
        <path d="M11 20H9.6A1.6 1.6 0 0 1 8 18.4V17" />
      </g>
      <rect x="12.6" y="12.6" width="2.8" height="2.8" rx="1.4" fill="#fff" />
    </svg>
  );
}
