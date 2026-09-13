/**
 * GLB-Export des Mehrschalengreifers, mit Animationen.
 *
 * Aufruf:  npx vite-node tools/greifer-export.ts
 * Ergebnis: src/greifer/greifer-mehrschalen.glb
 *
 * Die Animationen werden nicht von Hand gekeyt, sondern aus dem Rig
 * abgetastet: Für jeden Zeitpunkt wird `setOeffnung`/`setDrehung` gerufen und
 * danach abgelesen, wo die Knoten stehen. Damit kann die Animation gar nicht
 * von der Mechanik abweichen — Zylinder und Schalen bleiben zwangsläufig
 * synchron, auch wenn jemand später an der Anlenkung dreht.
 *
 * glTF kennt nur Translation, Rotation (als Quaternion) und Skalierung. Die
 * Kolbenstange fährt deshalb über Position und Skalierung aus, nicht über eine
 * eigene Längenkurve.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { writeFileSync } from "node:fs";
import { MASS } from "../src/grapple/teile";
import { baueGreifer, type Greifer } from "../src/grapple/rig";

/**
 * `FileReader` gibt es in Node nicht, der glTF-Exporter braucht ihn aber, um
 * den Binärblock des GLB zu lesen. Er benutzt genau eine Methode und genau
 * einen Rückruf — also wird genau das nachgereicht. Der Rückruf wird erst im
 * nächsten Mikrotask gefeuert, weil der Exporter `onloadend` erst NACH dem
 * Aufruf von `readAsArrayBuffer` setzt.
 */
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader ??= NodeFileReader;

/** Ein Knoten, dessen Bewegung aufgezeichnet wird. */
interface Spur {
  knoten: THREE.Object3D;
  quat: number[];
  pos: number[];
  skal: number[];
}

function spuren(g: Greifer): Spur[] {
  const liste: THREE.Object3D[] = [g.rotator];
  for (let i = 1; i <= MASS.schalen; i++) {
    const nr = String(i).padStart(2, "0");
    for (const name of [
      `SHELL_${nr}`,
      `CYLINDER_${nr}`,
      `CYL_ROD_${nr}`,
      `CYL_ROD_SHAFT_${nr}`,
      `CYL_ROD_EYE_${nr}`,
    ]) {
      const o = g.wurzel.getObjectByName(name);
      if (o) liste.push(o);
    }
  }
  return liste.map((knoten) => ({ knoten, quat: [], pos: [], skal: [] }));
}

function abtasten(sp: Spur[]): void {
  for (const s of sp) {
    s.knoten.updateMatrix();
    s.quat.push(s.knoten.quaternion.x, s.knoten.quaternion.y, s.knoten.quaternion.z, s.knoten.quaternion.w);
    s.pos.push(s.knoten.position.x, s.knoten.position.y, s.knoten.position.z);
    s.skal.push(s.knoten.scale.x, s.knoten.scale.y, s.knoten.scale.z);
  }
}

/**
 * Spuren zu Keyframe-Tracks.
 *
 * `nurBewegte` wirft weg, was sich über den Clip nicht ändert — das haelt die
 * Datei klein. Für stehende Posen muss es ausgeschaltet sein: Dort ändert sich
 * per Definition nichts, und mit dem Filter kamen drei leere Clips heraus.
 * Aufgefallen ist das erst in der Vorschau, als POSE_OFFEN den Greifer
 * geschlossen liess.
 */
function tracks(
  sp: Spur[],
  zeiten: number[],
  nurBewegte = true
): THREE.KeyframeTrack[] {
  const out: THREE.KeyframeTrack[] = [];
  const bewegt = (werte: number[], breite: number): boolean => {
    for (let i = breite; i < werte.length; i++) {
      if (Math.abs(werte[i]! - werte[i % breite]!) > 1e-6) return true;
    }
    return false;
  };
  for (const s of sp) {
    const n = s.knoten.name;
    if (!nurBewegte || bewegt(s.quat, 4)) {
      out.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, zeiten, s.quat));
    }
    if (!nurBewegte || bewegt(s.pos, 3)) {
      out.push(new THREE.VectorKeyframeTrack(`${n}.position`, zeiten, s.pos));
    }
    if (!nurBewegte || bewegt(s.skal, 3)) {
      out.push(new THREE.VectorKeyframeTrack(`${n}.scale`, zeiten, s.skal));
    }
  }
  return out;
}

/** Weich anlaufen und auslaufen — eine Hydraulik ruckt nicht an. */
function weich(t: number): number {
  return t * t * (3 - 2 * t);
}

interface Ablauf {
  name: string;
  dauer: number;
  schritte: number;
  /** Setzt das Rig auf den Zeitpunkt `t` ∈ [0,1]. */
  stelle(g: Greifer, t: number): void;
}

const ABLAEUFE: Ablauf[] = [
  {
    name: "OEFFNEN",
    dauer: 1.6,
    schritte: 16,
    stelle: (g, t) => g.setOeffnung(weich(t)),
  },
  {
    name: "SCHLIESSEN",
    dauer: 1.3,
    schritte: 16,
    stelle: (g, t) => g.setOeffnung(1 - weich(t)),
  },
  {
    name: "GREIFEN",
    dauer: 2.4,
    schritte: 24,
    /*
     * Zufassen: aus der offenen Stellung zügig zu, kurz vor dem Anschlag
     * langsamer — dort steht das Material im Weg — und dann nachdrücken.
     * Das kurze Nachsetzen am Ende ist das, was ein Greifer wirklich tut,
     * wenn der Druck steht.
     */
    stelle: (g, t) => {
      if (t < 0.62) g.setOeffnung(1 - weich(t / 0.62) * 0.86);
      else g.setOeffnung(0.14 - 0.14 * weich((t - 0.62) / 0.38));
    },
  },
  {
    name: "HEBEN",
    dauer: 2.6,
    schritte: 20,
    /*
     * Geschlossen anheben. Bewegt wird die Wurzel, nicht der Kopf: In der
     * Engine hängt der Greifer am Stiel, und diese Spur ist als Vorlage
     * gedacht — wer den Greifer an einen Arm hängt, lässt sie weg.
     */
    stelle: (g, t) => {
      g.setOeffnung(0);
      g.wurzel.position.y = weich(Math.min(1, t / 0.8)) * 1.8;
    },
  },
  {
    name: "DREHEN",
    dauer: 4.0,
    schritte: 24,
    stelle: (g, t) => {
      g.setOeffnung(0);
      g.setDrehung(t * Math.PI * 2);
    },
  },
];

const greifer = baueGreifer();
const clips: THREE.AnimationClip[] = [];

for (const ablauf of ABLAEUFE) {
  const sp = spuren(greifer);
  const zeiten: number[] = [];
  for (let i = 0; i <= ablauf.schritte; i++) {
    const t = i / ablauf.schritte;
    ablauf.stelle(greifer, t);
    zeiten.push(t * ablauf.dauer);
    abtasten(sp);
  }
  // Wurzelbewegung gehört auch dazu, wenn der Ablauf sie nutzt
  const wurzelSpur: Spur = { knoten: greifer.wurzel, quat: [], pos: [], skal: [] };
  for (let i = 0; i <= ablauf.schritte; i++) {
    ablauf.stelle(greifer, i / ablauf.schritte);
    abtasten([wurzelSpur]);
  }
  const alle = tracks([...sp, wurzelSpur], zeiten);
  clips.push(new THREE.AnimationClip(ablauf.name, ablauf.dauer, alle));
  greifer.wurzel.position.set(0, 0, 0);
  greifer.setDrehung(0);
  greifer.setOeffnung(0);
}

/** Statische Posen als eigene, einzelbildlange Clips — praktisch zum Prüfen. */
for (const [name, wert] of [
  ["POSE_ZU", 0],
  ["POSE_HALB", 0.5],
  ["POSE_OFFEN", 1],
] as Array<[string, number]>) {
  const sp = spuren(greifer);
  greifer.setOeffnung(wert);
  abtasten(sp);
  greifer.setOeffnung(wert);
  abtasten(sp);
  clips.push(new THREE.AnimationClip(name, 0.04, tracks(sp, [0, 0.04], false)));
}
greifer.setOeffnung(0);

/**
 * Gegenprobe: die geschriebene Datei wieder einlesen und nachsehen, ob darin
 * wirklich steht, was drinstehen soll.
 *
 * Ein GLB, das sich schreiben lässt, muss sich nicht laden lassen, und Clips,
 * die im Exporter existieren, müssen nicht in der Datei stehen — Spuren auf
 * Knoten, die der Exporter nicht kennt, fallen stillschweigend weg. Also wird
 * geladen, abgespielt und gemessen.
 */
function gegenprobe(puffer: Buffer): void {
  const loader = new GLTFLoader();
  const ab = puffer.buffer.slice(
    puffer.byteOffset,
    puffer.byteOffset + puffer.byteLength
  ) as ArrayBuffer;
  loader.parse(
    ab,
    "",
    (gltf) => {
      const szene = gltf.scene;
      const fehlt = [
        "01_AUFHAENGUNG",
        "02_ROTATOR",
        "03_DREHWERKSGEHAEUSE",
        "GRAPPLE_HEAD",
        ...Array.from({ length: MASS.schalen }, (_, i) => {
          const nr = String(i + 1).padStart(2, "0");
          return [
            `SHELL_${nr}`,
            `CYLINDER_${nr}`,
            `CYL_ROD_${nr}`,
            `CYL_ROD_SHAFT_${nr}`,
            `CYL_ROD_EYE_${nr}`,
            `SHELL_TIP_${nr}`,
          ];
        }).flat(),
      ].filter((n) => !szene.getObjectByName(n));
      if (fehlt.length) {
        console.error("  FEHLEN im GLB:", fehlt.join(", "));
        process.exitCode = 1;
        return;
      }

      const mixer = new THREE.AnimationMixer(szene);
      const oeffnen = gltf.animations.find((c) => c.name === "OEFFNEN");
      const drehen = gltf.animations.find((c) => c.name === "DREHEN");
      if (!oeffnen || !drehen) {
        console.error("  Clips OEFFNEN/DREHEN fehlen im GLB");
        process.exitCode = 1;
        return;
      }
      const schale = szene.getObjectByName("SHELL_01")!;
      /*
       * Gemessen wird am AUGE der Kolbenstange, und zwar seine Lage in Metern.
       * Vorher stand hier die Skalierung der Stangengruppe, ausgegeben als
       * Zentimeter — das meldete 118 cm Hub, wo der Zylinder 19 cm faehrt.
       */
      const stange = szene.getObjectByName("CYL_ROD_EYE_01")!;
      const rotator = szene.getObjectByName("ROTATOR")!;

      /*
       * Abgetastet wird KURZ VOR dem Clipende, nicht genau darauf: Bei
       * Schleifenwiedergabe springt der Mixer am Ende auf null zurueck, und
       * man misst zweimal denselben Wert. Genau das ist hier beim ersten
       * Anlauf passiert — der Greifer sah bewegungslos aus, obwohl die Spuren
       * in der Datei standen.
       */
      const wirkung = mixer.clipAction(oeffnen);
      wirkung.play();
      mixer.update(0);
      const zuWinkel = schale.rotation.x;
      const zuStange = stange.position.y;
      mixer.update(oeffnen.duration * 0.98);
      const offenWinkel = schale.rotation.x;
      const offenStange = stange.position.y;
      wirkung.stop();

      const drehWirkung = mixer.clipAction(drehen);
      drehWirkung.play();
      mixer.update(0);
      mixer.update(drehen.duration * 0.25);
      const gedreht = rotator.rotation.y;
      drehWirkung.stop();

      console.log(
        `  Gegenprobe: Schale schwenkt ${(((offenWinkel - zuWinkel) * 180) / Math.PI).toFixed(1)}°, ` +
          `Stange faehrt beim Oeffnen ${Math.abs((offenStange - zuStange) * 100).toFixed(0)} cm ` +
          `${offenStange > zuStange ? "ein" : "aus"}, ` +
          `Rotator nach einem Viertel bei ${((gedreht * 180) / Math.PI).toFixed(0)}°`
      );
      for (const name of ["POSE_ZU", "POSE_HALB", "POSE_OFFEN"]) {
        const clip = gltf.animations.find((c) => c.name === name);
        if (!clip || clip.tracks.length === 0) {
          console.error(`  Clip ${name} ist leer.`);
          process.exitCode = 1;
        }
      }
      if (Math.abs(offenWinkel - zuWinkel) < 0.5) {
        console.error("  Die Schalen bewegen sich im GLB nicht.");
        process.exitCode = 1;
      }
      if (Math.abs(offenStange - zuStange) < 0.05) {
        console.error("  Die Kolbenstange bewegt sich im GLB nicht.");
        process.exitCode = 1;
      }
    },
    (fehler) => {
      console.error("  GLB laesst sich nicht laden:", fehler);
      process.exitCode = 1;
    }
  );
}

const exporter = new GLTFExporter();
exporter.parse(
  greifer.wurzel,
  (ergebnis) => {
    const puffer = Buffer.from(ergebnis as ArrayBuffer);
    writeFileSync("src/greifer/greifer-mehrschalen.glb", puffer);
    let dreiecke = 0;
    let meshes = 0;
    greifer.wurzel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const idx = m.geometry.getIndex();
      dreiecke += (idx ? idx.count : m.geometry.getAttribute("position").count) / 3;
    });
    console.log(
      `src/greifer/greifer-mehrschalen.glb  ${(puffer.length / 1024).toFixed(0)} kB · ` +
        `${meshes} Meshes · ${dreiecke} Dreiecke · ${clips.length} Clips: ` +
        clips.map((c) => c.name).join(", ")
    );
    gegenprobe(puffer);
  },
  (fehler) => {
    console.error("Export fehlgeschlagen:", fehler);
    process.exitCode = 1;
  },
  { binary: true, animations: clips, onlyVisible: false }
);
