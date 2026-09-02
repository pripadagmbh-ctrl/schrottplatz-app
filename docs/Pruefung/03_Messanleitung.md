# Messanleitung

Wie die Laufzeitwerte zustande kamen — zum Nachmessen und zum Widerlegen.
Alle Angaben vom 02.09.2026, Windows 10, Desktop-Browser, Vite-Entwicklungsserver.

---

## Vorbereitung

```bash
cd prototype && npm run dev
```

Dann `http://localhost:5173` öffnen und **rund 20 Sekunden warten**. Das ist
kein Aberglaube: Rapier lädt sein WASM-Modul asynchron, und `window.__game`
existiert erst danach. Wer zu früh misst, misst den Ladevorgang.

---

## Der Debug-Zugang

```js
Object.keys(window.__game)
// excavator, grip, physics, input, THREE, items, containers, composites,
// fence, vehicles, account, press, bus, saveNow, touch, hitsObstacle,
// daylight, floodlights, staff, lanes, audio, togglePause, isPaused, step
```

Wichtig:

| Zugang | Bedeutung |
| --- | --- |
| `__game.step(n)` | n Spielschritte von Hand takten (Physik **und** Spiellogik) |
| `__game.physics.world` | die Rapier-Welt direkt |
| `__game.items` | die losen Schrottteile |
| `__game.vehicles.spawnNow(art)` | Fahrzeug erzwingen: `pritsche`, `kipper`, `pkw`, `wrack` |

---

## Physikschritt messen

**Wichtig: erst aufwärmen.** Meine erste Messung ergab 8,04 ms im Leerlauf und
5,91 ms unter Last — also Unsinn, weil der erste Durchlauf die
Just-in-time-Übersetzung mitgemessen hat. Ohne Vorlauf misst man den Compiler,
nicht die Physik.

### Reiner Physikschritt (der Wert, der im Bericht steht)

```js
(() => {
  const g = window.__game, p = g.physics, w = p.world;
  const rein = () => {
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) w.step(p.eventQueue ?? undefined);
    return (performance.now() - t0) / 200;
  };
  rein();                                  // aufwaermen, Ergebnis verwerfen
  const l = [rein(), rein(), rein()].sort((a, b) => a - b);
  let wach = 0; w.bodies.forEach(b => { if (!b.isSleeping()) wach++; });
  return { medianMs: +l[1].toFixed(2), koerper: w.bodies.len(), wach };
})()
```

**Ergebnis 02.09.2026:** `{ medianMs: 2.78, koerper: 218, wach: 108 }`

Der Median aus drei Läufen, nicht der Mittelwert — ein einzelner Ausreißer
durch die Speicherbereinigung soll das Ergebnis nicht verziehen.

### Schritt mit Spiellogik

```js
(() => {
  const g = window.__game;
  for (let i = 0; i < 120; i++) g.step(1);          // aufwaermen
  const batch = () => {
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) g.step(1);
    return (performance.now() - t0) / 120;
  };
  const l = [batch(), batch(), batch()].sort((a, b) => a - b);
  return +l[1].toFixed(2);
})()
```

**Ergebnis 02.09.2026:** 4,42 ms. Die Differenz zu 2,78 ms ist die Spiellogik:
Kinematik, Kollisionsprüfungen, Fahrzeugablauf, Fahrspurüberwachung.

---

## Platz füllen, um unter Last zu messen

Die Werte oben stammen von einem Platz im laufenden Betrieb. Um gezielt zu
belasten:

```js
const g = window.__game;
for (let f = 0; f < 6; f++) g.vehicles.spawnNow();
for (let i = 0; i < 200; i++) g.step(1);
```

Danach neu messen. **Achtung:** Die Bündelung greift ab 260 losen Teilen und
fasst Kleinkram zusammen — über diese Grenze hinaus lässt sich die Teilezahl
nicht ohne Weiteres treiben. Das ist gewollt, macht aber Lastmessungen
jenseits von 260 Teilen künstlich.

---

## Fahrzeugmodelle prüfen

```js
(() => {
  const g = window.__game, proben = [];
  for (const art of ['pritsche', 'kipper', 'pkw', 'wrack']) {
    g.vehicles.spawnNow(art);
    const v = g.vehicles.active;
    proben.push({ art, bordwaende: v.sideWalls?.length ?? 0,
                  heckklappe: !!v.tailGate, ladung: v.cargo.items.length });
    v.despawn(); g.vehicles.active = null;
  }
  return proben;
})()
```

**Erwartet:** Pritsche 2 Bordwände + Heckklappe · Kipper 2 Bordwände, keine
Klappe (er kippt) · PKW 0 Bordwände (Anhänger) · Wrack 2 Bordwände + Klappe,
`ladung: 0` (er trägt eine Karosse, keine Einzelteile).

---

## Bündelgröße

```bash
cd prototype && npm run build
```

**Ergebnis 02.09.2026:** `dist/assets/index-*.js` 2 741,05 kB, gzip 948,76 kB;
`dist/index.html` 22,38 kB, gzip 5,90 kB.

Vite warnt, dass der Brocken über 500 kB liegt. Das ist bekannt und für ein
Spiel mit Three.js und einer Physik-Engine im Bündel normal — aufgeteilt wird
bewusst nicht, weil beim Start ohnehin alles gebraucht wird.

---

## Fallstricke, in die ich getappt bin

**Rapier-Abfragen nie vorzeitig abbrechen.** Die Welt bleibt während einer
`intersectionsWithShape`-Abfrage geborgt. Ein `return false` im Callback lässt
den Borrow offen, und der nächste schreibende Zugriff stürzt mit *„recursive
use of an object detected"* ab. Immer `true` zurückgeben und das Ergebnis nur
merken. **Dasselbe passiert, wenn ein Konsolenaufruf mitten in einer Abfrage
in eine Zeitüberschreitung läuft** — dann ist die Welt kaputt und die Seite
muss neu geladen werden. Halte Messschnipsel deshalb kurz.

**Nicht auf Modulebene initialisieren.** `new RAPIER.Ball(0.62)` als
Modulkonstante läuft vor `RAPIER.init()` und schlägt fehl. Erst beim ersten
Gebrauch anlegen.

**Schwerpunkt ist nicht Position.** `body.translation()` liefert den
Schwerpunkt. Bei einem Auto liegt der in der Fahrzeugmitte, nicht dort, wo der
Greifer zupackt. Für „ist das Teil im Greifer" gehört
`collider.projectPoint(punkt, true)` benutzt.

---

## Was ich nicht gemessen habe

Damit klar ist, wo die Lücken sind:

- **Bildrate.** Nur der Physik- und Logikanteil ist erhoben, nicht das
  Zeichnen. Was Three.js pro Bild kostet, ist offen.
- **Speicherverbrauch.** Nie betrachtet.
- **Ladezeit** bis zur Spielbereitschaft. Die 20 Sekunden Wartezeit oben sind
  ein Erfahrungswert aus dem Entwicklungsserver, keine Messung — im gebauten
  Paket dürfte es deutlich schneller gehen.
- **Irgendetwas auf echter Handy-Hardware.** Siehe `02_Schwachstellen.md`.
