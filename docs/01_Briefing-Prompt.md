# Briefing-Prompt — Schrottplatz-App

**So benutzt du ihn:** Neue Claude-Unterhaltung (oder Claude Code im Projektordner) öffnen, alles zwischen den Linien kopieren und abschicken. Claude stellt dir zuerst Rückfragen, danach entsteht das vollständige Briefing als Datei `docs/02_Briefing.md`.

---

Du bist ein erfahrener Game Designer und Technical Director. Deine Aufgabe ist es, mit mir zusammen ein **vollständiges, umsetzbares Entwicklungs-Briefing (Game Design Document)** für mein Spielprojekt zu erarbeiten. Das fertige Briefing soll so präzise sein, dass ein Entwickler (oder ein KI-Coding-Agent) direkt damit anfangen kann zu bauen, ohne nachfragen zu müssen.

## Das Projekt

Eine spielbare App, in der man einen **Fuchsbagger mit Greifspinne** auf einem **Schrottplatz** steuert. Kern der Spielidee:

- Schrotthändler und Privatleute liefern Altmetall an und laden es ab.
- Der Spieler nimmt die Ware an, bewertet sie und **sortiert sie korrekt** in die richtigen Container/Boxen.
- Mit dem Bagger wird Schrott **getrennt und zerlegt**: Kommt z. B. ein Auto, wird der Motor herausgerissen, das Fahrzeug flachgedrückt, Störstoffe werden entfernt.
- Richtiges Sortieren und sauberes Trennen bringt Geld; Fehler kosten.

## Dein Vorgehen — in dieser Reihenfolge

**Schritt 1 — Rückfragen.**
Stelle mir gebündelt Rückfragen, bevor du irgendetwas schreibst. Halte dich dabei an folgende Regeln:

- Maximal **zwei Runden** Rückfragen, pro Runde höchstens **8 Fragen**, nummeriert.
- Frage nur, was du wirklich nicht sinnvoll selbst entscheiden kannst.
- Gib zu **jeder** Frage einen konkreten Vorschlag mit, den ich einfach mit „ok" bestätigen kann („Empfehlung: …, weil …"). Ich soll antworten können, ohne selbst zu recherchieren.
- Decke dabei mindestens ab: Zielplattform und Technologie-Stack, Ziel-Spielgefühl (arcadig vs. simulationsnah), Session-Länge, Einzel- oder Mehrspieler, Steuerungsgeräte, Grafikstil, Umfang des ersten spielbaren Stands, Zeitbudget und mein technisches Vorwissen.
- Wenn ich auf eine Frage nicht antworte, nimm deine eigene Empfehlung und markiere sie im Briefing als **Annahme**.

**Schritt 2 — Briefing schreiben.**
Erst nachdem ich geantwortet habe, schreibst du das Briefing als Markdown-Datei nach `docs/02_Briefing.md`. Kein Fließtext-Dump in den Chat — die Datei ist das Ergebnis.

## Aufbau des Briefings

Nutze exakt diese Kapitel, mit Nummerierung:

1. **Kurzfassung** — Elevator Pitch in 3 Sätzen, Genre, Plattform, Zielgruppe, USP.
2. **Vision & Spielgefühl** — Was soll sich beim Spielen gut anfühlen? Welche Emotion trägt das Spiel? 3–5 Referenztitel und was genau du davon übernimmst bzw. bewusst anders machst.
3. **Zielgruppe & Plattform** — Spielertyp, Vorwissen, Eingabegeräte, Zielhardware inkl. unterster unterstützter Konfiguration.
4. **Gameplay-Loops** — getrennt beschrieben: Sekunden-Loop (Greifen, Heben, Ablegen), Minuten-Loop (eine Anlieferung komplett abarbeiten), Session-Loop (ein Arbeitstag), Meta-Loop (Ausbau des Platzes über viele Tage).
5. **Baggersteuerung** — jede Bewegungsachse einzeln (Fahrwerk, Oberwagendrehung, Ausleger, Stiel, Greifspinne öffnen/schließen, Rotator), jeweils mit Tastenbelegung für Tastatur+Maus, Gamepad und ggf. Touch. Dazu: Kamerasystem, Umschalten zwischen Ansichten, Assistenzfunktionen für Einsteiger.
6. **Physik & Simulation** — welches Verhalten wird echt simuliert, was wird gefaked. Wie funktioniert das Greifen technisch (Kollisionsabfrage, Joint/Constraint, Haltekraft, Abrutschen). Stapelverhalten, Gewicht, Schwerpunkt, Kippgefahr. Klare Grenzen: was ist bewusst nicht simuliert.
7. **Material- und Schrottkatalog** — Tabelle aller Materialklassen (z. B. Stahlschrott, Guss, Aluminium, Kupfer, Messing, Edelstahl, Elektroschrott, Kabel, Reifen, Akkus, Störstoffe) mit: Dichte/Gewicht, Ankaufspreis, Verkaufspreis, Zielcontainer, typische Fehlsortierungen, visuelle Erkennungsmerkmale für den Spieler.
8. **Zerlegungs-Mechanik** — wie ein zusammengesetztes Objekt in Teile zerfällt. Beispiel Auto vollständig durchdekliniert: Zerlegungsstufen, welche Baugruppe mit welchem Werkzeug entfernt wird (Motor, Katalysator, Starterbatterie, Reifen, Tank, Kabelbaum), was passiert bei falscher Reihenfolge, wann darf gepresst werden. Beschreibe das als wiederverwendbares System, nicht nur als Sonderfall Auto.
9. **Annahme, Wiegen & Sortierung** — Ablauf einer Anlieferung von der Einfahrt bis zur Bezahlung. Waage, Sichtprüfung, Ankaufspreisbildung, Verunreinigungsgrad, Reklamation, Betrugsversuche durch Kunden.
10. **Wirtschaftssystem & Progression** — Einnahmen und Kosten, Preisschwankungen, Upgrade-Baum (Bagger, Anbauwerkzeuge wie Sortiergreifer, Magnet, Schrottschere, Presse, Shredder; Container, Platzfläche, Mitarbeiter, Genehmigungen). Nenne konkrete Startwerte und eine grobe Balancing-Kurve für die ersten 5 Spielstunden.
11. **Aufträge & Spielmodi** — Freies Spiel, Kampagne/Tagesziele, Zeitdruck-Modi, Tutorial. Wie wird Erfolg gemessen, wie Misserfolg.
12. **Weltaufbau & Level** — Platzlayout mit Zonen (Einfahrt, Waage, Annahme, Sortierboxen, Zerlegebereich, Presse, Abholung), Laufwege, wie der Platz beim Ausbau wächst.
13. **NPCs & KI** — Kundenfahrzeuge, Anfahrt und Wegfindung, Wartezeit und Geduld, Zufriedenheit und deren Auswirkung.
14. **UI, HUD & Steuerungs-Feedback** — jedes HUD-Element mit Zweck, Menüstruktur, Onboarding-Fluss für die ersten 10 Minuten, wie der Spieler erkennt, was er greift und ob er richtig liegt.
15. **Audio** — Soundkategorien, wichtigste Einzelsounds, Musikkonzept, wie Audio Feedback für gelungene Aktionen gibt.
16. **Art Direction** — Stilrichtung, Farbleitsystem (besonders zur Unterscheidung der Materialien), Detailgrad, Tageszeit und Wetter, Referenzbild-Beschreibungen.
17. **Technische Architektur** — Engine/Framework, Renderer, Physik-Engine, Projekt- und Ordnerstruktur, Modulschnitt, Datenfluss, Speicherstände, Build- und Deployprozess. Begründe jede größere Technologieentscheidung in einem Satz und nenne jeweils eine Alternative.
18. **Datenmodell** — die zentralen Entitäten als kommentierte JSON-Schemata oder Typdefinitionen (Schrott-Item, Materialklasse, Container, Fahrzeug, Anlieferung, Auftrag, Upgrade, Spielstand).
19. **Performance-Budgets** — Zielbildrate, maximale gleichzeitig simulierte Physikobjekte, Polygon- und Texturbudget, Ladezeiten, Strategien wenn das Budget reißt (Schlafenlegen ruhender Objekte, Zusammenfassen sortierter Teile, LOD).
20. **Barrierefreiheit & Lokalisierung** — Bedienhilfen, Farbfehlsichtigkeit, Textgrößen, Sprachen.
21. **MVP-Abgrenzung** — zwei Listen: „Im ersten spielbaren Stand enthalten" und „Bewusst nicht enthalten". Die zweite Liste muss mindestens so lang sein wie die erste.
22. **Meilensteinplan** — Schritte vom ersten technischen Prototyp bis zum spielbaren Vertical Slice, jeder Meilenstein mit einem prüfbaren Abnahmekriterium („fertig, wenn …") und grober Aufwandsschätzung.
23. **Risiken & offene Punkte** — technische, gestalterische und Umfangsrisiken, jeweils mit Gegenmaßnahme. Dazu eine Liste aller Annahmen, die du ohne meine Antwort getroffen hast.
24. **Glossar** — Fachbegriffe aus Schrottwirtschaft und Baggertechnik kurz erklärt.

## Qualitätsregeln

- **Konkret statt vage.** Nicht „das Greifen soll sich gut anfühlen", sondern „die Spinne schließt in 0,4 s, Haltekraft X, Objekte über Y kg rutschen mit Z % Wahrscheinlichkeit pro Sekunde ab". Wo du Zahlen erfindest, kennzeichne sie als **Startwert zum Austesten**.
- **Jedes Feature bekommt ein Abnahmekriterium**, an dem man ohne Diskussion sieht, ob es fertig ist.
- **Priorisiere alles** mit `[MVP]`, `[V1]` oder `[Später]`. Wenn alles MVP ist, hast du nicht priorisiert.
- **Keine Platzhalter** wie „TBD" oder „hier später ergänzen". Wenn etwas offen ist, triff eine begründete Entscheidung und schreib sie in die Annahmen-Liste.
- **Widersprich mir**, wenn ein Wunsch von mir den Umfang sprengt oder dem Spielgefühl schadet. Sag klar, was du stattdessen empfiehlst und warum. Nicke nichts einfach ab.
- **Realitätscheck Umfang:** Sag mir ehrlich, wenn das, was ich beschreibe, für die geplante Zeit zu groß ist, und schlage einen kleineren ersten Schnitt vor.
- Nutze Tabellen für alles Aufzählbare (Materialien, Tastenbelegung, Upgrades, Meilensteine).
- Schreib auf Deutsch, sachlich, ohne Marketingsprache. Fachbegriffe gern, aber im Glossar erklärt.

## Abschluss

Wenn die Datei steht, gib mir im Chat nur:
1. eine Zusammenfassung in maximal 10 Zeilen,
2. die drei Entscheidungen, bei denen du dir am unsichersten bist,
3. den einen konkreten nächsten Schritt, mit dem ich anfangen sollte.
