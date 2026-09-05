import type { ReactNode } from 'react';

/**
 * Gerahmte Abbildung mit Bildunterschrift — das wiederkehrende Muster für
 * alle Darstellungen auf der Seite: Hero, Aplicativo, Fit-Module.
 *
 * Die Bildunterschrift ist keine Zierde. Sie benennt, was zu sehen ist, und
 * markiert Mockups sichtbar als Darstellung — deshalb ist sie Pflicht.
 */
export function Figure({
  children,
  caption,
  legend,
  tone = 'dark',
  padded = true,
  className,
  style,
}: {
  children: ReactNode;
  caption: string;
  /** Optionale nummerierte Legende zwischen Abbildung und Unterschrift. */
  legend?: { n: string; label: string }[];
  tone?: 'dark' | 'light';
  /** Ohne Polsterung, wenn der Inhalt selbst schon ein Raster ist. */
  padded?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <figure
      className={['figure', className].filter(Boolean).join(' ')}
      data-tone={tone}
      style={style}
    >
      <div className="figure-stage" data-padded={padded ? 'true' : undefined}>
        {children}
      </div>

      {legend?.length ? (
        <ol className="figure-legend">
          {legend.map((item) => (
            <li key={item.n}>
              <span className="figure-legend-n">{item.n}</span>
              {item.label}
            </li>
          ))}
        </ol>
      ) : null}

      <figcaption className="figure-caption">{caption}</figcaption>
    </figure>
  );
}
