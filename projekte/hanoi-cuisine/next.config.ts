import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Statischer Export: das Ergebnis liegt in out/ und läuft auf jedem Hosting
  // ohne Node-Server — inklusive günstigem CDN-Caching.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
