import { Check, DoorOpen, Fingerprint, IdCard, ScanFace } from 'lucide-react';
import { FaceMesh } from './FaceMesh';
import { ScanCorners } from '@/components/ui/ScanFrame';

/**
 * Große Erkennungsbühne für die iDFace-Sektion: links das, was das Gerät
 * sieht, rechts das, was daraus im System wird. Kein Foto, keine erfundenen
 * Kennzahlen — nur der Ablauf.
 */
export function RecognitionStage({ className }: { className?: string }) {
  return (
    <div className={['stage', className].filter(Boolean).join(' ')}>
      <div className="stage-inner">
        <ScanCorners className="stage-corners" />

        <div className="stage-view">
          <FaceMesh uid="fm-stage" className="stage-face" />
          <span className="stage-tag" aria-hidden>
            <ScanFace size={12} strokeWidth={2.2} />
            Leitura facial
          </span>
        </div>

        <div className="stage-side" aria-hidden>
          <p className="stage-side-title">Métodos aceitos</p>
          <ul className="stage-methods">
            <li data-active="true">
              <ScanFace size={14} strokeWidth={2} />
              Reconhecimento facial
            </li>
            <li>
              <Fingerprint size={14} strokeWidth={2} />
              Impressão digital
            </li>
            <li>
              <IdCard size={14} strokeWidth={2} />
              Cartão ou tag
            </li>
          </ul>

          <div className="stage-result">
            <span className="stage-result-icon">
              <Check size={13} strokeWidth={3} />
            </span>
            <span>
              <strong>Acesso liberado</strong>
              <span className="stage-result-sub">
                <DoorOpen size={11} strokeWidth={2.2} />
                Registro enviado à gestão
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
