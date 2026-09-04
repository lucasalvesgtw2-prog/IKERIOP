import type { ReactNode } from 'react';

/**
 * Fenster-Rahmen für alle Interface-Mockups. Der Hinweis „Representação de
 * interface" steht bewusst im Rahmen selbst: die Darstellungen zeigen echte
 * Module, aber keine echten Kundendaten.
 */
export function AppWindow({
  title,
  children,
  className,
  tone = 'light',
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <figure
      className={['app-window', className].filter(Boolean).join(' ')}
      data-tone={tone}
    >
      <div className="app-window-bar">
        <span className="app-window-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="app-window-title">{title}</span>
        <span className="app-window-note">Representação</span>
      </div>
      <div className="app-window-body">{children}</div>
    </figure>
  );
}

/** Anonymisierte Textzeile — steht für einen Namen, ohne einen zu erfinden. */
export function GhostLine({
  w = '60%',
  h = 8,
  className,
}: {
  w?: string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={['ghost-line', className].filter(Boolean).join(' ')}
      style={{ width: w, height: h }}
    />
  );
}
