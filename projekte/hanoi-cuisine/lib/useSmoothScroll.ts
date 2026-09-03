'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { clamp, scrollState } from './scroll';

/**
 * Smooth Scrolling mit Lenis, an GSAP/ScrollTrigger gekoppelt, und Pflege des
 * globalen Scroll-Fortschritts für die 3D-Szene.
 *
 * Bei prefers-reduced-motion wird Lenis gar nicht erst gestartet — natives
 * Scrollen bleibt dann exakt so, wie das Betriebssystem es vorsieht.
 */
export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const cinema = document.getElementById('cinema');
    const measure = () => {
      if (!cinema) return;
      const total = cinema.offsetHeight - window.innerHeight;
      scrollState.progress = clamp(total > 0 ? window.scrollY / total : 0);
      scrollState.presence = clamp(
        (cinema.getBoundingClientRect().bottom - window.innerHeight * 0.2) /
          (window.innerHeight * 0.6),
      );
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    if (!enabled) {
      return () => {
        window.removeEventListener('scroll', measure);
        window.removeEventListener('resize', measure);
      };
    }

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    lenis.on('scroll', () => {
      ScrollTrigger.update();
      measure();
    });

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [enabled]);
}
