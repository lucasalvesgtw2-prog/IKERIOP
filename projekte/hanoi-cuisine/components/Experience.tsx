import { Reveal, SplitHeading } from './Reveal';

/** Akt 02 — die Atmosphäre des Hauses, über der laufenden 3D-Szene. */
export function Experience() {
  return (
    <section id="erlebnis" className="relative py-32 md:py-48">
      <div className="mx-auto grid max-w-[1600px] gap-14 px-6 md:grid-cols-12 md:px-12">
        <Reveal className="md:col-span-4" as="div">
          <p className="eyebrow text-gold/70">02 — Das Erlebnis</p>
          <div className="rule-gold mt-6 w-24" />
        </Reveal>

        <div className="md:col-span-8">
          <SplitHeading
            text="Zwei Etagen, mitten im Brühl."
            className="max-w-[18ch] font-display text-[clamp(2rem,5vw,4.6rem)] text-paper"
          />
          <Reveal className="mt-10 grid gap-8 md:grid-cols-2" delay={0.1}>
            <p className="prose-vi text-lg text-paper/60">
              Das Haus liegt dort, wo Leipzig am schnellsten ist: an der
              Einkaufsstraße Brühl, wenige Schritte vom Hauptbahnhof. Drinnen
              wird es sofort langsamer. Zwei Etagen, im Sommer Plätze draußen —
              und der Geruch von Brühe, der über allem liegt.
            </p>
            <p className="prose-vi text-lg text-paper/60">
              Der Hot Pot kommt an den Tisch und bleibt dort stehen: gekocht
              wird gemeinsam, über die ganze Länge eines Abends. Es ist die Art
              zu essen, die in Hanoi selbstverständlich ist — und in Leipzig
              sonst kaum jemand anbietet.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
