/**
 * Einzige Quelle für alle Geschäftsdaten.
 *
 * Alle Angaben sind öffentlich recherchiert (Stand: September 2026) und
 * stammen aus der offiziellen Website hanoi-leipzig.de sowie den
 * Branchenverzeichnissen speisekarte.de, Quandoo und kreuzer-leipzig.de.
 * Nichts hier ist erfunden — Felder ohne belastbare Quelle fehlen bewusst.
 */

export const restaurant = {
  name: 'Hà Nội Cuisine',
  nameLatin: 'Ha Noi Cuisine',
  legalName: 'Hà Nội Cuisine — Vietnamesisches Restaurant',
  street: 'Brühl 54',
  postalCode: '04109',
  city: 'Leipzig',
  region: 'Sachsen',
  country: 'DE',

  phone: '+4934146257868',
  phoneDisplay: '0341 46257868',
  email: 'info@hanoi-leipzig.de',
  website: 'https://hanoi-leipzig.de',

  maps:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Restaurant Hà Nội, Brühl 54, 04109 Leipzig'),

  /** Offizielle Buchungsstrecke (Quandoo) — kein erfundener Link. */
  reservation:
    'https://www.quandoo.de/place/hanoi-cuisine-vietnamesisches-restaurant-66623',
  facebook: 'https://www.facebook.com/HanoiCuisineLpz/',
  delivery:
    'https://www.ubereats.com/de/store/ha-noi-cuisine-vietnamesisches-restaurant/NwGUjTmjU6yFITdVjydr1A',

  /** Öffnungszeiten laut Website und kreuzer Leipzig. */
  hours: [
    { label: 'Montag – Donnerstag', open: '11:00', close: '22:00', days: ['Mo', 'Tu', 'We', 'Th'] },
    { label: 'Freitag – Samstag', open: '11:00', close: '22:30', days: ['Fr', 'Sa'] },
    { label: 'Sonntag', open: '11:00', close: '22:00', days: ['Su'] },
  ],
} as const;

/** Kurzform für Fließtext und strukturierte Daten. */
export const addressLine = `${restaurant.street}, ${restaurant.postalCode} ${restaurant.city}`;

/**
 * Gerichte mit den Beschreibungen der offiziellen Karte.
 * Preise sind bewusst nicht hinterlegt — für keine der Positionen ließ sich
 * ein offiziell veröffentlichter Preis belegen.
 */
export type Dish = {
  id: string;
  index: string;
  vietnamese: string;
  german: string;
  description: string;
  /** Brühen-/Grundton für die 3D-Szene */
  tone: string;
  accent: string;
};

export const dishes: Dish[] = [
  {
    id: 'goi-cuon',
    index: 'Một',
    vietnamese: 'Gỏi cuốn',
    german: 'Sommerrollen',
    description:
      'Handgerollt, mit Hähnchen und Garnelen, Gurke, Paprika, Mango, Salat und Reisnudeln — dazu ein Hoisin-Erdnuss-Dip.',
    tone: '#2A3320',
    accent: '#7C8F5B',
  },
  {
    id: 'pho',
    index: 'Hai',
    vietnamese: 'Phở',
    german: 'Die Suppe aus Hanoi',
    description:
      'Angebratenes und gekochtes Rinderfilet mit Reisnudeln in einer Rinderbrühe aus fünf Kräutern — der Klassiker der Hauptstadt.',
    tone: '#3A2312',
    accent: '#C8A05A',
  },
  {
    id: 'bun-bo',
    index: 'Ba',
    vietnamese: 'Bún bò',
    german: 'Rind auf warmen Reisnudeln',
    description:
      'Rindfleisch mit Mungbohnensprossen, Zitronengras und Knoblauch auf warmen Reisnudeln, dazu Salat, Gurke, Kräuter, Erdnüsse, Röstzwiebeln und eine Knoblauch-Chili-Fisch-Vinaigrette.',
    tone: '#331A16',
    accent: '#B23A2C',
  },
];

/** Frische Zutaten für die Ingredients-Sektion. */
export const ingredients = [
  { vi: 'Rau mùi', de: 'Koriander' },
  { vi: 'Sả', de: 'Zitronengras' },
  { vi: 'Ớt', de: 'Chili' },
  { vi: 'Chanh', de: 'Limette' },
  { vi: 'Húng quế', de: 'Thai-Basilikum' },
  { vi: 'Gừng', de: 'Ingwer' },
  { vi: 'Hồi', de: 'Sternanis' },
  { vi: 'Đậu phộng', de: 'Erdnuss' },
];

/**
 * Gäste-Bewertungen.
 *
 * Bewusst leer: Die öffentlich auffindbaren Durchschnittswerte widersprechen
 * sich je nach Portal deutlich (Google, TripAdvisor, Restaurant Guru und
 * HolidayCheck nennen unterschiedliche Werte). Eine Zahl, die man nicht
 * belegen kann, gehört nicht auf die Seite. Sobald der aktuelle Wert aus dem
 * Google-Unternehmensprofil feststeht, hier eintragen — die Sektion zeigt die
 * Statistik dann automatisch an.
 */
export const rating: { score: number; count: number; source: string } | null = null;

/** Öffentliche Profile, auf denen Gäste die Bewertungen selbst nachlesen. */
export const reviewSources = [
  { name: 'Google', href: restaurant.maps },
  {
    name: 'Tripadvisor',
    href: 'https://www.tripadvisor.com/Restaurant_Review-g187400-d10351208-Reviews-Ha_Noi_Cuisine-Leipzig_Saxony.html',
  },
  { name: 'Quandoo', href: restaurant.reservation },
];
