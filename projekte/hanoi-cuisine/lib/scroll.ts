'use client';

import { useEffect, useState } from 'react';

/**
 * Scroll-Zustand außerhalb von React.
 *
 * Die 3D-Szene liest diese Werte in jedem Frame. Würde der Fortschritt über
 * React-State laufen, würde die halbe Seite 60-mal pro Sekunde neu rendern.
 */
export const scrollState = {
  /** 0…1 über die gesamte cinematische Strecke (Hero bis Zutaten) */
  progress: 0,
  /** Sichtbarkeit der 3D-Szene, 0…1 */
  presence: 0,
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Grobe Geräteklasse — entscheidet über 3D-Detailgrad, nicht über Layout. */
export function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Fortschritt innerhalb eines Abschnitts, 0 davor, 1 danach. */
export const range = (v: number, start: number, end: number) =>
  clamp((v - start) / (end - start));

/** Rahmenrate-unabhängige Dämpfung — lässt jede Bewegung nachschwingen. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
