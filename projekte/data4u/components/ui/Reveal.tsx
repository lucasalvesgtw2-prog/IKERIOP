'use client';

import { useEffect } from 'react';

/**
 * Ein einziger IntersectionObserver für die gesamte Seite. Er schaltet die
 * Klasse `is-in` an jedem Element mit `.reveal` und meldet sich danach ab —
 * kein Scroll-Listener, keine Animationsbibliothek.
 *
 * Elemente, die bereits beim Laden im Bild stehen, werden sofort geschaltet,
 * damit im Hero nichts nachträglich einblendet.
 */
export function RevealProvider() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (nodes.length === 0) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return null;
}
