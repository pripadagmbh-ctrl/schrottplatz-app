/**
 * Das Blatt zur Konsolenfrage (E-039): Wie sieht der Steg am Zylinderauge aus?
 *
 * E-013 hat am 14.09.2026 die Konsole unter dem Zylinderauge abgeschafft —
 * „der Zinken ist ein Gussstueck, ein Element, kein Stempel guckt heraus".
 * Mit der Anlenkung der Traverse B verlaesst das Auge den Gusskoerper wieder
 * (gemessen 26 mm, `augensonde.ts`), und es braucht Werkstoff dazwischen.
 *
 * Dieses Blatt zeigt, was dabei herauskommt — und zwar so, dass man es
 * BEURTEILEN kann, nicht nur glauben muss: Jede Ansicht steht zweimal
 * nebeneinander, links MIT dem Steg, rechts OHNE ihn. Was sich zwischen den
 * beiden Bildern aendert, ist genau das, was die Konsole am Aussehen kostet.
 *
 *   Reihe 1  Ferse von der Seite, offene Schale, als Umriss. Die Ansicht, in
 *            der die Form beurteilt wird — steht etwas heraus?
 *   Reihe 2  Ferse von schraeg aussen-oben bei offener Schale: die flache
 *            Flaeche, die der Greifer offen nach oben zeigt.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/konsolenbild.ts
 * Ergebnis: docs/f5-augenkonsole.png  — gerastert, kein Bildschirmfoto.
 */
import * as THREE from "three";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreiferInTeilen } from "../../src/fuenfschalen/rig";
import { dreiecke } from "../riss";
import { Blatt, farbe } from "./png";

const BREITE = 1240;
const HOEHE = 900;
const blatt = new Blatt(BREITE, HOEHE);
const WEISS = farbe("#ffffff");
const UMRISS = farbe("#33373b");

/**
 * Die Ferse EINER Schale am offenen Greifer, mit oder ohne Steg.
 *
 * Gebaut wird der ganze Greifer und dann der eine Knoten herausgegriffen —
 * ueber den NAMEN, nicht ueber Lage oder Reihenfolge. Nur so ist sicher, dass
 * beide Felder dieselbe Baugruppe in derselben Stellung zeigen.
 */
function ferse(mitSteg: boolean): THREE.Object3D {
  const g = baueGreiferInTeilen(stoffe());
  g.setOeffnung(1);
  g.wurzel.updateMatrixWorld(true);
  const schale = g.schalen[0]!.gelenk;
  if (!mitSteg) {
    const steg = schale.getObjectByName("06_AUGENKONSOLE");
    if (steg) steg.removeFromParent();
  }
  /* Ohne Zahn und Blechende — hier geht es um die Ferse. */
  schale.getObjectByName("SHELL_TIP_01")?.removeFromParent();
  g.wurzel.updateMatrixWorld(true);
  return schale;
}

/**
 * Beide Felder einer Reihe im GLEICHEN Massstab.
 *
 * Jedes Feld fuer sich einzupassen waere der bequeme Weg und der falsche: Der
 * Steg aendert die Huellmasse, das Bild wuerde dadurch um ein paar Prozent
 * skalieren, und jeder Unterschied im Bild kaeme aus dem Massstab statt aus
 * der Form. Also wird einmal gemessen — am Koerper MIT Steg — und beide Felder
 * mit derselben Zahl gemalt.
 *
 * Gemittet wird auf das ZYLINDERAUGE, nicht auf die Huellbox: Die Schale ist
 * 1,2 m lang, die Frage ist 26 mm gross. Auf die Huellbox eingepasst waere die
 * Stelle, um die es geht, 20 Pixel gross.
 */
function reihe(
  blick: THREE.Vector3,
  y0: number,
  h: number,
  umriss: boolean,
  bildfeld: number
): void {
  const d = blick.clone().normalize();
  const rechts = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const hoch = d.clone().cross(rechts).normalize();
  const koerper = ferse(true);
  const auge = koerper.getObjectByName("06_ZYLINDERAUGE")!;
  auge.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(auge.matrixWorld);
  const mit = dreiecke(koerper, blick);
  const w = Math.floor((BREITE - 24) / 2);
  /* `bildfeld` ist die Breite des Ausschnitts in Metern. */
  const s = w / bildfeld;
  const mx = p.dot(rechts);
  const my = p.dot(hoch);
  [true, false].forEach((mitSteg, i) => {
    const x0 = 8 + i * (w + 8);
    blatt.rechteck(x0, y0, w, h, WEISS);
    blatt.frei(x0, y0, w, h);
    const cx = x0 + w / 2 - mx * s;
    const cy = y0 + h / 2 + my * s;
    for (const t of mitSteg ? mit : dreiecke(ferse(false), blick))
      blatt.dreieck(
        t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
        umriss ? UMRISS : farbe(t.farbe),
        t.ecken
      );
  });
}

/* Reihe 1 — genau von der Seite, als Umriss: die Silhouettenfrage. */
reihe(new THREE.Vector3(1, 0, 0), 8, 440, true, 1.3);
/*
 * Reihe 2 — von schraeg aussen und oben auf die offene Schale.
 *
 * Offen schwenkt die Schale um 96,25°; ihre Trogseite zeigt dann nach oben und
 * nach aussen. Genau diese Flaeche liest sich im Vorschaubild als flache
 * Platte, und genau dort duerfte ein aufgesetzter Sockel auffallen.
 */
reihe(new THREE.Vector3(0.55, 0.75, 0.35), 456, HOEHE - 464, false, 1.3);

blatt.schreibe("docs/f5-augenkonsole.png");
console.log("docs/f5-augenkonsole.png geschrieben — links mit Steg, rechts ohne");
