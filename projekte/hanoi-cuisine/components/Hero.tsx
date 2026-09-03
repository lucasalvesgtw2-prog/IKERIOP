'use client';

import { ArrowDown } from 'lucide-react';
import { restaurant } from '@/lib/restaurant';
import { SplitHeading } from './Reveal';

/**
 * Cinematischer Auftakt.
 *
 * Der Vorhang wird per CSS-Keyframe entfernt, nicht per JavaScript — er
 * verschwindet also auch dann zuverlässig, wenn ein Skript scheitert, und bei
 * prefers-reduced-motion ist er sofort weg.
 */
export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      {/* Vorhang */}
      <div className="intro-curtain pointer-events-none absolute inset-0 z-40 grid place-items-center bg-lacquer">
        <div className="intro-mark text-center">
          <span className="block font-display text-[clamp(2rem,7vw,4.5rem)] leading-none text-paper">
            Hà Nội
          </span>
          <span className="intro-rule mx-auto mt-5 block h-px w-0 bg-gold/70" />
          <span className="eyebrow mt-5 block text-gold/60">Cuisine · Leipzig</span>
        </div>
      </div>

      {/* Leseschutz: verdichtet den unteren Bildrand, damit die Typografie
          über der 3D-Szene steht statt in ihr zu verschwinden. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(16,12,11,0.85) 0%, rgba(16,12,11,0.15) 34%, rgba(16,12,11,0.55) 72%, rgba(16,12,11,0.95) 100%)',
        }}
      />

      <div className="relative z-20 mx-auto w-full max-w-[1600px] px-6 pb-16 md:px-12 md:pb-20">
        <p className="hero-fade eyebrow mb-8 text-gold/80">
          Vietnamesisches Restaurant · {restaurant.street}, {restaurant.city}
        </p>

        <SplitHeading
          as="h1"
          immediate
          delay={2.0}
          text="Hanoi beginnt am Brühl."
          className="max-w-[16ch] font-display text-[clamp(2.75rem,7.1vw,6.6rem)] leading-[0.94] text-paper"
        />

        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="hero-fade prose-vi max-w-md text-lg text-paper/65 md:text-xl">
            Phở aus einer Brühe mit fünf Kräutern, handgerollte Sommerrollen und
            Hot Pot — hundertfünfzig Meter vom Hauptbahnhof.
          </p>

          <div className="hero-fade flex flex-wrap items-center gap-4">
            <a
              href={restaurant.reservation}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-full bg-paper px-8 py-4 text-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            >
              <span className="relative z-10">Tisch reservieren</span>
              <span className="absolute inset-0 z-0 origin-bottom scale-y-0 bg-gold transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100" />
            </a>
            <a
              href="#gerichte"
              className="rounded-full border border-paper/25 px-8 py-4 text-paper/80 transition-colors duration-500 hover:border-paper hover:text-paper"
            >
              Die Gerichte
            </a>
          </div>
        </div>

        <div className="hero-fade mt-14 flex items-center gap-3 text-paper/35">
          <ArrowDown size={14} strokeWidth={1.5} className="animate-[nudge_2.4s_ease-in-out_infinite]" />
          <span className="eyebrow">Scrollen</span>
        </div>
      </div>
    </section>
  );
}
