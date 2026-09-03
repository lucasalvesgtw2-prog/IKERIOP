import { Reveal, SplitHeading } from './Reveal';

/** Akt 03 — die Küche, ruhig gesetzt: nur Typografie über der 3D-Szene. */
export function Cuisine() {
  return (
    <section className="relative py-32 md:py-52">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <Reveal>
          <p className="eyebrow text-gold/70">03 — Die Küche</p>
        </Reveal>

        <SplitHeading
          text="Eine Brühe ist kein Rezept. Sie ist Geduld."
          className="mt-10 max-w-[20ch] font-display text-[clamp(2.2rem,6.4vw,6rem)] leading-[0.98] text-paper"
        />

        <Reveal className="mt-14 ml-auto max-w-xl" delay={0.15}>
          <p className="prose-vi text-lg text-paper/60 md:text-xl">
            Vietnamesisch kochen heißt, fünf Geschmäcker gleichzeitig im
            Gleichgewicht zu halten — und trotzdem jeden einzelnen zu schmecken.
            Fünf Kräuter gehen in unsere Rinderbrühe. Was danach in die Schale
            kommt, ist Handarbeit: gerollt, geschnitten, angerichtet.
          </p>
          <div className="rule-gold mt-10 w-full" />
        </Reveal>
      </div>
    </section>
  );
}
