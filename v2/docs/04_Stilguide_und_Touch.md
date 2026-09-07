# 04 · Stilguide und Touch-Spezifikation (v2)

Engine-neutral. Gilt für die Web-Spur (Three.js) und die Unity-Testspur gleichermaßen. Testgerät: iPhone/Safari zuerst. Basis: Review `review/art-director.md`.

---

## 1. Stilguide

**Leitidee: „Ordnung im Chaos."** Der Platz ist grau und ruhig, das Material leuchtet. Alles, was Geld ist, hat Farbe; alles, was Arbeit ist, hat keine. Spielzeughaft-solide — nicht Comic, nicht Foto. Referenzen: Teardown (Lesbarkeit), Kenney-Kits (Formen), Mini Motorways (Ruhe), Sennebogen-Prospekt (Bagger-Stolz).

### 1.1 Palette

ΔE-Regel (CIE-Lab, ΔE76): Fraktion↔Fraktion ≥ 25 · Fraktion↔Welt ≥ 20 · Welt↔Welt egal (darf verschwimmen). Nur der Bagger ist grün, nur UI-Akzente sind gelb. Jede Änderung wird gegen diese Regel nachgerechnet.

| Gruppe | Name | Hex | Verwendung |
|---|---|---|---|
| Welt | Sandboden | `#b8ad9a` | Grundfläche |
| Welt | Beton | `#9c9a92` | Mulden, Wände, Waage |
| Welt | Asphalt/Fahrspur | `#5f5d58` | Wege, Spuren |
| Welt | Gebäude/Zaun | `#6f7378` | Büro, Zaun, Masten |
| Welt | Himmel oben → Horizont | `#cfd9e0` → `#f0e6cf` | Verlauf statt Nebelgrau |
| Bagger | Maschinengrün | `#4fbf3f` | Ober-/Unterwagen, Ausleger |
| Bagger | Maschinenschwarz | `#1e2124` | Hydraulik, Reifen, Kabine |
| Bagger | Warngelb | `#f2b632` | Greifer, Stützen, Schriftzug |
| Fraktion | Stahl | `#4a5563` | kalt blaugrau; Rost nur als Decal |
| Fraktion | Edelstahl VA | `#f2f6f8` | metalness 0,9, spiegelnd |
| Fraktion | Aluminium | `#a9b6c2` | matt, roughness 0,6 |
| Fraktion | Kupfer | `#d9742e` | satt orange |
| Fraktion | Messing | `#c9a227` | Zweitfarbe der Kupfer-Fraktion |
| Fraktion | Kabel | `#1d1f22` / `#2f5f9e` / `#b2332b` | Mantel schwarz/blau/rot, Kupferkern an den Enden |
| Fraktion | Holz | `#8b5a2b` | mit Maserungsstreifen |
| Fraktion | Beton/Baumisch | `#b9b6ad` | rau, kantig |
| Fraktion | Reifen | `#1a1a1a` | Torus, matt |
| UI | Fläche | `rgba(20,22,24,.85)` | Panels, Chips |
| UI | Text | `#eef0ec` | |
| UI | Akzent | `#f2b632` | Buttons aktiv, Auswahl |
| UI | Erfolg | `#3fc463` | Ampel grün, +Geld |
| UI | Warnung | `#e0483a` | Ampel rot, Störfall |

### 1.2 Formsprache
- Alles hat eine sichtbare Fase ab 3 m Distanz; bei Primitiven per Flat-Shading + zweitem Farbton auf Deckflächen gefaked.
- Pro Objekt max. 2 Farben: Grundfarbe + 15 % dunkler an Unterseite/Kanten.
- Texturen nur: Rost-Decals, Container-Nummern, Bagger-Schriftzug (ein 2k-Atlas). Sonst Vertex-Farben.
- Menschen: bewusst Figuren (Kapsel + Kugel, ohne Gesicht) — Stil, nicht Mangel.
- Jede Fraktion hat eine Signatur-Silhouette (Kap. 3).

### 1.3 Kamera (Werte)
| Parameter | Wert |
|---|---|
| Standard | Schulter-Orbit hinter der **Kabine**, dreht mit dem Oberwagen |
| Ziel | Greiferposition, weich nachgeführt (Zeitkonstante 0,3 s) |
| Abstand | 3–18 m, Start 11 m; Pinch zoomt |
| Pitch | 5°–75°, Start 24° |
| FOV | 50° Handy, 55° Desktop; Kabine 80° |
| Modi | Orbit · Draufsicht (25 m, 60°) · Kabine — die Seitenansicht entfällt |
| Wechsel | < 0,3 s weicher Blend |
| Verdeckung | Greifer nie > 1 s verdeckt (Kamera weicht nach oben aus) |
| Bodenring | immer sichtbar unter der Spinne, Ø = Greiferöffnung, Farbe = Ampel |

### 1.4 Licht
- Fester Spätvormittag als Standard; Tageslauf nur als Stimmung, nie Nacht ohne Flutlicht.
- Tone-Mapping ACES Filmic, Exposure 1,1. Umgebungsreflexion (Room-Environment) — ohne sie sind VA/Alu/Kupfer nicht unterscheidbar.
- Sonne warm `#fff4e0`, Hemisphäre `#dde6ec`/`#6b6257`. Schatten weich, 2048 px, auf dem Handy auf 40 m Umkreis begrenzt.
- Kontaktschatten (dunkler Fleck) unter jedem Teil — billig, entscheidend für die Tiefenwahrnehmung.

### 1.5 UI-Stil und Schriften
- Schrift: **Barlow Condensed** (Ziffern, Titel), **Inter** (Text). Beide Google Fonts, in die App gebündelt (kein Netzabruf). Mindestgrößen Handy: Text 14 px, Nebentext 12 px, Kontostand 22 px.
- HUD wie ein Maschinendisplay: wenige Chips mit Icon, keine Fließtexte. Kein Monospace.
- Toasts stapeln (max. 3), Geldzuwachs als grüner „+123 €"-Aufsteiger am Konto.
- Dialoge als Bottom-Sheet (halbe Höhe, von unten), Spiel dahinter pausiert, immer ein Schließen-Knopf.
- Farbe nie einziger Kanal: Icon + Text + Farbe (Farbenblind-Regel).

---

## 2. Touch-Layout v2 (412 × 915 CSS-px, quer)

Safe-Area: links/rechts je `env(safe-area-inset-*)` (iPhone: 47–59 px), unten 21 px (Home-Indikator). Alle Positionen relativ zur Safe-Area. Alle Tippziele ≥ 44 px, Sticks/Greifknopf deutlich größer.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [II]  KONTO 5 120 €  ▲+85          10:42 · Annahme               [Kamera] [≡]   │  oben 8 px
│                                                                                  │
│                                                                                  │
│                              (Spielfläche: Wischen = Kamera drehen,              │
│                               Pinch = Zoom, Doppeltipp = Ansicht)                │
│                                                                                  │
│   (FAHREN)                                             (↺) (↻)                   │
│   Ø56                     [▼ Kupferrohr · 12 kg · €€€]  Ø48 Ø48                  │
│  ╭──────╮                                                       ╭────────╮       │
│  │  L   │                                          ╭────╮       │   R    │       │
│  │ Ø120 │                                          │GREI│       │  Ø120  │       │
│  ╰──────╯                                          │FEN │       ╰────────╯       │
│                                                    ╰Ø76─╯                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

| Element | Position (Safe-Area) | Größe | Funktion | Modus |
|---|---|---|---|---|
| Stick L | links 16, unten 16 | Ø 120, Knob Ø 52 | X: Oberwagen drehen · Y: Hauptarm | stufenlos, „floating": erscheint dort, wo der Daumen aufsetzt (Zone linke 40 %) |
| Stick R | rechts 16, unten 16 | Ø 120 | X: — (frei) · Y: Stiel heran/weg | stufenlos, floating (Zone rechte 40 %) |
| GREIFEN | links neben Stick R, unten 24 | Ø 76 | Spinne schließen | Halten (Standard) oder Toggle (Einstellung) |
| ↺ ↻ | über GREIFEN, 8 px Abstand | je Ø 48 | Rotator links/rechts | Halten |
| FAHREN | über Stick L | Ø 56 | Fahr-Modus an/aus | Toggle, leuchtet gelb |
| Pause `II` | oben links 8 | 48 × 48 | Pause-Menü, Spiel friert | Tipp |
| Kamera | oben rechts, links vom Menü | 48 × 48 | Ansicht Orbit → Draufsicht → Kabine | Tipp |
| Menü `≡` | oben rechts 8 | 48 × 48 | Bottom-Sheet: Abholen, Schere, Stützen, Kabine hoch, Schild, Vorfahren, Ausbau, Schilder, Musik, Einstellungen | Tipp; Sheet pausiert nicht, dimmt Sticks |
| Griff-Info | unten mittig über GREIFEN | Chip, 44 hoch | Icon + Fraktion + kg + €-Stufe | Anzeige |
| Konto | oben links neben Pause | 22 px Ziffern | Konto + Aufsteiger | Anzeige |

**Fahr-Modus (Toggle):** Aktiv → Stick L wird Gas/Bremse (Y) + Lenkung (X); Stick R bleibt Stiel; Knopf leuchtet, HUD zeigt „FAHREN"; Rückwärts-Piepser. Wird automatisch verlassen, wenn 4 s kein Fahrbefehl und der Spieler einen Arm-Befehl gibt. Bei ausgefahrenen Stützen ist der Knopf gesperrt (grau) mit Hinweis.

**Kamera-Gesten:** Ein Finger auf freier Fläche wischt = Orbit drehen/neigen (Empfindlichkeit einstellbar, Invertierung einstellbar). Zwei Finger = Pinch-Zoom. Doppeltipp = Ansichtswechsel. Wischen beginnt nur außerhalb der Stick-Zonen und Knöpfe; ein Stick, der bereits aktiv ist, bleibt aktiv (Pointer-Capture).

**Pause:** Eigener Knopf, immer sichtbar; zusätzlich pausiert die App bei `visibilitychange` (Anruf, App-Wechsel). Pause-Menü: Weiter · Steuerung · Speichern · Neues Spiel.

**Einstellungen (Steuerung):** Achsenbelegung + Invertierung (wie bisher), Greifen Halten/Toggle, Stick-Größe S/M/L, Links-/Rechtshänder-Spiegelung, Kamera-Empfindlichkeit, Vibration an/aus.

### 2.1 Einsteiger-Assistenz

| Assistent | Spezifikation | Fertig, wenn |
|---|---|---|
| **Bodenring** | Ring unter der Spinne, Ø = aktuelle Greiferöffnung, projiziert auf das oberste Objekt/den Boden; Farbe: neutral weiß, über greifbarem Teil in Fraktionsfarbe, über Mulde in Ampelfarbe | Tester nennt aus der Orbit-Sicht ohne HUD, ob die Spinne über dem Zielteil steht (8/10 richtig) |
| **Snap (Greif-Magnet)** | Liegt ein greifbares Teil ≤ 0,5 m seitlich vom Sensor und wird GREIFEN gedrückt, schwenkt der Oberwagen/Stiel in 0,25 s auf das Teil, bevor die Spinne schließt; abschaltbar; kein Snap bei Verbundteilen (Abreißen) | Erstspieler greift 5 einzelne Teile ≤ 60 s nach Tutorial-Start |
| **IK-Zielmodus** („Einsteiger") | Stick R bewegt einen Zielpunkt am Boden (X/Y), Stick L Y = Höhe; Hauptarm + Stiel + Oberwagen folgen per inverser Kinematik mit den bisherigen Geschwindigkeitsgrenzen; Profi-Achsmodus bleibt wählbar; Tutorial startet im Einsteigermodus | 3 von 4 Erst-Testern sortieren im Einsteigermodus ohne verbale Hilfe 10 Teile richtig; Umschalten auf Profi ohne Neustart |
| **Auto-Öffnen** | Option: über grüner Ampel öffnet die Spinne bei losgelassenem GREIFEN automatisch erst, wenn sie ≤ 1,5 m über dem Füllstand ist | keine Fehlwürfe über Muldenrand in 20 Abwürfen |
| **Kamera-Nachführung** | siehe 1.3; Verdeckungs-Ausweichen | Greifer in Orbit/Draufsicht nie > 1 s verdeckt (Log-Messung) |

---

## 3. Fraktions-Lesbarkeit

| Fraktion | Farbe | Signatur-Silhouette | Piktogramm (24 px, einfarbig) |
|---|---|---|---|
| Stahl | `#4a5563` | eckig, dick, lang: Träger, Rohr, Blech, Heizkörper, Motorblock | Doppel-T-Träger im Querschnitt |
| Edelstahl VA | `#f2f6f8` spiegelnd | Gefäß: Spülbecken, Tank, Geländer | Spülbecken mit Abfluss |
| Aluminium | `#a9b6c2` matt | flach, dünn, rund: Felge, Tafel, Profil, Fensterrahmen | Felge (5 Speichen) |
| Kupfer/Messing | `#d9742e` / `#c9a227` | Rohr, Boiler, Rohrbund (Spirale, nie Torus), Armaturen | gebogenes Rohr mit Fitting |
| Kabel | schwarz/blau/rot, Kupferende | Coil (unregelmäßig gelegt), Kabeltrommel | Kabelrolle mit Stecker |
| Holz | `#8b5a2b` gestreift | Latte, Palette, Kiste | drei Bretter |
| Beton/Baumisch | `#b9b6ad` kantig | Block, Bruchstück, Ziegel | Ziegel mit Riss |
| Reifen | `#1a1a1a` | Torus mit Profil | Reifen im Querschnitt |

Regeln: Kein Torus außer Reifen (Kupferbund wird Spirale, Kabel bleibt Coil). Keine Box in Holzfarbe ohne Streifen. Stahl nie braun. Abnahme: Screenshot aus 15 m, 10 Zufallsteile, Tester ordnet ≥ 8 richtig zu — auf dem iPhone, ohne HUD.

---

## 4. Asset-Plan und Budget

| Bedarf | Quelle | Kosten | Aufwand |
|---|---|---|---|
| Fahrzeuge, Container, Props, Zaun, Paletten | Kenney CC0 (City Kit Industrial, Car Kit, Construction Kit) | 0 € | 2–3 Tage (glTF, Skalierung, Kollider) |
| Umschlagbagger mit Greifer, riggbar (Ausleger, Stiel, Rotator, 5 Zinken, Kabinenhub) | Sketchfab/CGTrader Low-Poly **oder** Auftrag (≈ 15k Tris) | 60 € Kauf / 400–1 200 € Auftrag | Kauf 1–2 Tage Rig; Auftrag 2–4 Wochen |
| Hero-Schrottteile (5–8: Waschmaschine, Fahrrad, Heizkörper, Motorblock, Kabeltrommel) | Packs/Sketchfab, Rest prozedural | 0–100 € | 2 Tage |
| UI-Icons (8 Fraktionen, 12 Funktionen, Ampel) | Lucide/Tabler CC0 + 8 eigene Piktogramme | 0 € / 150–300 € Illustrator | 1–2 Tage |
| Schriften | Barlow Condensed, Inter (Google Fonts, gebündelt) | 0 € | ½ Tag |
| Store-Grafik: Icon 1024, Screenshots 6–8 (iPhone 6,7"), Feature-Grafik, 30-s-Video | aus dem Spiel nach Stilpass; Icon/Feature-Grafik Illustrator oder KI + Nacharbeit | 150–500 € | 3–5 Tage |
| KI-3D (Meshy/Tripo) | nur für statische Props; nicht für den Bagger; Lizenz für Store prüfen | 20–50 €/Monat | – |

**Summe ohne Auftrags-Bagger: 300–600 € und 3–4 Entwicklerwochen**, davon die Hälfte Stilpass am bestehenden prozeduralen Material (Palette, Licht, Outline, HUD). Gratis + Premium-Unlock ändert am Asset-Bedarf nichts, braucht aber zusätzlich: Unlock-Screen, „Premium"-Badge im Menü, Store-Screenshot mit Unlock-Inhalt.

### 4.1 iPhone/Safari-Besonderheiten (Pflicht vor dem ersten Gerätetest)

| Thema | Problem | Maßnahme |
|---|---|---|
| Safe-Area | Notch/Dynamic Island quer links oder rechts (47–59 px), Home-Indikator unten 21 px | `viewport-fit=cover` + `padding: env(safe-area-inset-*)` an HUD und Touch-Layer; nichts Tippbares in den Rand |
| 100vh | Safari rechnet Adressleiste in `100vh` ein → Layout springt | `100dvh` bzw. `window.innerHeight` + `resize`/`visualViewport`-Listener; Canvas per JS dimensionieren |
| Audio-Unlock | Web Audio startet stumm bis zur ersten Nutzergeste; nach Sperren des Geräts wieder `suspended` | `AudioContext.resume()` im ersten `touchend`; bei `visibilitychange` erneut; Start-Screen mit „Tippen zum Start" |
| Home-Screen-PWA | Standalone-Modus ohne Browserleisten, aber: eigener Speicher (localStorage getrennt vom Safari-Tab), kein `beforeinstallprompt`, iOS löscht Speicher inaktiver Web-Apps nach ~7 Tagen | Spielstand zusätzlich exportierbar; für den Store ohnehin Capacitor-Wrapper → dort nativer Speicher |
| Vibration | `navigator.vibrate` existiert nicht auf iOS | Haptik im Web nur akustisch (Klick); im Capacitor-Wrapper `@capacitor/haptics` |
| Gesten | Doppeltipp-Zoom, Pinch-Zoom, Wisch-zurück am linken Rand, Textauswahl-Lupe | `touch-action: none`, `gesturestart` abfangen (vorhanden); Sticks nicht in die ersten 20 px am Rand legen (Zurück-Geste) |
| Orientierung | `screen.orientation.lock()` in Safari nicht verfügbar | Hochformat-Sperrbildschirm („Bitte Gerät drehen") im Web; Lock nur im Capacitor-Wrapper (Info.plist) |
| Leistung | 120-Hz-Displays, aber Safari drosselt WebGL im Hintergrund-Tab; PixelRatio 3 | `devicePixelRatio` auf max. 2 deckeln; `requestAnimationFrame` bei `hidden` pausieren |
| Pointer-Events | `pointercancel` bei Systemgesten; Multi-Touch-`pressure` immer 0 | Druck-Greifen entfällt; Sticks bei `pointercancel` sauber auf 0 |
