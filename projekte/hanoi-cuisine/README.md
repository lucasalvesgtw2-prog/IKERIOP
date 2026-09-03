# Hà Nội Cuisine — Website

Website für das vietnamesische Restaurant **Hà Nội Cuisine**, Brühl 54, 04109 Leipzig.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # statischer Export nach out/
```

Der Build erzeugt reines HTML/CSS/JS in `out/` — läuft auf jedem Hosting,
kein Node-Server nötig.

## Stack

Next.js 16 (App Router, statischer Export) · React 19 · TypeScript · Tailwind CSS 4 ·
GSAP + ScrollTrigger · Lenis · Three.js über React Three Fiber · lucide-react

## Aufbau

```
app/          Layout (Fonts, SEO, Restaurant-Schema), Seite, Pflichtseiten
components/   Ein Abschnitt je Datei
components/3d Szene, Schale, Dampf
lib/          restaurant.ts (alle Geschäftsdaten), Scroll-Zustand, Lenis
```

`lib/restaurant.ts` ist die **einzige** Quelle für Adresse, Telefon, Öffnungszeiten,
Gerichte und Links. Wer dort etwas ändert, ändert es überall — auch im
strukturierten Datensatz für Google.

## Gestaltung

Die Bildsprache kommt aus der vietnamesischen Lackkunst *sơn mài*: Schichten aus
Harz über Schwarz, mit Zinnober und Blattgold eingelegt und zurückpoliert. Daher
der Wechsel aus dunklen Lack-Akten und hellen Reispapier-Akten sowie die goldenen
Haarlinien.

| Rolle | Wert |
|---|---|
| Grund | `#100c0b` Lack |
| Papier | `#efe7da` Reispapier |
| Akzent | `#b23a2c` Zinnober |
| Gold | `#c8a05a` Blattgold |
| Kraut | `#7c8f5b` |

Schriften: **Prata** für Überschriften, **Be Vietnam Pro** für Fließtext. Beide
haben ein vietnamesisches Subset — ohne das fehlen die Diakritika in „Hà Nội",
„Phở" und „Bún bò". Beide werden mitgeliefert und selbst ausgeliefert: keine
Anfrage an Google beim Seitenaufruf.

## Die 3D-Szene

Eine einzige durchgehende Kamerafahrt über fünf Akte, gesteuert vom Scroll-
Fortschritt der Sektion `#cinema`:

| Fortschritt | Was passiert |
|---|---|
| 0 – 20 % | Schale dreht sich langsam, Dampf steigt |
| 20 – 40 % | Kamera fährt heran |
| 36 – 70 % | Brühe wechselt mit dem gezeigten Gericht |
| 62 – 86 % | Zutaten fliegen auseinander, Schale tritt zurück |
| 86 – 100 % | alles beruhigt sich, Szene blendet aus |

Auf Mobilgeräten und bei `prefers-reduced-motion` läuft die Szene mit weniger
Partikeln, niedrigerer Auflösung und nur einem gerenderten Bild. Die
Gerichte-Strecke ist dort eine ruhige vertikale Abfolge statt einer angehefteten
Horizontalfahrt. Alle Materialien und Texturen entstehen im Browser — kein
externes HDR, keine geladenen Assets.

## Recherchierte Daten

Stand September 2026, aus der offiziellen Website hanoi-leipzig.de sowie
speisekarte.de, Quandoo, kreuzer Leipzig und Tripadvisor:

- Adresse Brühl 54, 04109 Leipzig · Telefon 0341 46257868 · info@hanoi-leipzig.de
- Mo–Do 11–22 Uhr, Fr–Sa 11–22:30 Uhr, So 11–22 Uhr
- Reservierung über Quandoo, Lieferung über Uber Eats, Profil auf Facebook
- Zwei Etagen, Außenplätze, rund 150 m vom Hauptbahnhof, Hot Pot als Spezialität
- Gerichtbeschreibungen wörtlich von der offiziellen Karte

**Nicht übernommen, weil nicht belegbar:** Preise (nirgends offiziell
veröffentlicht) und eine Durchschnittsbewertung — die Portale nennen stark
abweichende Werte. Beides ist im Code vorbereitet, aber leer.

## Was der Betreiber noch liefern muss

- [ ] **Fotos.** In `components/Restaurant.tsx` sind drei Tafeln mit festem
      Seitenverhältnis vorbereitet; ein `<img>` ersetzt die Tafel, ohne dass das
      Layout springt.
- [ ] **Logo.** Aktuell ist die Wortmarke rein typografisch gesetzt (Prata).
      Liegt eine Logodatei vor, ersetzt sie den Schriftzug in `Navbar.tsx`,
      `Hero.tsx` und `Footer.tsx`.
- [ ] **Bewertung.** Sobald der aktuelle Wert aus dem Google-Unternehmensprofil
      feststeht, in `lib/restaurant.ts` unter `rating` eintragen — die Sektion
      zeigt die Statistik dann von selbst.
- [ ] **Impressum.** Vertretungsberechtigte Person, Registereintrag und
      USt-IdNr. in `app/impressum/page.tsx` ergänzen.
- [ ] **Datenschutz.** Hosting-Anbieter und Speicherdauer der Server-Logs in
      `app/datenschutz/page.tsx` eintragen.
