import {
  BadgeCheck,
  Bell,
  Car,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LineChart,
  LogIn,
  LogOut,
  MessageSquare,
  ScanFace,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AppWindow, GhostLine } from './AppWindow';

type Variant = 'dashboard' | 'terminal' | 'gate' | 'roster';

/* Feste Balkenhöhen: eine abstrakte Kurve ohne Achsenbeschriftung und ohne
   erfundene Kennzahlen — sie zeigt, dass es eine Auswertung gibt, nicht
   welche Werte darin stehen. */
const bars = [34, 52, 41, 63, 58, 76, 68, 88, 72, 94, 84, 100];

export function ProductMockup({
  variant,
  className,
}: {
  variant: Variant;
  className?: string;
}) {
  if (variant === 'dashboard') return <FitDashboard className={className} />;
  if (variant === 'terminal') return <AccessConsole className={className} />;
  if (variant === 'gate') return <GateConsole className={className} />;
  return <SchoolRoster className={className} />;
}

/* ------------------------------------------------------------------ Fit -- */
function FitDashboard({ className }: { className?: string }) {
  const modules = [
    { icon: LineChart, label: 'Painel' },
    { icon: Users, label: 'Alunos' },
    { icon: CreditCard, label: 'Financeiro' },
    { icon: Dumbbell, label: 'Treinos' },
    { icon: ClipboardList, label: 'Avaliação física' },
    { icon: ScanFace, label: 'Acessos' },
    { icon: MessageSquare, label: 'CRM' },
  ];

  return (
    <AppWindow title="Data4U Fit" className={className}>
      <div className="mock-split">
        <nav className="mock-side" aria-hidden>
          {modules.map(({ icon: Icon, label }, i) => (
            <span key={label} className="mock-side-item" data-active={i === 0 || undefined}>
              <Icon size={13} strokeWidth={2} />
              {label}
            </span>
          ))}
        </nav>

        <div className="mock-main">
          <div className="mock-tiles" aria-hidden>
            {['Matrículas', 'Recebimentos', 'Acessos hoje'].map((t) => (
              <div key={t} className="mock-tile">
                <span className="mock-tile-label">{t}</span>
                <GhostLine w="52%" h={12} className="mt-1.5" />
              </div>
            ))}
          </div>

          <div className="mock-chart" aria-hidden>
            <span className="mock-tile-label">Frequência por período</span>
            <div className="mock-bars">
              {bars.map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="mock-rows" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="mock-row">
                <span className="mock-avatar" />
                <GhostLine w={['58%', '44%', '66%'][i]} />
                <span className="mock-chip mock-chip-ok">
                  <BadgeCheck size={11} strokeWidth={2.4} />
                  Liberado
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------- Access -- */
function AccessConsole({ className }: { className?: string }) {
  const events = [
    { icon: LogIn, label: 'Entrada — Recepção', chip: 'Facial', ok: true },
    { icon: ShieldCheck, label: 'Entrada — Área restrita', chip: 'Digital', ok: true },
    { icon: LogOut, label: 'Saída — Recepção', chip: 'Cartão', ok: true },
    { icon: Users, label: 'Visitante agendado', chip: 'Visitante', ok: false },
  ];

  return (
    <AppWindow title="Data4U Access" className={className}>
      <div className="mock-stack">
        <div className="mock-tiles" aria-hidden>
          <div className="mock-tile">
            <span className="mock-tile-label">Pessoas no local</span>
            <GhostLine w="40%" h={12} className="mt-1.5" />
          </div>
          <div className="mock-tile">
            <span className="mock-tile-label">Visitantes hoje</span>
            <GhostLine w="34%" h={12} className="mt-1.5" />
          </div>
          <div className="mock-tile">
            <span className="mock-tile-label">Vagas ocupadas</span>
            <GhostLine w="46%" h={12} className="mt-1.5" />
          </div>
        </div>

        <div className="mock-log" aria-hidden>
          <span className="mock-tile-label">Registros de acesso</span>
          {events.map(({ icon: Icon, label, chip, ok }) => (
            <div key={label} className="mock-row">
              <span className="mock-icon">
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="mock-row-label">{label}</span>
              <span className={ok ? 'mock-chip mock-chip-ok' : 'mock-chip'}>{chip}</span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

/* ---------------------------------------------------------- Condominium -- */
function GateConsole({ className }: { className?: string }) {
  return (
    <AppWindow title="Data4U Condominium" className={className}>
      <div className="mock-stack">
        <div className="mock-panel" aria-hidden>
          <span className="mock-icon mock-icon-lg">
            <Car size={17} strokeWidth={1.9} />
          </span>
          <div className="flex-1">
            <span className="mock-row-label">Veículo autorizado</span>
            <GhostLine w="52%" className="mt-1.5" />
          </div>
          <span className="mock-chip mock-chip-ok">Portão</span>
        </div>

        <div className="mock-log" aria-hidden>
          <span className="mock-tile-label">Movimentação da portaria</span>
          {[
            { icon: Users, label: 'Visitante — autorizado pelo morador' },
            { icon: ClipboardList, label: 'Prestador de serviço — entrada' },
            { icon: LogOut, label: 'Morador — saída registrada' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="mock-row">
              <span className="mock-icon">
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="mock-row-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="mock-notice" aria-hidden>
          <Bell size={13} strokeWidth={2} />
          <span>Aviso enviado ao morador por SMS e e-mail</span>
        </div>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------- School -- */
function SchoolRoster({ className }: { className?: string }) {
  return (
    <AppWindow title="Data4U School" className={className}>
      <div className="mock-stack">
        <div className="mock-log" aria-hidden>
          <span className="mock-tile-label">Entradas e saídas</span>
          {[
            { icon: LogIn, label: 'Entrada registrada', chip: 'Aluno' },
            { icon: LogIn, label: 'Entrada registrada', chip: 'Aluno' },
            { icon: LogOut, label: 'Saída registrada', chip: 'Aluno' },
            { icon: LogIn, label: 'Entrada registrada', chip: 'Funcionário' },
          ].map(({ icon: Icon, label, chip }, i) => (
            <div key={i} className="mock-row">
              <span className="mock-icon">
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="mock-avatar" />
              <GhostLine w={['46%', '58%', '40%', '52%'][i]} />
              <span className="mock-chip">{chip}</span>
            </div>
          ))}
        </div>

        <div className="mock-notice" aria-hidden>
          <MessageSquare size={13} strokeWidth={2} />
          <span>SMS enviado ao responsável com o horário registrado</span>
        </div>
      </div>
    </AppWindow>
  );
}
