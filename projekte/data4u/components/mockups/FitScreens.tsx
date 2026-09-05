import {
  CalendarClock,
  ClipboardList,
  FileText,
  PlayCircle,
  Repeat,
  Ruler,
} from 'lucide-react';
import { GhostLine } from './AppWindow';

/**
 * Die drei Module des Data4U Fit, die im Hero-Mockup nicht sichtbar sind:
 * Finanzen, Treinos, Avaliação física.
 *
 * Gezeigt werden die realen Modulnamen und die reale Struktur der Listen.
 * Alle Werte bleiben leer — Data4U veröffentlicht keine Beispieldaten, und
 * erfundene Zahlen in einem Screenshot sind auch dann erfunden, wenn sie
 * klein gesetzt sind.
 */

function Screen({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="fit-screen">
      <header className="fit-screen-head">
        <span className="fit-screen-icon" aria-hidden>
          {icon}
        </span>
        <h3 className="fit-screen-title">{title}</h3>
      </header>
      <div className="fit-screen-body">{children}</div>
    </article>
  );
}

export function FitScreens() {
  return (
    <div className="fit-screens">
      <Screen title="Financeiro" icon={<FileText size={14} strokeWidth={2} />}>
        <ul className="fit-list" aria-hidden>
          {['Mensalidade', 'Mensalidade', 'Matrícula', 'Mensalidade'].map((l, i) => (
            <li key={i}>
              <span className="fit-list-label">{l}</span>
              <GhostLine w="2.5rem" h={6} />
              <span className={i === 3 ? 'mock-chip' : 'mock-chip mock-chip-ok'}>
                {i === 3 ? 'Em aberto' : 'Pago'}
              </span>
            </li>
          ))}
        </ul>
        <div className="fit-note" aria-hidden>
          <Repeat size={12} strokeWidth={2} />
          Cobrança recorrente
          <span className="fit-note-sep" />
          <FileText size={12} strokeWidth={2} />
          Nota fiscal eletrônica
        </div>
      </Screen>

      <Screen title="Treinos" icon={<ClipboardList size={14} strokeWidth={2} />}>
        <ul className="fit-list" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <PlayCircle size={13} strokeWidth={2} className="fit-list-icon" />
              <GhostLine w={['64%', '48%', '72%', '56%'][i]} h={6} />
              <span className="fit-list-meta">séries × reps</span>
            </li>
          ))}
        </ul>
        <div className="fit-note" aria-hidden>
          <PlayCircle size={12} strokeWidth={2} />
          Banco de exercícios com vídeos demonstrativos
        </div>
      </Screen>

      <Screen title="Avaliação física" icon={<Ruler size={14} strokeWidth={2} />}>
        <ul className="fit-list" aria-hidden>
          {['Peso', 'Estatura', 'Circunferências', 'Dobras cutâneas'].map((l) => (
            <li key={l}>
              <span className="fit-list-label">{l}</span>
              <GhostLine w="3rem" h={6} />
            </li>
          ))}
        </ul>
        <div className="fit-note" aria-hidden>
          <CalendarClock size={12} strokeWidth={2} />
          Histórico no mesmo cadastro do aluno
        </div>
      </Screen>
    </div>
  );
}
