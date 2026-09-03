'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion, useIsCompact } from '@/lib/scroll';
import { useSmoothScroll } from '@/lib/useSmoothScroll';

/* Three.js gehört nicht ins Server-Rendering und nicht in den ersten Ladepfad:
   die Szene wird erst nach dem ersten Bild nachgeladen. */
const Scene = dynamic(() => import('./3d/Scene'), { ssr: false });

export function SiteShell({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const compact = useIsCompact();
  const [ready, setReady] = useState(false);

  useSmoothScroll(!reduced);

  useEffect(() => {
    // Erst wenn die Seite steht, kommt die GPU-Arbeit dazu.
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => setReady(true), { timeout: 1200 })
      : window.setTimeout(() => setReady(true), 600);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, []);

  return (
    <>
      {ready && <Scene quality={reduced || compact ? 'reduced' : 'full'} />}
      <div className="relative z-10">{children}</div>
    </>
  );
}
