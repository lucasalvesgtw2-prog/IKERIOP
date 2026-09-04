import { revealDelay } from '@/lib/motion';
import { company } from '@/lib/data4u';

/**
 * Firmenhistorie. Nur belegte Eckdaten: Gründung als PolySoft Informática
 * 1988, Umbenennung in Data4U Technology 1996, heutiges Tätigkeitsfeld.
 */
const milestones = [
  {
    year: String(company.foundedAs.year),
    title: 'Fundação',
    text: `A empresa nasce como ${company.foundedAs.name}, desenvolvendo software sob demanda.`,
  },
  {
    year: String(company.renamedTo.year),
    title: company.renamedTo.name,
    text: 'A operação passa a atuar sob o nome Data4U Technology.',
  },
  {
    year: 'Hoje',
    title: 'Gestão e controle de acesso',
    text: 'Software e equipamentos integrados para academias, empresas, condomínios e escolas.',
  },
] as const;

export function Timeline() {
  return (
    <ol className="timeline">
      {milestones.map((m, i) => (
        <li key={m.year} className="timeline-item reveal" style={revealDelay(i * 120)}>
          <span className="timeline-year">{m.year}</span>
          <span className="timeline-node" aria-hidden />
          <h3 className="timeline-title">{m.title}</h3>
          <p className="timeline-text">{m.text}</p>
        </li>
      ))}
    </ol>
  );
}
