import type { CSSProperties } from 'react';

/**
 * Staffelung eines Scroll-Reveals. Reine Rechnung ohne Client-Zustand —
 * deshalb liegt sie hier und nicht in der Client-Komponente, damit auch
 * Server-Komponenten sie aufrufen können.
 */
export function revealDelay(ms: number): CSSProperties {
  return { '--reveal-delay': `${ms}ms` } as CSSProperties;
}
