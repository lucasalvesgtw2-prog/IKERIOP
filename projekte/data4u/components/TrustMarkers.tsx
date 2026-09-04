import { revealDelay } from '@/lib/motion';
import { trustMarkers } from '@/lib/data4u';

/**
 * Bewusst ohne Zahlen. Data4U veröffentlicht keine Kunden-, Installations-
 * oder Wachstumszahlen — statt sie zu erfinden, stehen hier qualitative
 * Merkmale, die belegbar sind.
 */
export function TrustMarkers() {
  return (
    <ul className="markers">
      {trustMarkers.map((m, i) => (
        <li key={m.title} className="marker reveal" style={revealDelay(i * 80)}>
          <span className="marker-rule" aria-hidden />
          <h3 className="marker-title">{m.title}</h3>
          <p className="marker-text">{m.text}</p>
        </li>
      ))}
    </ul>
  );
}
