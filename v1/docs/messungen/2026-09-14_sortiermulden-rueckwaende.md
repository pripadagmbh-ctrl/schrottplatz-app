# Messprotokoll 14.09.2026 — Sortiermulden ohne Rückwand

Kurzprotokoll zu E-006. Gehört nicht zur Greifer-Messung desselben Tages und steht deshalb
für sich.

**Was gemessen wurde:** Steht hinter den vier Sortiermulden noch eine Wand — sichtbar oder
unsichtbar? Der teure Fehler dieser Art ist bekannt: Ein Eintrag in `STATIC_OBSTACLES`
bleibt stehen, die Steine sind längst weg, und die Maschine fährt gegen nichts
(`test/collision.test.ts:369`, Presse am 13.09.2026).

**Womit:** Wegwerf-Test in `v1/`, Vitest 2.1.9, headless. Gefragt wurde `hitsObstacle` aus
`src/world/obstacles.ts` an sechs Punkten je Mulde, die Muldenlage aus `CONFIGS` in
`src/world/containers.ts` (nicht abgeschrieben). Zweig `v1/start`, Basis `5985fc5`.
Kein Gerätetest.

**Ergebnis** (Mulden 4,5 m in x, 4,6 m in z; Rückwand läge bei x + 2,25):

| Mulde | Innenraum | Rückwandlinie (x + 2,25) | 0,5 m dahinter | Nordflanke | Südflanke | offene Seite |
|---|---|---|---|---|---|---|
| `r_alu` ALU | frei | **frei** | **frei** | ALU Nord | ALU Süd | frei |
| `r_va` EDELSTAHL VA | frei | **frei** | **frei** | ALU Süd | EDELSTAHL VA Süd | frei |
| `r_cable` KABEL | frei | **frei** | **frei** | EDELSTAHL VA Süd | KABEL Süd | frei |
| `r_copper` KUPFER | frei | **frei** | **frei** | KABEL Süd | KUPFER Süd | frei |

Gelesen heißt das: Keine der vier Mulden hat hinten noch einen Eintrag; die Flanken stehen
alle. Bei drei von vier ist die Nordflanke zugleich die Südflanke der Nachbarmulde
(`shareSouth`) — die Reihe teilt sich ihre Trennwände, es steht also nicht doppelt Beton
zwischen zwei Fraktionen.

Ausdrücklich **nicht** betroffen: die Silos an der Ostwand (`c_wood`, `c_rubble`,
`c_plastic`, `c_va_lager`). Sie behalten ihre Stirnwand, und sie behalten sie zwei Lagen
höher als die Flanken — gewacht von `test/collision.test.ts` „lässt die Silos zum Platz hin
offen" und „die Ruecknwand ist hoeher als die Flanken". Zwischen E-006 und diesen beiden
Wächtern besteht kein Widerspruch.

## Befund

| # | Schwere | Ort | Was | Vorschlag | Zuständig |
|---|---|---|---|---|---|
| 1 | Wichtig (Testlücke) | `test/collision.test.ts` | Dass die vier Sortiermulden **keine** Rückwand haben, ist nirgends festgehalten. Die Wächter prüfen das Gegenteil für die Silos (`:178` Öffnung frei, Rückwand sperrt) und fangen Geisterwände nur an der Presse ab (`:369`). Setzt jemand `shareEast` zurück oder baut die Reihe um, fällt kein Test | Wächter „die vier Sortiermulden haben nur Seitenwände" ergänzen: Rückwandlinie und der Streifen dahinter frei, beide Flanken sperren, Muldenlage aus `CONFIGS` | `welt` (Code-nah), Test durch `qa`, Freigabe Orchestrator |

Solange dieser Wächter fehlt, ist E-006 durch diese Messung belegt, nicht durch einen Test.

## Auf dem Gerät zu prüfen

Steht bei E-006 im Entscheidungslog.
