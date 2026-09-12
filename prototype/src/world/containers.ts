import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";
import { computePurity, containerValue } from "../materials/purity";
import type { ItemManager, ScrapItem } from "./scrapItems";
import type { EventBus } from "../core/events";

/**
 * Sortierziele (Design-Pivot 2026-08-27): offene **Haufen-Zonen** für die großen
 * Fraktionen (Schrott einfach draufwerfen) + 2 Kleinboxen für Kupfer/Kabel.
 * Zuordnung per Zonen-Zählung: Ein Item „zählt", sobald es (nicht gegriffen)
 * in der Zone liegt — Herausgreifen macht die Zählung rückgängig (Nachsortieren).
 */

export interface ContainerConfig {
  id: string;
  fractionId: string;
  label: string;
  /**
   * pile   offene Fläche, nur markiert — Reifendepot
   * halde  Mischschrottplatz: doppelt gesetzte, sehr hohe Wände, nach Norden offen
   * bay    Betonlego-Box (3 Wände, vorn offen) — Silos und Batteriemulde
   * box    feste Kleinbox
   * rolloff        kleiner Absetzcontainer, vom Bagger versetzbar
   * grosscontainer 40-m³-Abrollcontainer, fest — den zieht der LKW herauf
   */
  kind: "pile" | "halde" | "bay" | "box" | "rolloff" | "grosscontainer";
  x: number;
  z: number;
  /** Zonenmaße [Breite, Tiefe, Wandhöhe] */
  size: [number, number, number];
  /**
   * Wohin die offene Seite zeigt. Standard ist Westen (die Boxenreihe im
   * Osten öffnet sich zum Bagger); die Nichtmetall-Mulden im Süden öffnen
   * nach Norden.
   */
  facing?: "west" | "north" | "east";
  /**
   * Seitenwände weglassen, wo eine Nachbarmulde direkt anschließt — dort
   * genügt eine Trennwand statt zweier nebeneinanderstehender.
   */
  shareSouth?: boolean;
  shareNorth?: boolean;
  /** Rückwand weglassen — die Nachbarmulde dahinter bringt sie mit */
  shareEast?: boolean;
  shareWest?: boolean;
}

/**
 * Platzanordnung (Design 2026-08-29): Der Bagger steht auf (0, −1) im Zentrum.
 * LINKS (Westen) der riesige Stahlschrott-Haufen, RECHTS (Osten) die Boxen in
 * einer Reihe — alles im Schwenkbereich, damit kaum gefahren werden muss.
 */
export const CONFIGS: ContainerConfig[] = [
  /*
   * ORTSKONZEPT (Ansage 12.09.2026, aus der Sicht des Fahrers beschrieben):
   * „Der Bagger steht und schaut Richtung Janine, rechts neben mir der
   * Stahlschrottcontainer, hinter mir die Presse im Süden, und in
   * West-West-Süd-Richtung der Mischschrott."
   *
   * Janine steht bei +z, also blickt die Maschine dorthin.
   *
   * ACHTUNG, hier ist zweimal etwas schiefgegangen: Der Code nennt +z Norden
   * und +x Osten, aber wer nach +z blickt, hat +x LINKS auf dem Schirm.
   * Gemessen am 12.09.2026 durch Projektion mit der echten Spielkamera. Die
   * Himmelsrichtungen im Quelltext bilden also einen gespiegelten Kompass —
   * verlass dich nicht darauf, sondern auf diese Regel:
   *
   *   rechts vom Sitz = −x        links vom Sitz = +x
   *   vor dem Sitz    = +z        hinter dem Sitz = −z
   *
   * Daraus folgt der Platz (Ansage 12.09.2026, aus der Sicht des Fahrers):
   *
   *   hinten   Presse (an der Wand)        rechts        Stahlcontainer 40 m³
   *   rechts hinten  Reifendepot           links hinten  Mischschrott
   *   rechts vorne   sechs Absetzcontainer links vorne   Batteriemulde
   *   rechts aussen  Silos, am Büro vorbei fährt der Abholer sie ab
   *
   * Der Bagger arbeitet auf einer kurzen Linie von (−5 | −18,5) nach
   * (−5 | −13,5). Alles steht bewusst eng beieinander (Ansage 12.09.2026:
   * „Du kannst das alles viel enger aneinanderstellen, der Bagger braucht
   * nicht so viel Abstand zu der Presse") — die Untergrenze setzt der Arm
   * selbst: Unter 4,0 m kommt er gar nicht auf den Boden, und über eine Wand
   * muss die Krallenspitze 40 cm Luft behalten. Ein Ring von 4,0 bis 9,5 m fasst nicht elf Ziele, und ein
   * Umschlagbagger fährt im Betrieb ohnehin ein paar Meter hin und her.
   * Geprüft wird das in `test/reach.test.ts`.
   */

  /*
   * MISCHSCHROTT — links hinten, die große Fläche des Platzes.
   *
   * Hier kippt jeder ab, der gemischt anliefert, und von hier holt der Bagger
   * alles Weitere. Die Wände sind doppelt gesetzt und fünf Meter hoch (Ansage
   * 12.09.2026: „da müssten natürlich die Wände doppelt sein und sehr hoch,
   * damit wir den Mischschrott auch ohne Probleme stapeln können").
   *
   * Aber nur ZWEI Wände, und zwar die, die ohnehin die Platzgrenze sind
   * (Ansage 12.09.2026: „die natürlichen Abgrenzungen vom Mischschrott soll
   * eigentlich nur die Außenwand sein und daneben der Bagger, anders braucht's
   * eigentlich keine Abgrenzung"). Zur Maschine hin ist offen — dort stand
   * eine Wand, die nur im Weg war. Und die Fläche ist von 156 auf 90 m²
   * geschrumpft: „die erscheint mir auch viel zu groß".
   */
  { id: "c_mixed", fractionId: "mixed", label: "MISCHSCHROTT", kind: "halde", x: 5.0,
    z: -22.75, size: [9.0, 9.5, 5.0] },

  /*
   * STAHLSCHROTT — fester 40-m³-Abrollcontainer, direkt rechts vom Bagger.
   *
   * „Stahlschrott kommt in den 40er Container und sollte direkt neben Bagger,
   * damit er erreicht werden kann." Er bleibt stehen: Der Abholer zieht ihn
   * samt Inhalt auf den LKW, der Bagger versetzt ihn nicht.
   */
  { id: "c_steel", fractionId: "steel", label: "STAHLSCHROTT", kind: "grosscontainer", x: -13.0,
    z: -17.0, size: [6.6, 2.6, 2.0] },

  /*
   * REIFENDEPOT — rechts hinten, offene Fläche ohne Wände.
   *
   * Reifen fallen ständig an und werden selten abgeholt; sie brauchen Fläche,
   * keine Mulde. Heinz kümmert sich darum (Ansage 12.09.2026).
   */
  { id: "c_tires", fractionId: "tires", label: "REIFEN", kind: "pile", x: -17.0,
    z: -21.0, size: [8.0, 7.0, 0] },

  /*
   * ABSETZCONTAINER — sechs Stück rechts vorne, in Reichweite.
   *
   * Kabel, VA, Kupfer, Alu, Zink, Messing. Beweglich, damit man sich den
   * heranzieht, mit dem man gerade arbeitet. Kupfer und Messing bleiben
   * getrennt: doppelter Preisunterschied, und wer beides in einen Behälter
   * wirft, bekommt für alles den Messingpreis.
   */
  { id: "r_cable", fractionId: "cable", label: "KABEL", kind: "rolloff", x: -9.5,
    z: -13.5, size: [2.8, 1.8, 1.1] },
  { id: "r_va", fractionId: "va", label: "EDELSTAHL VA", kind: "rolloff", x: -12.5,
    z: -13.5, size: [2.8, 1.8, 1.1] },
  { id: "r_copper", fractionId: "copper", label: "KUPFER", kind: "rolloff", x: -9.5,
    z: -11.5, size: [2.8, 1.8, 1.1] },
  { id: "r_alu", fractionId: "alu", label: "ALU", kind: "rolloff", x: -12.5,
    z: -11.5, size: [2.8, 1.8, 1.1] },
  { id: "r_zinc", fractionId: "zinc", label: "ZINK", kind: "rolloff", x: -9.5,
    z: -9.5, size: [2.8, 1.8, 1.1] },
  { id: "r_brass", fractionId: "brass", label: "MESSING", kind: "rolloff", x: -12.5,
    z: -9.5, size: [2.8, 1.8, 1.1] },

  /*
   * SILOS an der Ostwand — dorthin fährt der Abholer entlang, ohne den
   * Arbeitsbereich zu kreuzen (Ansage 12.09.2026). Was liegenbleiben darf,
   * bis genug für eine Fuhre zusammen ist; gefüllt vom Radlader.
   */
  { id: "c_wood", fractionId: "wood", label: "HOLZ", kind: "bay", x: -34.5,
    z: -2.0, size: [3.6, 6.0, 3.0], facing: "east" },
  { id: "c_rubble", fractionId: "rubble", label: "BAUMISCH", kind: "bay", x: -34.5,
    z: -9.0, size: [3.6, 6.0, 3.0], facing: "east" },
  { id: "c_plastic", fractionId: "plastic", label: "KUNSTSTOFF", kind: "bay", x: -34.5,
    z: -16.0, size: [3.6, 6.0, 3.0], facing: "east" },
  { id: "c_va_lager", fractionId: "va", label: "VA-LAGER", kind: "bay", x: -34.5,
    z: -23.0, size: [3.6, 6.0, 3.5], facing: "east" },
];

/** Fangbereich über einer Haufen-Zone (Zonen-Zählung + Ampel) */
const PILE_CATCH_HEIGHT = 2.4;

const WALL = 0.1;

export type AmpelState = "green" | "yellow" | "red";

class GameContainer {
  contentKg = 0;
  contaminationKg = 0;
  readonly itemIds = new Set<string>();
  private label: ContainerLabel;
  /**
   * Wo der Behälter gerade steht.
   *
   * Für Mulden und Haufen ist das die Angabe aus CONFIGS und ändert sich nie.
   * Ein Absetzcontainer dagegen wird vom Bagger über den Platz geschleift
   * (Ansage 12.09.2026) — dann wandert die Zählzone mit ihm, sonst zählte
   * weiter das Loch, an dem er einmal stand.
   */
  private px: number;
  private pz: number;
  private pyaw = 0;
  /** Der bewegliche Körper eines Absetzcontainers, sonst null. */
  private koerper: RAPIER.RigidBody | null = null;
  private group: THREE.Group;

  /** Schild nach Entfernung zur Kamera ein- oder ausblenden. */
  updateLabelDistance(camPos: THREE.Vector3): void {
    this.label.updateDistance(camPos);
  }

  constructor(
    readonly cfg: ContainerConfig,
    scene: THREE.Scene,
    world: RAPIER.World
  ) {
    const [w, d, h] = cfg.size;
    const fraction = getMaterial(cfg.fractionId);
    const gray = new THREE.MeshStandardMaterial({ color: 0x70757a, roughness: 0.8, metalness: 0.3 });
    const band = new THREE.MeshStandardMaterial({ color: fraction.color, roughness: 0.7 });

    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    scene.add(group);
    this.group = group;
    this.px = cfg.x;
    this.pz = cfg.z;

    if (cfg.kind === "halde") {
      /*
       * Mischschrottplatz: drei Wände aus doppelt gesetzten Betonlegos, fünf
       * Meter hoch, nach Norden offen.
       *
       * Doppelt heißt wirklich zwei Steinreihen hintereinander, nicht ein
       * dickerer Stein — wer ein paar Tonnen dagegen kippt, drückt eine
       * einreihige Wand um. Gebaut in Weltachsen ohne die Drehung der Mulden:
       * bei fünf Metern Höhe waere eine gedrehte Gruppe nur schwerer
       * nachzurechnen.
       */
      const [hw, hd, hh] = cfg.size;
      const boden = new THREE.Mesh(
        new THREE.PlaneGeometry(hw, hd),
        new THREE.MeshStandardMaterial({
          color: fraction.color,
          roughness: 1,
          transparent: true,
          opacity: 0.2,
        })
      );
      boden.rotation.x = -Math.PI / 2;
      boden.position.y = 0.02;
      group.add(boden);

      const BL = 1.5;
      const BH = 0.5;
      const BT = 0.55;
      const REIHEN = Math.round(hh / BH);
      const farben = [0x9b9b94, 0x8d8d86, 0xa4a49c, 0x94908a, 0xaaa89f].map(
        (c) => new THREE.Color(c)
      );
      const bloecke: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const nieten: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const block = new THREE.Object3D();
      const niete = new THREE.Object3D();
      let bi = 0;
      const setze = (bx: number, by: number, bz: number, alongX: boolean): void => {
        const f = farben[bi % 5]!;
        const j = (n: number): number => ((bi * 9301 + n * 49297) % 233280) / 233280 - 0.5;
        block.position.set(bx + j(1) * 0.05, by + j(2) * 0.02, bz + j(3) * 0.05);
        block.rotation.set(j(4) * 0.02, (alongX ? 0 : Math.PI / 2) + j(5) * 0.035, j(6) * 0.018);
        block.updateMatrix();
        bi++;
        bloecke.push({ m: block.matrix.clone(), f });
        for (const sv of [-0.4, 0.4]) {
          niete.position.set(alongX ? sv : 0, BH / 2 + 0.045, alongX ? 0 : sv);
          niete.updateMatrix();
          nieten.push({ m: block.matrix.clone().multiply(niete.matrix), f });
        }
      };
      /*
       * Nur die zwei Wände, die ohnehin Platzgrenze sind: hinten und die
       * Seite, die von der Maschine wegzeigt. Zum Bagger hin bleibt offen —
       * dort ist er selbst die Abgrenzung.
       *
       * Und sie hören nicht auf einen Schlag auf, sondern laufen zum offenen
       * Ende hin treppenförmig aus (Ansage 12.09.2026: „wär cool, wenn das so
       * nicht auf einmal weggeht, sondern so leicht abfallend schräg tiefer
       * wird"). Eine Wand, die mit voller Höhe endet, sieht aus wie ein
       * abgebrochenes Bauteil; eine auslaufende sieht aus, als hätte sie
       * jemand so gesetzt.
       */
      const AUSLAUF = 0.4; // Resthöhe am offenen Ende
      const reihenBei = (t: number): number =>
        Math.max(2, Math.round(REIHEN * (AUSLAUF + (1 - AUSLAUF) * t)));
      for (let lage = 0; lage < 2; lage++) {
        const tt = BT * (0.5 + lage);
        // Rückwand: läuft zur Maschinenseite (−x) hin aus
        for (let bx = -hw / 2 + BL / 2; bx < hw / 2 + 0.4; bx += BL) {
          const n = reihenBei((bx + hw / 2) / hw);
          for (let r = 0; r < n; r++) {
            const off = (r % 2) * (BL / 2);
            setze(bx - off, BH / 2 + r * BH, -(hd / 2 + tt), true);
          }
        }
        // Aussenwand: läuft nach vorn (+z) hin aus
        for (let bz = -hd / 2 + BL / 2; bz < hd / 2 + 0.4; bz += BL) {
          const n = reihenBei((hd / 2 - bz) / hd);
          for (let r = 0; r < n; r++) {
            const off = (r % 2) * (BL / 2);
            setze(hw / 2 + tt, BH / 2 + r * BH, bz - off, false);
          }
        }
      }
      const wandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 });
      const bauen = (
        geo: THREE.BufferGeometry,
        liste: Array<{ m: THREE.Matrix4; f: THREE.Color }>
      ): void => {
        const im = new THREE.InstancedMesh(geo, wandMat, liste.length);
        liste.forEach((e, i) => {
          im.setMatrixAt(i, e.m);
          im.setColorAt(i, e.f);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        group.add(im);
      };
      bauen(new THREE.BoxGeometry(BL, BH, BT), bloecke);
      bauen(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10), nieten);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      /*
       * Je Wand zwei Kollider, damit der Kollisionskörper dem Auslaufen folgt:
       * die geschlossene Hälfte auf voller Höhe, die auslaufende auf gut der
       * halben. Ein einziger Quader auf voller Höhe wäre eine unsichtbare Wand
       * dort, wo man die Steine schon aufhören sieht.
       */
      const halb = hh * 0.55;
      for (const [hoch, vorz] of [
        [hh, 1],
        [halb, -1],
      ] as Array<[number, number]>) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hw / 4 + BT / 2, hoch / 2, BT).setTranslation(
            (vorz * hw) / 4,
            hoch / 2,
            -(hd / 2 + BT)
          ),
          body
        );
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(BT, hoch / 2, hd / 4 + BT / 2).setTranslation(
            hw / 2 + BT,
            hoch / 2,
            (-vorz * hd) / 4
          ),
          body
        );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, hh + 1.4, cfg.z + hd / 2 + 1.0);
    } else if (cfg.kind === "bay") {
      // Betonlego-Box (Design-Wunsch 2026-08-27): drei Wände aus gestapelten
      // Beton-Legosteinen mit Noppen, vorn offen — wie auf echten Schrottplätzen.
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color: fraction.color,
          roughness: 1,
          transparent: true,
          opacity: 0.24,
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.02;
      group.add(ground);

      // Flachere Betonsteine, dafür eine Reihe mehr: wirkt weniger klotzig
      const BLOCK_L = 1.5;
      const BLOCK_H = 0.5;
      const BLOCK_T = 0.55;
      // Reihen aus der angegebenen Wandhöhe statt fest verdrahtet: Die Zahl in
      // CONFIGS hatte bisher keine Wirkung, jede Mulde bekam 5 Reihen à 0,5 m,
      // also 2,50 m Wand. Gemessen an der Armgeometrie ist das unerreichbar —
      // über der Muldenmitte (4,6 m vom Bagger) kommt die Spinne auf 1,58 m.
      const ROWS = Math.max(2, Math.round(h / BLOCK_H));
      // Fünf Grautöne statt drei: schon das lässt die Wand gebraucht
      // wirken, weil Blöcke aus verschiedenen Chargen nebeneinanderstehen.
      // Kostet nichts — die Materialien werden ohnehin geteilt.
      // Fuenf Grautoene als Exemplarfarben statt fuenf Materialien: Jede Mulde
      // stand vorher mit ein paar hundert einzeln gezeichneten Bloecken und
      // doppelt so vielen Nieten im Bild. Als zwei InstancedMesh je Mulde sind
      // es zwei Zeichenrufe — das Aussehen bleibt Block fuer Block dasselbe.
      const farben = [0x9b9b94, 0x8d8d86, 0xa4a49c, 0x94908a, 0xaaa89f].map(
        (col) => new THREE.Color(col)
      );
      const blockGeo = new THREE.BoxGeometry(BLOCK_L, BLOCK_H, BLOCK_T);
      const studGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10);
      const bloecke: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const nieten: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const block = new THREE.Object3D();
      const niete = new THREE.Object3D();
      let bi = 0;
      const placeBlock = (x: number, y: number, z: number, alongX: boolean): void => {
        const f = farben[bi % 5]!;
        // Jeder Block sitzt ein wenig anders — von Hand mit dem Stapler
        // gesetzt, nicht gegossen. Reiner Aufbau, keine Laufzeitkosten.
        const j = (n: number): number => (((bi * 9301 + n * 49297) % 233280) / 233280 - 0.5);
        block.position.set(x + j(1) * 0.05, y + j(2) * 0.02, z + j(3) * 0.05);
        block.rotation.set(j(4) * 0.02, (alongX ? 0 : Math.PI / 2) + j(5) * 0.035, j(6) * 0.018);
        block.updateMatrix();
        bi++;
        bloecke.push({ m: block.matrix.clone(), f });
        for (const s of [-0.4, 0.4]) {
          niete.position.set(alongX ? s : 0, BLOCK_H / 2 + 0.045, alongX ? 0 : s);
          niete.updateMatrix();
          // Block-Matrix mal lokale Matrix — dieselbe Rechnung wie vorher die
          // Eltern-Kind-Beziehung, also sitzt jede Niete unveraendert
          nieten.push({ m: block.matrix.clone().multiply(niete.matrix), f });
        }
      };
      // Wände: Ostseite + Nord + Süd. Die WESTseite bleibt offen — dorthin
      // schaut der Bagger, von dort wird eingefüllt und ausgeräumt.
      //
      // Die Rückwand steht zwei Lagen höher als die Flanken: Wer von oben
      // einfüllt, wirft regelmäßig ein Stück über die hintere Kante, und
      // dahinter ist es verloren. Vorn ändert das nichts — dort wird
      // eingefüllt, und die Reichweite des Arms haengt an der Muldenmitte.
      const REIHEN_HINTEN = ROWS + 2;
      for (let r = 0; r < REIHEN_HINTEN; r++) {
        const y = BLOCK_H / 2 + r * BLOCK_H;
        const off = (r % 2) * (BLOCK_L / 2);
        if (r < ROWS) {
          for (let x = -w / 2 + BLOCK_L / 2 - off; x < w / 2 + 0.4; x += BLOCK_L) {
            if (!cfg.shareNorth) placeBlock(x, y, d / 2 + BLOCK_T / 2, true);
            if (!cfg.shareSouth) placeBlock(x, y, -(d / 2 + BLOCK_T / 2), true);
          }
        }
        // Rückwand: entfällt, wenn die Nachbarmulde dahinter sie schon stellt
        if (!cfg.shareEast) {
          for (let z = -d / 2 + BLOCK_L / 2 - off; z < d / 2 + 0.4; z += BLOCK_L) {
            placeBlock(w / 2 + BLOCK_T / 2, y, z, false);
          }
        }
      }
      const wandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 });
      const bauen = (
        geo: THREE.BufferGeometry,
        liste: Array<{ m: THREE.Matrix4; f: THREE.Color }>
      ): void => {
        if (liste.length === 0) return;
        const im = new THREE.InstancedMesh(geo, wandMat, liste.length);
        liste.forEach((e, i) => {
          im.setMatrixAt(i, e.m);
          im.setColorAt(i, e.f);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        group.add(im);
      };
      bauen(blockGeo, bloecke);
      bauen(studGeo, nieten);

      // Öffnung nach Norden: die ganze Mulde wird gedreht, statt die
      // Wandlogik zu verdoppeln
      if (cfg.facing === "north") group.rotation.y = Math.PI / 2;
      else if (cfg.facing === "east") group.rotation.y = Math.PI;
      // Kollider: drei Wandquader (Ostseite offen)
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      const wallH = ROWS * BLOCK_H;
      for (const sz of [-1, 1]) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(w / 2 + BLOCK_T, wallH / 2, BLOCK_T / 2).setTranslation(
            0,
            wallH / 2,
            sz * (d / 2 + BLOCK_T / 2)
          ),
          body
        );
      }
      // Rückwand-Kollider so hoch wie ihre Blöcke, sonst fliegt der Schrott
      // durch die zwei zusätzlichen Lagen hindurch
      const wallHinten = REIHEN_HINTEN * BLOCK_H;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(BLOCK_T / 2, wallHinten / 2, d / 2 + BLOCK_T).setTranslation(
          w / 2 + BLOCK_T / 2,
          wallHinten / 2,
          0
        ),
        body
      );
      this.label = new ContainerLabel(cfg.label, fraction.color);
      // Schild am hinteren (geschlossenen) Ende — so steht es nicht im Blickfeld
      this.label.sprite.position.set(cfg.x + w / 2 + 0.6, wallH + 1.1, cfg.z);
    } else if (cfg.kind === "rolloff" || cfg.kind === "grosscontainer") {
      /*
       * Absetzcontainer: flache Wanne auf zwei Kufen, Rungen außen, vorn die
       * Öse für den Haken des Abrollkippers. Er ist ein dynamischer Körper
       * und damit für den Greifer nichts anderes als ein sehr großes, sehr
       * schweres Schrottteil — der Bagger fasst ihn an und zieht ihn weg,
       * ohne dass die Greiflogik davon wissen muss.
       *
       * Kippen kann er nicht: nur die Hochachse ist freigegeben. Ein
       * umgefallener Container voller Kupfer wäre kein Spiel, sondern eine
       * Aufräumstrafe. Geschleift statt gehoben ist ohnehin das Richtige —
       * eine volle Mulde hebt kein Umschlagbagger am Greifer an.
       */
      const T = 0.055;
      const KUFE = 0.16;
      const stahl = new THREE.MeshStandardMaterial({
        color: fraction.color,
        roughness: 0.62,
        metalness: 0.35,
      });
      const rahmen = new THREE.MeshStandardMaterial({
        color: 0x474c52,
        roughness: 0.78,
        metalness: 0.45,
      });
      const boden = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), rahmen);
      boden.position.y = KUFE + T / 2;
      boden.castShadow = true;
      boden.receiveShadow = true;
      group.add(boden);
      for (const sx of [-1, 1]) {
        const kufe = new THREE.Mesh(new THREE.BoxGeometry(0.16, KUFE, d), rahmen);
        kufe.position.set((sx * (w - 0.3)) / 2, KUFE / 2, 0);
        kufe.castShadow = true;
        group.add(kufe);
      }
      const wandY = KUFE + T + h / 2;
      const waende: Array<[number, number, number, number]> = [
        [0, -(d / 2 - T / 2), w, T],
        [0, d / 2 - T / 2, w, T],
        [-(w / 2 - T / 2), 0, T, d],
        [w / 2 - T / 2, 0, T, d],
      ];
      for (const [wx, wz, sx, sz] of waende) {
        const wand = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), stahl);
        wand.position.set(wx, wandY, wz);
        wand.castShadow = true;
        wand.receiveShadow = true;
        group.add(wand);
      }
      // Rungen: senkrechte Profile außen auf den Längsseiten
      for (const sz of [-1, 1]) {
        for (const rx of [-w / 2 + 0.35, 0, w / 2 - 0.35]) {
          const runge = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.07), rahmen);
          runge.position.set(rx, wandY, sz * (d / 2 + 0.03));
          group.add(runge);
        }
      }
      // Obere Kante als durchlaufender Riegel — daran erkennt man die Mulde
      for (const sz of [-1, 1]) {
        const kante = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.09, 0.12), rahmen);
        kante.position.set(0, KUFE + T + h, sz * (d / 2));
        group.add(kante);
      }
      // Haken-Öse an der Stirnseite: ohne sie ist es eine Kiste, keine Mulde
      const oese = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 12), rahmen);
      oese.rotation.y = Math.PI / 2;
      oese.position.set(0, KUFE + T + h * 0.75, -(d / 2 + 0.16));
      group.add(oese);

      /*
       * Der grosse Stahlcontainer steht fest: Ihn holt der Abrollkipper, nicht
       * der Bagger (Ansage 12.09.2026). Die kleinen sind dynamisch und lassen
       * sich mit dem Greifer herumschleifen.
       */
      const fest = cfg.kind === "grosscontainer";
      const body = world.createRigidBody(
        (fest ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
          .setTranslation(cfg.x, 0, cfg.z)
          // Stark gedämpft und nur um die Hochachse drehbar. Gemessen
          // (12.09.2026): Mit 1,8 rutschte die leere Wanne nach einem Ruck
          // 48 m weit bis an die Westwand — ein Schlitten, kein Container.
          // Eine Stahlwanne auf Sand kommt nach einem Meter zum Stehen.
          .setLinearDamping(6.0)
          .setAngularDamping(8.0)
          .enabledRotations(false, true, false)
      );
      const teil = (hx: number, hy: number, hz: number, x: number, y: number, z: number): void => {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz)
            // Rund 640 kg für eine 7-m³-Wanne — so schwer, dass der Greifer
            // sie schleift statt sie durch die Gegend zu werfen.
            .setDensity(300)
            .setFriction(1.4)
            .setTranslation(x, y, z),
          body
        );
      };
      teil(w / 2, (KUFE + T) / 2, d / 2, 0, (KUFE + T) / 2, 0);
      for (const [wx, wz, sx, sz] of waende) {
        teil(sx / 2, h / 2, sz / 2, wx, wandY, wz);
      }
      this.koerper = fest ? null : body;
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, KUFE + T + h + 0.9, cfg.z);
    } else if (cfg.kind === "pile") {
      // Offene Haufen-Zone: getönte Bodenfläche + farbiger Rahmen, keine Wände
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color: fraction.color,
          roughness: 1,
          transparent: true,
          opacity: 0.28,
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.02;
      group.add(ground);
      const frames: Array<[number, number, number, number]> = [
        [0, -d / 2, w + 0.14, 0.14],
        [0, d / 2, w + 0.14, 0.14],
        [-w / 2, 0, 0.14, d],
        [w / 2, 0, 0.14, d],
      ];
      for (const [fx, fz, sx, sz] of frames) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), band);
        strip.position.set(fx, 0.03, fz);
        group.add(strip);
      }
      // Schild an Pfosten hinter der Zone
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), gray);
      pole.position.set(0, 1.15, d / 2 + 0.3);
      pole.castShadow = true;
      group.add(pole);
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, 2.9, cfg.z + d / 2 + 0.3);
    } else {
      // Kleinbox mit Wänden + Kollidern (Kupfer/Kabel)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * WALL, WALL, d + 2 * WALL), gray);
      floor.position.y = WALL / 2;
      floor.receiveShadow = true;
      group.add(floor);
      const walls: Array<[number, number, number, number]> = [
        [0, -(d / 2 + WALL / 2), w + 2 * WALL, WALL],
        [0, d / 2 + WALL / 2, w + 2 * WALL, WALL],
        [-(w / 2 + WALL / 2), 0, WALL, d],
        [w / 2 + WALL / 2, 0, WALL, d],
      ];
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid((w + 2 * WALL) / 2, WALL / 2, (d + 2 * WALL) / 2).setTranslation(0, WALL / 2, 0),
        body
      );
      for (const [wx, wz, sx, sz] of walls) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), gray);
        wall.position.set(wx, h / 2, wz);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        const bandMesh = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.22, sz + 0.02), band);
        bandMesh.position.set(wx, h - 0.11, wz);
        group.add(bandMesh);
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(sx / 2, h / 2, sz / 2).setTranslation(wx, h / 2, wz),
          body
        );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, h + 1.15, cfg.z);
    }
    scene.add(this.label.sprite);
    this.refreshLabel();
  }

  /**
   * Stellung eines beweglichen Behälters übernehmen. Einmal je Bild.
   *
   * Für alles Feststehende passiert hier nichts — die Abfrage kostet einen
   * Vergleich, und dafür steht die Position der Zone an einer einzigen
   * Stelle statt zweimal.
   */
  syncBeweglich(): void {
    const b = this.koerper;
    if (!b) return;
    const t = b.translation();
    const r = b.rotation();
    this.px = t.x;
    this.pz = t.z;
    // Nur die Hochachse ist freigegeben, also genügt der Gierwinkel
    this.pyaw = Math.atan2(2 * (r.w * r.y), 1 - 2 * r.y * r.y);
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    const [, , h] = this.cfg.size;
    this.label.sprite.position.set(t.x, t.y + h + 1.1, t.z);
  }

  /** Liegt der Punkt in der Zone (Haufen/Bay: bis Fanghöhe; Box: bis knapp überm Rand)? */
  containsPoint(p: { x: number; y: number; z: number }, marginXZ = 0, marginY = 0.4): boolean {
    const [w, d, h] = this.cfg.size;
    // Offene Flaechen fangen bis Fanghoehe, umwandete bis Oberkante: In einer
    // 5-m-Halde liegt der Schrott sonst zur Haelfte ausserhalb der Zaehlung.
    const offen = this.cfg.kind === "pile";
    const maxY = offen ? PILE_CATCH_HEIGHT : Math.max(PILE_CATCH_HEIGHT, h) + marginY;
    const mXZ = marginXZ + (this.cfg.kind === "pile" ? 0.35 : 0);
    const [lx, lz] = this.lokal(p.x, p.z);
    return Math.abs(lx) < w / 2 + mXZ && Math.abs(lz) < d / 2 + mXZ && p.y < maxY;
  }

  /** Punkt in die Achsen des Behälters drehen — ein gezogener Container steht schief. */
  private lokal(x: number, z: number): [number, number] {
    const dx = x - this.px;
    const dz = z - this.pz;
    if (this.pyaw === 0) return [dx, dz];
    const c = Math.cos(-this.pyaw);
    const s = Math.sin(-this.pyaw);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  /** Für die Abwurf-Ampel: großzügigere XZ-Zone, Höhe egal. */
  isOverhead(x: number, z: number): boolean {
    const [w, d] = this.cfg.size;
    const [lx, lz] = this.lokal(x, z);
    return Math.abs(lx) < w / 2 + 0.35 && Math.abs(lz) < d / 2 + 0.35;
  }

  get purity(): number {
    return computePurity(this.contentKg, this.contaminationKg);
  }

  get value(): number {
    return containerValue(getMaterial(this.cfg.fractionId), this.contentKg, this.contaminationKg);
  }

  setLabelVisible(v: boolean): void {
    this.label.sprite.visible = v;
  }

  /** Nach dem Verkauf: Aggregat leeren (Items wurden bereits entfernt). */
  clearAfterSale(): void {
    this.itemIds.clear();
    this.contentKg = 0;
    this.contaminationKg = 0;
    this.refreshLabel();
  }

  /**
   * Die Mulden sind zum Sortieren da, das Schild ist nur Hilfe. Es zeigt
   * darum im Normalfall bloß, wofür die Mulde ist. Erst wenn der Greifer
   * darüber steht, kommen Füllung, Sortenreinheit und Erlös dazu — dann
   * braucht man sie auch (Design-Fix 29.08.2026).
   */
  refreshLabel(ampel: AmpelState | null = null): void {
    if (ampel === null) {
      this.label.draw([this.cfg.label], null);
      return;
    }
    this.label.draw(
      [
        this.cfg.label,
        `${this.contentKg.toFixed(0)} kg · ${(this.purity * 100).toFixed(0)} %`,
        `≈ ${this.value.toFixed(0)} €`,
      ],
      ampel
    );
  }
}

/** World-Space-Label als Canvas-Sprite (Name, Füllung, Reinheit, Erlös + Ampelrahmen). */
class ContainerLabel {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement("canvas");
  private texture: THREE.CanvasTexture;

  constructor(_title: string, private fractionColor: number) {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    // Tiefentest an: das Schild gehört zur Szene und verschwindet hinter
    // Bagger oder Haufen. Ohne ihn schwebte es über allem und beherrschte
    // jede Einstellung (Design-Fix 29.08.2026).
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(2.3, 1.15, 1);
  }

  /**
   * Sichtbarkeit nach Entfernung. Aus der Nähe wächst ein Sprite ins Bild,
   * bis es alles verdeckt — dort wird ausgeblendet, denn wer davorsteht,
   * braucht die Aufschrift nicht mehr. Von weit weg ist sie ohnehin nicht
   * zu lesen.
   */
  updateDistance(camPos: THREE.Vector3): void {
    const d = this.sprite.position.distanceTo(camPos);
    const nah = THREE.MathUtils.smoothstep(d, 4.5, 9);
    const fern = 1 - THREE.MathUtils.smoothstep(d, 38, 52);
    const a = Math.min(nah, fern);
    (this.sprite.material as THREE.SpriteMaterial).opacity = a;
    this.sprite.visible = a > 0.02;
  }

  draw(lines: string[], ampel: AmpelState | null): void {
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 128);
    const kurz = lines.length === 1;
    // Nur-Name-Schild ist flach und ruhig, das ausführliche nutzt die
    // ganze Tafel
    const h = kurz ? 52 : 128;
    const y0 = kurz ? 38 : 128;
    ctx.fillStyle = kurz ? "rgba(20,22,24,0.62)" : "rgba(20,22,24,0.82)";
    ctx.fillRect(0, 0, 256, h);
    ctx.strokeStyle =
      ampel === "green" ? "#35c24d" : ampel === "yellow" ? "#e0b528" : ampel === "red" ? "#d84a38" :
      "#" + this.fractionColor.toString(16).padStart(6, "0");
    ctx.lineWidth = ampel ? 12 : 4;
    ctx.strokeRect(0, 0, 256, h);
    ctx.fillStyle = "#e8e8e4";
    ctx.textAlign = "center";
    if (kurz) {
      ctx.font = "bold 27px Consolas, monospace";
      ctx.fillText(lines[0], 128, y0);
    } else {
      ctx.font = "bold 30px Consolas, monospace";
      ctx.fillText(lines[0], 128, 42);
      ctx.font = "24px Consolas, monospace";
      ctx.fillText(lines[1], 128, 76);
      ctx.fillText(lines[2], 128, 108);
    }
    this.sprite.scale.set(2.3, kurz ? 0.47 : 1.15, 1);
    this.sprite.center.set(0.5, kurz ? 0.79 : 0.5);
    this.texture.needsUpdate = true;
  }
}

export class ContainerManager {
  readonly containers: GameContainer[] = [];
  private hovered: GameContainer | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World, private bus: EventBus) {
    for (const cfg of CONFIGS) {
      this.containers.push(new GameContainer(cfg, scene, world));
    }
  }

  /**
   * Zonen-Zählung (alle ~10 Steps): Items den Containern zuordnen, Aggregate
   * neu berechnen, Enter/Leave-Events feuern. Gegriffene Items zählen nicht.
   */
  /**
   * Schilder nach Entfernung ein- und ausblenden und bewegliche Behälter
   * ihrer Physik nachführen. Jedes Bild aufrufen.
   */
  updateLabels(camPos: THREE.Vector3): void {
    for (const c of this.containers) {
      c.syncBeweglich();
      c.updateLabelDistance(camPos);
    }
  }

  recount(itemManager: ItemManager, grippedBodies: Set<number>): void {
    /*
     * Erst die Stellung der beweglichen Behälter holen, dann zählen. Sonst
     * zählt die Zählung gegen den Ort des vorigen Bildes — beim Schleifen
     * eines vollen Containers wandert die Zone dann eine Fuhre hinterher.
     */
    for (const c of this.containers) c.syncBeweglich();
    const changes: Array<{ item: ScrapItem; from: string | null; to: string | null }> = [];
    for (const item of itemManager.items) {
      let to: string | null = null;
      if (!grippedBodies.has(item.body.handle)) {
        const p = item.body.translation();
        for (const c of this.containers) {
          if (c.containsPoint(p)) {
            to = c.cfg.id;
            break;
          }
        }
      }
      if (to !== item.containerId) {
        changes.push({ item, from: item.containerId, to });
        item.containerId = to;
      }
    }
    if (changes.length === 0) return;

    for (const c of this.containers) {
      c.itemIds.clear();
      c.contentKg = 0;
      c.contaminationKg = 0;
    }
    for (const item of itemManager.items) {
      if (!item.containerId) continue;
      const c = this.byId(item.containerId);
      c.itemIds.add(item.id);
      c.contentKg += item.massKg;
      if (item.materialId !== c.cfg.fractionId) c.contaminationKg += item.massKg;
    }
    for (const c of this.containers) c.refreshLabel(c === this.hovered ? this.hoverAmpel : null);

    for (const { item, from, to } of changes) {
      if (from) this.bus.emit("itemLeft", { itemId: item.id, containerId: from });
      if (to) {
        const c = this.byId(to);
        this.bus.emit("itemEntered", {
          itemId: item.id,
          materialId: item.materialId,
          containerId: to,
          correct: item.materialId === c.cfg.fractionId,
        });
      }
    }
  }

  private hoverAmpel: AmpelState = "green";

  /**
   * Abwurf-Ampel (Briefing Kap. 5.3): Container unterm Greifer + Bewertung der
   * getragenen Ladung. Grün = alles richtig, Gelb = gemischt, Rot = alles falsch.
   */
  updateHover(sensorX: number, sensorZ: number, carriedMaterialIds: string[]): {
    container: string;
    ampel: AmpelState;
  } | null {
    let over: GameContainer | null = null;
    if (carriedMaterialIds.length > 0) {
      over = this.containers.find((c) => c.isOverhead(sensorX, sensorZ)) ?? null;
    }
    let result: { container: string; ampel: AmpelState } | null = null;
    if (over) {
      const correct = carriedMaterialIds.filter((m) => m === over.cfg.fractionId).length;
      const ampel: AmpelState =
        correct === carriedMaterialIds.length ? "green" : correct > 0 ? "yellow" : "red";
      this.hoverAmpel = ampel;
      result = { container: over.cfg.label, ampel };
    }
    if (over !== this.hovered) {
      this.hovered?.refreshLabel(null);
      over?.refreshLabel(this.hoverAmpel);
      this.hovered = over;
    } else if (over) {
      over.refreshLabel(this.hoverAmpel);
    }
    return result;
  }

  /** Zonen-Schilder ein-/ausblenden (Taste M bzw. Touch-Knopf). */
  setLabelsVisible(v: boolean): void {
    for (const c of this.containers) c.setLabelVisible(v);
  }

  byId(id: string): GameContainer {
    const c = this.containers.find((c) => c.cfg.id === id);
    if (!c) throw new Error(`Unbekannter Container: ${id}`);
    return c;
  }

  /** Summe der prognostizierten Erlöse — die „Sortierwert"-Anzeige im HUD. */
  totalValue(): number {
    return this.containers.reduce((s, c) => s + c.value, 0);
  }
}
