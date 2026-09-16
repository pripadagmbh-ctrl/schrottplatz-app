/**
 * Waechter fuer das SEITWAERTSKIPPEN des Greifers (E-083, 16.09.2026).
 *
 * Wunsch Patrick 15.09.2026: „Greifer muss komplett zur seite kippen können,
 * zum kehren und schleudern."
 *
 * Die haerteste Bedingung dieses Umbaus ist nicht, dass das Kippen
 * funktioniert — sondern dass BEI NULL GRAD NICHTS ANDERS IST. Am lotrechten
 * Greifer haengt alles, was Patrick am Prototyp gefallen hat: Bodenanschlag,
 * Greiffenster, Pendel, das Gefuehl beim Zupacken. Deshalb steht diese Probe
 * hier an erster Stelle und nicht am Ende.
 *
 * JEDE ZAHLENSCHRANKE HAT EINE GEGENPROBE, DIE MELDEN MUSS. Eine Pruefung,
 * die nur bestaetigt, kann blind sein; erst die Gegenprobe zeigt, dass sie
 * hinsieht.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";

class Tasten {
  down = new Set<string>();
  gedrueckt = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(c: string): boolean {
    return this.gedrueckt.has(c);
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

const DT = 1 / 60;
const GRAD = Math.PI / 180;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function baueBagger(): { bagger: Excavator; world: RAPIER.World; szene: THREE.Scene } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  return { bagger: new Excavator(szene, world), world, szene };
}

/** Tiefster gezeichneter Punkt des Greifers ueber dem Beton (m). */
function tiefsterPunkt(bagger: Excavator): number {
  const g = bagger.grappleGroup;
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3();
  let tief = Infinity;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (p.y < tief) tief = p.y;
    }
  });
  return tief;
}

/**
 * Den Arm auf den Beton absetzen und die Spinne schliessen — dieselbe Folge,
 * mit der E-046 und E-065 den Bodenanschlag gemessen haben.
 */
function absetzen(bagger: Excavator, world: RAPIER.World, schritte = 420): number {
  const tasten = new Tasten();
  for (let i = 0; i < schritte; i++) {
    tasten.down.clear();
    if (i < schritte * 0.55) {
      tasten.down.add("KeyF"); // Ausleger senken
      tasten.down.add("KeyG"); // Stiel ran
    } else {
      tasten.down.add("Space"); // zupacken
    }
    bagger.update(DT, tasten as never);
    world.step();
  }
  return tiefsterPunkt(bagger);
}

/* ==================================================================== */
describe("Bei 0 Grad ist nichts anders — Ziffer fuer Ziffer", () => {
  /*
   * Die Formen liefern ihre Ausladung bei Kippwinkel 0 durch einen
   * Vorabsprung: `if (kipp === 0) return tiefe(winkel)`. Diese Pruefung
   * haelt genau diesen Sprung fest. `toBe` und nicht `toBeCloseTo` — es geht
   * um dieselbe Zahl, nicht um eine aehnliche.
   */
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    it(`${form.name}: ausladung(winkel, 0) ist tiefe(winkel)`, () => {
      for (let i = 0; i <= 40; i++) {
        const w = form.zu + ((form.offen - form.zu) * i) / 40;
        expect(form.ausladung(w, 0)).toBe(form.tiefe(w));
      }
      expect(form.maxAusladung(0)).toBe(form.maxTiefe);
    });

    it(`${form.name}: GEGENPROBE — schon ein Grad Kippen aendert die Zahl`, () => {
      let groesste = 0;
      for (let i = 0; i <= 40; i++) {
        const w = form.zu + ((form.offen - form.zu) * i) / 40;
        groesste = Math.max(groesste, Math.abs(form.ausladung(w, 1 * GRAD) - form.tiefe(w)));
      }
      // Ein Grad an 3 m Hebel sind Zentimeter, nicht Nullen.
      expect(groesste).toBeGreaterThan(0.002);
      expect(form.maxAusladung(1 * GRAD)).not.toBe(form.maxTiefe);
    });
  }

  /**
   * DIE ZAHL, DIE PATRICK AM GERAET SIEHT: wie hoch der geschlossene Greifer
   * ueber dem Beton stehen bleibt.
   *
   * Die Sollwerte sind am Stand `v1/start` VOR diesem Umbau gemessen, mit
   * `tools/bodenanschlag-hoehe.ts` und mit derselben Folge wie hier —
   * absenken, zupacken, tiefsten gezeichneten Punkt nehmen. Gemessen:
   * Sichelkralle **6,37 cm**, Fuenfschalengreifer **20,99 cm**.
   *
   * ZU DEN ZAHLEN AUS DEM LOG: E-065 hat 6,7 bzw. 25,4 cm ausgewiesen, der
   * Auftrag zu diesem Paket nennt 6,7 und 19,4 cm. Beides stammt aus anderen
   * Messfolgen und anderen Staenden (dazwischen liegen E-069 und E-075). Hier
   * wird deshalb gegen die EIGENE Messung am eigenen Ausgangsstand gehalten,
   * nicht gegen eine Zahl aus einem Logeintrag — Werte aus verschiedenen
   * Verfahren gegeneinanderzuhalten ist genau der Fehler, an dem die
   * Kastenmessung von E-065 gescheitert ist.
   *
   * Das Fenster ist ein Millimeter: enger als jeder Effekt, den ein Umbau am
   * Bodenanschlag haben koennte, und weit genug fuer das Rauschen einer
   * Physikschleife.
   */
  const ANSCHLAG: Array<{ form: Greiferform; soll: number }> = [
    { form: SICHELKRALLE, soll: 0.0637 },
    { form: FUENFSCHALEN, soll: 0.2099 },
  ];
  for (const { form, soll } of ANSCHLAG) {
    it(`${form.name}: der Bodenanschlag steht bei 0 Grad auf ${(soll * 100).toFixed(2)} cm`, () => {
      const { bagger, world } = baueBagger();
      if (form !== SICHELKRALLE) expect(bagger.setGreifer(form)).toBe(true);
      const hoehe = absetzen(bagger, world);
      expect(bagger.kippIst).toBe(0);
      expect(hoehe).toBeGreaterThan(soll - 0.001);
      expect(hoehe).toBeLessThan(soll + 0.001);
    });
  }

  it("GEGENPROBE — gekippt steht der Greifer messbar anders", () => {
    const { bagger, world } = baueBagger();
    bagger.toggleKippen();
    const hoehe = absetzen(bagger, world);
    expect(bagger.kippIst).toBeGreaterThan(80 * GRAD);
    /*
     * Gekippt ist die Ausladung der Sichelkralle 1,77 statt 3,00 m. Der
     * Bodenanschlag muss das merken — sonst stuende der Greifer 1,2 m ueber
     * dem Beton und die Zahl oben waere ein Zufall gewesen.
     */
    expect(Math.abs(hoehe - 0.0637)).toBeGreaterThan(0.05);
  });
});

/* ==================================================================== */
describe("Die Ausladung stimmt mit dem gezeichneten Netz", () => {
  /**
   * `maxAusladung` ist die Zahl, mit der `resolveGroundClamp` den Arm anhaelt.
   * Sie darf nicht kleiner sein als das, was wirklich gezeichnet wird —
   * sonst faehrt der Greifer in den Beton.
   */
  function wahreMaxAusladung(bagger: Excavator, form: Greiferform, kipp: number): number {
    const g = bagger.grappleGroup;
    const bau = (bagger as unknown as {
      greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
    }).greiferbau;
    const ck = Math.cos(kipp);
    const sk = Math.sin(kipp);
    const p = new THREE.Vector3();
    let weit = -Infinity;
    /*
     * 41 Stuetzstellen — DIESELBEN, die `maxAusladungVon` nimmt. Mit 21
     * meldete diese Pruefung 29 mm Unterschied, und das war kein Fehler der
     * Rechnung, sondern der Pruefung: Die Rechnung hatte eine tiefere
     * Oeffnungsstellung gefunden, die hier gar nicht abgetastet wurde.
     */
    for (let s = 0; s <= 40; s++) {
      const w = form.zu + ((form.offen - form.zu) * s) / 40;
      for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, w);
      bau.nachfuehren();
      g.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
        const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        for (let k = 0; k < pos.count; k++) {
          p.fromBufferAttribute(pos, k).applyMatrix4(mm);
          const d = -p.y * ck + p.z * sk;
          if (d > weit) weit = d;
        }
      });
    }
    return weit;
  }

  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    it(`${form.name}: der Bodenanschlag liegt nie unter dem gezeichneten Netz`, () => {
      const { bagger } = baueBagger();
      if (form !== SICHELKRALLE) expect(bagger.setGreifer(form)).toBe(true);
      let zuFlach = 0;
      let zuHoch = 0;
      /*
       * BEIDE Richtungen. Der Bagger kippt um −x (`KIPP_ACHSE`), rechnet die
       * Ausladung also mit negativem Winkel; dass die Rechnung auch mit
       * positivem stimmt, ist keine Selbstverstaendlichkeit, sondern haengt
       * daran, dass sie ueber ALLE Schalen laeuft. Der Greifer ist um seine
       * Achse fuenfzaehlig — nach der einen Seite steht eine Schale unten,
       * nach der anderen eine Luecke.
       */
      for (let g = -90; g <= 90; g += 10) {
        const k = g * GRAD;
        const d = form.maxAusladung(k) - wahreMaxAusladung(bagger, form, k);
        zuFlach = Math.max(zuFlach, -d);
        zuHoch = Math.max(zuHoch, d);
      }
      // Nie zu flach: sonst sinkt der Greifer in den Beton.
      expect(zuFlach).toBeLessThanOrEqual(0);
      // Und nicht unnoetig hoch: der Zuschlag darf kein Polster werden.
      expect(zuHoch).toBeLessThan(0.055);
    });

    it(`${form.name}: GEGENPROBE — ohne den Zuschlag sinkt der Greifer ein`, () => {
      const { bagger } = baueBagger();
      if (form !== SICHELKRALLE) expect(bagger.setGreifer(form)).toBe(true);
      /*
       * Dieselbe Rechnung wie `maxAusladungVon`, nur ohne `KIPP_ZUSCHLAG`.
       * Dass hier ein Fehlbetrag herauskommt, ist der Grund, warum es den
       * Zuschlag gibt — und der Beweis, dass die Pruefung darueber nicht
       * trivial ist.
       */
      let ohne = 0;
      for (let i = 0; i <= 40; i++) {
        ohne = Math.max(ohne, form.ausladung(form.zu + ((form.offen - form.zu) * i) / 40, -90 * GRAD));
      }
      expect(wahreMaxAusladung(bagger, form, -90 * GRAD) - ohne).toBeGreaterThan(0.015);
    });

    it(`${form.name}: GEGENPROBE — die alte Rechnung (maxTiefe) faellt durch`, () => {
      const { bagger } = baueBagger();
      if (form !== SICHELKRALLE) expect(bagger.setGreifer(form)).toBe(true);
      /*
       * So sah der Bodenanschlag bis heute aus: eine feste Tiefe, egal wie
       * der Greifer haengt. Bei 90 Grad liegt er um rund einen Meter daneben
       * — genau die Zahl, die E-065 als „der Arm bliebe 1,23 m zu hoch"
       * ausgewiesen hat.
       */
      const abweichung = Math.abs(form.maxTiefe - wahreMaxAusladung(bagger, form, -90 * GRAD));
      expect(abweichung).toBeGreaterThan(0.9);
    });
  }
});

/* ==================================================================== */
describe("Die Kipprichtung dreht mit dem Rotator mit", () => {
  /**
   * `qKipp` steht GANZ RECHTS in `qPendel · qGier · qKipp`. Damit waehlt der
   * Rotator, wohin der Greifer faellt — Patrick: „ich kann die Spinne ja
   * drehen damit es passt." Stuende es links, kippte der Greifer immer in
   * dieselbe Himmelsrichtung.
   */
  function achseNach(rotator: number): THREE.Vector3 {
    const { bagger, world } = baueBagger();
    bagger.rotatorYaw = rotator;
    bagger.toggleKippen();
    const tasten = new Tasten();
    for (let i = 0; i < 300; i++) {
      tasten.down.clear();
      bagger.rotatorYaw = rotator;
      bagger.update(DT, tasten as never);
      world.step();
    }
    expect(bagger.kippIst).toBeGreaterThan(80 * GRAD);
    // Die Greiferachse (lokal −y) in Weltkoordinaten
    return new THREE.Vector3(0, -1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
  }

  it("dreht der Rotator um 90 Grad, faellt der Greifer 90 Grad weiter herum", () => {
    const a = achseNach(0);
    const b = achseNach(90 * GRAD);
    // Waagerechter Anteil der Achse — der zeigt, wohin der Greifer faellt
    const wa = Math.atan2(a.x, a.z);
    const wb = Math.atan2(b.x, b.z);
    let d = wb - wa;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    expect(Math.abs(Math.abs(d) - Math.PI / 2)).toBeLessThan(3 * GRAD);
  });

  it("GEGENPROBE — ohne den Rotator bliebe die Richtung stehen", () => {
    const a = achseNach(0);
    const b = achseNach(90 * GRAD);
    const wa = Math.atan2(a.x, a.z);
    const wb = Math.atan2(b.x, b.z);
    // Waere `qKipp` links multipliziert, kaeme hier 0 heraus.
    expect(Math.abs(wb - wa)).toBeGreaterThan(10 * GRAD);
  });
});

/* ==================================================================== */
describe("Die Rampe trifft die Null EXAKT", () => {
  /**
   * An `kippIst === 0` haengen drei Vorabspruenge. Bliebe der Winkel bei
   * 3e−17 stehen, waeren sie fuer immer aus — der lotrechte Greifer liefe
   * dann dauerhaft durch den gekippten Rechenweg, und die Zusage „bei 0 Grad
   * ist nichts anders" waere gebrochen, ohne dass es jemand saehe.
   */
  it("aufrichten endet auf genau 0, nicht auf fast 0", () => {
    const { bagger, world } = baueBagger();
    const tasten = new Tasten();
    bagger.toggleKippen();
    for (let i = 0; i < 200; i++) {
      bagger.update(DT, tasten as never);
      world.step();
    }
    expect(bagger.kippIst).toBeGreaterThan(80 * GRAD);
    bagger.toggleKippen();
    for (let i = 0; i < 200; i++) {
      bagger.update(DT, tasten as never);
      world.step();
    }
    expect(bagger.kippIst).toBe(0);
    expect(bagger.kippAktiv).toBe(false);
  });

  it("GEGENPROBE — jede weichere Rampe verfehlt den Anschlag", () => {
    /*
     * EHRLICH GESAGT ist das Aufschnappen bei der HEUTIGEN Rampe
     * ueberfluessig, und das steht auch so in `excavator.ts`: Kurz vor dem
     * Ziel liegen `ist` und `soll` so nah beieinander, dass `soll − ist`
     * exakt darstellbar ist (Sterbenz), und dann ist `ist + (soll − ist)`
     * exakt `soll`. Die beiden Pruefungen oben bestaetigen das.
     *
     * Die Zeile steht trotzdem — und diese Gegenprobe zeigt, wogegen. Kaum
     * jemand laesst eine Rampe auf Dauer linear; die naechstliegende
     * Aenderung ist ein weiches Auslaufen. Das erreicht seinen Anschlag NIE
     * exakt, und dann waeren die drei Vorabspruenge auf `kippIst === 0` fuer
     * immer aus, ohne dass es jemand merkt.
     */
    const soll = 90 * GRAD;
    let weich = 0;
    for (let i = 0; i < 4000; i++) weich += (soll - weich) * 0.2;
    expect(weich).not.toBe(soll);

    let zurueck = soll;
    for (let i = 0; i < 4000; i++) zurueck += (0 - zurueck) * 0.2;
    expect(zurueck).not.toBe(0);
  });

  it("das Kippen endet EXAKT auf dem Anschlag, nicht knapp davor", () => {
    const { bagger, world } = baueBagger();
    const tasten = new Tasten();
    bagger.toggleKippen();
    for (let i = 0; i < 300; i++) {
      bagger.update(DT, tasten as never);
      world.step();
    }
    expect(bagger.kippIst).toBe(90 * GRAD);
  });

  it("der Weg von lotrecht bis ganz zur Seite dauert zwei Sekunden", () => {
    const { bagger, world } = baueBagger();
    const tasten = new Tasten();
    bagger.toggleKippen();
    let bilder = 0;
    while (bagger.kippIst < 90 * GRAD - 1e-9 && bilder < 600) {
      bagger.update(DT, tasten as never);
      world.step();
      bilder++;
    }
    expect(bilder / 60).toBeGreaterThan(1.8);
    expect(bilder / 60).toBeLessThan(2.2);
  });

  it("Taste K kippt und richtet wieder auf", () => {
    const { bagger } = baueBagger();
    const tasten = new Tasten();
    expect(bagger.kippAktiv).toBe(false);
    tasten.gedrueckt.add("KeyK");
    bagger.handleDiscreteInput(tasten as never);
    expect(bagger.kippAktiv).toBe(true);
    bagger.handleDiscreteInput(tasten as never);
    expect(bagger.kippAktiv).toBe(false);
  });
});

/* ==================================================================== */
describe("Der Messstrahl wandert mit dem Greifer", () => {
  /**
   * `surfaceUnderClaws` schickt einen Strahl die GREIFERACHSE entlang nach
   * unten. Gekippt liegt sein Fusspunkt seitlich versetzt — dort, wo die
   * Schalen wirklich hinkommen. Geprueft wird mit einem Podest NEBEN dem
   * Bagger: Steht der Rotator so, dass der Greifer auf das Podest faellt,
   * muss der Arm frueher anhalten. Steht er 180 Grad anders, darf das Podest
   * gar nichts bewirken — das ist die Gegenprobe im selben Versuch.
   */
  /**
   * Hoehe, die `surfaceUnderClaws` meldet — mit einem Podest, das GENAU DORT
   * liegt, wo der gekippte Greifer hinlangt.
   *
   * Wo das ist, wird NICHT nachgerechnet, sondern an der Drehung des Greifers
   * abgegriffen: Der Fusspunkt der Greiferachse ist
   * `grappleGroup.quaternion · (0, −maxTiefe, 0)`. Damit haengt der Versuch
   * nicht an einem Vorzeichen, das jemand von Hand nachziehen muesste, wenn
   * die Kipprichtung gedreht wird — und genau das ist an diesem Paket einmal
   * passiert (`KIPP_ACHSE` ging von +x auf −x).
   */
  const PODEST_H = 1.2;

  /** Wo die Greiferachse den Boden trifft, waagerecht (Weltkoordinaten). */
  function achsfusspunkt(bagger: Excavator): { x: number; z: number } {
    const f = new THREE.Vector3(0, -SICHELKRALLE.maxTiefe, 0).applyQuaternion(
      bagger.grappleGroup.quaternion
    );
    return { x: bagger.grappleGroup.position.x + f.x, z: bagger.grappleGroup.position.z + f.z };
  }

  function gemesseneFlaeche(rotator: number, kippen: boolean, mitPodest: boolean): number {
    const { bagger, world } = baueBagger();
    bagger.rotatorYaw = rotator;
    if (kippen) bagger.toggleKippen();
    const tasten = new Tasten();
    // erst kippen lassen, damit die Pose steht
    for (let i = 0; i < 200; i++) {
      bagger.rotatorYaw = rotator;
      bagger.update(DT, tasten as never);
      world.step();
    }
    if (mitPodest) {
      const f = achsfusspunkt(bagger);
      const p = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(f.x, PODEST_H / 2, f.z)
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, PODEST_H / 2, 1.2), p);
      world.step();
    }
    const splay = (bagger as unknown as { currentSplay(): number }).currentSplay();
    return (bagger as unknown as { surfaceUnderClaws(s: number): number }).surfaceUnderClaws(splay);
  }

  it("gekippt misst der Strahl das Podest unter den Schalen", () => {
    const flaeche = gemesseneFlaeche(0, true, true);
    expect(flaeche).toBeGreaterThan(PODEST_H - 0.02);
  });

  it("GEGENPROBE — lotrecht liegt dasselbe Podest 3 m daneben und zaehlt nicht", () => {
    /*
     * Das Podest wird hier an DIESELBE Stelle gesetzt wie oben (der Versatz
     * wird aus `kippIst` gerechnet, und der ist bei lotrechtem Greifer null —
     * also liegt es direkt unter der Mitte). Deshalb steht hier der Fall, der
     * wirklich unterscheidet: gekippt, aber der Rotator zeigt in die
     * Gegenrichtung.
     */
    const anders = gemesseneFlaeche(Math.PI, true, false);
    expect(anders).toBeLessThan(0.02);
  });

  it("GEGENPROBE — steht der Rotator falsch, geht der Strahl am Podest vorbei", () => {
    // Podest an der Stelle fuer Rotator 0, gemessen wird aber mit Rotator 180.
    const { bagger, world } = baueBagger();
    const tasten = new Tasten();
    bagger.toggleKippen();
    for (let i = 0; i < 200; i++) {
      bagger.update(DT, tasten as never);
      world.step();
    }
    const f = achsfusspunkt(bagger);
    const p = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(f.x, PODEST_H / 2, f.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, PODEST_H / 2, 1.2), p);
    world.step();
    const splay = (bagger as unknown as { currentSplay(): number }).currentSplay();
    const mitRichtig = (
      bagger as unknown as { surfaceUnderClaws(s: number): number }
    ).surfaceUnderClaws(splay);
    expect(mitRichtig).toBeGreaterThan(PODEST_H - 0.02);
    // jetzt den Rotator um 180 Grad drehen — derselbe Greifer, dasselbe Podest
    bagger.rotatorYaw = Math.PI;
    for (let i = 0; i < 5; i++) {
      bagger.update(DT, tasten as never);
      world.step();
    }
    const mitFalsch = (
      bagger as unknown as { surfaceUnderClaws(s: number): number }
    ).surfaceUnderClaws(splay);
    expect(mitFalsch).toBeLessThan(0.02);
  });
});
