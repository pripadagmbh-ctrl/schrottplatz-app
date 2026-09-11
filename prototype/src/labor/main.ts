import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics, PhysicsWorld } from "../physics/physicsWorld";
import { GripSystem } from "../physics/gripSystem";
import { Excavator } from "../excavator/excavator";
import { OrbitCamera } from "../excavator/orbitCamera";
import { Input } from "../core/input";
import { TouchControls } from "../core/touch";
import { ItemManager, randomCargo } from "../world/scrapItems";
import { CompositeManager } from "../dismantle/composites";
import { EventBus } from "../core/events";
import { AudioManager } from "../audio/audioManager";

/**
 * Spinnen-Labor (Auftrag 11.09.2026, Phase 1).
 *
 * Eine Testszene neben dem Spiel: Boden, eine Mulde, ein Pkw, ein paar Teile
 * und die Spinne. Mehr nicht. Wozu:
 *
 *   - **Messen.** Im Spiel laufen LKW, Personal, Presse, Tageslicht und
 *     Wirtschaft mit; da lässt sich nicht sagen, was die Spinne kostet. Hier
 *     ist alles andere weg, und die Zeit pro Bild wird in drei Töpfe
 *     aufgeteilt: Physik, Spinne samt Greifzone, Rest.
 *   - **Umbauen, ohne das Spiel anzufassen.** Die Lehre aus dem letzten
 *     Versuch war, die Spinne nicht im laufenden Spiel umzubauen. Was hier
 *     besteht, wandert danach hinüber — vorher nicht.
 *
 * Bedienung absichtlich wie im Spiel, sonst misst man ein anderes Gerät als
 * das, das gespielt wird.
 */

/** Fester Zeitschritt wie im Spiel */
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
/** So viele Bilder werden beim Start uebersprungen (Shader, Schattenkarten) */
const AUFWAERM_BILDER = 40;
/** So viele lose Teile liegen im Labor */
const TEILE = 26;
/** Mittelpunkt der Testmulde */
const MULDE = new THREE.Vector3(7, 0, -1);
/** Innenmaße der Testmulde (wie eine Sortiermulde im Spiel) */
const MULDE_B = 3.0;
const MULDE_T = 3.3;
const MULDE_H = 3.0;

/** Gleitender Mittelwert — Messwerte schwanken je Bild zu stark zum Ablesen. */
class Glaetter {
  private wert = 0;
  private erste = true;
  mittel(neu: number, faktor = 0.08): number {
    if (this.erste) {
      this.wert = neu;
      this.erste = false;
    } else {
      this.wert += (neu - this.wert) * faktor;
    }
    return this.wert;
  }
  get stand(): number {
    return this.wert;
  }
}

async function main(): Promise<void> {
  await initPhysics();
  document.getElementById("laden")!.remove();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb0bd);
  scene.fog = new THREE.Fog(0x9fb0bd, 45, 120);
  const hemi = new THREE.HemisphereLight(0xdde6ec, 0x6b6257, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.far = 70;
  scene.add(sun);

  const physics = new PhysicsWorld();
  const world = physics.world;

  // --- Boden: Platte mit Kollider, sonst nichts ---
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0x8b8071, roughness: 1 })
  );
  boden.rotation.x = -Math.PI / 2;
  boden.receiveShadow = true;
  scene.add(boden);
  const bodenBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(35, 0.5, 35).setTranslation(0, -0.5, 0).setFriction(1.1),
    bodenBody
  );

  // --- Eine Mulde, Öffnung nach Westen wie die Sortierreihe im Spiel ---
  const beton = new THREE.MeshStandardMaterial({ color: 0xa9a49a, roughness: 0.95 });
  const muldeBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const wand = (dx: number, dz: number, sx: number, sz: number): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, MULDE_H, sz), beton);
    mesh.position.set(MULDE.x + dx, MULDE_H / 2, MULDE.z + dz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(sx / 2, MULDE_H / 2, sz / 2).setTranslation(
        MULDE.x + dx,
        MULDE_H / 2,
        MULDE.z + dz
      ),
      muldeBody
    );
  };
  wand(0, -MULDE_T / 2, MULDE_B, 0.35); // Süd
  wand(0, MULDE_T / 2, MULDE_B, 0.35); // Nord
  wand(MULDE_B / 2, 0, 0.35, MULDE_T); // Rückwand im Osten

  // --- Inhalt: Teile und ein Pkw ---
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, bus);

  const legeTeile = (anzahl: number): void => {
    const specs = randomCargo(anzahl, 0.4);
    for (const s of specs) {
      const pos = new THREE.Vector3(
        -3 + (Math.random() - 0.5) * 5,
        0.6 + Math.random() * 1.2,
        1 + (Math.random() - 0.5) * 5
      );
      items.spawnScrap(s.materialId, s.massKg, s.shape, pos);
    }
    items.settle(world);
  };
  legeTeile(TEILE);
  let pkw = composites.spawnCar(new THREE.Vector3(-6.5, 0.6, -4));

  // --- Spinne ---
  const excavator = new Excavator(scene, world);
  const grip = new GripSystem(world, excavator.grappleBody);
  const audio = new AudioManager();
  grip.partResolver = (pos) => composites.findPartNear(pos);
  grip.getViolence = () => excavator.tearViolence;
  grip.onGrabbed = () => audio.playGrab();
  grip.onTear = () => audio.playTear();
  excavator.onClawSnap = (haerte) => audio.playClawSnap(haerte);

  const input = new Input(renderer.domElement);
  const touch = new TouchControls(renderer.domElement);
  excavator.touch = touch.axes;
  const orbit = new OrbitCamera(window.innerWidth / window.innerHeight);
  const sensorPos = new THREE.Vector3();

  // --- Messung: drei Töpfe je Bild ---
  const gPhysik = new Glaetter();
  const gSpinne = new Glaetter();
  const gRest = new Glaetter();
  const gFps = new Glaetter();
  let bilder = 0;
  let spitzePhysik = 0;
  let spitzeSpinne = 0;
  const messEl = document.getElementById("mess")!;
  let messUhr = 0;

  /**
   * Ein Schritt, in zwei Hälften gestoppt:
   *
   *   SPINNE  Armgeometrie, Krallen-Kollider, Greifsystem — alles, was nur
   *           wegen der Spinne gerechnet wird.
   *   PHYSIK  der Rapier-Schritt selbst.
   *
   * Alles, was danach im Bild passiert (Meshes nachführen, Zeichnen), zählt
   * als Rest. Die Aufteilung ist der Kern von Phase 1.2: Ohne sie weiß
   * niemand, ob die Spinne oder der Haufen das Budget frisst.
   */
  function stepOnce(): { spinne: number; physik: number } {
    const t0 = performance.now();
    excavator.update(FIXED_DT, input);
    excavator.getSensorPosition(sensorPos);
    grip.update(excavator.closure, excavator.closing, sensorPos, FIXED_DT);
    excavator.carriedMassKg = grip.totalMassKg;
    excavator.carriedCount = grip.grippedCount;
    excavator.grippedHandles.clear();
    for (const b of grip.grippedBodies) excavator.grippedHandles.add(b.handle);
    for (const car of composites.cars) {
      if (car.body.isValid()) excavator.obstacleBodies.add(car.body.handle);
    }
    const t1 = performance.now();
    physics.step();
    items.clampSpeeds();
    items.settleSleep(FIXED_DT, excavator.grappleBody.translation());
    composites.update();
    const t2 = performance.now();
    return { spinne: t1 - t0, physik: t2 - t1 };
  }

  let last = performance.now();
  let acc = 0;

  function frame(): void {
    const jetzt = performance.now();
    const frameDt = Math.min((jetzt - last) / 1000, 0.25);
    last = jetzt;
    acc += frameDt;

    let spinne = 0;
    let physik = 0;
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      const m = stepOnce();
      spinne += m.spinne;
      physik += m.physik;
      acc -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) acc = 0;

    const tRest0 = performance.now();
    items.syncMeshes();
    orbit.update(
      frameDt,
      input,
      (out) => out.copy(excavator.position),
      (out) => {
        excavator.getCabinEye(out);
        return excavator.cabinBaseYaw;
      }
    );
    renderer.render(scene, orbit.camera);
    const rest = performance.now() - tRest0;

    /*
     * Die ersten Bilder zaehlen nicht: Da werden Shader uebersetzt und
     * Schattenkarten angelegt, das erste Bild kostete gemessen 2,3 Sekunden.
     * Wer das in den Mittelwert laesst, liest minutenlang Unsinn ab.
     */
    bilder++;
    if (bilder > AUFWAERM_BILDER) {
      gPhysik.mittel(physik);
      gSpinne.mittel(spinne);
      gRest.mittel(rest);
      gFps.mittel(1 / Math.max(frameDt, 1e-4), 0.05);
      if (physik > spitzePhysik) spitzePhysik = physik;
      if (spinne > spitzeSpinne) spitzeSpinne = spinne;
    }
    messUhr += frameDt;
    if (messUhr > 0.25) {
      messUhr = 0;
      zeigeMessung();
    }

    // Tastenbefehle des Labors
    if (input.wasPressed("Digit1")) legeTeile(8);
    if (input.wasPressed("Digit2")) {
      pkw = composites.spawnCar(new THREE.Vector3(-6.5, 0.8, -4));
      void pkw;
    }
    if (input.wasPressed("Digit3")) {
      for (const it of items.items) if (it.body.isValid()) it.body.wakeUp();
    }
    if (input.wasPressed("KeyN")) {
      // Der Fall, der wehtut: Haufen bleibt waehrend der ganzen Messung wach
      zeigeLauf("MESSLAUF wach", messlauf(300, true));
    }
    if (input.wasPressed("KeyM")) {
      zeigeLauf("MESSLAUF ruhig", messlauf(300));
    }
    if (input.wasPressed("Digit0")) {
      spitzePhysik = 0;
      spitzeSpinne = 0;
    }

    input.endFrame();
    requestAnimationFrame(frame);
  }

  /**
   * Messlauf über eine feste Schrittzahl — unabhängig von der
   * Bildwiederholrate.
   *
   * Der Weg über die Bildschleife taugt zum Ablesen im Spiel, aber nicht zum
   * Vergleichen: Wird das Fenster nicht angezeigt, drosselt der Browser die
   * Bildschleife, und die Zahlen sagen nichts (im Testfenster gemessen: 8 fps
   * und 1400 ms „Rest", während ein Schritt tatsächlich 1,07 ms kostete).
   */
  function messlauf(
    n = 300,
    /**
     * Alle Teile vor jedem Schritt wecken. Sonst misst man den schlafenden
     * Haufen: Die Schlafhilfe legt ihn binnen weniger Schritte wieder hin,
     * und der Mittelwert sagt nichts ueber den Fall, der wehtut.
     */
    wachHalten = false
  ): {
    schritte: number;
    spinneMs: number;
    physikMs: number;
    gesamtMs: number;
    koerper: ReturnType<typeof physics.counts>;
  } {
    let spinne = 0;
    let physik = 0;
    for (let i = 0; i < n; i++) {
      if (wachHalten) {
        for (const it of items.items) if (it.body.isValid()) it.body.wakeUp();
      }
      const m = stepOnce();
      spinne += m.spinne;
      physik += m.physik;
    }
    items.syncMeshes();
    return {
      schritte: n,
      spinneMs: spinne / n,
      physikMs: physik / n,
      gesamtMs: (spinne + physik) / n,
      koerper: physics.counts(),
    };
  }

  /** Ergebnis eines Messlaufs anzeigen und ein paar Sekunden stehen lassen. */
  function zeigeLauf(titel: string, r: ReturnType<typeof messlauf>): void {
    messEl.innerHTML =
      `<b>${titel} · ${r.schritte} Schritte</b>
` +
      `Spinne+Greifer ${r.spinneMs.toFixed(2).padStart(6)} ms/Schritt
` +
      `Physik         ${r.physikMs.toFixed(2).padStart(6)} ms/Schritt
` +
      `Summe          ${r.gesamtMs.toFixed(2).padStart(6)} ms/Schritt
` +
      `beweglich ${r.koerper.dynamic} (wach ${r.koerper.dynAwake})`;
    messUhr = -6; // sechs Sekunden stehen lassen
  }

  function zeigeMessung(): void {
    const c = physics.counts();
    const info = renderer.info.render;
    const gesamt = gPhysik.stand + gSpinne.stand + gRest.stand;
    const anteil = (v: number): string =>
      gesamt > 0.01 ? `${((v / gesamt) * 100).toFixed(0).padStart(3)} %` : "  – ";
    messEl.innerHTML =
      `<b>SPINNEN-LABOR</b>\n` +
      `FPS            ${gFps.stand.toFixed(0).padStart(6)}\n` +
      `Spinne+Greifer ${gSpinne.stand.toFixed(2).padStart(6)} ms  ${anteil(gSpinne.stand)}\n` +
      `Physik         ${gPhysik.stand.toFixed(2).padStart(6)} ms  ${anteil(gPhysik.stand)}\n` +
      `Rest+Bild      ${gRest.stand.toFixed(2).padStart(6)} ms  ${anteil(gRest.stand)}\n` +
      `Summe          ${gesamt.toFixed(2).padStart(6)} ms\n` +
      `Spitze Spinne  ${spitzeSpinne.toFixed(2).padStart(6)} ms\n` +
      `Spitze Physik  ${spitzePhysik.toFixed(2).padStart(6)} ms\n` +
      `Koerper ${c.bodies} (wach ${c.awake})  beweglich ${c.dynamic} (wach ${c.dynAwake})\n` +
      `Zeichenrufe ${info.calls} · ${(info.triangles / 1000).toFixed(0)}k Dreiecke\n` +
      `Gegriffen ${grip.grippedCount} / ${grip.totalMassKg.toFixed(0)} kg`;
  }

  /*
   * Dieselben Befehle als Knoepfe: Gemessen wird auf dem iPad, und dort gibt
   * es keine Tastatur. Ohne die Knoepfe kaeme vom Geraet nur der ruhende
   * Haufen zurueck — also genau der Fall, der nichts kostet.
   */
  const knopf = (id: string, tue: () => void): void => {
    const el = document.getElementById(id);
    el?.addEventListener("click", (e) => {
      e.preventDefault();
      tue();
    });
  };
  knopf("k-teile", () => legeTeile(8));
  knopf("k-wecken", () => {
    for (const it of items.items) if (it.body.isValid()) it.body.wakeUp();
  });
  knopf("k-mess", () => zeigeLauf("MESSLAUF ruhig", messlauf(300)));
  knopf("k-mess-wach", () => zeigeLauf("MESSLAUF wach", messlauf(300, true)));

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    orbit.resize(window.innerWidth / window.innerHeight);
  });

  // Messhandle wie im Spiel: von aussen Schritte ausloesen, Schleife anhalten
  (window as unknown as { __labor: unknown }).__labor = {
    excavator,
    grip,
    items,
    composites,
    physics,
    audio,
    legeTeile,
    step: (n: number) => {
      for (let i = 0; i < n; i++) stepOnce();
      items.syncMeshes();
    },
    messlauf,
    messwerte: () => ({
      fps: gFps.stand,
      spinneMs: gSpinne.stand,
      physikMs: gPhysik.stand,
      restMs: gRest.stand,
      spitzeSpinne,
      spitzePhysik,
      koerper: physics.counts(),
      zeichenrufe: renderer.info.render.calls,
    }),
  };

  requestAnimationFrame(frame);
}

void main();
