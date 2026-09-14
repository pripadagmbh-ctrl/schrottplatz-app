# Messprotokoll 14.09.2026 — Zapfen und Zylinderanlenkung der Spinne

**Was gemessen wurde:** die vier Wächter aus `test/greifer.test.ts`, die der Umbau
„Zähne an den Zapfen" gerissen hatte, plus die Zahlen, die in den Kommentaren von
`src/grapple/form.ts` und `src/excavator/grappleParts.ts` behauptet werden.

**Womit:** ein Wegwerf-Test über `baueGreifer()` aus `src/grapple/rig.ts`, 21 Stützstellen
Öffnung 0,00 … 1,00 in Schritten von 0,05 — dieselben Rechenwege wie die Wächter selbst
(`zylinderLaenge`, `zylinderNeigung`, `hebelarm`; Sektorprüfung über alle Mesh-Eckpunkte
mit Radius ≥ 0,30 m). Die Luft zum Gussblock aus einer eigenen Rechnung in der Radialebene
einer Kralle (Traverse als Fünfeck, maßgeblich ist der Inkreis: 0,550 m oben, 0,372 m unten).

**Kein Gerätetest.** Das hier ist eine Rechnung am Modell. Ob es sich auf dem Glas richtig
anfühlt, steht weiter offen — siehe unten.

**Wer, wo, womit.** Gerechnet auf dem Entwicklungsrechner (Windows, Node, Vitest 2.1.9),
headless, ohne Browser. Zweig `v1/start`, Basis-Commit `5985fc5` („v1 als Arbeitsordner
sichern: Zapfen-Umbau, Rueckwaende raus, Agenten, Regeln") plus Arbeitsstand im Baum.
Gemessen vom Orchestrator; die Luft zum Gussblock kommt aus dem parallelen Durchgang des
Fachagenten `bagger`. Die QA hat am 14.09. unabhängig nachgemessen — eigener Wegwerf-Test
über `baueGreifer()` für die Spalte „Stand 14.09.2026" und eine reine Nachrechnung der
Anlenkgeometrie in Node für die beiden Vorher-Spalten. **Alle Zahlen der drei Spalten sind
in beiden Durchgängen zeichengleich herausgekommen**, ebenso die Zusatzwerte. Nicht
nachgemessen hat die QA die Luft zum Gussblock; diese Zahl steht hier auf der Messung des
`bagger`.

**Was hier nicht gemessen wurde:** fps, Frame-Zeiten, Physik-Zeiten, Draw Calls, Heap,
Verhalten auf iPad oder iPhone mini. Das ist eine Geometrie- und Mechanikmessung, keine
Laufzeitmessung.

## Die vier Wächter, vorher und nachher

| Wächter (Zeile in `test/greifer.test.ts`) | gefordert | Stand `v1/start` 5985fc5 | nur Vorzeichenfix im Rig | Stand 14.09.2026 |
|---|---|---|---|---|
| bleibt in jeder Stellung im eigenen Sektor (:184) | Luft > 0 | **−2,5133 rad** — 180,0° von 36° genutzt | 0,0716 rad — 31,9° von 36° | **0,0716 rad** — 31,9° von 36° |
| fährt zum SCHLIESSEN aus, Hub (:211) | > 0,15 m | 0,2586 m | **0,1529 m** | **0,2761 m** |
| steht steil, größte Neigung (:226) | < 20° | 7,109° | **31,432°** | **7,148°** (bei Öffnung 1,00) |
| Hebelarm über den ganzen Weg (:236) | > 0,10 m | 0,1924 m | **0,0033 m** (bei Öffnung 0,90) | **0,1969 m** (bei Öffnung 1,00) |

Fett in den beiden Vorher-Spalten = Forderung verfehlt, Test rot. Fett in der letzten Spalte
= der Stand, der abgenommen wird; alle vier sind dort grün.

Die Zeilennummern gelten für `5985fc5`. Im Arbeitsbaum sind sie durch den neuen Wächter
„zeichnet die Schale dort, wo clawPoint sie rechnet" nach hinten gerutscht (:185, :255, :270,
:280). Der belastbare Anker ist deshalb der Testname, nicht die Zeile:

| Zeile in `5985fc5` | Testname |
|---|---|
| :184 | „bleibt in jeder Stellung im eigenen Sektor" |
| :211 | „fährt zum SCHLIESSEN aus — die Kraft liegt beim Zugreifen" |
| :226 | „steht steil, statt quer über dem Kopf zu liegen" |
| :236 | „hat einen Hebelarm, der über den ganzen Weg trägt" |

### Warum es drei Spalten braucht

Bei `5985fc5` sahen drei der vier Wächter gut aus. Das war kein guter Zustand, sondern ein
verdeckter: Derselbe Vorzeichenfehler, der den Sektortest zerriss, fror auch die Lasche in
einem falschen Bezugsrahmen ein. Gedreht wurde um `-(Spreizung − ZU)` statt um `-Spreizung`.
Solange „zu" die Spreizung 0 war, war beides dasselbe; am Zapfen ist „zu" 0,5495, und damit
stand die gezeichnete Kralle 31 Grad weiter zu als die gerechnete und schoss geschlossen
76 cm über die Achse.

Die mittlere Spalte ist deshalb der ehrliche Ausgangspunkt: Erst mit richtigem Vorzeichen
wird sichtbar, was die alte Anlenkung am neuen Schwenkbereich wirklich leistet — einen
Hebelarm von 3 mm bei 90 % Öffnung. Das ist ein Totpunkt: Dort steht die Schale fest,
gleich wie viel Druck anliegt.

### Verhältnis zu den Zahlen im Auftrag

Der Auftrag nennt als Ist-Stand Hub 0,1474 m · 20,079° · 0,0989 m. Diese Werte stammen vom
Zweig `wip/zapfen`, der in `prototype/` eine andere Anlenkung stehen hat (Anlenkkreis 0,84,
Bock −0,38, Lasche z 0,20). Sie sind darum nicht deckungsgleich mit den hier gemessenen,
die aus `v1/` kommen (Anlenkkreis 0,66, Bock −0,52, Lasche {−0,09; 0,26}). Die Diagnose ist
in beiden Fällen dieselbe: Anlenkung auf den alten Bereich abgetastet, nie nachgerechnet.

## Zusatzwerte, Stand 14.09.2026

| Größe | Wert |
|---|---|
| Zylinderlänge geschlossen | 0,7332 m |
| Zylinderlänge offen | 0,4571 m |
| Hebelarm geschlossen | 0,2848 m |
| Hebelarm offen | 0,1969 m |
| Momentverhältnis Schließen zu Öffnen | 1,446 |
| kleinster Überstand über die Rohrlänge | 0,1771 m (Rohr 0,28 m) |
| Spitzenweite offen | 3,3805 m |
| Spitzenweite geschlossen | 0,0015 m |
| Luft Zylinderachse zum Gussblock | 0,1164 m (bei Öffnung 1,00) |
| Luft Rohrmantel zum Gussblock | 0,0504 m (Rohr-Außenradius 0,066 m) |

Die Luft zum Gussblock ist positiv über den ganzen Weg — der Zylinder läuft an der Traverse
vorbei und nicht hindurch. Fünf Zentimeter sind wenig; sie reichen für das Modell, aber wer
an der Traverse oder am Anlenkbock dreht, muss diese Zahl neu rechnen.

## Geltende Konstanten nach diesem Durchgang

| Konstante | Datei | vorher | nachher |
|---|---|---|---|
| `ZYLINDERKREIS` | `grapple/form.ts`, `excavator/grappleParts.ts` | 0,66 | **0,68** |
| `ZYLINDER_OBEN_Y` / `obenLokal.y` | dieselben | −0,52 | **−0,40** |
| `LASCHE` / `untenAmGelenk` | dieselben | {y −0,09; z 0,26} | **{y −0,22; z 0,20}** |
| Drehung des Gelenkpunkts | `grapple/rig.ts`, `excavator/excavator.ts` | `-(Spreizung − ZU)` | **`-Spreizung`** |

Unverändert und nicht Gegenstand dieses Durchgangs: `CLAW_RING_R` 0,40 · `CLAW_SEGMENTS` 8 ·
`CLAW_OPEN_SPLAY` 1,555 · `CLAW_CLOSED_SPLAY` 0,5495.

## Prüfkette

- `npm test` in `v1/`: 26 Dateien, 251 Tests grün (250 vorher, plus ein neuer Wächter
  „zeichnet die Schale dort, wo clawPoint sie rechnet").
- `npm run build`: grün (tsc --noEmit und vite build).
- Kein Wächter wurde aufgeweicht, übersprungen oder in seiner Erwartung geändert.

## Befunde der QA aus diesem Durchgang

Kein Blocker: Die Wächter sind grün, Build und Tests laufen, kein Test wurde aufgeweicht.
Offen bleiben drei Stellen, an denen der Quelltext Zahlen behauptet, die die Messung nicht
bestätigt — Regel 3 („jede Zahl hat eine Herkunft") gilt auch für Kommentare.

| # | Schwere | Ort | Was | Vorschlag | Zuständig |
|---|---|---|---|---|---|
| 1 | Wichtig | `src/excavator/grappleParts.ts:91–97` | Der Kommentarblock über `ZYLINDERKREIS = 0.68` nennt „geschlossen 0,62 m · offen 0,36 m · Hub 0,26 m · Hebelarm 0,26/0,19 · Schließmoment 1,35". Nachgerechnet sind das auf vier Stellen genau die Werte der **alten** Anlenkung im **fehlerhaften** Bezugsrahmen (0,6200 / 0,3614 / 0,2586 / 0,2600 / 0,1924 / 1,351) — nicht die der Konstanten darunter | Kommentar auf die gemessenen Werte ziehen: 0,7332 / 0,4571 / 0,2761 / 0,2848 / 0,1969 / 1,446 | `bagger` |
| 2 | Wichtig | `src/grapple/form.ts:72–77` | Derselbe Fall: „steht bis 14° steil, hat nirgends weniger als 11 cm Hebelarm … Faktor 1,70" beschreibt die Suche vom 13.09. für den Gelenkring, nicht die Anlenkung darunter. Gemessen sind 7,148°, 0,1969 m, 1,446 | Kommentar nachziehen | `bagger` |
| 3 | Hinweis | `src/excavator/clawGeometry.ts:16–25` und `:28` | Der Kopfkommentar rechnet noch die alte Kette vor („offen (Spreizung 1,25) Spitzenweite 3,38 m Tiefe 1,11 m / geschlossen (Spreizung 0)"), und in `:28` steht über dem Zapfen noch die verwaiste Zeile „Radius des Gelenkrings … = ØC/2 aus dem Datenblatt". Unter den Konstanten steht die neue Kette richtig; der Kopf widerspricht ihr | Kopf auf 1,555 / 0,5495 / acht Segmente ziehen, Zeile 28 löschen | `bagger` |
| 4 | Hinweis (Testlücke) | `test/greifer.test.ts:45` | Der Wächter „teilt Zahl, Ring, Segmente und Öffnungsweite mit dem Baggermodell" hält Spielmodell und Exportmodell an der **Form** zusammen, nicht an der **Anlenkung**. `grappleParts.ts` führt Anlenkkreis, Bock-y und Lasche als eigene Zahlen (`:98`, `:288–292`); driften sie von `form.ts` ab, merkt es kein Test. Genau diese Doppelführung hat am 12./13.09. schon einmal zwei Greifer nebeneinander entstehen lassen | Wächter ergänzen, der beide Dateien in diesen drei Werten vergleicht | `bagger`, Freigabe durch Orchestrator |

Die Luft zum Gussblock von 0,0504 m am Rohrmantel ist die knappste Zahl dieses Protokolls.
Sie steht auf der Rechnung des `bagger` und ist von der QA nicht gegengerechnet; wer an
Traverse, Anlenkbock oder Rohrradius dreht, muss sie neu messen.

## Auf dem Gerät zu prüfen

Offen. Diese Messung ist eine Rechnung, kein Gerätetest. Die Handgriffe für iPad und
iPhone mini stehen in der Übergabe zu diesem Paket; ihr Ergebnis gehört als eigenes
Protokoll hierher, sobald Patrick gespielt hat.
