'use client';

import { useRef } from 'react';
import { restaurant } from '@/lib/restaurant';
import { Reveal, SplitHeading } from './Reveal';

/**
 * Akt 09 — der Abschluss.
 * Der Hauptknopf ist magnetisch: er folgt dem Zeiger ein Stück weit, was ihn
 * auf einer sonst ruhigen Fläche spürbar macht. Auf Touch passiert nichts —
 * dort gibt es keinen Zeiger, dem er folgen könnte.
 */
export function Reservation() {
  const button = useRef<HTMLAnchorElement>(null);

  const magnetize = (e: React.MouseEvent) => {
    const el = button.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`;
  };

  const release = () => {
    if (button.current) button.current.style.transform = '';
  };

  return (
    <section
      id="reservieren"
      className="relative z-10 overflow-hidden bg-lacquer"
      onMouseMove={magnetize}
      onMouseLeave={release}
    >
      {/* Zinnober-Schimmer: der einzige große Farbeinsatz der Seite */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-1/2 h-[120vh]"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(178,58,44,0.22) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-6 py-36 text-center md:px-12 md:py-52">
        <Reveal>
          <p className="eyebrow text-gold/70">09 — Reservierung</p>
        </Reveal>

        <SplitHeading
          text="Ihr Tisch wartet."
          className="mt-10 font-display text-[clamp(3rem,11vw,10rem)] leading-[0.9] text-paper"
        />

        <Reveal className="mt-14 flex flex-col items-center gap-6" delay={0.15}>
          <a
            ref={button}
            href={restaurant.reservation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-son px-12 py-6 text-lg text-paper transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#c8452f]"
          >
            Online reservieren
          </a>

          <p className="text-paper/45">
            oder direkt anrufen —{' '}
            <a
              href={`tel:${restaurant.phone}`}
              className="text-paper underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold"
            >
              {restaurant.phoneDisplay}
            </a>
          </p>

          <a
            href={restaurant.delivery}
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow text-paper/30 transition-colors hover:text-paper/60"
          >
            Lieber zu Hause? Zur Lieferung
          </a>
        </Reveal>
      </div>
    </section>
  );
}
