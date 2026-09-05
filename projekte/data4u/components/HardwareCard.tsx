import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Hardware } from '@/lib/data4u';
import { hardwareArt } from '@/components/mockups/HardwareArt';

export function HardwareCard({ item }: { item: Hardware }) {
  const Art = hardwareArt[item.art];

  return (
    <article className="card card-hover hw-card">
      <div className="hw-art">
        <Art className="hw-art-inner" />
      </div>

      <div className="hw-body">
        <p className="solution-eyebrow">{item.eyebrow}</p>
        <h3 className="t-h3 mt-2">{item.name}</h3>
        <p className="t-body mt-2.5">{item.short}</p>
        <p className="mt-5">
          <Link href={item.href} className="link-arrow solution-link">
            Ver detalhes
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
          </Link>
        </p>
      </div>
    </article>
  );
}
