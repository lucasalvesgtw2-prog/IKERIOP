/**
 * Die vier Ecken einer Gesichtserkennung — das wiederkehrende Erkennungs-
 * zeichen des Layouts. Liegt als Overlay über einem `position: relative`
 * Elternelement und ist rein dekorativ.
 */
export function ScanCorners({ className }: { className?: string }) {
  return (
    <span aria-hidden className={['pointer-events-none', className].filter(Boolean).join(' ')}>
      <span className="scan-corner scan-corner-tl" />
      <span className="scan-corner scan-corner-tr" />
      <span className="scan-corner scan-corner-bl" />
      <span className="scan-corner scan-corner-br" />
    </span>
  );
}
