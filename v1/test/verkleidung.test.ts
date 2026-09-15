/**
 * Der Zylinderschutz — das Blech über der Mittelsäule des Fünfschalengreifers.
 *
 * Patrick, 15.09.2026, vor sieben Vorbildaufnahmen: „Der Kopf ist zu schlank."
 * Gebaut ist daraufhin genau EIN Teil (`08_VERKLEIDUNG`), und die härteste
 * Bedingung dieses Pakets lautet: **es trägt nichts.** Kein Kollider, kein
 * Körper, keine Masse, keine Rolle in der Kinematik. Es ist Geometrie, sonst
 * nichts.
 *
 * WARUM DAS EIN EIGENER WÄCHTER IST. Am selben Tag ist in der Presse genau der
 * umgekehrte Fall gefunden worden (E-071): eine unsichtbare Klappe, deren
 * Kollider in voller Größe stehenblieb und den Greifer aufhielt. Ein Bauteil,
 * das man nicht sieht, und eine Physik, die man nicht sieht, sind zwei
 * verschiedene Dinge — und nur eines davon fällt beim Hinsehen auf.
 *
 * JEDE ZAHLENSCHRANKE HIER HAT EINE GEGENPROBE, DIE MELDEN MUSS.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { MASS, STEMPEL_AUGE, TRAVERSE_Y, stoffe } from "../src/fuenfschalen/teile";
import { baueGreifer, baueGreiferInTeilen } from "../src/fuenfschalen/rig";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { freigang, zaehlen } from "../tools/fuenfschalen/verkleidung-messen";

describe("Der Zylinderschutz — Geometrie, sonst nichts", () => {
  it("hängt am KOPF, nicht an den Schalen", () => {
    const g = baueGreiferInTeilen(stoffe());
    const hut = g.traverse.getObjectByName("08_ZYLINDERSCHUTZ");
    expect(hut, "die Verkleidung hängt nicht an der Mitteltraverse").toBeTruthy();
    /*
     * GEGENPROBE: Sie darf an keiner Schale und an keinem Zylinder hängen —
     * sonst schwenkte sie beim Schließen mit. Ohne diese Zeile prüfte die
     * darüber nur, dass irgendwo ein Knoten dieses Namens existiert.
     */
    for (const s of g.schalen) expect(s.gelenk.getObjectByName("08_ZYLINDERSCHUTZ")).toBeFalsy();
    for (const z of g.zylinder) expect(z.gelenk.getObjectByName("08_ZYLINDERSCHUTZ")).toBeFalsy();
  });

  it("kostet KEIN Netz — sie wird ins Blech des Kopfes eingeschmolzen", () => {
    /*
     * Der Engpass sind Netze, nicht Dreiecke (E-025, gemessen auf Patricks
     * Gerät). Die Verkleidung ist aus `st.blech`, und die Mitteltraverse trägt
     * schon Blech (die zehn Sitzringe) — beim Zusammenlegen fällt sie also in
     * ein vorhandenes Netz.
     */
    const zusammen = zaehlen(baueGreifer(stoffe()).wurzel);
    expect(zusammen.netze, "der Greifer muss bei 58 Netzen bleiben").toBe(58);
    let eigenes = false;
    baueGreifer(stoffe()).wurzel.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name.includes("VERKLEIDUNG")) eigenes = true;
    });
    expect(eigenes, "die Verkleidung hat ein eigenes Netz behalten").toBe(false);
    /*
     * GEGENPROBE: In EINZELTEILEN ist sie sehr wohl ein eigenes Netz — 218
     * statt 217. Wäre auch das gleich, hätte der Test oben gar kein Teil
     * gemessen.
     */
    expect(zaehlen(baueGreiferInTeilen(stoffe()).wurzel).netze).toBe(218);
  });

  it("nimmt ihre Maße aus Traverse und Stempel, nicht aus der Luft", () => {
    const g = baueGreiferInTeilen(stoffe());
    const hut = g.traverse.getObjectByName("08_ZYLINDERSCHUTZ")!;
    g.wurzel.updateMatrixWorld(true);
    let oben = -Infinity;
    let unten = Infinity;
    let rOben = 0;
    const p = new THREE.Vector3();
    hut.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const a = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        p.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
        oben = Math.max(oben, p.y);
        unten = Math.min(unten, p.y);
        if (p.y > -1.02) rOben = Math.max(rOben, Math.hypot(p.x, p.z));
      }
    });
    /* Oben genau der untere Rand des Traversenkörpers … */
    expect(oben).toBeCloseTo(TRAVERSE_Y - (MASS.traverse.hoehe * 0.75) / 2, 6);
    /* … unten genau der obere Rand des Stempels. */
    expect(unten).toBeCloseTo(STEMPEL_AUGE.y + MASS.stempel.hoehe, 6);
    /* Und sie ragt nirgends über die Traverse hinaus — sie ist keine breite Platte. */
    expect(rOben).toBeLessThanOrEqual(MASS.traverse.breite / 2 + 1e-9);
    /*
     * GEGENPROBE: Sie deckt wirklich eine Strecke ab, keinen Punkt. Wären oben
     * und unten gleich, gingen die drei Zeilen darüber trivial durch.
     */
    expect(oben - unten).toBeGreaterThan(0.2);
  });

  it("ragt über den ganzen Schließweg in keine Schale und keinen Zylinder", () => {
    /*
     * Punkte der Verkleidung gegen DREIECKE der Anlenkung, 21 Stellungen. Nicht
     * Eckpunkt gegen Eckpunkt: Ein Zylinderrohr hat zwischen seinen Enden keine
     * Eckpunkte, und eine Messung, die nur Ecken kennt, sieht seine Flanke
     * nicht — derselbe Fehler, an dem die Kastenmessung von E-065 gescheitert
     * ist.
     */
    const f = freigang(11);
    expect(f.abstand, "die Verkleidung kommt der Anlenkung zu nah").toBeGreaterThan(0.03);
    /*
     * GEGENPROBE: Die Messung ist nicht blind — sie findet überhaupt etwas und
     * meldet einen endlichen Abstand, keine Unendlichkeit.
     */
    expect(Number.isFinite(f.abstand)).toBe(true);
    expect(f.abstand).toBeLessThan(0.5);
  });
});

describe("Der Zylinderschutz — er trägt nichts", () => {
  let bagger: Excavator;
  let welt: RAPIER.World;

  beforeAll(async () => {
    leinwandAttrappe();
    await initPhysics();
    welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    bagger = new Excavator(new THREE.Scene(), welt);
    bagger.setGreifer(FUENFSCHALEN);
  });

  it("hängt keinen einzigen Kollider an den Greiferkörper", () => {
    /*
     * DAS IST DER WÄCHTER, DEN E-071 GEKOSTET HAT. Dort blieb der Kollider
     * einer unsichtbaren Klappe in voller Größe stehen und hielt den Greifer
     * auf. Was am Greifer Physik hat, sind die Krallen und die Fühlkugel —
     * beide kommen aus der FORM (`form.punkt`, `form.sensorSitz`), nicht aus
     * einem Netz. Ein Blech, das sich einen Kollider zulegt, fällt hier auf.
     */
    const vorher = bagger.grappleBody.numColliders();
    /*
     * ELF, und zwar nachgezählt: EIN Zylinder für den Greiferkörper selbst
     * (`ColliderDesc.cylinder(0.22, 0.5)` in `excavator.ts`) und ZEHN
     * Krallenkapseln — `form.schalen · KOLLIDER_REIHEN · 2` mit fünf Schalen.
     * Kein zwölfter. Ein Blech, das sich einen Kollider zulegt, fällt hier auf.
     */
    expect(vorher, "am Greiferkörper hängen andere Kollider als erwartet").toBe(11);
    expect((vorher - 1) % FUENFSCHALEN.schalen, "die zehn gehören zu den fünf Schalen").toBe(0);
    /*
     * GEGENPROBE, die MELDEN MUSS: Ein versehentlich angelegtes Blech-Kollider
     * wird gezählt. Ohne sie prüfte die Zeile darüber nur, dass die Zahl
     * konstant ist — und genau das war der Fehler in der Presse.
     */
    const versehen = welt.createCollider(
      RAPIER.ColliderDesc.cylinder(0.13, 0.41),
      bagger.grappleBody
    );
    expect(bagger.grappleBody.numColliders()).toBe(vorher + 1);
    welt.removeCollider(versehen, false);
    expect(bagger.grappleBody.numColliders()).toBe(vorher);
  });

  it("lässt jede Zahl der Form unverändert", () => {
    /*
     * Die Form ist der einzige Weg vom Greifer zur Physik: Bodenanschlag,
     * Greiffenster, Krallenkollider und Fühlkugel lesen ausschließlich sie.
     * Die Zahlen stehen hier als ABSOLUTE Werte aus E-069 und E-065, nicht als
     * „wie vorher" — ein Wächter, der sich selbst als Maßstab nimmt, misst nichts.
     */
    expect(FUENFSCHALEN.maxTiefe).toBeCloseTo(2.7071, 3);
    expect(FUENFSCHALEN.schalenluecke).toBeCloseTo(0.5954, 3);
    expect(FUENFSCHALEN.kolliderRadius).toBeCloseTo(SICHELKRALLE.kolliderRadius, 9);
    /* Die Tiefe über den ganzen Schließweg, nicht nur an den Enden. */
    for (let i = 0; i <= 10; i++) {
      const w = FUENFSCHALEN.zu + ((FUENFSCHALEN.offen - FUENFSCHALEN.zu) * i) / 10;
      expect(FUENFSCHALEN.tiefe(w)).toBeGreaterThan(0);
      expect(FUENFSCHALEN.tiefe(w)).toBeLessThanOrEqual(FUENFSCHALEN.maxTiefe + 1e-9);
    }
    /*
     * GEGENPROBE: Die Verkleidung liegt weit über dem tiefsten Punkt — sie
     * KÖNNTE `maxTiefe` gar nicht setzen, selbst wenn sie mitgemessen würde.
     * Damit ist die Zeile oben kein Zufall, sondern eine Eigenschaft.
     */
    const hutUnten = -(STEMPEL_AUGE.y + MASS.stempel.hoehe);
    expect(hutUnten).toBeLessThan(FUENFSCHALEN.maxTiefe - 1.0);
  });
});
