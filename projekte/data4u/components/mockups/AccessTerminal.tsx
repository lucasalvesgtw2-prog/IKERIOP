import { Check, Fingerprint, ScanFace, Wifi } from 'lucide-react';
import { FaceMesh } from './FaceMesh';

/**
 * Zugangsterminal mit Gesichtserkennung — als Interface nachgebaut, nicht
 * fotografiert. Das Gerät zeigt, was das System sieht: Kamerabild als
 * Punktnetz, Erkennungsrahmen, Statuszeile.
 */
export function AccessTerminal({ className }: { className?: string }) {
  return (
    <div className={['terminal', className].filter(Boolean).join(' ')}>
      {/* Gehäuse */}
      <div className="terminal-body">
        {/* Sensorleiste über dem Display */}
        <div className="terminal-sensors" aria-hidden>
          <span className="terminal-lens" />
          <span className="terminal-lens terminal-lens-ir" />
          <span className="terminal-led anim-pulse" />
        </div>

        {/* Display */}
        <div className="terminal-screen">
          <div className="terminal-topbar" aria-hidden>
            <span className="flex items-center gap-1.5">
              <ScanFace size={12} strokeWidth={2.2} />
              Portaria 01
            </span>
            <span className="flex items-center gap-1.5">
              <Wifi size={12} strokeWidth={2.2} />
              Online
            </span>
          </div>

          <FaceMesh uid="fm-terminal" className="terminal-face" />

          <div className="terminal-status">
            <span className="terminal-status-dot" aria-hidden>
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="terminal-status-text">Acesso liberado</span>
          </div>
        </div>

        {/* Fingerabdrucksensor unter dem Display */}
        <div className="terminal-touch" aria-hidden>
          <Fingerprint size={18} strokeWidth={1.6} />
        </div>
      </div>

      {/* Wandschatten */}
      <div className="terminal-shadow" aria-hidden />
    </div>
  );
}
