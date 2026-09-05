import { Building2, Dumbbell, GraduationCap, Home, Landmark } from 'lucide-react';
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
      <div className="container-d4u">
        <p className="trustbar-claim reveal">
          Há décadas desenvolvendo tecnologia para gestão e controle de acesso.
        </p>

        <ul className="trustbar-list">
          {items.map((item, i) => {
            const Icon = icons[item.icon];
            return (
              <li key={item.label} className="reveal" style={revealDelay(40 + i * 50)}>
                <span className="trustbar-item">
                  <Icon size={16} strokeWidth={1.7} aria-hidden />
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
