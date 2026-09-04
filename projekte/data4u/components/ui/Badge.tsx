import type { ReactNode } from 'react';

/**
 * Pille. Zwei Größen, ein Bauteil:
 *
 * - `sm` ist das technische Mikro-Label in Mono-Versalien.
 * - `md` ist die größere Variante mit Symbol, die die Branchen unter dem
 *   Hero trägt.
 */
export function Badge({
  children,
  size = 'sm',
  icon,
  className,
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={['badge', size === 'md' ? 'badge-md' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}
