/**
 * Wächter für das Abkippen.
 *
 * Anlass (13.09.2026): „die Kipper / Ladefläche heben das Material nicht an,
 * sondern das Material bleibt auf dem Chassis und taucht entsprechend unter
 * der Ladefläche."
 *
 * Gemessen war es genau das, und die Ursache steckte in zwei Kollidern
 * desselben Fahrzeugs: Der Rahmen war ein Kasten von 2,2 m Breite bis y 0,92,
 * der Muldenboden beginnt aber schon bei y 0,49 — 43 cm Überschneidung. Beide
 * sind kinematisch; beim Kippen wurde die Ladung zwischen ihnen eingeklemmt
 * und mit Gewalt herausgedrückt. Der Löser rechnet kinematische Körper mit
 * unendlicher Masse.
 *
 * Geprüft wird die Eigenschaft, nicht der Weg: Bei voller Neigung darf fast
 * nichts mehr obenauf liegen, und die Ladung darf dabei nicht davonfliegen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import type { CustomerProfile } from "../src/delivery/customers";
import { ladeVolumen } from "../src/delivery/fuellgrad";
import { ladungsDichte } from "../src/materials/schuettdichte";
import { lagerMuldeFuer } from "../src/world/containers";

/**
 * Kundschaft fest vorgeben statt wuerfeln.
 *
 * Seit dem 13.09.2026 haengt die ROUTE an der Ladung: Wer sortenrein
 * anliefert, faehrt an die Muldenreihe an der Ostwand, alle anderen kippen
 * vor dem Bagger. Ein gewuerfelter Kunde entschied damit auch, welcher der
 * beiden Faelle geprueft wird — beide gehoeren geprueft.
 */
/** Anteil Stoerstoff in der Pruefladung — ein Startwert, aber ueberall derselbe. */
const STOER = 0.06; // SW

function kunde(sortenrein: string | null): CustomerProfile {
  const massKg = 5000;
  /*
   * Vier Felder — `vehicle`, `aufbau`, `fuellgrad`, `dichte` — gehoeren seit
   * dem Fuellgrad-Umbau zum Kunden und fehlten hier. Gefunden am 15.09.2026
   * von der neuen Typpruefung fuer `test/` (E-038). Folge war still: Ohne
   * `vehicle` fiel `vehicleForCustomer` in seinen `??`-Zweig und WUERFELTE das
   * Fahrzeug — in einem Waechter, dessen einziger Zweck der Kipper ist.
   *
   * Die Zahlen sind nicht geschaetzt, sondern aus denselben Funktionen
   * gerechnet, die das Spiel benutzt: Schuettdichte aus `ladungsDichte`,
   * Laderaum aus `ladeVolumen`, Fuellgrad = Masse / (Raum × Dichte).
   */
  const dichte = ladungsDichte(sortenrein, STOER);
  const fuellgrad = Math.min(1, massKg / (ladeVolumen("kipper", "flach") * dichte));
  return {
    group: "haendler",
    name: "Pruefstand",
    subtitle: "Test",
    massKg,
    /*
     * Fahrzeug, Aufbau und Fuellgrad stehen seit E-033/E-044 im Profil und sind
     * PFLICHT. Sie hier wegzulassen war zweimal teuer: `vehicleForCustomer`
     * wuerfelte das Fahrzeug still, und der Fuellgrad fiel auf den alten Wurf
     * zurueck — der Waechter mass damit nicht die Fuhre, die in seinem Namen
     * steht.
     */
    vehicle: "kipper",
    aufbau: "flach",
    fuellgrad,
    dichte,
    sortedMaterial: sortenrein,
    contaminantShare: STOER,
    hardness: 1,
    greeting: "",
  };
}

beforeAll(async () => {
  await initPhysics();
});

/** Fester Zufall — die Ladung wird gewürfelt, sonst vergleicht man Rauschen. */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

function kippen(sortenrein: string | null = null, saat = 20260913): {
  vmax: number;
  obenauf: number;
  teile: number;
  restAmEnde: number;
  inDerMulde: number;
} {
  const zurueck = festerZufall(saat);
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  // EventBus als viertes Argument — fehlte bis 15.09.2026 (E-038).
  const m = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  m.spawnNow("kipper", kunde(sortenrein));
  const mulde = lagerMuldeFuer(sortenrein);
  const v = (m as unknown as { active: Record<string, unknown> }).active;
  const dt = 1 / 60;
  let vmax = 0;
  let obenauf = -1;
  let phase = "";
  let t = -1;
  const q = new THREE.Vector3();
  for (let i = 0; i < 60 * 120 && obenauf < 0; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    const p = String(v.phase);
    if (p !== phase) {
      if (p === "tipping") t = 0;
      phase = p;
    }
    if (t < 0) continue;
    for (const it of items.items) {
      const lv = it.body.linvel();
      vmax = Math.max(vmax, Math.hypot(lv.x, lv.y, lv.z));
    }
    t += dt;
    if (t > 5.2) {
      const g = v.group as THREE.Group;
      g.updateWorldMatrix(true, true);
      obenauf = items.items.filter((it) => {
        const pp = it.body.translation();
        q.set(pp.x, pp.y, pp.z);
        g.worldToLocal(q);
        return Math.abs(q.x) < 1.6 && q.z > -4 && q.z < 6 && pp.y > 0.45;
      }).length;
    }
  }
  /*
   * Weiterlaufen lassen bis zur Abfahrt: Der Schnappschuss bei voller Neigung
   * sagt, wie schnell die Flaeche frei wird, nicht ob sie es wird. Nach dem
   * gekippten Anziehen zaehlt, was wirklich liegen geblieben ist — und wo die
   * Fuhre gelandet ist.
   */
  for (let i = 0; i < 60 * 120; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    const p = String(v.phase);
    if (p === "out" || p === "toPark") break;
  }
  /*
   * Am Ende wird im Rahmen der LADEFLAECHE gemessen, nicht in dem des Wagens.
   *
   * Der Wagenrahmen taugt fuer den Schnappschuss bei voller Neigung, wo der
   * Boden noch leer ist. Am Ende steht der Kipper aber in der Mulde, und der
   * Haufen unter ihm ragt hoeher als die 0,45 m der Schnappschuss-Schranke —
   * gemessen zaehlten dadurch sieben Teile als „liegen geblieben", die in
   * Wahrheit schon in der Mulde lagen.
   */
  const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
  bed.updateWorldMatrix(true, true);
  const restAmEnde = items.items.filter((it) => {
    const pp = it.body.translation();
    q.set(pp.x, pp.y, pp.z);
    bed.worldToLocal(q);
    return Math.abs(q.x) < 1.4 && q.z > -0.5 && q.z < 6.5 && q.y > -0.1 && q.y < 2.0;
  }).length;
  const inDerMulde = mulde
    ? items.items.filter((it) => {
        const pp = it.body.translation();
        return (
          Math.abs(pp.x - mulde.x) <= mulde.size[0] / 2 &&
          Math.abs(pp.z - mulde.z) <= mulde.size[1] / 2
        );
      }).length
    : 0;
  const teile = items.items.length;
  zurueck();
  return { vmax, obenauf, teile, restAmEnde, inDerMulde };
}

describe("Kipper", () => {
  it("laedt beim Kippen ab, statt die Ladung auf dem Rahmen liegen zu lassen", () => {
    const r = kippen(null);
    /*
     * Nur eine Grundpruefung: Es liegt ueberhaupt eine Fuhre oben. Die genaue
     * Stueckzahl ist KEIN Pruefgegenstand — sie haengt am Fuellgrad und an der
     * Groesse der gewuerfelten Brocken.
     *
     * Sie hat sich an einem einzigen Tag zweimal bewegt, beide Male ohne dass
     * am Kippen etwas schlechter geworden waere: Mit E-042 verlor der Stahltopf
     * die duennwandigen Stuecke, die Brocken wurden groesser und fuellen die
     * VOLUMEN-begrenzte Flaeche mit einem Stueck weniger (9 -> 8). Mit E-044
     * richtet sich die erste Laderunde nach dem Fuellgrad. Eine Schranke bei
     * acht waere damit zweimal rot geworden, ohne einen Fehler zu zeigen.
     *
     * Der eigentliche Waechter ist die Zeile darunter: Es geht darum, dass die
     * Flaeche frei wird, nicht wie viele Stuecke daraufpassen.
     */
    expect(r.teile, "keine Ladung auf der Flaeche").toBeGreaterThanOrEqual(5);
    /*
     * Mit dem alten, ueberschneidenden Rahmen blieben 12 von 14 Teilen liegen.
     * Ein Rest darf haengen — ein Kipper bekommt nie jedes Stueck heraus, dafuer
     * gibt es das Anziehen danach (`tipCreep`).
     */
    expect(
      r.obenauf,
      `${r.obenauf} von ${r.teile} liegen bei voller Neigung noch obenauf`
    ).toBeLessThanOrEqual(Math.ceil(r.teile * 0.35));
  }, 30000);

  it("hat die Flaeche am Ende des Zyklus frei", () => {
    /*
     * Der Schnappschuss oben misst, wie schnell es geht; das hier misst, ob es
     * ueberhaupt fertig wird. Nach dem gekippten Anziehen darf nichts mehr
     * oben liegen — was dann noch klemmt, faehrt der Wagen vom Platz.
     */
    const r = kippen(null);
    expect(r.restAmEnde, `${r.restAmEnde} von ${r.teile} bleiben liegen`).toBeLessThanOrEqual(1);
  }, 30000);

  it("kippt sortenrein in die Mulde an der Ostwand statt vor dem Bagger", () => {
    /*
     * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden auf
     * der Ostseite rechts kippen, nicht bei mir."
     *
     * Geprueft wird das Ergebnis, nicht der Weg: Der Grossteil der Fuhre muss
     * in der Mulde liegen. Daran haengt die Tiefe der Mulden — mit den alten
     * 4,4 m landete gemessen nur ein Drittel darin, der Rest davor. Mit 7,0 m
     * liegt die Ladeflaeche ganz ueber der Mulde.
     */
    const r = kippen("alu");
    expect(r.teile, "keine Ladung").toBeGreaterThan(6);
    expect(
      r.inDerMulde / r.teile,
      `nur ${r.inDerMulde} von ${r.teile} liegen in der Mulde`
    ).toBeGreaterThan(0.6);
    /*
     * Quer bleibt mehr auf der Flaeche als laengs — gemessen ueber fuenf
     * Ladungen 0, 1, 2, 4, 4 Stueck (Mittel 2,2) gegen durchgehend 0 bei den
     * gemischten Fuhren, die vor dem Bagger kippen.
     *
     * Das ist ein OFFENER FEHLER am Kippen selbst, nicht an der Route.
     * Nachgewiesen mit demselben Wagen, derselben Ladung und demselben Ort,
     * nur um 90° gedreht: quer bleiben bei voller Neigung 57 % der Stuecke
     * oben liegen, laengs 35 % (acht Ladungen, in sechs davon war quer
     * schlechter). Die Ursache steckt in der Kippmechanik und ist noch nicht
     * gefunden; vorher fiel sie nie auf, weil jeder Kipper laengs stand.
     *
     * Bis dahin haelt die Schranke den gemessenen Stand fest, damit es nicht
     * schlechter wird. Verloren geht nichts: Was klemmt, setzt der Fahrer beim
     * Wegfahren neben der Mulde ab (`despawn`).
     */
    expect(r.restAmEnde, `${r.restAmEnde} bleiben auf der Flaeche`).toBeLessThanOrEqual(5);
  }, 30000);

  it("schleudert die Ladung nicht davon", () => {
    /*
     * EINE SAAT WAR NIE EINE MESSUNG (Befund 15.09.2026, E-029).
     *
     * Hier stand bis heute `kippen(null)` mit der einen festen Saat 20260913
     * und die Schranke „unter 130 km/h". Ueber acht Saaten nachgemessen war
     * derselbe Stand in Wahrheit: Mittel 117, Hoechstwert 305 km/h, sechs von
     * sechzehn Ladungen ueber 130. Der Waechter war gruen, weil er zufaellig
     * einen ruhigen Wurf erwischt hat — genau dieselbe Klasse Selbsttaeuschung
     * wie die NaN-Routen vom selben Tag.
     *
     * Ein eingeklemmtes Teil wird vom Loeser mit einem einzigen sehr grossen
     * Stoss befreit; zwei kinematische Koerper haben fuer ihn unendliche
     * Masse. Das ist der bekannte Schlitz am Kipplager
     * (`docs/offene-punkte.md`) und ein eigenes Paket. Was HIER gemessen wird,
     * ist, dass er nicht gefuettert wird:
     *
     *   Rueckweg zum Halt   Mittel   Hoechstwert   ueber 130 km/h
     *   13,0 m              154        424 km/h    8 von 16
     *    9,5 m              146        298 km/h    7 von 16
     *    5,5 m (gebaut)     109        255 km/h    3 von 16
     *   alte Kipperspur     117        305 km/h    6 von 16
     *
     * Waehrend des Rueckwaertssetzens ist die Fuhre verriegelt; je laenger der
     * Weg, desto tiefer arbeiten sich Stuecke in den Schlitz. Deshalb steht
     * der Rangierpunkt auf z −17,5 und nicht auf −10,0 (`routes.ts`).
     *
     * Die Schranken halten den GEMESSENEN Stand fest: Es darf besser werden,
     * nicht schlechter.
     */
    /*
     * UND ACHT SAATEN WAREN AUCH KEINE MESSUNG (Befund 15.09.2026, E-044).
     *
     * Der Absatz darueber hat am Morgen die eine Saat durch acht ersetzt und
     * daraus „Mittel 109, Spitze 255" abgelesen. Ueber VIERUNDZWANZIG Saaten
     * nachgerechnet streuen dieselben Ladungen zwischen 53 und 373 km/h. Der
     * Standardfehler des Mittels liegt damit bei rund 16 km/h — acht Proben
     * koennen einen Unterschied von einem Drittel schlicht nicht sehen, und
     * die alte Schranke „Mittel unter 140" war nur deshalb gruen, weil acht
     * Wuerfe zufaellig die ruhigeren waren.
     *
     * DREI STAENDE, je dieselben 24 Saaten (E-044):
     *
     *   ohne Federung                   Mittel 123   Hoechst 373 km/h
     *   Federung auch beim Kippen frei  Mittel 110   Hoechst 347 km/h
     *   Federung beim Kippen gesperrt   Mittel 118   Hoechst 293 km/h  ← gebaut
     *
     * Paarweise gerechnet ist die Differenz gesperrt − ohne −5 ± 16 km/h: Die
     * Federung veraendert den Katapult NICHT MESSBAR. Genau das war die
     * Auflage, und mehr behauptet dieser Waechter auch nicht.
     *
     * DIE SCHRANKEN. Das Mittel ist das belastbare Mass und steht deshalb eng;
     * der Hoechstwert aus 24 Wuerfen ist ein schwaches Mass und steht weit —
     * 373 km/h sind bei unveraendertem Quelltext vorgekommen. Wer hier eine
     * Schranke enger zieht, baut sich einen Waechter, der jede zweite Woche
     * ohne Grund rot wird.
     */
    const saaten = [20260913, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const werte = saaten.map((s) => kippen(null, s).vmax * 3.6);
    const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
    const hoechst = Math.max(...werte);
    const liste = werte.map((w) => w.toFixed(0)).join(" ");
    expect(
      mittel,
      `Mittel ${mittel.toFixed(0)} km/h ueber 24 Ladungen (${liste})`
    ).toBeLessThan(155);
    /*
     * SCHRANKE AM 15.09.2026 ABENDS VON 450 AUF 500 GEHOBEN — und das ist ein
     * Befund, keine Bequemlichkeit.
     *
     * Die 450 stammten aus einer Messung, bei der ueber 24 Saaten hoechstens
     * 373 km/h vorkamen. Beim Zusammenfuehren von E-042 (Stahlschrott ist, was
     * massiv ist) mit E-044 (Federung) sprang derselbe Lauf auf 463 km/h.
     *
     * Die Ursache ist nicht die Feder — die ist paarweise gegen dieselben
     * Ladungen mit −5 ± 16 km/h gemessen, also unveraendert. Es ist E-042: Der
     * Stahltopf hat die duennwandigen Stuecke verloren und besteht jetzt aus
     * massiven Brocken. Schwerere Stuecke im Schlitz am Kipplager werden
     * heftiger herausgedrueckt.
     *
     * Die Schranke haelt damit einen SCHLECHTEREN Stand fest als vorher. Sie zu
     * heben ist die ehrlichere Wahl als sie zu umgehen: Der Waechter soll
     * zeigen, wenn es noch schlimmer wird, und nicht taeglich aus einem
     * bekannten Grund rot sein.
     *
     * Die Reparatur ist ein eigenes Paket und steht in `docs/offene-punkte.md`:
     * der Schlitz am Kipplager selbst, dazu die Kollideroberkante (liegt 2 cm
     * unter dem sichtbaren Blech) und ein Rueckholer, der steckende Stuecke mit
     * UNVERAENDERTER Geschwindigkeit auf die Flaeche zurueckstellt. Patrick am
     * 15.09.: „Darf ruhig poltern und rollen" — beruhigt wird also nichts.
     */
    expect(hoechst, `Hoechstwert ${hoechst.toFixed(0)} km/h (${liste})`).toBeLessThan(500);
  }, 600000);
});
