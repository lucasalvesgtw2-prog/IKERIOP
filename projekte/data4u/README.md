# Data4U Technology — Website

Neubau der Website von **Data4U Technology** (Brasília/DF) — Software und
Equipment für Zutrittskontrolle und Management.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # statischer Export nach out/
npm run typecheck
```

Der Build erzeugt reines HTML/CSS/JS in `out/` — läuft auf jedem Hosting,
kein Node-Server nötig.

## Stack

Next.js 16 (App Router, statischer Export) · React 19 · TypeScript ·
Tailwind CSS 4 · lucide-react

Bewusst **ohne** Animationsbibliothek, ohne 3D und ohne Bilddateien: alle
Visuals sind SVG bzw. CSS, alle Bewegungen laufen über CSS-Transitions und
einen einzigen IntersectionObserver. Das gesamte JavaScript der Seite besteht
aus Navigation, Scroll-Reveal, Kontakt-Dock und Formular.

## Aufbau

```
app/            Layout (Fonts, SEO, Organization-Schema), Seiten, sitemap, robots
components/     Ein Abschnitt bzw. ein Baustein je Datei
components/ui/  Button, Badge, SectionHeader, Logo, ScanFrame, Reveal
components/mockups/  Alle Produkt- und Gerätedarstellungen
lib/data4u.ts   Geschäftsdaten — die einzige Quelle
lib/pages.ts    Inhalte der Produkt- und Equipmentseiten
lib/motion.ts   Reveal-Staffelung
```

`lib/data4u.ts` ist die **einzige** Quelle für Firmendaten, Kontakt,
Navigation, Produkte und Equipment. Wer dort etwas ändert, ändert es überall
— auch im strukturierten Datensatz für Google, in der Sitemap und im Footer.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Home |
| `/data4u-fit` | Gestão und Zutritt für Fitnessbetriebe |
| `/data4u-access` | Zutrittskontrolle für Unternehmen |
| `/data4u-condominium` | Zutritt und Portaria für Wohnanlagen |
| `/data4u-school` | Zutritt für Schulen |
| `/equipamentos` | Übersicht Equipment |
| `/catracas` · `/leitores-digitais` · `/controladoras` · `/relogios-de-ponto` | Einzelne Gerätegruppen |
| `/sobre-nos` · `/suporte` · `/fale-conosco` | Institutionelles |
| `/politica-de-privacidade` | Rechtstext (Entwurf, siehe unten) |

Alle vier Produktseiten und alle vier Equipmentseiten laufen über je eine
gemeinsame Erzählstruktur (`ProductPage`, `HardwarePage`) — dieselbe
Reihenfolge, dieselben Bausteine. Eine neue Produktseite braucht einen
Eintrag in `lib/data4u.ts`, einen in `lib/pages.ts` und eine dreizeilige
`page.tsx`.

## Gestaltung

Leitbild ist **Präzision**: Data4U misst, prüft und lässt durch. Daraus
kommen die drei wiederkehrenden Elemente:

1. **Haarlinien-Raster** (`.grid-rules`) — zwei 1px-Linien auf Höhe der
   Container-Kanten, die durch jede Sektion laufen.
2. **Erkennungsrahmen** (`ScanCorners`) — die vier Ecken einer
   Gesichtserkennung, als Rahmen um Visuals und als Hover-Zustand auf den
   Lösungskarten.
3. **Technische Mikro-Labels** in JetBrains Mono über jeder Sektion.

Helle und dunkle Akte wechseln sich ab. Die Klasse `.act-dark` schaltet alle
Textrollen um — dieselbe Komponente läuft dadurch unverändert in hellen und
dunklen Sektionen.

| Rolle | Wert |
|---|---|
| Primär | `#2f66f5` Markenblau |
| Primär dunkel | `#1a4ae0` |
| Grund dunkel | `#060a14` Marine |
| Fläche | `#ffffff` / `#f6f8fc` |
| Linie | `#e4e9f2` |
| Signal (nur Biometrie-Visuals) | `#21c7dd` |
| Erfolg | `#0f9d63` |

Schriften: **Inter** für die gesamte Oberfläche, **JetBrains Mono** nur für
die Mikro-Labels. Beide werden über `next/font` mitgeliefert und selbst
ausgeliefert — keine Anfrage an Google beim Seitenaufruf, kein Textflackern.

Alle Größen und Abstände kommen aus dem Design-System in `app/globals.css`
(CSS-Variablen für Farben, Radien, Schatten, Bewegung; `clamp()`-Skala für
Typografie und Sektionsabstände).

## Visuals

Es lagen keine freigegebenen Produktfotos oder Screenshots von Data4U vor.
Statt Stockfotos zu verwenden, ist alles gezeichnet:

- **Gesichtsnetz** (`FaceMesh`) — deterministisch erzeugte Punktwolke mit
  Landmarken und Erkennungsrahmen. Kein Foto, keine reale Person.
- **Zugangsterminal** (`AccessTerminal`) — Gerät als Interface nachgebaut.
- **Interface-Mockups** (`ProductMockup`) — echte Modulnamen, abstrakte
  Daten. Jedes Fenster trägt sichtbar den Hinweis „Representação".
  Kennzahlenfelder bleiben bewusst leer.
- **Geräte** (`HardwareArt`) — technische Strichzeichnungen von Catraca,
  Leser, Controladora und Stempeluhr.

Jede Zeichnung sitzt in einer Kachel mit festem Seitenverhältnis. Ein später
geliefertes Foto ersetzt sie, ohne dass das Layout springt.

## Inhaltsregeln

Der Text der Seite ist neu geschrieben, die **Fakten sind es nicht**.
Übernommen wurden nur belegte Angaben von Data4U: Firmenhistorie
(1988 als PolySoft Informática, 1996 Data4U Technology), Produktmodule,
Gerätearten, Portaria 1510, Supportwege, Anschrift, Telefon, E-Mail.

Nicht übernommen, weil nicht belegbar: Kundenzahlen, Installationszahlen,
Verfügbarkeits- oder Wachstumsprozente, Preise, Zertifizierungen. An ihrer
Stelle stehen qualitative Merkmale (`trustMarkers` in `lib/data4u.ts`).

## Was Data4U noch liefern muss

- [ ] **Logo.** Die Wortmarke ist aktuell rein typografisch gesetzt
      (`components/ui/Logo.tsx`). Eine gelieferte SVG-Datei ersetzt dort das
      Bildzeichen — und damit Navigation, Footer und 404 gleichzeitig.
      Zusätzlich `app/icon.svg` austauschen.
- [ ] **WhatsApp-Nummer.** In `lib/data4u.ts` unter `contact.whatsapp` im
      Format `5561999999999` eintragen. Der schwebende Kontakt-Button und
      der WhatsApp-CTA im Abschluss-Block erscheinen dann von selbst.
      Solange die Angabe fehlt, führen beide zu Telefon und E-Mail.
- [ ] **Formular-Endpunkt.** `FORM_ENDPOINT` in
      `components/ContactForm.tsx` auf die Empfangs-URL setzen. Ohne
      Endpunkt stellt das Formular die Nachricht zusammen und öffnet das
      E-Mail-Programm — der Text geht also nie verloren.
- [ ] **Produktfotos und Screenshots.** Ersetzen die Zeichnungen in
      `components/mockups/`, sobald freigegeben.
- [ ] **Datenschutzerklärung.** `app/politica-de-privacidade/page.tsx`
      enthält einen Entwurf mit sichtbarem Hinweis. Hosting-Anbieter,
      Speicherdauer der Server-Logs und Datenschutzbeauftragter müssen vom
      Rechtsbereich ergänzt werden.
- [ ] **`metadataBase`.** Steht auf `https://www.data4u.com.br`
      (`lib/data4u.ts` → `company.website`). Für eine andere Domain dort
      anpassen — Sitemap, robots.txt und Canonical-Links folgen automatisch.

## Barrierefreiheit

- Sprungmarke zum Inhalt, sichtbare Fokusringe (auf dunklen Akten hell).
- Vollständige Tastaturbedienung: Dropdowns mit `aria-expanded`, Schublade
  mit Fokusfalle und `Escape`, FAQ als `<details>`/`<summary>`.
- Trefferflächen ab 44px, im Menü 48px, in der FAQ 56px.
- `@media (prefers-reduced-motion: reduce)` schaltet **alle** Animationen und
  Transitions ab, nicht nur verkürzt.
- Ohne JavaScript bleibt die gesamte Seite sichtbar und lesbar
  (`html.no-js .reveal`).
