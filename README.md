# Ikeriop Studios — Landingpage

Einseitige Landingpage für die Webdesign-Agentur **Ikeriop Studios**.
Alles steckt in einer einzigen Datei: `index.html` (HTML + CSS + JS).
Doppelklick genügt — die Seite läuft ohne Build-Schritt im Browser.

## Technik

| Baustein   | Einsatz                                                        |
|------------|----------------------------------------------------------------|
| Tailwind   | Layout & Utilities (Play-CDN)                                  |
| Custom CSS | Glassmorphism, Cursor, Preloader, Mockups, Verläufe            |
| GSAP + ScrollTrigger | Text-Reveal, Scroll-Animationen, Parallax, Zähler    |
| Three.js   | Partikelfeld + Drahtgitter im Hero, reagiert auf die Maus      |

Schriften: **Syne** (Headlines) und **Inter** (Fließtext) via Google Fonts.
Farben: Hintergrund `#050505`, Cyber-Violett `#8b5cf6`, Neon-Cyan `#06b6d4`.

## Higgsfield-Videos einfügen

Im Code sind alle Stellen mit `>>> HIGGSFIELD VIDEO HIER EINFÜGEN <<<` markiert.
Dort jeweils die auskommentierte `<source>`-Zeile aktivieren:

```html
<video autoplay loop muted playsinline preload="none">
  <source src="assets/hero-neon-waves.mp4" type="video/mp4">
</video>
```

| Stelle              | Prompt-Empfehlung für Higgsfield                                                        |
|---------------------|------------------------------------------------------------------------------------------|
| Hero-Hintergrund    | *Abstract dark glowing neon waves, cinematic lighting, slow motion, cyber aesthetic, high quality 3D render* |
| Karte „Redesign"    | *High-tech wireframe morphing into a modern website, dark background, violet glow*        |
| Karte „KI"          | *Glowing neural network nodes connecting, abstract AI data flow, cyan and violet light*   |
| Karte „Local SEO"   | *Cinematic 3D city map zooming in, glowing location pin, neon grid, dark futuristic*      |

Solange kein Video hinterlegt ist, läuft an jeder Stelle ein animierter
Verlaufs-Platzhalter — die Seite wirkt also auch ohne Assets fertig.
Sobald ein Video geladen ist, wird es automatisch eingeblendet.

**Empfehlung:** H.264/MP4, 1920×1080, unter 6 MB, ohne Ton.
Die Videos gehören in einen Ordner `assets/` neben die `index.html`.

## Vorher/Nachher-Slider

Beide Websites im Showcase sind als HTML/CSS nachgebaut — sofort vorführbar.
Wer echte Screenshots zeigen möchte, aktiviert in `#compare-before` bzw.
`#compare-after` das vorbereitete `<img>`-Tag; es legt sich automatisch über
das Mockup.

## Vor dem Livegang

- [ ] Impressum, Datenschutz und AGB verlinken (Platzhalter `href="#"` im Footer)
- [ ] Social-Media-Links im Footer auf die echten Profile setzen
- [ ] `og:image` im `<head>` auf ein echtes Vorschaubild setzen
- [ ] Tailwind lokal kompilieren statt Play-CDN (Performance)
