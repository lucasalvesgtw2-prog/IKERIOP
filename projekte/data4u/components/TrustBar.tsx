import { Building2, Dumbbell, GraduationCap, Home, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { revealDelay } from '@/lib/motion';

const icons = {
  dumbbell: Dumbbell,
  building2: Building2,
  home: Home,
  graduation: GraduationCap,
  landmark: Landmark,
} as const;

const items = [
  { label: 'Academias', icon: 'dumbbell' },
  { label: 'Empresas', icon: 'building2' },
  { label: 'Condomínios', icon: 'home' },
  { label: 'Escolas', icon: 'graduation' },
  { label: 'Instituições', icon: 'landmark' },
] as const;

export function TrustBar() {
  return (
    <section className="trustbar" aria-label="Segmentos atendidos">
      <div className="container-d4u grid-rules">
        <p className="trustbar-claim reveal">
          Há décadas desenvolvendo tecnologia para gestão e controle de acesso.
        </p>

        <ul className="trustbar-list">
          {items.map((item, i) => {
            const Icon = icons[item.icon];
            return (
              <li key={item.label} className="reveal" style={revealDelay(60 + i * 60)}>
                <Badge size="md" icon={<Icon size={17} strokeWidth={1.8} aria-hidden />}>
                  {item.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
