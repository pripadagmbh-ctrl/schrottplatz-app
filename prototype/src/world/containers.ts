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
   * pile = offener Haufen · bay = Betonlego-Box (3 Wände, vorn offen) ·
   * box = feste Kleinbox · rolloff = Absetzcontainer, vom Bagger versetzbar
   */
  kind: "pile" | "bay" | "box" | "rolloff";
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
   * HAUPTPLATZ — eine einzige Fläche, kein geteilter Haufen mehr.
   *
   * Stahl und Mischschrott lagen hier bis heute in zwei Zonen nebeneinander.
   * Das war falsch herum gedacht: Auf den Hauptplatz kippt der LKW, was er
   * gerade bringt, und das ist nie sortiert. Erst danach wird gegriffen und
   * getrennt. Wer schon beim Abkippen zwei Zonen treffen soll, sortiert mit
   * dem Lastwagen — das tut niemand (Ansage 12.09.2026: „Es soll aber nicht
   * unterteilt werden zwischen Misch und Stahlschrott").
   *
   * Die Fläche ist die Vereinigung der beiden alten Zonen, also genau so groß
   * wie vorher, und zählt als Mischschrott: Was hier liegt, ist unsortiert.
   */
  { id: "c_yard", fractionId: "mixed", label: "SCHROTTPLATZ", kind: "pile", x: -9, z: 1.1,
    size: [11, 12.2, 0] },

  /*
   * SORTIERREIHE OST — hierhin wird aus dem Haufen sortiert.
   *
   * Die Reihe liegt auf x = 7,0, weil der Arm nur zwischen 5,5 und 9,0 m über
   * eine 4-m-Wand kommt (gemessen mit `hoechsteKrallenspitze`, 12.09.2026):
   *
   *   5,0 m → 2,87   5,5 m → 8,46   7,0 m → 7,24   8,5 m → 5,20
   *   9,0 m → 4,11   9,5 m → 2,13   10,0 m → gar nicht
   *
   * Daraus folgt das ganze Muster: Die Stahlmulde steht direkt östlich vom
   * Bagger (7,0 m, Spitze 7,2 m), Alu und VA schließen nach Norden und Süden
   * an (8,7–8,8 m, Spitze rund 4,7 m) und bekommen darum niedrigere Wände.
   * Weiter außen ginge nichts mehr: bei 9,5 m kommt der Greifer keine zwei
   * Meter hoch.
   *
   * Die Stahlmulde ist die größte des Platzes — breiter, tiefer und zwei
   * Lagen höher als die übrigen (Ansage 12.09.2026). Sie muss es sein: Stahl
   * ist die Fraktion, die in Tonnen anfällt, alles andere in Zentnern.
   */
  { id: "c_steel", fractionId: "steel", label: "STAHLSCHROTT", kind: "bay", x: 7.0, z: -1.2,
    size: [4.5, 5.6, 4.0] },
  { id: "c_alu", fractionId: "alu", label: "ALU", kind: "bay", x: 7.0, z: 4.2,
    size: [3.6, 4.0, 3.2] },
  { id: "c_va", fractionId: "va", label: "EDELSTAHL VA", kind: "bay", x: 7.0, z: -6.4,
    size: [3.6, 4.0, 3.2] },

  /*
   * ABROLLCONTAINER — Kabel, Kupfer und Messing.
   *
   * Für diese drei eine Betonlego-Mulde zu bauen wäre Platzverschwendung: Was
   * an einem Tag zusammenkommt, passt in eine Schubkarre, und der Abnehmer
   * holt am Ende den ganzen Behälter. Also kleine Container statt Mulden
   * (Ansage 12.09.2026).
   *
   * Sie stehen nordöstlich abgestellt, nicht im Schwenkkranz. Das ist kein
   * Versehen: Der Ring zwischen 4,0 und 9,5 m um den Bagger ist mit den drei
   * Mulden ausgereizt, und was dort noch hineingestellt wird, steht vor einer
   * Muldenöffnung oder in einer Fahrspur. Abgestellt sind sie dort, wo sie
   * niemanden stören — und weil sie beweglich sind, zieht man sich den
   * Behälter heran, mit dem man gerade arbeitet.
   */
  { id: "r_cable", fractionId: "cable", label: "KABEL", kind: "rolloff", x: 8.0, z: 8.6,
    size: [2.0, 3.4, 1.1] },
  { id: "r_copper", fractionId: "copper", label: "KUPFER", kind: "rolloff", x: 8.0, z: 11.8,
    size: [2.0, 3.4, 1.1] },
  { id: "r_brass", fractionId: "brass", label: "MESSING", kind: "rolloff", x: 8.0, z: 15.0,
    size: [2.0, 3.4, 1.1] },

  /*
   * ABFALL UND HORTGUT — außerhalb des Schwenkbereichs, dorthin wird gefahren.
   *
   * Holz, Reifen und Baumisch fallen selten an und dürfen liegenbleiben; ganz
   * hinten an der Südwand stehen die Hortmulden für sperriges Buntmetall
   * (Ansage 12.09.2026: Mulden „wo man's dann auch horten kann"). Ein
   * Kupferkessel passt in keinen Absetzcontainer.
   */
  { id: "c_wood", fractionId: "wood", label: "HOLZ", kind: "bay", x: 7.0, z: -10.25,
    size: [3.0, 3.3, 3.0] },
  { id: "c_tires", fractionId: "tires", label: "REIFEN", kind: "bay", x: 7.0, z: -13.95,
    size: [3.0, 3.3, 3.0] },
  { id: "c_rubble", fractionId: "rubble", label: "BAUMISCH", kind: "bay", x: 7.0, z: -17.65,
    size: [3.0, 3.3, 3.0] },
  { id: "c_copper_lager", fractionId: "copper", label: "KUPFER LAGER", kind: "bay", x: 7.0,
    z: -21.35, size: [3.0, 3.3, 3.0] },
  { id: "c_brass_lager", fractionId: "brass", label: "MESSING LAGER", kind: "bay", x: 7.0,
    z: -25.05, size: [3.0, 3.3, 3.0] },

  // Ballenlager direkt neben der Schere: Was gepresst aus der Kammer kommt,
  // wandert hierher und wartet auf den Abholer. Offene Fläche statt Mulde
  // (Wunsch 10.09.2026) — ein Ballenlager ist ein markierter Platz, kein
  // Behälter: Man stellt Pakete ab, man schüttet sie nicht ein.
  { id: "c_bales", fractionId: "steel", label: "BALLEN", kind: "pile", x: -0.5, z: -8.5,
    size: [3.2, 4.2, 0] },
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

    if (cfg.kind === "bay") {
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
    } else if (cfg.kind === "rolloff") {
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

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
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
      this.koerper = body;
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
    const offen = this.cfg.kind === "pile" || this.cfg.kind === "bay";
    const maxY = offen ? PILE_CATCH_HEIGHT : h + marginY;
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
