# Gerätetest Prototyp — iPad, nach Haufenruhe und Instancing

Datum: 09.09.2026 · Tester: Patrick · Build: GitHub-Pages-Fassung des Prototyps
Methode: Debug-Overlay auf dem Gerät abgelesen (Fünf-Finger-Tipp), Ruhezustand ohne Eingabe.

Dies ist die **erste Zahlenmessung des Prototyps auf echter Hardware**. Der Gerätetest vom
02.09. war rein subjektiv, weil das Overlay auf Touch nicht erreichbar war — das ist jetzt
behoben. Damit ist Schritt 0.1/0.2 der Roadmap (`03_Roadmap.md` Phase 0) für den Prototyp
beantwortet.

---

## Ausgangslage

Im gebauten Prototyp blieben **115 von 159 Körpern dauerhaft wach**, auch nach 20 s ohne
Eingabe. Bildzeit 34,0 ms bei 30 fps.

## Zahlen nach den Änderungen

| Größe | Wert | Bemerkung |
|---|---|---|
| Bewegliche Körper wach | **0 von 128** | vorher praktisch alle |
| Physik | **1,1 ms** | je Bild, alle Schritte zusammen |
| Zeichnen | **8,7 ms** | CPU-seitige Abgabe an die Grafik |
| **Arbeit gesamt** | **9,8 ms** | Budget für 60 fps: 16,7 ms → **41 % Luft** |
| Zeichenrufe | 1 234 | vorher rund 3 800 |
| Dreiecke | 239 k | unverändert — es wird dasselbe gezeichnet |
| Angezeigte fps | 30 | siehe unten |

## Warum trotzdem 30 fps

Die angezeigten 30 fps bei 34,0 ms sind **nicht** die Arbeit des Spiels — die liegt bei 9,8 ms.
Zwei Deckel liegen darüber:

1. **Bildsynchronisation.** Safari synchronisiert auf 60 Hz und fällt auf glatte 30 zurück,
   sobald 16,7 ms nicht reichen. Dazwischen gibt es nichts. Solange dieser Deckel greift,
   zeigt `frameDt` immer 34,0 ms — jede Verbesserung bleibt unsichtbar. Genau das ist beim
   Instancing passiert: Zeichenrufe von 3 800 auf 1 234, Anzeige unverändert 34,0 ms.
2. **Stromsparmodus.** Das Gerät stand bei 14 % mit gelbem Batteriesymbol. iOS deckelt darin
   die Bildrate hart auf 30. **Noch nicht gegengeprüft** — Messung am Kabel steht aus.

Merksatz für künftige Messungen: **`frameDt` taugt auf iOS nicht als Leistungsmaß.**
Abzulesen ist die Zeile `Arbeit: Physik … · Bild …`.

---

## Änderungen, die zu diesen Zahlen führten

| Änderung | Wirkung |
|---|---|
| Spawn überlappungsfrei (Umkugel statt halber Kantenlänge, 6 cm Luft) | keine Spawn-Explosionen mehr |
| Runde Kollider als Achtkant-Prismen, Drahtknäuel facettiert | kein endloses Rollen (Rapier hat keinen Rollwiderstand) |
| Schlafhilfe mit Mehrheitsregel (92 %) statt Einstimmigkeit | Haufen schläft überhaupt erst ein |
| Vorsimulation nach allen Anfangs-Spawns | erstes Bild zeigt einen liegenden Platz |
| Betonlego (Umrandung + Mulden) als `InstancedMesh` | Zeichenrufe gedrittelt |

Begründungen im Entscheidungslog der jeweiligen Commits; die ersten beiden Punkte folgen
v2s E-010 und E-011, der dritte weicht bewusst von E-012 ab (dort Einstimmigkeit).

---

## Was daraus folgt

- **Die Mobil-Frage ist für den Prototyp beantwortet:** 9,8 ms Arbeit auf einem iPad, bei
  128 beweglichen Körpern, einem Haufen, zwei Wracks und laufendem Betrieb. Es ist Luft da.
- Weitere Zeichen-Optimierung (Bäume instancen, Fahrbahnmarkierungen zusammenführen,
  Schattenwerfer begrenzen) ist **nicht dringend**, solange 8,7 ms fürs Bild reichen.
- Offen: Messung ohne Stromsparmodus, und dieselbe Messung unter Last (voller Platz,
  mehrere Fahrzeuge, Presse in Bewegung).
