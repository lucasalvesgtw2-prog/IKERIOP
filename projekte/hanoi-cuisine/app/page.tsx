import { Cuisine } from '@/components/Cuisine';
import { Experience } from '@/components/Experience';
import { FoodShowcase } from '@/components/FoodShowcase';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { Ingredients } from '@/components/Ingredients';
import { Navbar } from '@/components/Navbar';
import { Reservation } from '@/components/Reservation';
import { Restaurant } from '@/components/Restaurant';
import { Reviews } from '@/components/Reviews';
import { SiteShell } from '@/components/SiteShell';
import { Visit } from '@/components/Visit';

export default function Home() {
  return (
    <SiteShell>
      <Navbar />

      <main id="hauptinhalt">
        {/*
          Der cinematische Teil: fünf Akte über einer einzigen, durchgehenden
          3D-Einstellung. Die Höhe dieses Blocks bestimmt den Fortschritt der
          Kamerafahrt (siehe lib/useSmoothScroll.ts).
        */}
        <div id="cinema">
          <Hero />
          <Experience />
          <Cuisine />
          <FoodShowcase />
          <Ingredients />
        </div>

        {/* Ab hier deckende Flächen — der Wechsel von Lack zu Reispapier. */}
        <Restaurant />
        <Reviews />
        <Visit />
        <Reservation />
      </main>

      <Footer />
    </SiteShell>
  );
}
