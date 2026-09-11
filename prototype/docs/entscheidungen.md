# Entscheidungen (Prototyp)

Fortlaufendes Protokoll ab dem Auftrag vom 11.09.2026. Die Nummern schließen
an die v2-Liste an (dort endet sie bei E-042), damit keine Nummer zweimal
vergeben ist — gearbeitet wird aber ausschließlich im Prototyp: v2 ist nicht
so gelaufen wie vorgestellt (Entscheidung des Auftraggebers, 11.09.2026).

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-043 | Der Auftrag vom 11.09.2026 gilt für den **Prototyp**, nicht für v2; Ablage `prototype/docs/auftrag-2026-09-11.md`, Protokoll hier | Ansage 11.09.2026: "ist nicht für v2, für prototyp". v2 wird nicht angefasst | Umsetzung in `v2/web` wie im Auftragskopf vermerkt |
| E-044 | Lamberts Wegprüfung rechnet den Korridor selbst aus, statt Rapier `castShape` zu rufen | Der Auftrag verlangt eine Prüfung "per Shape Cast in Schaufelbreite"; die Wirkung ist dieselbe, aber die eigene Rechnung ist ohne Physikwelt testbar (Node), deterministisch und kostet einen Bruchteil: Die Teileliste wird ohnehin jede Sekunde durchlaufen | `world.castShape` je Fahrtziel |
| E-045 | Die Uhr läuft im Tutorial mit, hat dort aber keine Wirkung | Antwort 11.09.2026: "Uhr rund um die Uhr, aber nicht im Tutorial relevant". Eine Uhr, die stehenbleibt, müsste überall mitgedacht werden | Uhr pausiert bis zum Ende des Tutorials |
| E-046 | Holz bleibt eine eigene Sortierklasse (eigene Mulde), ebenso Reifen, Baumischabfall und Kunststoff | Antwort 11.09.2026: "eigene Sortierklasse". "Störstoff" als Sammeltopf war niemandem verständlich | Holz unter "Sonstiges" sammeln |
| E-047 | Lamberts Rücksprache und Anweisungen kommen später, nicht vorgezogen | Antwort 11.09.2026: "Lambert später" | Funk und Anweisungen vor Phase 1 |
