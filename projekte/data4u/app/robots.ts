import type { MetadataRoute } from 'next';
import { company } from '@/lib/data4u';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/politica-de-privacidade/' },
    sitemap: `${company.website}/sitemap.xml`,
  };
}
