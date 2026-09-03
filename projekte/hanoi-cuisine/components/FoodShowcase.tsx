'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { dishes } from '@/lib/restaurant';

/**
 * Akt 04 — die Gerichte.
 *
 * Auf großen Screens wird die Sektion angeheftet und horizontal
 * durchgefahren; die 3D-Schale im Hintergrund wechselt dabei ihre Brühe.
 * Auf Mobilgeräten und bei reduzierter Bewegung wird daraus eine ruhige
 * vertikale Abfolge — kein angehefteter Scroll, keine Orientierungslosigkeit.
 */
export function FoodShowcase() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [horizontal, setHorizontal] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
    const update = () => setHorizontal(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!horizontal || !wrap.current || !track.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const el = track.current!;
      const distance = () => el.scrollWidth - window.innerWidth;

      gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
    }, wrap);

    return () => ctx.revert();
  }, [horizontal]);

  return (
    <section id="gerichte" ref={wrap} className="relative">
      <div className="mx-auto max-w-[1600px] px-6 pt-32 md:px-12 md:pt-40">
        <p className="eyebrow text-gold/70">04 — Signature Dishes</p>
        <h2 className="mt-6 max-w-[14ch] font-display text-[clamp(2rem,5vw,4.4rem)] text-paper">
          Drei Gerichte, an denen man uns messen darf.
        </h2>
      </div>

      <div
        ref={track}
        className={
          horizontal
            ? 'mt-16 flex w-max items-stretch gap-10 pl-6 md:pl-12'
            : 'mt-16 flex flex-col gap-16 px-6 md:px-12'
        }
      >
        {dishes.map((dish) => (
          <article
            key={dish.id}
            className={`relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-paper/10 p-8 md:p-12 ${
              horizontal ? 'h-[62vh] w-[78vw] max-w-[860px]' : 'min-h-[26rem]'
            }`}
            style={{
              background: `radial-gradient(120% 100% at 80% 0%, ${dish.tone} 0%, rgba(16,12,11,0.92) 68%)`,
            }}
          >
            {/* Brühen-Scheibe: greift die Schale aus der 3D-Szene auf.
                >>> Hier kann später ein echtes Gerichte-Foto einziehen. <<< */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-24 h-[24rem] w-[24rem] rounded-full opacity-80 blur-[1px] md:-top-28 md:-right-20 md:h-[34rem] md:w-[34rem]"
              style={{
                background: `radial-gradient(circle at 38% 32%, ${dish.accent}55 0%, ${dish.tone} 46%, rgba(10,7,6,0.9) 78%)`,
                boxShadow: `inset 0 0 90px rgba(0,0,0,0.65), 0 0 0 1px ${dish.accent}33`,
              }}
            />

            <div className="relative flex items-center gap-4">
              <span className="font-display text-2xl text-gold/80">{dish.index}</span>
              <span className="h-px flex-1 bg-paper/15" />
            </div>

            <div className="relative max-w-[26rem]">
              <h3 className="font-display text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[0.95] text-paper">
                {dish.vietnamese}
              </h3>
              <p className="mt-3 text-sm tracking-[0.2em] text-paper/45 uppercase">{dish.german}</p>
              <p className="prose-vi mt-6 text-paper/65">{dish.description}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-[1600px] px-6 text-xs text-paper/30 md:px-12">
        Gerichtbeschreibungen von der offiziellen Karte. Die vollständige Auswahl
        samt Preisen liegt im Haus und auf hanoi-leipzig.de.
      </p>
    </section>
  );
}
