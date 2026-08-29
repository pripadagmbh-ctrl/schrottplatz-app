import * as THREE from "three";
import { Input } from "./core/input";
import { TouchControls } from "./core/touch";
import { DebugOverlay } from "./core/debugOverlay";
import { EventBus } from "./core/events";
import { initPhysics, PhysicsWorld } from "./physics/physicsWorld";
import { GripSystem } from "./physics/gripSystem";
import { Excavator } from "./excavator/excavator";
import { OrbitCamera } from "./excavator/orbitCamera";
import { Yard } from "./world/yard";
import { ItemManager } from "./world/scrapItems";
import { ContainerManager } from "./world/containers";
import { AudioManager } from "./audio/audioManager";
import { Hud } from "./ui/hud";
import { Particles } from "./world/particles";
import { CompositeManager } from "./dismantle/composites";
import { FenceManager } from "./world/fence";
import { VehicleManager } from "./delivery/vehicles";
import { PressManager } from "./world/press";
import { randomCargo } from "./world/scrapItems";
import { Shift } from "./economy/shift";
import { Signage } from "./world/signage";
import {
  type AxisId,
  type ControlFunction,
  FUNCTION_LABELS,
  defaultConfig,
  saveConfig,
} from "./core/controlConfig";
import { Account } from "./economy/account";
import { getMaterial } from "./materials/catalog";
import { StaffManager } from "./world/people";
import { GATE_X, WEIGH_X, WEIGH_Z } from "./world/yard";
import { clearSave, readSave, storeSave, type SaveData } from "./core/save";

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5; // Spiral-of-death-Schutz
const RECOUNT_INTERVAL = 10; // Container-Zählung alle 10 Steps

async function main(): Promise<void> {
  await initPhysics();
  document.getElementById("loading")!.remove();

  // --- Renderer & Szene ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c4cc); // leicht bewölkter Spätvormittag (Kap. 16)
  scene.fog = new THREE.Fog(0xb8c4cc, 60, 140);

  const hemi = new THREE.HemisphereLight(0xdde6ec, 0x6b6257, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 80;
  scene.add(sun);

  // --- Spielobjekte ---
  const bus = new EventBus();
  const physics = new PhysicsWorld();
  const input = new Input(renderer.domElement);
  const touch = new TouchControls(renderer.domElement);
  const yard = new Yard(scene, physics.world);
  const signage = new Signage(scene); // Orientierungstexte, mit M umschaltbar
  const items = new ItemManager(scene, physics.world);
  const containers = new ContainerManager(scene, physics.world, bus);
  const composites = new CompositeManager(scene, physics.world, items, bus);
  const account = new Account();

  // Boot: vorhandener Spielstand → Welt aus dem Save; sonst Neues Spiel
  const save = readSave();
  let fence: FenceManager;
  if (save) {
    account.moneyEur = save.moneyEur;
    fence = new FenceManager(scene, physics.world, items, bus, save.fencesBroken);
    for (const it of save.items) {
      items.spawnScrap(
        it.materialId,
        it.massKg,
        it.shape,
        new THREE.Vector3(it.pos[0], it.pos[1], it.pos[2]),
        new THREE.Quaternion(it.rot[0], it.rot[1], it.rot[2], it.rot[3])
      );
    }
    for (const c of save.cars) {
      const car = composites.spawnCar(new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]));
      car.body.setRotation({ x: c.rot[0], y: c.rot[1], z: c.rot[2], w: c.rot[3] }, true);
      car.restoreState(c);
    }
  } else {
    fence = new FenceManager(scene, physics.world, items, bus);
    // Großer Berg auf der Stahlschrottfläche. Die Annahmefläche bleibt frei,
    // dort laden die Pritschen ab.
    items.spawnPile(new THREE.Vector3(-9, 0, 1));
    // Altfahrzeuge stehen von Anfang an am Rand des Stahlschrott-Haufens
    composites.spawnCar(new THREE.Vector3(-15.8, 0.5, 3.5));
    composites.spawnCar(new THREE.Vector3(-15.8, 0.5, -2.5));
    // loser Schrott auf den Bergen hinter dem Bagger — hoch genug über der
    // Kegelspitze (1,9 m) spawnen, sonst klemmt er im Berg-Kollider
    for (const mound of yard.moundCenters) {
      randomCargo(5).forEach((s, i) => {
        const a = (i / 5) * Math.PI * 2;
        items.spawnScrap(
          s.materialId,
          s.massKg,
          s.shape,
          // vor dem Berg (außerhalb des Kegel-Kolliders, Radius 2,6) und
          // gestaffelt, damit sich beim Spawn nichts durchdringt
          new THREE.Vector3(mound.x + Math.cos(a) * 3.3, 1.2 + i * 1.1, mound.z + Math.sin(a) * 3.3)
        );
      });
    }
  }
  const vehicles = new VehicleManager(scene, physics.world, items, composites);
  const press = new PressManager(scene, physics.world, items, composites);
  const staff = new StaffManager(
    scene,
    items,
    new THREE.Vector3(WEIGH_X, 0, WEIGH_Z),
    physics.world,
    GATE_X
  );
  staff.getExcavatorPos = () => excavator.position;
  const carPos: THREE.Vector3[] = [];
  staff.getObstaclePositions = () => {
    carPos.length = 0;
    for (const c of composites.cars) {
      const p = c.body.translation();
      carPos.push(new THREE.Vector3(p.x, 0, p.z));
    }
    return carPos;
  };

  const buildSaveData = (): SaveData => ({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    moneyEur: account.moneyEur,
    shift: shift.toJSON(),
    items: items.items
      .filter((i) => i.shape)
      .map((i) => {
        const p = i.body.translation();
        const r = i.body.rotation();
        return {
          materialId: i.materialId,
          massKg: i.massKg,
          shape: i.shape!,
          pos: [p.x, p.y, p.z],
          rot: [r.x, r.y, r.z, r.w],
        };
      }),
    cars: composites.cars.map((c) => c.saveState),
    fencesBroken: fence.brokenFlags,
  });
  const excavator = new Excavator(scene, physics.world);
  const grip = new GripSystem(physics.world, excavator.grappleBody);
  const orbit = new OrbitCamera(window.innerWidth / window.innerHeight);
  const debug = new DebugOverlay();
  const audio = new AudioManager();
  const hud = new Hud();
  const particles = new Particles(scene);

  // --- Pausenmenü ---
  // Tagesablauf: Annahme → Sortieren → Annahme (Briefing Kap. 21)
  const shift = new Shift();
  shift.load(save?.shift);
  let looseKg = 0;
  let looseTimer = 0;
  /**
   * Lose auf dem Platz liegender Schrott. Alles, was nicht in einer Box liegt
   * und am Boden ist, zählt — das ist die Arbeit, die noch vor dem Spieler
   * liegt. Die Summe ändert sich träge, daher reicht viermal pro Sekunde.
   */
  const measureLoose = (): number => {
    let kg = 0;
    for (const it of items.items) {
      if (it.containerId) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (it.body.translation().y > 2.5) continue; // noch auf einer Ladefläche
      kg += it.massKg;
    }
    return kg;
  };

  const pauseEl = document.getElementById("pause")!;
  let paused = false;
  const setPaused = (v: boolean): void => {
    paused = v;
    pauseEl.classList.toggle("open", v);
    if (!v) {
      pauseEl.classList.remove("settings");
      document.getElementById("controls-menu")!.classList.remove("open");
    }
  };
  document.getElementById("pause-resume")!.addEventListener("click", () => setPaused(false));
  document.getElementById("pause-save")!.addEventListener("click", () => {
    hud.toast(storeSave(buildSaveData()) ? "Gespeichert." : "Speichern fehlgeschlagen!");
    setPaused(false);
  });
  document.getElementById("pause-load")!.addEventListener("click", () => location.reload());
  document.getElementById("pause-new")!.addEventListener("click", () => {
    clearSave();
    location.reload();
  });

  // --- Steuerungsmenü: die vier Stickachsen frei belegen ---
  const AXIS_IDS: AxisId[] = ["leftY", "leftX", "rightY", "rightX"];
  const warnEl = document.getElementById("ctrl-warn")!;
  const renderControls = (): void => {
    for (const id of AXIS_IDS) {
      const sel = document.getElementById(`ax-${id}`) as HTMLSelectElement;
      const b = touch.config[id];
      if (sel.options.length === 0) {
        for (const [fn, label] of Object.entries(FUNCTION_LABELS)) {
          sel.add(new Option(label, fn));
        }
      }
      sel.value = b.fn;
      document.getElementById(`inv-${id}`)!.classList.toggle("on", b.invert);
    }
    // Doppelt belegte Funktionen sind erlaubt, aber selten gewollt — Hinweis
    const used = AXIS_IDS.map((i) => touch.config[i].fn).filter((f) => f !== "none");
    const doppelt = used.filter((f, i) => used.indexOf(f) !== i);
    warnEl.textContent = doppelt.length
      ? `Mehrfach belegt: ${[...new Set(doppelt)].map((f) => FUNCTION_LABELS[f]).join(", ")}`
      : "";
  };
  for (const id of AXIS_IDS) {
    document.getElementById(`ax-${id}`)!.addEventListener("change", (e) => {
      touch.config[id].fn = (e.target as HTMLSelectElement).value as ControlFunction;
      saveConfig(touch.config);
      renderControls();
    });
    document.getElementById(`inv-${id}`)!.addEventListener("click", () => {
      touch.config[id].invert = !touch.config[id].invert;
      saveConfig(touch.config);
      renderControls();
    });
  }
  const showControls = (v: boolean): void => {
    pauseEl.classList.toggle("settings", v);
    document.getElementById("controls-menu")!.classList.toggle("open", v);
    if (v) renderControls();
  };
  const ctrlBtn = document.getElementById("pause-controls")!;
  if (!touch.active) ctrlBtn.style.display = "none";
  ctrlBtn.addEventListener("click", () => showControls(true));
  document.getElementById("ctrl-back")!.addEventListener("click", () => showControls(false));
  document.getElementById("ctrl-reset")!.addEventListener("click", () => {
    touch.config = defaultConfig();
    saveConfig(touch.config);
    renderControls();
  });

  const helpEl = document.getElementById("help")!;
  if (touch.active) helpEl.style.display = "none"; // auf Touchgeräten stört die Tastenliste
  const sensorPos = new THREE.Vector3();

  // --- Event-Verdrahtung (Kap. 17: Querverbindungen nur über Events) ---
  grip.onGrabbed = (bodies) => {
    audio.playGrab();
    for (const b of bodies) fence.notifyGrabbed(b); // verankertes Zaunfeld? → losreißen
  };
  grip.onTear = () => audio.playTear();
  grip.partResolver = (pos) => composites.findPartNear(pos);
  grip.insideGrapple = (pos) => excavator.isInsideGrapple(pos);
  // Zudrücken: was nachgibt, wird in der Spinne plattgequetscht
  grip.crusher = (body) => {
    const it = items.items.find((i) => i.body.handle === body.handle);
    if (!it || !items.isCrushable(it)) return false;
    if (!items.flattenItem(it)) return false;
    const p = body.translation();
    audio.playDrop(it.materialId);
    particles.spawn(new THREE.Vector3(p.x, p.y, p.z), 6, 0xb0b6bb, 1.6, 1.2, 0.5);
    hud.toast(`${getMaterial(it.materialId).name} zusammengedrückt`);
    return true;
  };
  bus.on("itemEntered", (e) => {
    audio.playDrop(e.materialId);
    if (e.correct) {
      audio.playCorrect();
      const it = items.items.find((i) => i.id === e.itemId);
      if (it) account.paySortingBonus(it.massKg); // Sortierprämie sofort aufs Konto
    } else {
      audio.playWrong();
    }
  });
  const evPos = new THREE.Vector3();
  bus.on("glassShattered", (e) => {
    audio.playGlass();
    particles.spawn(evPos.set(e.x, e.y, e.z), 14, 0xcfe8f2, 2.4, 1.6, 0.5);
  });
  bus.on("crushed", (e) => {
    audio.playCrash(1);
    particles.spawn(evPos.set(e.x, e.y + 0.4, e.z), 12, 0x9a8b74, 2.2, 1.6, 0.7);
    particles.spawn(evPos.set(e.x, e.y + 0.3, e.z), 6, 0xffc060, 4, 2, 0.4);
  });
  bus.on("fenceBroken", (e) => {
    audio.playRattle();
    particles.spawn(evPos.set(e.x, 0.3, e.z), 8, 0x9a8b74, 1.5, 1.2, 0.6);
  });
  press.onStart = () => {
    audio.playGrab(); // Hydraulik läuft an
    hud.toast("Schere: Klappen schließen …");
  };
  press.onLidsClosed = () => audio.playCrash(0.6); // Eisenplatten schlagen auf
  press.onStamp = (count, pos) => {
    audio.playCrash(1);
    audio.playTear();
    particles.spawn(pos, 16, 0x9a8b74, 2.5, 1.8, 0.7);
    particles.spawn(pos, 8, 0xffc060, 4, 2, 0.4);
    hud.toast(count > 0 ? `Schere: ${count} Teil${count > 1 ? "e" : ""} zum Paket gepresst` : "Schere: Mulde war leer");
  };
  // Fahrer fahren weder durch den Bagger noch über liegenden Schrott (Kap. 13)
  vehicles.getExcavatorPos = () => excavator.position;
  vehicles.onHonk = () => {
    audio.playWrong();
    hud.toast("Der Fahrer hupt — Fahrspur ist blockiert!");
  };
  // Brückenwaage: voll rein, leer raus → Kunde bekommt sein Geld
  vehicles.onWeighIn = (kg) => {
    const rein = vehicles.activeSortedMaterial;
    hud.toast(
      rein
        ? `Waage: ${kg.toFixed(0)} kg brutto — sortenrein ${getMaterial(rein).name}.`
        : `Waage: ${kg.toFixed(0)} kg brutto — bitte abladen.`
    );
  };
  vehicles.onWeighOut = (netKg) => {
    const paid = account.payDelivery(netKg);
    shift.deliveriesThisShift++;
    audio.playSale();
    hud.toast(`Waage: ${netKg.toFixed(0)} kg netto · Kunde erhält ${paid.toFixed(0)} €`);
  };
  // Abhol-LKW fährt los → Container abrechnen (sortenrein zahlt sich aus)
  vehicles.onPickupDepart = (truck) => {
    const loaded = truck.containedItems(items);
    const sale = account.sellContainer(loaded, items, composites);
    if (sale.massKg > 0) {
      audio.playSale();
      hud.toast(
        `Verkauft: ${sale.massKg.toFixed(0)} kg ${getMaterial(sale.dominant).name} · ` +
          `${(sale.purity * 100).toFixed(0)} % sortenrein · +${sale.eur.toFixed(0)} €`
      );
    } else {
      hud.toast("Container war leer — der LKW fährt umsonst.");
    }
  };

  // --- Fester Physik-Step, von Loop und Test-Handle gemeinsam genutzt ---
  let stepCount = 0;
  function stepOnce(): void {
    excavator.update(FIXED_DT, input);
    excavator.getSensorPosition(sensorPos);
    grip.update(excavator.closure, excavator.closing, sensorPos, FIXED_DT);
    excavator.carriedMassKg = grip.totalMassKg;
    excavator.carriedCount = grip.grippedCount;
    vehicles.obstacleHandles(excavator.obstacleBodies);
    // Karossen sind ebenfalls feste Störer: der Arm soll nicht hindurchfahren.
    // Die Spinne selbst bleibt frei — sonst käme man nicht mehr zum Greifen ran.
    for (const car of composites.cars) {
      if (car.body.isValid()) excavator.obstacleBodies.add(car.body.handle);
    }
    physics.step();
    items.clampSpeeds();
    composites.update();
    fence.update();
    vehicles.update(FIXED_DT);
    press.update(FIXED_DT);
    staff.update(FIXED_DT, vehicles.maneuveringTruck());
    stepCount++;
    if (stepCount % RECOUNT_INTERVAL === 0) {
      const grippedHandles = new Set(grip.grippedBodies.map((b) => b.handle));
      containers.recount(items, grippedHandles);
    }
  }

  // Debug-Handle für automatisierte Smoke-Tests (nur Dev-Server, nicht im Build)
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__game = {
      excavator,
      grip,
      physics,
      input,
      THREE,
      items,
      containers,
      composites,
      fence,
      vehicles,
      account,
      press,
      bus,
      saveNow: () => storeSave(buildSaveData()),
      touch,
      audio,
      togglePause: () => setPaused(!paused),
      isPaused: () => paused,
      step: (n: number) => {
        for (let i = 0; i < n; i++) stepOnce();
        items.syncMeshes();
      },
    };
  }

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    orbit.resize(window.innerWidth / window.innerHeight);
  });

  // --- Hauptschleife ---
  let accumulator = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let labelsOn = true; // Zonen-Schilder sichtbar

  function frame(): void {
    const now = performance.now();
    const frameDt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    touch.update();
    if (input.wasPressed("Escape") || input.wasPressed("KeyP") || touch.consumePress("Escape")) {
      setPaused(!paused);
    }
    if (paused) {
      // In der Pause ruht die Simulation; nur Rendern und Eingaben laufen weiter
      renderer.render(scene, orbit.camera);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }
    excavator.touch = touch.active ? touch.axes : null;
    if (touch.consumePress("KeyC")) orbit.touchViewPress = true;
    if (touch.consumePress("KeyX")) excavator.toggleCabLift();
    if (touch.consumePress("KeyO")) excavator.toggleOutriggers();
    if (input.wasPressed("KeyM") || touch.consumePress("KeyM")) {
      labelsOn = !labelsOn;
      containers.setLabelsVisible(labelsOn);
      signage.setVisible(labelsOn);
      hud.toast(labelsOn ? "Markierungen an" : "Markierungen aus");
    }
    if (input.wasPressed("F3")) debug.toggle();
    if (input.wasPressed("KeyH")) {
      helpEl.style.display = helpEl.style.display === "none" ? "block" : "none";
    }
    // Abholung anfordern / beladenen Container abfahren lassen
    if (input.wasPressed("KeyV") || touch.consumePress("KeyV")) {
      const r = vehicles.requestPickup();
      if (r === "gerufen") hud.toast("Abholung angefordert — LKW kommt über die Ostspur.");
      else if (r === "abgefahren") hud.toast("Container geht raus …");
      else hud.toast("Erst muss das Fahrzeug auf dem Platz fertig werden.");
    }
    // „Mach Platz": vor dem Abladen wegschicken, danach ein Stück vorfahren
    if (input.wasPressed("KeyZ") || touch.consumePress("KeyZ")) {
      const r = vehicles.makeRoom();
      if (r === "weggeschickt") hud.toast("Weggeschickt — der Fahrer dreht ab.");
      else if (r === "vorgefahren") hud.toast("LKW fährt ein Stück vor.");
      else hud.toast("Gerade ist kein Fahrzeug auf dem Platz.");
    }
    if (input.wasPressed("KeyU") || touch.consumePress("KeyU")) {
      hud.toast(audio.toggleMusic() ? "Musik an." : "Musik aus.");
    }
    if (input.wasPressed("KeyK")) {
      hud.toast(storeSave(buildSaveData()) ? "Gespeichert." : "Speichern fehlgeschlagen!");
    }
    if (input.wasPressed("KeyB") || touch.consumePress("KeyB")) {
      if (!press.start()) hud.toast("Presse läuft bereits …");
    }
    if (input.wasPressed("KeyL")) {
      location.reload(); // Boot lädt den letzten Stand
    }
    if (input.wasPressed("KeyN")) {
      clearSave();
      location.reload();
    }
    excavator.handleDiscreteInput(input); // Mausrad-Rotator, einmal pro Frame

    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      stepOnce();
      accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;

    items.syncMeshes();
    excavator.setFirstPerson(orbit.mode === "cabin"); // Ego-Sicht: nur die eigenen Unterarme
    orbit.update(
      frameDt,
      input,
      (out) => excavator.getCameraTarget(out),
      (out) => {
        excavator.getCabinEye(out);
        return excavator.cabinBaseYaw;
      }
    );
    renderer.render(scene, orbit.camera);

    // --- HUD, Highlight, Ampel, Audio (pro Render-Frame) ---
    excavator.getSensorPosition(sensorPos);
    if (grip.grippedCount > 0) {
      items.setHighlight(null);
      const carried = grip.grippedBodies
        .map((b) => items.itemByBody(b))
        .filter((i): i is NonNullable<typeof i> => !!i);
      const hover = containers.updateHover(
        sensorPos.x,
        sensorPos.z,
        carried.map((i) => i.materialId)
      );
      hud.showCarry(carried, hover);
    } else {
      containers.updateHover(sensorPos.x, sensorPos.z, []);
      const tearing = grip.tearing;
      if (tearing) {
        items.setHighlight(null);
        hud.showTearing(tearing.name, tearing.progress01);
      } else if (excavator.closure < 0.3) {
        const part = composites.findPartNear(sensorPos);
        if (part) {
          items.setHighlight(null);
          hud.showPartHint(part.name);
        } else {
          const target = items.findNearest(sensorPos, 1.2);
          items.setHighlight(target);
          hud.showTarget(target);
        }
      } else {
        items.setHighlight(null);
        hud.showClosedEmpty();
      }
    }
    looseTimer += frameDt;
    if (looseTimer > 0.25) {
      looseKg = measureLoose();
      looseTimer = 0;
    }
    shift.update(frameDt, looseKg);
    vehicles.acceptDeliveries = shift.acceptsDeliveries;
    const wechsel = shift.consumeChange();
    if (wechsel === "sortieren") {
      hud.toast("Feierabend an der Einfahrt — jetzt sortieren, pressen, abholen lassen (V)");
    } else if (wechsel === "annahme") {
      hud.toast(`Platz ist frei — die Einfahrt macht wieder auf (Zyklus ${shift.cycle + 1})`);
    }
    hud.updateShift(shift.statusText(looseKg), shift.phase === "sortieren");
    excavator.updateInstruments(frameDt);
    hud.updateMoney(account.moneyEur, containers.totalValue());
    audio.updateEngine(excavator.activity, Math.min(grip.totalMassKg / 2000, 1));

    // Bodenkontakt: Kratzen + Staub, bei hoher Intensität Funken (Kap. 6.1)
    frameCount++;
    particles.update(frameDt);
    const gc = excavator.groundContact;
    if (gc.active && gc.intensity > 0.03) {
      audio.setScrape(gc.intensity);
      if (frameCount % 3 === 0) particles.spawn(gc.point, 2, 0x9a8b74, 0.9, 0.9, 0.6);
      if (gc.intensity > 0.45 && frameCount % 4 === 0) {
        particles.spawn(gc.point, 3, 0xffc060, 3.5, 1.8, 0.4);
      }
    } else {
      audio.setScrape(0);
    }

    const counts = physics.counts();
    debug.update(frameDt, {
      bodies: counts.bodies,
      awake: counts.awake,
      gripped: grip.grippedCount,
      grippedKg: grip.totalMassKg,
    });

    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error("Startfehler:", err);
  const el = document.getElementById("loading");
  if (el) el.textContent = "Fehler beim Start — Konsole prüfen.";
});
