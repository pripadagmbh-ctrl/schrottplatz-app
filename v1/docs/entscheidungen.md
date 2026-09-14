# Entscheidungslog v1

Jede Architektur- oder Design-Entscheidung mit Datum und Begründung, damit nichts zweimal diskutiert wird. Neueste oben. Sechs Felder je Eintrag: Nummer, Entscheidung, Begründung, verworfene Alternative, Abnahmekriterium, „Auf dem Gerät zu prüfen".

Das Log des verworfenen v2-Aufbaus liegt unter `v2/docs/entscheidungen.md` (E-001–E-061 dort). Es wird nicht fortgeführt; technische Lehren daraus stehen in `CLAUDE.md`.

## 2026-09-14 — Neustart: v1 als Nachfolger des Prototyps

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-001 | **Arbeitsordner ist `v1/`, eine Kopie von `prototype/` (Stand 13.09.2026, Commit `f3c3c52`, ohne `node_modules/` und `dist/`).** `prototype/` bleibt eingefroren als Referenz, `v2/` bleibt eingefroren als Nachschlagewerk | Patrick 14.09.: „Ich fand den Prototyp besser gelungen, Spinne war anders, Greifen war mit Saugen etc. v2 würde ich nur noch zum Nachschlagen nutzen, Prototyp liegen lassen und v1 als Nachfolgeversion des Prototyps öffnen und damit weiterarbeiten." | Im Prototyp selbst weiterbauen (dann geht die Referenz verloren); v2 weiterführen; **vom Stand 09.09. kopieren** — so stand es zuerst hier, und so stand auch der Hauptcheckout, der 174 Commits zurücklag. Patrick hat am 14.09. den aktuellen Stand gewählt: Die 132 Prototyp-Commits vom 10.–13.09. (Platzumbau, Ostmulden, Lego-Mulden, Lambert auf Befehl, Rückbau auf die Sichelkralle) sollen mit. |
| E-002 | **Spielgefühl des Prototyps ist Maßstab:** Spinne (Sensorkugel + Fixed Joint), Pendel, Kamera bleiben; Änderungen nur auf ausdrücklichen Wunsch, in kleinen, einzeln auf dem iPad abgenommenen Schritten | Die v2-Spinne (kinematisches Mitführen mit Interpolation in die Korbmitte, später dynamischer Körper an Feder) fühlte sich schlechter an und wurde zweimal zurückgenommen | Griff-Kern „modernisieren" |
| E-003 | **Agenten nach Themenordnern** (`orchestrator`, `bagger`, `welt`, `ui`, `qa`) statt nach Schichten wie in v2 | Der Prototyp ist nach Themen geordnet; eine Schichtenteilung gäbe es nur nach einem Umbau, den niemand will | sim/art/ui aus v2 übernehmen |
| E-004 | **Technische Rapier- und Safari-Lehren aus v2 gelten weiter** (Startpose, Treffer sammeln, Impuls statt setLinvel, gemeinsames Schlafen, Achtkant, touch-action none, Geister-Zeiger-Sicherung) — Liste in `CLAUDE.md` | Sie beschreiben Eigenschaften von Rapier und Safari, nicht der v2-Architektur; jede davon hat im v2-Test einen konkreten Fehler behoben | Bei null anfangen |

| E-005 | **v1 wird auf GitHub Pages unter `/v1/` veröffentlicht** (`pripadagmbh-ctrl.github.io/schrottplatz-app/v1/`); die Root-URL zeigt weiter den Prototyp, `/v2/` bleibt bestehen. Vite-`base` in `v1/vite.config.ts` auf `/schrottplatz-app/v1/`, Root-Workflow baut drei Ziele | Patrick 14.09.: „v1 einen eigenen Pfad." Der Prototyp bleibt so als spielbare Referenz auf dem iPad, und ein v1-Stand kann nie versehentlich die bewährte Version überschreiben | v1 ersetzt die Root-URL |

Abnahmekriterium: `v1/` läuft mit `npm run dev`, `npm test` ist grün (9 Tests des Prototyps), die fünf Agenten werden von Claude Code aufgelistet, nach Push auf `main` ist `/v1/` erreichbar und die Root-URL unverändert.

Auf dem Gerät zu prüfen: `/v1/` auf dem iPad öffnen — spielt es sich exakt wie der Prototyp auf der Root-URL?
