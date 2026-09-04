import type { MetadataRoute } from 'next';
import { company, hardware, solutions } from '@/lib/data4u';

/**
 * Sitemap für den statischen Export. Die Reihenfolge spiegelt die Wichtigkeit
 * wider: Startseite, dann Produkte, dann Equipment, dann Institutionelles.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = company.website;
  const now = new Date();

  const routes: { path: string; priority: number }[] = [
    { path: '/', priority: 1 },
    ...solutions.map((s) => ({ path: s.href, priority: 0.9 })),
    { path: '/equipamentos', priority: 0.8 },
    ...hardware.map((h) => ({ path: h.href, priority: 0.7 })),
    { path: '/sobre-nos', priority: 0.6 },
    { path: '/suporte', priority: 0.6 },
    { path: '/fale-conosco', priority: 0.8 },
    { path: '/politica-de-privacidade', priority: 0.2 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${base}${path === '/' ? '/' : `${path}/`}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority,
  }));
}
