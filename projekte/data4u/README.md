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
components/ui/  Button, Figure, SectionHeader, Logo, ScanFrame, Reveal
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

Die Seite ist als **technisches Dokument** gebaut, nicht als Werbefläche.
Tiefe entsteht über Linien und Flächenwechsel, nicht über Weichzeichner;
Farbe trägt keine Stimmung, sondern eine Bedeutung.

Vier wiederkehrende Bausteine:

1. **Haarlinien-Raster** (`.grid-rules`) — zwei 1px-Linien auf Höhe der
   Container-Kanten, die durch jede Sektion laufen.
2. **Gerahmte Abbildung** (`Figure`) — Rahmen, optionale nummerierte Legende,
   Bildunterschrift in Mono. Trägt Hero, Aplicativo und die Fit-Module. Die
   Bildunterschrift ist Pflicht: sie benennt, was zu sehen ist, und markiert
   Mockups sichtbar als Darstellung.
3. **Spec-Listen** — Module und Merkmale stehen als Tabellenzeilen mit
   Haarlinien, nicht als Häkchenlisten.
4. **Millimeterpapier** — die Gerätezeichnungen stehen auf einem Raster aus
   10px-Feinlinien und 50px-Hauptlinien, so wie technische Zeichnungen
   entstehen.

Bewusst **nicht** verwendet, weil es jede Vorlage benutzt: Leuchtkegel hinter
Überschriften, Punktraster als Hintergrund, schwebende Statusplaketten um
Geräte, farbige Schlagschatten unter Schaltflächen, Karten, die sich beim
Überfahren anheben, große weiche Radien.

| Rolle | Wert | Prüfung |
|---|---|---|
| Primär | `#1550c8` | 6,97:1 in beide Richtungen |
| Primär dunkel | `#12439f` | 9,02:1 auf Weiß |
| Grund dunkel | `#0a0f1a` | flach, ohne Verlauf |
| Fläche | `#ffffff` / `#f5f7fa` | |
| Linie | `#e2e6ed` | das eigentliche Gestaltungsmittel |
| Signal (nur Biometrie-Abbildungen) | `#1aa5b8` | |
| Erfolg | `#0a7a4e` | 5,38:1 auf Weiß |

Das Blau ist bewusst tiefer und weniger gesättigt als das helle Standardblau,
das gerade jede Oberfläche trägt — und hält als Fläche unter weißem Text
dieselbe Kontrastschwelle wie als Text auf Weiß.

Radien laufen von 2 bis 10px. Große weiche Ecken lassen technische Inhalte
wie Werbung aussehen; knappe lassen sie wie Gerät aussehen.

Schriften: **IBM Plex Sans** für Überschriften und Fließtext, **IBM Plex
Mono** für Beschriftungen, Legenden und Zahlen. Eine Familie, die für ein
Technologieunternehmen gezeichnet wurde. Beide werden über `next/font`
mitgeliefert und selbst ausgeliefert — keine Anfrage an Google beim
Seitenaufruf, kein Textflackern. Das `latin-ext`-Subset ist zwingend: ohne
es fehlen die Diakritika in „gestão", „condomínios" und „segurança".

Helle und dunkle Akte wechseln sich ab. Die Klasse `.act-dark` schaltet alle
Textrollen um — dieselbe Komponente läuft dadurch unverändert in hellen und
dunklen Sektionen.

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
