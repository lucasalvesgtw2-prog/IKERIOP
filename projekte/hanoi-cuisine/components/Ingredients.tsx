import { ingredients } from '@/lib/restaurant';
import { Reveal, SplitHeading } from './Reveal';

/** Akt 05 — die Zutaten. Hier fliegt die Garnitur der 3D-Szene auseinander. */
export function Ingredients() {
  return (
    <section className="relative py-32 md:py-48">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <Reveal>
          <p className="eyebrow text-gold/70">05 — Frische Zutaten</p>
        </Reveal>

        <SplitHeading
          text="Acht Dinge, ohne die nichts geht."
          className="mt-8 max-w-[16ch] font-display text-[clamp(2rem,5vw,4.4rem)] text-paper"
        />

        <ul className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          {ingredients.map((item, i) => (
            <Reveal as="li" key={item.vi} delay={i * 0.05} y={20}>
              <span className="block font-display text-[clamp(1.5rem,2.4vw,2.2rem)] text-paper">
                {item.vi}
              </span>
              <span className="mt-1 block text-sm text-herb/80">{item.de}</span>
              <span className="mt-4 block h-px w-full bg-paper/10" />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
