import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildPerson, type PersonParts } from "./people";
import { GATE_X, WEIGH_Z } from "./yard";
import { BUERO_TUER, OFFICE_FRONT_X, OFFICE_Z } from "./office";
import type { Box } from "./boxen";
import { hitsObstacle } from "./obstacles";

/**
 * Die Streifenwagen-Kontrolle (Wunsch 11.09.2026).
 *
 * Zwischendurch kommt die Polizei vorbei. Ohne Folgen — es geht um das
 * Gefühl, dass der Platz beobachtet wird, nicht um eine Strafe. Der Ablauf
 * ist immer derselbe:
 *
 *   1. Der Wagen fährt durchs Tor und hält vor dem Büro.
 *   2. Beide Beamten steigen aus und gehen kurz hinein.
 *   3. Sie kommen zurück, das Blaulicht geht an — ohne Sirene — und sie
 *      fahren den Platz einmal ab.
 *   4. Einer steigt beim Bagger aus, redet mit dem Fahrer, steigt wieder ein.
 *   5. Abfahrt durchs Tor.
 *
 * Der Wortführer ist Tristan Schädmeister, gebürtiger Liechtensteiner,
 * gutaussehend, mit Fernglas und Taschenlampe.
 */

/** Wie lange bis zur ersten Kontrolle (s) */
const ERSTE_KONTROLLE_S = 240;
/** Abstand zwischen zwei Kontrollen (s) */
const ABSTAND_S: [number, number] = [300, 540];
/** Fahrtempo des Streifenwagens (m/s) — er hat es nicht eilig */
const TEMPO = 5.0;
/** So lange sind die beiden im Büro */
const BUERO_S = 12;
/** So lange redet Tristan mit dem Baggerfahrer */
const GESPRAECH_S = 9;
/** Gehtempo der Beamten (m/s) */
const GEH_TEMPO = 1.6;
/** Blinktakt des Blaulichts (s je Wechsel) */
const BLINK_S = 0.28;

/** Halteplatz vor dem Büro */
const BUERO_HALT = new THREE.Vector3(OFFICE_FRONT_X + 4.5, 0, OFFICE_Z - 1.5);

/**
 * Rundfahrt über den Platz. Die Punkte liegen bewusst auf freier Fläche —
 * geprüft in `test/police.test.ts` gegen die Hindernisliste, damit der Wagen
 * nicht durch Mulden oder die Presse fährt.
 */
/*
 * Rundfahrt nach der neuen Platzordnung (12.09.2026). Sie laeuft aussen
 * herum: Der Betrieb sitzt jetzt im Sueden, und ein Streifenwagen hat weder
 * in der Muldenreihe noch zwischen Presse und Halde etwas zu suchen.
 */
const RUNDE: Array<[number, number]> = [
  [-24, 20],
  [-16, 16],
  [-8, 10],
  [-2, 2],
  [-4, -4],
  [-9, -4],
  [-16, -4],
  [-24, -6],
  [-30, 2],
  [-28, 12],
];

/**
 * Halteplätze beim Bagger, relativ zu seiner Position — der erste freie
 * gewinnt. Nach Osten stehen die Mulden, nach Westen der Stahlhaufen.
 */
export const HALT_KANDIDATEN: Array<[number, number]> = [
  [11.0, 10.0],
  [8.0, 14.0],
  [-14.0, 12.0],
  [4.0, 18.0],
];

/** Einfahrt und Ausfahrt am Tor */
const TOR_AUSSEN: [number, number] = [GATE_X, 40];
const TOR_INNEN: [number, number] = [GATE_X, WEIGH_Z - 2];

type Phase =
  | "weg"
  | "anfahrt"
  | "zumBuero"
  | "aussteigenBuero"
  | "imBuero"
  | "zurueckZumWagen"
  | "runde"
  | "zumBagger"
  | "gespraech"
  | "zurueckVomBagger"
  | "abfahrt";

export class Police {
  private group = new THREE.Group();
  private blau: THREE.Mesh[] = [];
  private raeder: THREE.Mesh[] = [];
  private tristan: PersonParts;
  private partner: PersonParts;
  private phase: Phase = "weg";
  private t = 0;
  private naechste = ERSTE_KONTROLLE_S;
  private weg: Array<[number, number]> = [];
  private wegIdx = 0;
  private blink = 0;
  private zielFuss = new THREE.Vector3();
  private startFuss = new THREE.Vector3();
  private body: RAPIER.RigidBody | null = null;
  private readonly quat = new THREE.Quaternion();

  /** Funksprüche und Ansagen fürs HUD. */
  onFunk: ((text: string) => void) | null = null;
  /** Wo der Bagger steht — dort wird angehalten und geredet. */
  getExcavatorPos: (() => THREE.Vector3) | null = null;

  /**
   * @param world Ohne Physikwelt bleibt der Wagen ein Bild; mit ihr schiebt
   *   er liegenden Schrott beiseite, genau wie ein LKW. Ein Streifenwagen,
   *   der durch einen Motorblock faehrt, faellt sofort auf.
   */
  constructor(scene: THREE.Scene, world?: RAPIER.World) {
    this.buildWagen();
    if (world) {
      this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.95, 0.62, 2.3).setTranslation(0, 0.72, 0),
        this.body
      );
    }
    this.tristan = buildPerson({ shirt: 0x1f3a63, trousers: 0x23272b, hair: 0x2b2117 });
    this.partner = buildPerson({ shirt: 0x1f3a63, trousers: 0x23272b, hair: 0x6a6257 });
    // Tristan trägt Fernglas und Taschenlampe — daran erkennt man ihn
    const leder = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.9 });
    const glas = new THREE.MeshStandardMaterial({
      color: 0x2b3a44,
      roughness: 0.25,
      metalness: 0.6,
    });
    const fernglas = new THREE.Group();
    for (const dx of [-0.05, 0.05]) {
      const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.16, 8), glas);
      rohr.rotation.x = Math.PI / 2;
      rohr.position.set(dx, 0, 0);
      fernglas.add(rohr);
    }
    fernglas.position.set(0, 1.16, 0.13); // hängt vor der Brust
    this.tristan.group.add(fernglas);
    const gurt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), leder);
    gurt.position.set(0, 0.92, 0);
    this.tristan.group.add(gurt);
    const lampe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.2, 8), leder);
    lampe.position.set(0.17, 0.86, 0.04);
    lampe.rotation.x = 0.2;
    this.tristan.group.add(lampe);

    for (const p of [this.tristan, this.partner]) {
      p.group.visible = false;
      scene.add(p.group);
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Streifenwagen: silbern mit blauem Streifen, Balken auf dem Dach. */
  private buildWagen(): void {
    const lack = new THREE.MeshStandardMaterial({
      color: 0xd9dde0,
      roughness: 0.35,
      metalness: 0.35,
    });
    const blauLack = new THREE.MeshStandardMaterial({ color: 0x1436a4, roughness: 0.5 });
    const dunkel = new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 0.85 });
    const scheibe = new THREE.MeshStandardMaterial({
      color: 0x9fc4d4,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
    });

    const L = 4.6;
    const B = 1.85;
    const korpus = new THREE.Mesh(new THREE.BoxGeometry(B, 0.72, L), lack);
    korpus.position.y = 0.78;
    korpus.castShadow = true;
    this.group.add(korpus);
    // Blauer Streifen auf halber Höhe — der macht den Wagen erkennbar
    const streifen = new THREE.Mesh(new THREE.BoxGeometry(B + 0.03, 0.22, L - 0.4), blauLack);
    streifen.position.y = 0.72;
    this.group.add(streifen);
    // Kabine mit Fenstern
    const kabine = new THREE.Mesh(new THREE.BoxGeometry(B - 0.16, 0.62, L * 0.45), lack);
    kabine.position.set(0, 1.4, -0.15);
    kabine.castShadow = true;
    this.group.add(kabine);
    for (const [dx, dz, sx, sz] of [
      [0, L * 0.225, B - 0.3, 0.05],
      [0, -L * 0.225, B - 0.3, 0.05],
      [(B - 0.16) / 2, 0, 0.05, L * 0.4],
      [-(B - 0.16) / 2, 0, 0.05, L * 0.4],
    ] as Array<[number, number, number, number]>) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.42, sz), scheibe);
      f.position.set(dx, 1.42, -0.15 + dz);
      this.group.add(f);
    }
    // Blaulichtbalken
    const balken = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 0.24), dunkel);
    balken.position.set(0, 1.76, -0.15);
    this.group.add(balken);
    for (const dx of [-0.4, 0.4]) {
      const leuchte = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.12, 0.2),
        new THREE.MeshStandardMaterial({
          color: 0x2748d8,
          emissive: 0x1030c0,
          emissiveIntensity: 0,
          roughness: 0.4,
        })
      );
      leuchte.position.set(dx, 1.82, -0.15);
      this.group.add(leuchte);
      this.blau.push(leuchte);
    }
    // Räder
    const radGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
    radGeo.rotateZ(Math.PI / 2);
    for (const dz of [L / 2 - 0.9, -L / 2 + 0.9]) {
      for (const dx of [-B / 2 + 0.05, B / 2 - 0.05]) {
        const rad = new THREE.Mesh(radGeo, dunkel);
        rad.position.set(dx, 0.34, dz);
        rad.castShadow = true;
        this.group.add(rad);
        this.raeder.push(rad);
      }
    }
    // Beschriftung auf beiden Seiten
    const schrift = this.schriftzug("POLIZEI");
    for (const [dx, ry] of [
      [B / 2 + 0.01, Math.PI / 2],
      [-B / 2 - 0.01, -Math.PI / 2],
    ] as Array<[number, number]>) {
      const tafel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.44), schrift);
      tafel.position.set(dx, 0.95, 0.1);
      tafel.rotation.y = ry;
      this.group.add(tafel);
    }
  }

  private schriftzug(text: string): THREE.MeshStandardMaterial {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 104;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#12307f";
    ctx.font = "bold 74px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    return new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      roughness: 0.6,
    });
  }

  /** Steht der Wagen gerade auf dem Platz? */
  get aufDemPlatz(): boolean {
    return this.phase !== "weg";
  }

  /** Standfläche für die Kollisionsprüfung von Bagger und Radlader. */
  boxen(out: Box[]): void {
    if (this.phase === "weg") return;
    out.push({
      x: this.group.position.x,
      z: this.group.position.z,
      hw: 1.1,
      hd: 2.5,
      rot: this.group.rotation.y,
    });
  }

  /** Kontrolle sofort auslösen (Test und Debug). */
  jetzt(): void {
    if (this.phase === "weg") this.starte();
  }

  private starte(): void {
    this.phase = "anfahrt";
    this.t = 0;
    this.group.visible = true;
    this.group.position.set(TOR_AUSSEN[0], 0, TOR_AUSSEN[1]);
    this.group.rotation.y = Math.PI; // fährt nach Süden herein
    this.setzeWeg([TOR_INNEN, [BUERO_HALT.x, BUERO_HALT.z]]);
    this.onFunk?.("Streifenwagen am Tor — Routinekontrolle.");
  }

  private setzeWeg(punkte: Array<[number, number]>): void {
    this.weg = punkte;
    this.wegIdx = 0;
  }

  /** Fährt ein Stück der Route ab; true, sobald das Ende erreicht ist. */
  private fahre(dt: number): boolean {
    if (this.wegIdx >= this.weg.length) return true;
    const [zx, zz] = this.weg[this.wegIdx];
    const dx = zx - this.group.position.x;
    const dz = zz - this.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) {
      this.wegIdx++;
      return this.wegIdx >= this.weg.length;
    }
    const schritt = Math.min(TEMPO * dt, d);
    this.group.position.x += (dx / d) * schritt;
    this.group.position.z += (dz / d) * schritt;
    // sanft einlenken statt springen
    const soll = Math.atan2(dx, dz);
    let diff = soll - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(dt * 2.6, 1);
    for (const r of this.raeder) r.rotation.x -= schritt * 2.4;
    return false;
  }

  /** Eine Figur zu Fuß bewegen; true, sobald sie da ist. */
  private gehe(p: PersonParts, ziel: THREE.Vector3, dt: number): boolean {
    const g = p.group;
    const dx = ziel.x - g.position.x;
    const dz = ziel.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      p.legLeft.rotation.x = 0;
      p.legRight.rotation.x = 0;
      return true;
    }
    const schritt = Math.min(GEH_TEMPO * dt, d);
    g.position.x += (dx / d) * schritt;
    g.position.z += (dz / d) * schritt;
    g.rotation.y = Math.atan2(dx, dz);
    const swing = Math.sin(performance.now() * 0.008) * 0.45;
    p.legLeft.rotation.x = swing;
    p.legRight.rotation.x = -swing;
    return false;
  }

  /** Beide Beamte neben den Wagen stellen. */
  private steigeAus(): void {
    const seite = new THREE.Vector3(1.4, 0, 0.4).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.group.rotation.y
    );
    for (const [i, p] of [this.tristan, this.partner].entries()) {
      p.group.visible = true;
      p.group.position.set(
        this.group.position.x + seite.x * (i === 0 ? 1 : -1),
        0,
        this.group.position.z + seite.z * (i === 0 ? 1 : -1)
      );
    }
  }

  private setzeBlaulicht(an: boolean): void {
    for (const b of this.blau) {
      const m = b.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = an ? 1 : 0;
    }
  }

  /** Kollider auf die Wagenpose setzen — und weit weg, solange er nicht da ist. */
  private syncBody(): void {
    if (!this.body) return;
    if (this.phase === "weg") {
      this.body.setTranslation({ x: 0, y: -50, z: 0 }, false);
      return;
    }
    this.quat.setFromEuler(new THREE.Euler(0, this.group.rotation.y, 0));
    this.body.setTranslation(this.group.position, false);
    this.body.setRotation(
      { x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w },
      false
    );
  }

  update(dt: number): void {
    if (this.phase === "weg") {
      this.syncBody();
      this.naechste -= dt;
      if (this.naechste <= 0) this.starte();
      return;
    }
    this.t += dt;
    this.syncBody();

    // Blaulicht blinkt — Sirene bleibt aus, es ist ja nichts passiert
    if (this.phase === "runde" || this.phase === "zumBagger" || this.phase === "gespraech") {
      this.blink += dt;
      if (this.blink >= BLINK_S) {
        this.blink = 0;
        const m = this.blau[0].material as THREE.MeshStandardMaterial;
        const an = m.emissiveIntensity > 0.5;
        (this.blau[0].material as THREE.MeshStandardMaterial).emissiveIntensity = an ? 0 : 1;
        (this.blau[1].material as THREE.MeshStandardMaterial).emissiveIntensity = an ? 1 : 0;
      }
    }

    switch (this.phase) {
      case "anfahrt":
      case "zumBuero":
        if (this.fahre(dt)) {
          this.phase = "aussteigenBuero";
          this.t = 0;
          this.steigeAus();
          this.zielFuss.copy(BUERO_TUER);
          this.onFunk?.("Zwei Beamte gehen ins Büro.");
        }
        break;
      case "aussteigenBuero": {
        const a = this.gehe(this.tristan, this.zielFuss, dt);
        const b = this.gehe(this.partner, this.zielFuss, dt);
        if (a && b) {
          this.tristan.group.visible = false;
          this.partner.group.visible = false;
          this.phase = "imBuero";
          this.t = 0;
        }
        break;
      }
      case "imBuero":
        if (this.t > BUERO_S) {
          this.tristan.group.visible = true;
          this.partner.group.visible = true;
          this.tristan.group.position.copy(BUERO_TUER);
          this.partner.group.position.copy(BUERO_TUER);
          this.phase = "zurueckZumWagen";
          this.zielFuss.set(this.group.position.x, 0, this.group.position.z);
        }
        break;
      case "zurueckZumWagen": {
        const a = this.gehe(this.tristan, this.zielFuss, dt);
        const b = this.gehe(this.partner, this.zielFuss, dt);
        if (a && b) {
          this.tristan.group.visible = false;
          this.partner.group.visible = false;
          this.phase = "runde";
          this.setzeBlaulicht(true);
          this.setzeWeg(RUNDE);
          this.onFunk?.("Blaulicht an, ohne Sirene — sie fahren den Platz ab.");
        }
        break;
      }
      case "runde":
        if (this.fahre(dt)) {
          this.phase = "zumBagger";
          const [hx, hz] = this.haltAmBagger();
          this.setzeWeg([[hx, hz]]);
        }
        break;
      case "zumBagger":
        if (this.fahre(dt)) {
          this.phase = "gespraech";
          this.t = 0;
          this.steigeAus();
          this.partner.group.visible = false; // der Partner bleibt sitzen
          const ex = this.getExcavatorPos?.();
          this.zielFuss.set((ex?.x ?? 0) + 3.2, 0, (ex?.z ?? 0) + 1.4);
          this.startFuss.copy(this.tristan.group.position);
          this.onFunk?.(
            "Tristan Schädmeister, Landespolizei — gebürtiger Liechtensteiner, " +
              "seit zwei Jahren hier. Alles in Ordnung bei Ihnen?"
          );
        }
        break;
      case "gespraech": {
        const da = this.gehe(this.tristan, this.zielFuss, dt);
        if (da) {
          const ex = this.getExcavatorPos?.();
          if (ex) {
            const dx = ex.x - this.tristan.group.position.x;
            const dz = ex.z - this.tristan.group.position.z;
            this.tristan.group.rotation.y = Math.atan2(dx, dz);
          }
          // Fernglas heben: er sieht sich den Haufen an, waehrend er redet
          this.tristan.armRight.rotation.x = -1.45;
          this.tristan.armLeft.rotation.x = -1.35;
        }
        if (this.t > GESPRAECH_S) {
          this.tristan.armRight.rotation.x = 0;
          this.tristan.armLeft.rotation.x = 0;
          this.phase = "zurueckVomBagger";
          this.zielFuss.copy(this.startFuss);
          this.onFunk?.("Schaedmeister: Danke, alles sauber. Schoenen Tag noch.");
        }
        break;
      }
      case "zurueckVomBagger":
        if (this.gehe(this.tristan, this.zielFuss, dt)) {
          this.tristan.group.visible = false;
          this.phase = "abfahrt";
          this.setzeWeg([TOR_INNEN, TOR_AUSSEN]);
        }
        break;
      case "abfahrt":
        if (this.fahre(dt)) {
          this.phase = "weg";
          this.group.visible = false;
          this.setzeBlaulicht(false);
          this.naechste = ABSTAND_S[0] + Math.random() * (ABSTAND_S[1] - ABSTAND_S[0]);
        }
        break;
    }
  }

  /**
   * Halteplatz beim Bagger. Gesucht statt gesetzt: Der erste Versuch lag mit
   * 6,5 m nach Osten mitten in der Muldenreihe, und der Wagen verschwand in
   * der Betonwand (Befund beim ersten Rendern 11.09.2026). Geprüft wird gegen
   * dieselbe Hindernisliste, die auch die LKW benutzen.
   */
  private haltAmBagger(): [number, number] {
    const ex = this.getExcavatorPos?.();
    const bx = ex?.x ?? 0;
    const bz = ex?.z ?? -1;
    for (const [dx, dz] of HALT_KANDIDATEN) {
      const x = bx + dx;
      const z = bz + dz;
      if (hitsObstacle(x, z, 1.6)) continue;
      return [x, z];
    }
    return [bx + 4.5, bz + 9.5];
  }

  /** Für Tests und das Debug-Overlay. */
  get phaseName(): string {
    return this.phase;
  }

  /** Punkte der Rundfahrt — der Test prüft sie gegen die Hindernisse. */
  static get runde(): Array<[number, number]> {
    return RUNDE;
  }

  /** Halteplatz vor dem Büro — ebenfalls für den Test. */
  static get bueroHalt(): THREE.Vector3 {
    return BUERO_HALT;
  }
}
