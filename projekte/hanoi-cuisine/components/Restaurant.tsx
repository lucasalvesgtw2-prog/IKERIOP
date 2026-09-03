import { Reveal, SplitHeading } from './Reveal';

const facts = [
  { value: '2', label: 'Etagen', note: 'plus Plätze im Freien, sobald es warm wird' },
  { value: '150 m', label: 'zum Hauptbahnhof', note: 'mitten auf der Einkaufsstraße Brühl' },
  { value: 'Lẩu', label: 'Hot Pot am Tisch', note: 'in Leipzig kaum ein zweites Mal zu finden' },
];

/** Akt 06 — das Haus. Erster heller Akt: Reispapier nach dem Lack. */
export function Restaurant() {
  return (
    <section id="restaurant" className="relative z-10 bg-paper text-ink">
      <div className="mx-auto max-w-[1600px] px-6 py-32 md:px-12 md:py-48">
        <Reveal>
          <p className="eyebrow text-son">06 — Das Restaurant</p>
        </Reveal>

        <div className="mt-8 grid gap-16 md:grid-cols-12">
          <div className="md:col-span-7">
            <SplitHeading
              text="Ein Haus, das man im Vorbeigehen findet und dann wiederkommt."
              className="max-w-[16ch] font-display text-[clamp(2rem,4.6vw,4.2rem)] text-ink"
            />
          </div>

          <Reveal className="md:col-span-5 md:pt-3" delay={0.1}>
            <p className="prose-vi text-lg text-ink/70">
              Der Brühl ist die schnellste Straße der Stadt: Bahnhof, Höfe am
              Brühl, Menschen mit Koffern. Das Restaurant nimmt dieses Tempo auf
              und dreht es herunter — unten das offene Erdgeschoss, oben die
              ruhige Etage für längere Abende.
            </p>
          </Reveal>
        </div>

        {/* Bildstrecke — asymmetrisch gesetzt wie eine Magazin-Doppelseite.
            Bis echte Aufnahmen vorliegen, sind das gestaltete Lack-Tafeln mit
            goldener Rasterung: erkennbar Absicht, kein leerer Rahmen. Jede
            Tafel hat ihr endgültiges Seitenverhältnis — später zieht das Foto
            ein, ohne dass das Layout springt. */}
        <div className="mt-24 grid gap-5 md:grid-cols-12">
          {[
            { word: 'Nhà', caption: 'Erdgeschoss, Blick zur Straße', tone: '#3c2a20', box: 'md:col-span-7', ratio: 'aspect-[4/3]' },
            { word: 'Tầng', caption: 'Obere Etage, Abendlicht', tone: '#4a3020', box: 'md:col-span-5 md:mt-20', ratio: 'aspect-[3/4]' },
            { word: 'Lẩu', caption: 'Hot Pot am Tisch', tone: '#5a3524', box: 'md:col-span-6 md:col-start-4 md:mt-4', ratio: 'aspect-[16/10]' },
          ].map((frame, i) => (
            <Reveal key={frame.caption} delay={i * 0.08} className={frame.box}>
              <figure>
                <div
                  className={`relative ${frame.ratio} overflow-hidden rounded-2xl`}
                  style={{
                    background: `radial-gradient(120% 120% at 26% 12%, ${frame.tone} 0%, #1d1512 78%)`,
                  }}
                >
                  {/* Goldrasterung: das Lack-Motiv als feines Liniennetz */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-[0.18]"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(200,160,90,0.5) 0 1px, transparent 1px 46px), repeating-linear-gradient(0deg, rgba(200,160,90,0.5) 0 1px, transparent 1px 46px)',
                    }}
                  />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="font-display text-[clamp(3rem,8vw,6rem)] text-paper/25">
                      {frame.word}
                    </span>
                  </div>
                  <div className="absolute right-5 bottom-5 left-5 h-px bg-gold/40" />
                </div>
                <figcaption className="mt-3 text-sm text-ink/50">{frame.caption}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <dl className="mt-24 grid gap-10 border-t border-ink/10 pt-12 md:grid-cols-3">
          {facts.map((fact, i) => (
            <Reveal key={fact.label} delay={i * 0.08}>
              <dt className="font-display text-[clamp(2.6rem,5vw,4rem)] leading-none text-son">
                {fact.value}
              </dt>
              <dd className="mt-4">
                <span className="block text-ink">{fact.label}</span>
                <span className="mt-1 block text-sm text-ink/50">{fact.note}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
