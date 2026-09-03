import { addressLine, restaurant } from '@/lib/restaurant';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-paper/10 bg-lacquer">
      <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="font-display text-3xl text-paper">Hà Nội Cuisine</span>
            <p className="mt-3 text-sm text-paper/45">
              {addressLine} · Vietnamesisches Restaurant
            </p>
          </div>

          <nav aria-label="Weitere Links" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/50 transition-colors hover:text-paper"
            >
              hanoi-leipzig.de
            </a>
            <a
              href={restaurant.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/50 transition-colors hover:text-paper"
            >
              Facebook
            </a>
            {/* Pflichtseiten: hier die echten URLs des Betreibers eintragen */}
            <a href="/impressum/" className="text-paper/50 transition-colors hover:text-paper">
              Impressum
            </a>
            <a href="/datenschutz/" className="text-paper/50 transition-colors hover:text-paper">
              Datenschutz
            </a>
          </nav>
        </div>

        <div className="rule-gold my-10" />

        <p className="text-xs text-paper/25">
          © {new Date().getFullYear()} {restaurant.legalName}
        </p>
      </div>
    </footer>
  );
}
