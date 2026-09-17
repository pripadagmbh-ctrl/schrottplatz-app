# Wer fährt durch wen — Messung vom 17.09.2026

**Kein Gerätetest.** Alles hier ist kopflos gemessen (`vite-node`, echte
Rapier-Welt, echter Fuhrpark, echte Behälter). Der Anlass ist ein Gerätebefund;
die Nachprüfung am iPad steht noch aus und ist als Punkt 1 bis 4 unten notiert.

| | |
|---|---|
| Anlass | Patrick am Gerät, 17.09.2026, wörtlich: **„LKWS fahren durch Müllcontainer. Objekte fahren durch einander hindurch"** |
| Stand | Zweig `v1/start`, Commit `959d806` (E-092) |
| Werkzeug | `npx vite-node tools/durchfahrt.ts` → Rohausgabe in `2026-09-17_durchfahrt.txt` |
| Rechnung | `tools/durchfahrt-kern.ts`, darunter `src/delivery/umriss.ts` — dieselbe Funktion, mit der `isBlockedByBuilding` während der Fahrt nach vorn schaut |
| Bedingung | Container auf **(−2,80 \| −15,40)**, der Lage aus Patricks Spielstand; zusätzlich auf seinem Startplatz (−3,79 \| −14,11) gegengemessen |
| Nullprobe | bestanden — Umriss 90 m neben dem Hof: 0,00 m; derselbe Umriss auf dem Kaffeewagen: 2,80 m (Soll 2,80) |
| Log | E-093 |

## Die Tabelle

| Paar | durchdringt | Tiefe | Lage | Kollider vorhanden | Kollider wirksam |
|---|---|---|---|---|---|
| LKW × MÜLL-Container | **ja** | **3,10 m** | `toPark`, Warteplatz (−26 \| 6), Bild 2259 | **ja** — 5 am Container, 3 am LKW, **32 Berührpunkte** | **nein** |
| LKW × liegender Schrott | ja | Brocken 1,22 m verschoben | `toPark` | ja | teilweise (der Brocken weicht, der LKW hält nicht) |
| LKW × Ostwand | ja | 0,27 m gefahren / 0,60 m über alle Gierlagen | Kehre am Abladeplatz | ja | **nein** |
| LKW × LKW | in den Proben 0 | — | — | ja | **nein** (Bauart) |
| Behälter × Westmauer | **nein** | 0,01 m bei 6 m/s Anlauf | — | ja | **ja** — die Gegenprobe |
| Bagger × MÜLL-Container | ja | 1,30 m | überall | Punktabfrage mit Puffer | zu kleiner Puffer |

## Abgeleitetes Tempo des LKW-Rahmens je Phase (m/s)

Das ist die Zahl, an der die Ursache hängt: Rapier leitet das Tempo eines
kinematischen Körpers aus `nächste Pose − jetzige Pose` ab. Null heißt
**versetzt statt bewegt** — dann sieht der Löser keinen Stoß, sondern eine
ruhende Überdeckung.

| Phase | Tempo | |
|---|---|---|
| `in` | 4,889 | bewegt |
| `weighIn` | 4,325 | bewegt |
| `approach` | 4,891 | bewegt |
| `shiftPause` | 3,616 | bewegt |
| `reverseIn` | 2,886 | bewegt |
| `pauseBeforeUnload` | 1,681 | bewegt |
| `tipping` / `tipHold` / `tipCreep` | 0,003 / 0,000 / 0,000 | **versetzt** |
| **`toPark`** | **0,175** | **versetzt** |
| **`parkRueck`** | **0,026** | **versetzt** |
| `out` | **79,200** | **Sprung** — 1,32 m in einem Bild, Bild 2446 |

## Abgeleitete Aufgaben

| # | Was | Zuständig |
|---|---|---|
| 1 | `toPark` und `parkRueck` über `advance()` auf eine echte Strecke legen — dann greift die bestehende Hindernisprüfung ohne neue Logik | `welt` (delivery/), nach Freigabe durch Patrick: anhalten und hupen ODER beiseiteschieben |
| 2 | `snapBodiesToPose()` in `toPark`/`parkRueck` prüfen — es setzt die jetzige Pose und macht damit das abgeleitete Tempo null | `welt` |
| 3 | Sprung an der Ausfahrt (79,2 m/s) — gehört zum Ausfädel-Paket, das gerade läuft | `welt`, laufend |
| 4 | `CHASSIS_PAD` (1,30 m) gegen `UNTERWAGEN_R` (2,60 m) zusammenführen | `bagger` |
| 5 | `hindernisse()` meldet 1,00 m Oberkante, gebaut sind 1,175 m | `welt` (world/) |
| 6 | `ItemManager.clampSpeeds` fragt `isDynamic()` ohne `isValid()` — harter Rapier-Absturz nach 5,5 min Dauerlauf | `welt` |

## Auf dem Gerät zu prüfen

1. Einen Kipper abladen lassen und ihm zum Warteplatz an der Westseite folgen — fährt er durch den Müllcontainer?
2. Den Container mitten auf den Hof stellen und dasselbe noch einmal. Hält irgendein Wagen davor an und hupt?
3. Beim Zurückstoßen an den Abladeplatz auf die Ostwand sehen — schleift die Ecke sichtbar durch die Betonlego?
4. Mit dem Bagger dicht an den Container heranfahren — wie weit steckt der Unterwagen darin, bevor es klemmt?
