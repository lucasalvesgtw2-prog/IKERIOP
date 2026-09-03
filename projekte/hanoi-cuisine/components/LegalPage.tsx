import Link from 'next/link';
import { addressLine, restaurant } from '@/lib/restaurant';

/** Gemeinsames Gerüst für die Pflichtseiten — ruhig, gut lesbar, gleiche Marke. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
        <Link
          href="/"
          className="eyebrow text-son transition-opacity hover:opacity-70"
        >
          ← Hà Nội Cuisine
        </Link>

        <h1 className="mt-10 font-display text-[clamp(2.2rem,6vw,3.6rem)] text-ink">{title}</h1>
        <div className="rule-gold mt-8 mb-12" />

        <div className="prose-vi space-y-6 text-ink/75 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_strong]:text-ink">
          {children}
        </div>

        <p className="mt-16 border-t border-ink/10 pt-8 text-sm text-ink/45">
          {restaurant.legalName} · {addressLine} ·{' '}
          <a href={`tel:${restaurant.phone}`} className="underline underline-offset-4">
            {restaurant.phoneDisplay}
          </a>
        </p>
      </div>
    </main>
  );
}
