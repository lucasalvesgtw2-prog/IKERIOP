'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { restaurant } from '@/lib/restaurant';

const links = [
  { href: '#erlebnis', label: 'Erlebnis' },
  { href: '#gerichte', label: 'Gerichte' },
  { href: '#restaurant', label: 'Restaurant' },
  { href: '#besuch', label: 'Besuch' },
];

export function Navbar() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          compact
            ? 'border-b border-paper/10 bg-lacquer/92 py-3 backdrop-blur-xl'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 md:px-12">
          <a href="#top" className="group flex items-baseline gap-2.5">
            <span className="font-display text-xl leading-none tracking-tight text-paper">Hà Nội</span>
            <span className="eyebrow text-gold/70 transition-colors group-hover:text-gold">Cuisine</span>
          </a>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-10 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative text-sm text-paper/70 transition-colors hover:text-paper"
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:origin-left group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={restaurant.reservation}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full border border-gold/40 px-5 py-2.5 text-sm text-gold transition-all duration-500 hover:border-gold hover:bg-gold hover:text-lacquer md:inline-block"
            >
              Reservieren
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full border border-paper/15 text-paper md:hidden"
              aria-label="Menü öffnen"
              aria-expanded={open}
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Vollbild-Navigation für Mobilgeräte */}
      <div
        className={`fixed inset-0 z-60 bg-lacquer transition-[clip-path] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden ${
          open ? '[clip-path:inset(0_0_0%_0)]' : 'pointer-events-none [clip-path:inset(0_0_100%_0)]'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="font-display text-xl text-paper">Hà Nội</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-11 w-11 place-items-center rounded-full border border-paper/15 text-paper"
            aria-label="Menü schließen"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <nav aria-label="Mobile Navigation" className="flex flex-col gap-2 px-6 pt-10">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-paper/10 py-5 font-display text-4xl text-paper"
            >
              <span className="eyebrow mr-4 align-middle text-gold/50">{`0${i + 1}`}</span>
              {l.label}
            </a>
          ))}
          <a
            href={restaurant.reservation}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 rounded-full bg-son px-6 py-4 text-center text-paper"
          >
            Tisch reservieren
          </a>
          <a href={`tel:${restaurant.phone}`} className="py-4 text-center text-paper/60">
            {restaurant.phoneDisplay}
          </a>
        </nav>
      </div>
    </>
  );
}
