/**
 * Wächter für das Fahrwerk (E-010, 14.09.2026).
 *
 * Anlass: Das Fahrtempo stand auf 1,4 m/s = 5 km/h, also Kettenbagger-Tempo.
 * Der Fuchs ist ein Radbagger; mit dem Verladeplatz an der Westwand wird zum
 * ersten Mal ernsthaft über den 50,5 x 58 m großen Platz gefahren.
 *
 * Der Test hält drei Eigenschaften fest, nicht drei Zahlen:
 *   1. Die Maschine quert den Platz in vertretbarer Zeit.
 *   2. Sie fährt trotzdem einen Bogen, den eine gelenkte Achse hergibt —
 *      kein Kreisel.
 *   3. Sie beschleunigt wie eine Maschine, nicht wie ein Auto. Das ist der
 *      Wächter gegen die stille Nebenwirkung: Wer nur DRIVE_MAX anhebt und
 *      die Rampenzeit stehen lässt, verdreifacht die Beschleunigung mit.
 */
import { describe, it, expect } from "vitest";
import { FAHRWERK, fahrzeit, wenderadius, bremsweg } from "../src/excavator/excavator";

describe("Fahrwerk des Baggers", () => {
  it("fährt Radbagger-Tempo, nicht Kettenbagger-Tempo", () => {
    // E-010 gibt 3,0 bis 3,5 m/s frei (11 bis 13 km/h).
    expect(FAHRWERK.maxMS).toBeGreaterThanOrEqual(3.0);
    expect(FAHRWERK.maxMS).toBeLessThanOrEqual(3.5);
  });

  it("quert 50 m aus dem Stand in unter 20 Sekunden", () => {
    // Vorher (1,4 m/s, 0,3 s Rampe): 35,9 s. Jetzt: rund 16 s.
    const t = fahrzeit(50);
    expect(t).toBeLessThan(20);
    // Und nicht beliebig schnell: unter 14 s wäre über 3,6 m/s.
    expect(t).toBeGreaterThan(14);
  });

  it("dreht einen Bogen, den eine gelenkte Achse hergibt", () => {
    /*
     * Radstand rund 2,8 m, Lenkeinschlag 30 bis 35 Grad ergeben
     * 2,8 / tan(δ) = 4,0 bis 4,8 m. Enger als 3 m kann keine gelenkte
     * Achse — das wäre ein Kreisel und damit ein Auto-Gefühl.
     */
    const r = wenderadius();
    expect(r).toBeGreaterThan(3.0);
    expect(r).toBeLessThan(6.0);
  });

  it("beschleunigt wie eine Maschine, nicht wie ein Auto", () => {
    /*
     * Vor E-010: 1,4 m/s in 0,3 s = 4,7 m/s². Das hat Patrick als richtig
     * abgenommen, also bleibt es. Über 6 m/s² (0,6 g) wäre die Rampenzeit
     * nicht mitgewandert.
     */
    const a = FAHRWERK.maxMS / FAHRWERK.rampeS;
    expect(a).toBeGreaterThan(3.5);
    expect(a).toBeLessThan(6.0);
  });

  it("rollt in weniger als zwei Metern aus", () => {
    /*
     * Wichtig für die Kollision: Der Unterwagen wird pro Bild auf die letzte
     * freie Stelle zurückgesetzt, aber der Spieler muss vor einer Mauer noch
     * rechtzeitig loslassen können.
     */
    expect(bremsweg()).toBeLessThan(2.0);
  });

  it("macht bei 30 Bildern je Sekunde keinen anderen Schritt als bei 60", () => {
    // iPhone mini: Das Tempo darf nicht an der Bildrate hängen.
    expect(fahrzeit(50, 1 / 30)).toBeCloseTo(fahrzeit(50, 1 / 60), 0);
  });

  it("setzt keinen Schritt, der größer ist als die Kollisionsschürze", () => {
    /*
     * CHASSIS_PAD in collision.ts ist 1,3 m. Ein Fahrschritt von 3,2 m/s bei
     * 30 Bildern je Sekunde sind 10,7 cm — weit darunter, es kann nichts
     * durch eine Wand tunneln.
     */
    expect(FAHRWERK.maxMS / 30).toBeLessThan(1.3 / 2);
  });
});
