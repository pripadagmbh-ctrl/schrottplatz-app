/**
 * Wächter für den Steg am Zylinderauge (`06_AUGENKONSOLE`, E-039).
 *
 * E-013 hat am 14.09.2026 die Konsole unter dem Zylinderauge abgeschafft: „Der
 * Zinken ist ein Gussstück, ein Element, kein Stempel guckt heraus." Mit der
 * Anlenkung der Traverse B verlässt das Auge den Gusskörper wieder — gemessen
 * 26 mm —, und ohne Werkstoff dazwischen schwebte die Nabe unter der Ferse.
 *
 * Der Steg ist die kleinstmögliche Antwort darauf, und diese Datei hält fest,
 * WORAN das hängt. Jede einzelne Prüfung hier ist eine Zusage an E-013:
 *
 *   1. Er liegt auf der Verbindung der beiden Naben und ist nie breiter oder
 *      höher als sie — deshalb kann er in keiner Ansicht über seinen Anschluss
 *      hinausstehen, und genau das wäre ein „Stempel".
 *   2. Er lässt beide Bohrungen frei. Ein Lagerauge, durch das kein Bolzen
 *      passt, ist kein Lagerauge. (Das war der erste Bau: Der Steg lief von
 *      Mitte zu Mitte und verschloss beide Löcher zur Hälfte.)
 *   3. Er reicht in beide Naben hinein, steht also nicht als eigenes Teil
 *      daneben.
 *   4. Er hängt am Auge, nicht am Zahn — an der Grabtiefe ändert er nichts.
 *
 * Gemessen wird über KNOTENNAMEN, nicht über Extrempunkte — der Befund vom
 * 14.09.2026 (bei einer nach innen gekrümmten Sichel ist der äußerste Punkt
 * die Rückseite) gilt an dieser Baugruppe besonders.
 *
 * Und gemessen wird an FLÄCHEN, nicht an Eckpunkten. Der erste Anlauf dieser
 * Datei prüfte den Abstand der Netzpunkte von den Bohrungen — und ließ den
 * Steg, der beide Bohrungen zur Hälfte verschließt, anstandslos durch: Der
 * Querschnitt ist ein gefastes Achteck, seine Ecken liegen bei ±58 und ±85 mm
 * von der Achse, KEINE davon in der Mitte. Die Fläche dazwischen deckt das
 * Loch trotzdem ab. Ein Wächter, der nur Ecken kennt, prüft nichts.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  AUGE_R,
  OBERE_ANBINDUNG,
  STEMPEL_AUGE,
  baueGreiferschale,
  stoffe,
} from "../src/fuenfschalen/teile";
import { baueGreiferInTeilen } from "../src/fuenfschalen/rig";

/** Die Schale allein — in ihrem Frame liegt der Bolzen im Ursprung. */
function schale(): THREE.Group {
  const g = baueGreiferschale(stoffe());
  g.updateMatrixWorld(true);
  return g;
}

/** Netzpunkte eines Knotens, im Frame der Wurzel. */
function punkte(wurzel: THREE.Object3D, name: string): THREE.Vector3[] {
  const knoten = wurzel.getObjectByName(name);
  if (!knoten) return [];
  wurzel.updateMatrixWorld(true);
  const raus: THREE.Vector3[] = [];
  knoten.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++)
      raus.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
  return raus;
}

/** Dreiecke eines Knotens, auf die Radialebene (y/z) projiziert. */
function radialDreiecke(wurzel: THREE.Object3D, name: string): Array<THREE.Vector2[]> {
  const knoten = wurzel.getObjectByName(name);
  if (!knoten) return [];
  wurzel.updateMatrixWorld(true);
  const raus: Array<THREE.Vector2[]> = [];
  const v = new THREE.Vector3();
  knoten.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const e: THREE.Vector2[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        e.push(new THREE.Vector2(v.y, v.z));
      }
      raus.push(e);
    }
  });
  return raus;
}

/** Abstand eines Punktes von einem Dreieck in der Ebene; 0, wenn er darin liegt. */
function abstandZuDreieck(p: THREE.Vector2, d: THREE.Vector2[]): number {
  const [a, b, c] = d as [THREE.Vector2, THREE.Vector2, THREE.Vector2];
  const kante = (u: THREE.Vector2, w: THREE.Vector2): number =>
    (w.x - u.x) * (p.y - u.y) - (w.y - u.y) * (p.x - u.x);
  const s1 = kante(a, b);
  const s2 = kante(b, c);
  const s3 = kante(c, a);
  if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return 0;
  let nah = Infinity;
  for (const [u, w] of [
    [a, b],
    [b, c],
    [c, a],
  ] as Array<[THREE.Vector2, THREE.Vector2]>) {
    const uw = w.clone().sub(u);
    const l2 = uw.lengthSq();
    const t = l2 < 1e-18 ? 0 : Math.max(0, Math.min(1, p.clone().sub(u).dot(uw) / l2));
    nah = Math.min(nah, p.distanceTo(u.clone().addScaledVector(uw, t)));
  }
  return nah;
}

describe("Fünfschalen — der Steg am Zylinderauge", () => {
  /* Die Achse von Nabe zu Nabe: Bolzen (0,0) → Zylinderauge. */
  const ziel = new THREE.Vector2(OBERE_ANBINDUNG.y, OBERE_ANBINDUNG.z);
  const laenge = ziel.length();
  const richtung = ziel.clone().normalize();

  it("gibt es überhaupt, und er besteht aus einem Stück", () => {
    const g = schale();
    expect(g.getObjectByName("06_AUGENKONSOLE"), "Knoten 06_AUGENKONSOLE fehlt").toBeTruthy();
    let netze = 0;
    g.traverse((n) => {
      if ((n as THREE.Mesh).isMesh && n.name === "06_AUGENKONSOLE") netze++;
    });
    expect(netze, "der Steg ist mehr als ein Netz geworden").toBe(1);
    expect(punkte(g, "06_AUGENKONSOLE").length).toBeGreaterThan(0);
  });

  it("liegt auf der Verbindung der beiden Naben und ist nie höher als sie", () => {
    /*
     * Quer zur Achse darf kein Punkt weiter hinaus als der Nabenradius. Damit
     * kann der Steg in der Seitenansicht — der Ansicht, in der die Form
     * beurteilt wird — nicht über den Nabenkreis hinausragen.
     */
    for (const p of punkte(schale(), "06_AUGENKONSOLE")) {
      const quer = Math.abs(p.y * richtung.y - p.z * richtung.x);
      expect(quer, `Steg steht ${(quer * 1000).toFixed(0)} mm quer heraus`).toBeLessThanOrEqual(
        AUGE_R + 1e-6
      );
    }
  });

  it("ist nie breiter als die Nabe, die er trägt", () => {
    /*
     * Längs der Bolzenachse. Die Nabe steht seit jeher 30 mm je Seite über den
     * Gusskörper hinaus; der Steg darf diesen Absatz heranführen, aber nicht
     * überschreiten — sonst sieht man ihn von vorn als Kragen.
     */
    const g = schale();
    const halbeNabe = Math.max(...punkte(g, "06_ZYLINDERAUGE").map((p) => Math.abs(p.x)));
    for (const p of punkte(g, "06_AUGENKONSOLE"))
      expect(Math.abs(p.x), "Steg breiter als die Nabe").toBeLessThanOrEqual(halbeNabe + 1e-6);
  });

  it("lässt beide Bohrungen frei", () => {
    /*
     * Die Bohrungen liegen auf der x-Achse: die der Lagerhülse im Ursprung
     * (Ø 84 mm), die des Zylinderauges auf `OBERE_ANBINDUNG` (Ø 64 mm).
     * Geprüft wird der Abstand jeder Stegfläche von beiden Achsen — nicht der
     * Abstand seiner Ecken, siehe Kopf dieser Datei.
     *
     * Dieser Wächter war beim ersten Bau berechtigt rot: Der Steg lief von
     * Mitte zu Mitte, und im Umriss stand statt eines Loches ein Halbmond.
     */
    const flaechen = radialDreiecke(schale(), "06_AUGENKONSOLE");
    expect(flaechen.length).toBeGreaterThan(0);
    let nahBolzen = Infinity;
    let nahAuge = Infinity;
    for (const d of flaechen) {
      nahBolzen = Math.min(nahBolzen, abstandZuDreieck(new THREE.Vector2(0, 0), d));
      nahAuge = Math.min(nahAuge, abstandZuDreieck(ziel, d));
    }
    expect(nahBolzen, "Steg greift in die Bohrung der Lagerhülse").toBeGreaterThan(0.042);
    expect(nahAuge, "Steg greift in die Bohrung des Zylinderauges").toBeGreaterThan(0.032);
  });

  it("steckt in beiden Naben, steht also nicht daneben", () => {
    /* Abstand längs der Achse: Er muss an beiden Enden unter `AUGE_R` bleiben. */
    let ab = Infinity;
    let bis = -Infinity;
    for (const p of punkte(schale(), "06_AUGENKONSOLE")) {
      const laengs = p.y * richtung.x + p.z * richtung.y;
      ab = Math.min(ab, laengs);
      bis = Math.max(bis, laengs);
    }
    expect(ab, "Steg beginnt außerhalb der Lagerhülse").toBeLessThan(AUGE_R);
    expect(laenge - bis, "Steg endet vor dem Zylinderauge").toBeLessThan(AUGE_R);
  });

  it("hängt am Auge, nicht am Zahn — die Grabtiefe rührt er nicht an", () => {
    /*
     * Gemessen am gebauten Greifer über den ganzen Öffnungsweg; der Steg dreht
     * mit der Schale mit. Die Grabtiefe des Greifers ist 2,7511 m (Knoten
     * `07_ZAHN`), der Steg bleibt gut einen Meter darüber.
     */
    /* In Einzelteilen — der Steg wird über seinen Namen gesucht (E-053). */
    const greifer = baueGreiferInTeilen(stoffe());
    let tiefster = 0;
    for (let i = 0; i <= 20; i++) {
      greifer.setOeffnung(i / 20);
      greifer.wurzel.updateMatrixWorld(true);
      for (const p of punkte(greifer.schalen[0]!.gelenk, "06_AUGENKONSOLE"))
        tiefster = Math.max(tiefster, -p.y);
    }
    expect(tiefster, `Steg reicht bis ${tiefster.toFixed(3)} m hinunter`).toBeLessThan(1.8);
    /* Und er hängt unter der Bolzenebene — dort, wo auch das Auge sitzt. */
    expect(tiefster).toBeGreaterThan(-STEMPEL_AUGE.y);
  });
});
