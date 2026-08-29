# Schrottplatz-App

Spielprojekt: Fuchsbagger mit Greifspinne auf einem Schrottplatz — Altmetall annehmen,
sortieren, trennen und zerlegen (Auto: Motor rausreißen, flachpressen usw.).

## Ordner

| Ordner       | Inhalt                                              |
|--------------|-----------------------------------------------------|
| `docs/`      | Briefing, Design-Dokumente, Entscheidungen           |
| `assets/`    | Modelle, Texturen, Sounds, Referenzbilder            |
| `prototype/` | Code des spielbaren Prototyps                        |

## Stand

1. `docs/01_Briefing-Prompt.md` — Prompt, mit dem das Briefing erzeugt wurde. ✔
2. `docs/02_Briefing.md` — vollständiges Entwicklungs-Briefing (24 Kapitel). ✔
3. `prototype/` — **M3 abgeschlossen:** Anlieferungen (Kipper/Pritsche/Tieflader,
   rückwärts ansetzend), Konto + Haufen-Verkauf, Presse mit Hubplatte,
   Betonlego-Boxen, Schrottberge, Save/Load. Dazu aus M2: Wrack-Zerlegung,
   Beul-Verformung, Pendel-Spinne, Kabinensicht.

## Nächster Schritt

Meilenstein **M4** (Briefing Kap. 22): MVP-Polish — Onboarding (erstes Auto im
Tutorial), Einstellungen, Merge-/LOD-System, Audio-Vervollständigung, Balancing.

Prototyp starten: `cd prototype && npm install && npm run dev` → http://localhost:5173
