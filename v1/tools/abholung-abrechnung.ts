/**
 * EINE GANZE ABHOLUNG, KOPFLOS GEFAHREN — und was dabei abgerechnet wird.
 *
 * Ansage Patrick am Geraet, 15.09.2026: „Also ich habe gerade einen Abholer
 * kommen lassen mit Stahlschrott, der ist auch abgefahren, aber es hat sich
 * weder am Kontostand noch was geaendert, noch sind danach noch Haendler
 * gekommen und es stand auch 0 Tonnen umgeschlagen."
 *
 * Verkauf und Umschlagszaehler haengen an EINER Stelle: `onPickupDepart` in
 * `src/main.ts` ruft `truck.containedItems(items)` und gibt das an
 * `account.sellContainer()`. Kommt dort eine leere Liste an, ist beides null.
 * Dieses Werkzeug faehrt deshalb die ganze Kette wirklich ab — Wagen rufen,
 * Stahl mit der Physik auf die Flaeche fallen lassen, mit V losschicken — und
 * protokolliert in jedem Schritt, was die beiden Zaehlstellen sagen:
 *
 *   `containedItems()`  — woraus der Verkauf gerechnet wird,
 *   `ladeflaecheKg()`   — woraus die Ausfahrtswiegung gerechnet wird (E-064).
 *
 * Beide sollen dasselbe zaehlen. Weichen sie ab, steht hier, wo.
 *
 * NULLPROBE ZUERST. Ein Abholer, auf den nie etwas geladen wurde, MUSS mit
 * 0 kg, 0 EUR und der Meldung „Container war leer" abfahren. Kommt dort etwas
 * anderes heraus, misst das Geraet sich selbst und keine Zahl dieses Laufs
 * gilt; dann bricht es mit Fehlercode ab.
 *
 * Aufruf: npx vite-node tools/abholung-abrechnung.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, randomCargo, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";
import { Shift } from "../src/economy/shift";
import { getMaterial } from "../src/materials/catalog";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { setBaggerOrt, BED_HALF_W } from "../src/delivery/routes";

import { ContainerManager } from "../src/world/containers";
import { ContainerAbholung } from "../src/delivery/platzinventarAbholung";
import { setBuildingObstacles } from "../src/world/obstacles";
import { START_HAUFEN, START_AUTOS, START_STREU } from "../src/world/startplatz";
import { leinwandAttrappe } from "./leinwand-attrappe";

/**
 * Der Fahrzeugtyp, ohne ihn auszufuehren.
 *
 * Die Klasse `DeliveryVehicle` ist in `vehicles.ts` absichtlich nicht
 * exportiert — von aussen geht alles ueber den Fuhrpark. Gebraucht wird hier
 * nur ihr TYP, und den gibt `VehicleManager.pickupTruck` heraus. So bleibt die
 * Modulgrenze, wie sie ist.
 */
type Abholer = NonNullable<VehicleManager["pickupTruck"]>;

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  account: Account;
  shift: Shift;
  composites: CompositeManager;
  containers: ContainerManager | null;
}

/**
 * Der nackte Platz: Boden, ein Fahrzeug, sonst nichts.
 *
 * Damit laesst sich die Abrechnung allein pruefen — ohne Bauwerke, Behaelter
 * und Startschrott, die alle mitreden koennten.
 */
function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  return {
    m,
    items,
    world,
    scene,
    account: new Account(),
    shift: new Shift(),
    composites,
    containers: null,
  };
}

/**
 * Der Platz wie beim „Neuen Spiel" — Mauern, Behaelter, Starthaufen, Autos,
 * Streuschrott und das Platzinventar am Abholer.
 *
 * Der nackte Aufbau oben kann einen Fehler verstecken, der erst entsteht, wenn
 * ein Behaelter, ein Bauwerk oder ein zweites Fahrzeug mitspielt. Deshalb
 * dieselbe Messung ein zweites Mal, mit allem, was `main.ts` auch aufbaut.
 */
function bauePlatzWieImSpiel(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  /*
   * Kein `new Yard(...)`: Der Platzbau braucht eine Zeichenflaeche (`document`)
   * und liefert nur Kulisse und Mauerkollider. Was die Fahrzeuge an Bauwerken
   * sehen, steht ohnehin in `obstacles.ts` — das ist Moduldaten, keine Szene.
   */
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const containers = new ContainerManager(scene, world, bus);
  const composites = new CompositeManager(scene, world, items, bus);
  items.spawnPile(
    new THREE.Vector3(START_HAUFEN.x, 0, START_HAUFEN.z),
    START_HAUFEN.teile,
    START_HAUFEN.streuung
  );
  for (const a of START_AUTOS) composites.spawnCar(new THREE.Vector3(a.x, 0.5, a.z));
  randomCargo(START_STREU.teile).forEach((sp, i) => {
    const a = (i / START_STREU.teile) * Math.PI * 2;
    items.spawnScrap(
      sp.materialId,
      sp.massKg,
      sp.shape,
      new THREE.Vector3(
        START_STREU.x + Math.cos(a) * START_STREU.radius,
        0.8 + (i % 3) * 0.7,
        START_STREU.z + Math.sin(a) * START_STREU.radius
      )
    );
  });
  items.settle(world);
  const m = new VehicleManager(scene, world, items, composites);
  m.platzinventar = new ContainerAbholung(containers, items, world);
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  return { m, items, world, scene, account: new Account(), shift: new Shift(), composites, containers };
}

/**
 * Ein Takt des ganzen Platzes.
 *
 * Wie in `test/abholerwaage.test.ts` — und mit `scene.updateMatrixWorld()`,
 * das im Spiel der Renderer jedes Bild besorgt. Ohne das stuenden alle
 * Weltmatrizen der Baugruppen still, und jede Umrechnung „Welt → Flaeche"
 * rechnete mit der Lage von vorgestern.
 */
function takt(p: Platz, dt = 1 / 60): void {
  if (p.containers) {
    // Wie in `main.ts`: bewegliche Behaelter sind jedes Bild neue Hindernisse.
    setBuildingObstacles(p.containers.hindernisse());
    p.containers.bremseAlle();
  }
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
  p.scene.updateMatrixWorld(true);
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

/** Lage eines Teils im System der Ladeflaeche — fuer das Protokoll. */
function lokal(truck: Abholer, body: RAPIER.RigidBody): THREE.Vector3 {
  const bed = (truck as unknown as { bedGroup: THREE.Group }).bedGroup;
  const t = body.translation();
  return bed.worldToLocal(new THREE.Vector3(t.x, t.y, t.z));
}

/** Was der Spieler auflaedt: Stahlteile, die wirklich auf die Flaeche fallen. */
function ladeAuf(
  p: Platz,
  truck: Abholer,
  massen: number[],
  merke: Set<number>
): number {
  const bed = (truck as unknown as { bedGroup: THREE.Group; bedLen: number }).bedGroup;
  const bedLen = (truck as unknown as { bedLen: number }).bedLen;
  let soll = 0;
  for (const [i, kg] of massen.entries()) {
    // Mitte der Flaeche, gestaffelt in der Laenge, 1,2 m ueber dem Blech:
    // genau so setzt der Spieler ab — von oben, in den Container hinein.
    const wo = bed.localToWorld(
      new THREE.Vector3(0, 1.2, bedLen * (0.25 + 0.5 * (i / Math.max(massen.length - 1, 1))))
    );
    const it = p.items.spawnScrap("steel", kg, kiste(), wo, new THREE.Quaternion());
    merke.add(it.body.handle);
    soll += kg;
    for (let s = 0; s < 45; s++) takt(p);
  }
  for (let s = 0; s < 120; s++) takt(p);
  return soll;
}

interface Protokoll {
  name: string;
  sollKg: number;
  containedVor: { n: number; kg: number };
  flaecheVor: number;
  containedBeiAbfahrt: { n: number; kg: number };
  flaecheBeiAbfahrt: number;
  verkaufEur: number;
  verkaufKg: number;
  geldVor: number;
  geldNach: number;
  umschlagVor: number;
  umschlagNach: number;
  meldung: string;
  restAufPlatz: number;
  lagen: string[];
}

function summe(items: Array<{ massKg: number }>): number {
  let kg = 0;
  for (const it of items) kg += it.massKg;
  return kg;
}

/** Eine vollstaendige Abholung: rufen, laden, losschicken, abrechnen. */
function fahreAbholung(name: string, massen: number[], wieImSpiel = false): Protokoll {
  const p = wieImSpiel ? bauePlatzWieImSpiel() : bauePlatz();
  const prot: Partial<Protokoll> = { name, meldung: "(keine)" };
  const lagen: string[] = [];

  // Genau die Verdrahtung aus `main.ts`, Zeile 924 ff.
  p.m.onPickupDepart = (truck) => {
    const geldVor = p.account.moneyEur;
    const umschlagVor = p.shift.turnoverKg;
    const loaded = truck.containedItems(p.items);
    prot.containedBeiAbfahrt = { n: loaded.length, kg: summe(loaded) };
    prot.flaecheBeiAbfahrt = truck.ladeflaecheKg();
    const sale = p.account.sellContainer(loaded, p.items, p.composites, p.m.pickupOrder);
    if (sale.massKg > 0) {
      p.shift.noteTurnover(sale.massKg);
      prot.meldung =
        `Verkauft: ${sale.massKg.toFixed(0)} kg ${getMaterial(sale.dominant).name} · ` +
        `${(sale.purity * 100).toFixed(0)} % sortenrein · +${sale.eur.toFixed(0)} EUR`;
    } else {
      prot.meldung = "Container war leer — der LKW faehrt umsonst.";
    }
    prot.verkaufEur = sale.eur;
    prot.verkaufKg = sale.massKg;
    prot.geldVor = geldVor;
    prot.geldNach = p.account.moneyEur;
    prot.umschlagVor = umschlagVor;
    prot.umschlagNach = p.shift.turnoverKg;
  };

  p.m.requestPickup("steel");
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
  const truck = p.m.pickupTruck;
  if (!truck || !truck.waitingForLoad) {
    return {
      name,
      sollKg: 0,
      containedVor: { n: 0, kg: 0 },
      flaecheVor: 0,
      containedBeiAbfahrt: { n: 0, kg: 0 },
      flaecheBeiAbfahrt: 0,
      verkaufEur: 0,
      verkaufKg: 0,
      geldVor: p.account.moneyEur,
      geldNach: p.account.moneyEur,
      umschlagVor: 0,
      umschlagNach: 0,
      meldung: "WAGEN NIE ANGEKOMMEN",
      restAufPlatz: 0,
      lagen,
    };
  }

  const meine = new Set<number>();
  prot.sollKg = massen.length > 0 ? ladeAuf(p, truck, massen, meine) : 0;

  // Was liegt jetzt wo? Jede aufgeladene Lage einzeln ins Protokoll.
  for (const it of p.items.items) {
    if (!meine.has(it.body.handle)) continue;
    const l = lokal(truck, it.body);
    lagen.push(
      `${it.materialId} ${it.massKg.toFixed(0).padStart(4)} kg  ` +
        `x=${l.x.toFixed(2).padStart(6)} y=${l.y.toFixed(2).padStart(6)} z=${l.z.toFixed(2).padStart(6)}`
    );
  }
  const cv = truck.containedItems(p.items);
  prot.containedVor = { n: cv.length, kg: summe(cv) };
  prot.flaecheVor = truck.ladeflaecheKg();

  // Und jetzt die Taste V.
  p.m.requestPickup();
  for (let i = 0; i < 60 * 400 && prot.verkaufKg === undefined; i++) takt(p);
  // Nach der Abfahrt noch ein paar Takte, damit „vom Platz verschwunden"
  // wirklich heisst: nicht mehr in der Teileliste.
  for (let i = 0; i < 60 * 3; i++) takt(p);
  prot.restAufPlatz = summe(p.items.items.filter((it) => meine.has(it.body.handle)));

  return {
    name,
    sollKg: prot.sollKg ?? 0,
    containedVor: prot.containedVor ?? { n: 0, kg: 0 },
    flaecheVor: prot.flaecheVor ?? 0,
    containedBeiAbfahrt: prot.containedBeiAbfahrt ?? { n: 0, kg: 0 },
    flaecheBeiAbfahrt: prot.flaecheBeiAbfahrt ?? 0,
    verkaufEur: prot.verkaufEur ?? NaN,
    verkaufKg: prot.verkaufKg ?? NaN,
    geldVor: prot.geldVor ?? p.account.moneyEur,
    geldNach: prot.geldNach ?? p.account.moneyEur,
    umschlagVor: prot.umschlagVor ?? 0,
    umschlagNach: prot.umschlagNach ?? 0,
    meldung: prot.meldung ?? "(keine)",
    restAufPlatz: prot.restAufPlatz ?? 0,
    lagen,
  };
}

/**
 * DER BETRIEB — so, wie Patrick gespielt hat: Anlieferer kommen, dann wird
 * eine Abholung gerufen, beladen und weggeschickt, und danach laeuft der Hof
 * weiter.
 *
 * Die Faelle oben haben einen leeren Hof. Hier steht dazwischen alles, was ein
 * echter Betrieb mitbringt: ein Anlieferer auf dem Platz, wenn bestellt wird
 * (dann wird die Abholung vorgemerkt), Schrott auf dem Boden, und die Frage,
 * ob danach ueberhaupt noch jemand kommt.
 */
function fahreBetrieb(): void {
  const p = bauePlatzWieImSpiel();
  p.m.acceptDeliveries = true;
  let verkauft = 0;
  let meldung = "(keine)";
  p.m.onPickupDepart = (truck) => {
    const loaded = truck.containedItems(p.items);
    const sale = p.account.sellContainer(loaded, p.items, p.composites, p.m.pickupOrder);
    if (sale.massKg > 0) {
      p.shift.noteTurnover(sale.massKg);
      meldung = `Verkauft: ${sale.massKg.toFixed(0)} kg · +${sale.eur.toFixed(2)} EUR`;
    } else {
      meldung = "Container war leer — der LKW faehrt umsonst.";
    }
    verkauft++;
  };
  const fuhren: Array<{ netKg: number; eur: number; konto: number }> = [];
  p.m.onWeighOut = (netKg) => {
    const eur = p.account.payDelivery(netKg, 1);
    p.shift.deliveries++;
    fuhren.push({ netKg, eur, konto: p.account.moneyEur });
  };

  /*
   * DIESELBE ZAEHLUNG WIE IM SPIEL (`measureLoose` in `main.ts`): einsortiertes
   * Material zaehlt nicht mit, und was ueber 2,50 m liegt, steht noch auf einer
   * Ladeflaeche. Ohne die Zonenzaehlung (`recount`) bekaeme jedes Stueck des
   * Starthaufens keine Zone und der Platz gaelte sofort als zugestellt.
   */
  const measureLoose = (): number => {
    let kg = 0;
    for (const it of p.items.items) {
      if (it.containerId) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (it.body.translation().y > 2.5) continue;
      kg += it.massKg;
    }
    return kg;
  };
  let schritte = 0;
  const lauf = (sekunden: number): void => {
    for (let i = 0; i < 60 * sekunden; i++) {
      takt(p);
      if (++schritte % 30 === 0) p.containers?.recount(p.items, new Set<number>());
      const lose = measureLoose();
      p.shift.update(1 / 60, lose);
      p.m.acceptDeliveries = p.shift.acceptsDeliveries && p.account.canBuy;
      p.m.intervalFactor = p.shift.intervalFactor(lose);
    }
  };

  console.log("  Anlieferbetrieb 6 Minuten laufen lassen …");
  lauf(360);
  console.log(
    `    Anlieferungen ${p.shift.deliveries} · Konto ${p.account.moneyEur.toFixed(2)} EUR · ` +
      `${measureLoose().toFixed(0)} kg lose (${summe(p.items.items).toFixed(0)} kg gesamt) · ` +
      `aktives Fahrzeug ${p.m.activeKind ?? "keins"} · Platz dicht: ${p.shift.jammed}`
  );

  console.log("  Abholung fuer Stahlschrott bestellen (mitten im Betrieb) …");
  const antwort = p.m.requestPickup("steel");
  console.log(`    Antwort: ${antwort}`);
  for (let i = 0; i < 60 * 600 && !p.m.pickupTruck?.waitingForLoad; i++) {
    takt(p);
    p.shift.update(1 / 60, summe(p.items.items));
  }
  const truck = p.m.pickupTruck;
  if (!truck?.waitingForLoad) {
    console.log("    DER ABHOLER KAM NIE AN — aktives Fahrzeug: " + (p.m.activeKind ?? "keins"));
    return;
  }
  const meine = new Set<number>();
  const soll = ladeAuf(p, truck, [300, 280, 260, 240, 220, 200], meine);
  console.log(
    `    aufgeladen ${soll.toFixed(0)} kg · containedItems ` +
      `${truck.containedItems(p.items).length} Teile / ` +
      `${summe(truck.containedItems(p.items)).toFixed(0)} kg · ` +
      `ladeflaecheKg ${truck.ladeflaecheKg().toFixed(0)} kg`
  );
  const geldVor = p.account.moneyEur;
  const umschlagVor = p.shift.turnoverKg;
  p.m.requestPickup();
  lauf(300);
  console.log(
    `    nach der Abfahrt: Konto ${geldVor.toFixed(2)} -> ${p.account.moneyEur.toFixed(2)} EUR · ` +
      `Umschlag ${umschlagVor.toFixed(0)} -> ${p.shift.turnoverKg.toFixed(0)} kg · ` +
      `Abrechnungen ${verkauft}`
  );
  console.log(`    HUD: „${meldung}"`);
  console.log(
    `    5 Minuten spaeter: Anlieferungen ${p.shift.deliveries} · ` +
      `aktives Fahrzeug ${p.m.activeKind ?? "keins"} · ` +
      `Einfahrt ${p.m.acceptDeliveries ? "offen" : "ZU"} · ` +
      `zahlungsfaehig ${p.account.canBuy} · Platz dicht ${p.shift.jammed} · ` +
      `${measureLoose().toFixed(0)} kg lose`
  );
  console.log("\n  Jede Fuhre einzeln — was sie wiegt und was sie kostet:");
  for (const [i, f] of fuhren.entries()) {
    console.log(
      `    ${(i + 1).toString().padStart(2)}. ${f.netKg.toFixed(0).padStart(6)} kg netto · ` +
        `${f.eur.toFixed(2).padStart(8)} EUR · Konto danach ${f.konto.toFixed(2)} EUR`
    );
  }
  if (fuhren.length > 0) {
    const mittel = fuhren.reduce((a, f) => a + f.netKg, 0) / fuhren.length;
    const kosten = fuhren.reduce((a, f) => a + f.eur, 0) / fuhren.length;
    console.log(
      `    Mittel: ${mittel.toFixed(0)} kg je Fuhre · ${kosten.toFixed(2)} EUR je Fuhre · ` +
        `bis −1.500 EUR reichen ${((5000 + 1500) / kosten).toFixed(1)} Fuhren`
    );
  }
}

/**
 * DIE VOLLE MULDE — und die Frage, ob beide Zaehlstellen dasselbe sehen.
 *
 * Drei Fenster beschreiben dieselbe Sache, und sie sind verschieden weit:
 *
 *   `verriegeleLadeflaeche()`  |x| < 1,70   z −0,40 … L+0,40   y −0,40 … 3,00
 *   `ladeflaecheKg()`          |x| < 1,85   z −0,50 … L+0,50   y −0,40 … 5,00
 *   `containedItems()`         |x| < 1,60   z −0,30 … L+0,30   y −0,40 … 2,60
 *
 * Was zwischen zwei Fenstern liegt, faehrt mit (ist verriegelt), wird an der
 * Ausfahrt gewogen — und ist beim Verkauf nicht dabei. Dieses Stueck Ladung
 * verlaesst den Hof, ohne bezahlt zu werden. Hier wird der Container so weit
 * gefuellt, dass die Stapel ueber 2,60 m kommen, und beide Zahlen werden
 * nebeneinander gestellt.
 */
function vermesseFenster(): void {
  const p = bauePlatz();
  p.m.requestPickup("steel");
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
  const truck = p.m.pickupTruck;
  if (!truck?.waitingForLoad) {
    console.log("    DER ABHOLER KAM NIE AN");
    return;
  }
  const innen = truck as unknown as {
    bedGroup: THREE.Group;
    bedLen: number;
    riding: unknown[];
  };
  const bedLen = innen.bedLen;
  const probe = p.items.spawnScrap(
    "steel",
    100,
    kiste(),
    new THREE.Vector3(0, 40, 0),
    new THREE.Quaternion()
  );
  probe.body.setBodyType(RAPIER.RigidBodyType.Fixed, true); // steht, wo es hingesetzt wird

  /** Setzt das Probestueck auf einen Punkt im System der Ladeflaeche. */
  const setze = (x: number, y: number, z: number): void => {
    const w = innen.bedGroup.localToWorld(new THREE.Vector3(x, y, z));
    probe.body.setTranslation({ x: w.x, y: w.y, z: w.z }, true);
    p.scene.updateMatrixWorld(true);
  };
  /** Verriegelt die Flaeche dieses Stueck? Danach wird zurueckgestellt. */
  const verriegelt = (): boolean => {
    innen.riding.length = 0;
    truck.verriegeleLadeflaeche();
    const ja = innen.riding.length > 0;
    innen.riding.length = 0;
    probe.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    return ja;
  };

  const zeile = (was: string, x: number, y: number, z: number): void => {
    setze(x, y, z);
    const imVerkauf = truck.containedItems(p.items).some((it) => it === probe);
    const aufDerWaage = truck.ladeflaecheKg() >= 100;
    const mit = verriegelt();
    const einig = imVerkauf === aufDerWaage && imVerkauf === mit;
    console.log(
      `    ${was.padEnd(38)} x=${x.toFixed(2).padStart(5)} y=${y.toFixed(2).padStart(5)} ` +
        `z=${z.toFixed(2).padStart(5)}   ` +
        `faehrt mit ${mit ? "ja " : "nein"} · gewogen ${aufDerWaage ? "ja " : "nein"} · ` +
        `bezahlt ${imVerkauf ? "ja " : "nein"}` +
        `${einig ? "" : "   ← DREI FENSTER, ZWEI ANTWORTEN"}`
    );
  };

  console.log("    (Lage im System der Ladeflaeche; Blech liegt bei y = 0)");
  zeile("mitten drin", 0, 0.3, bedLen / 2);
  zeile("auf der Bordwand, noch innen", 1.5, 1.4, bedLen / 2);
  zeile("auf der Bordwand, halb drueber", 1.65, 1.4, bedLen / 2);
  zeile("auf der Bordwand, weit drueber", 1.8, 1.4, bedLen / 2);
  zeile("auf der Heckklappe", 0, 1.4, -0.35);
  zeile("an der Stirnwand", 0, 1.4, bedLen + 0.35);
  zeile("oben auf dem Haufen", 0, 2.4, bedLen / 2);
  zeile("ganz oben auf dem Haufen", 0, 2.8, bedLen / 2);
  zeile("turmhoch", 0, 4.0, bedLen / 2);
  p.items.remove(probe, true);
}

/**
 * WIEVIEL GEHT IN EINE MULDE? — die Zahl hinter „wie oft muss ich rufen".
 *
 * Gebraucht wird sie fuer die Frage nach der Sackgasse: Der Platz macht zu,
 * wenn mehr als 16.000 kg lose liegen, und wieder auf, wenn es unter 11.000 kg
 * sind. Wie viele Abholungen das sind, haengt daran, was in eine Mulde geht —
 * und das wird hier nicht geschaetzt, sondern geladen, bis nichts mehr drauf
 * bleibt.
 */
function messeMuldeninhalt(kgJe: number): void {
  const p = bauePlatz();
  p.m.requestPickup("steel");
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
  const truck = p.m.pickupTruck;
  if (!truck?.waitingForLoad) {
    console.log("    DER ABHOLER KAM NIE AN");
    return;
  }
  const bed = (truck as unknown as { bedGroup: THREE.Group; bedLen: number }).bedGroup;
  const bedLen = (truck as unknown as { bedLen: number }).bedLen;
  let stueck = 0;
  for (let n = 0; n < 80; n++) {
    const wo = bed.localToWorld(
      new THREE.Vector3(
        (((n % 3) - 1) * 2 * BED_HALF_W) / 3,
        2.0,
        bedLen * (0.2 + 0.6 * ((n % 7) / 6))
      )
    );
    p.items.spawnScrap("steel", kgJe, kiste(), wo, new THREE.Quaternion());
    stueck++;
    for (let s = 0; s < 30; s++) takt(p);
  }
  for (let s = 0; s < 240; s++) takt(p);
  console.log(
    `    ${stueck} Stueck a ${kgJe} kg angeboten (${(stueck * kgJe).toFixed(0)} kg) — ` +
      `auf der Flaeche bleiben ${truck.ladeflaecheKg().toFixed(0)} kg, ` +
      `bezahlt wuerden ${summe(truck.containedItems(p.items)).toFixed(0)} kg`
  );
}

function zeige(pr: Protokoll): void {
  console.log(`\n--- ${pr.name} ---`);
  console.log(`  aufgeladen (soll)            ${pr.sollKg.toFixed(0)} kg`);
  console.log(
    `  Lagen im System der Flaeche  (dazu gehoert |x| <= ${(BED_HALF_W + 0.35).toFixed(2)} m)`
  );
  for (const l of pr.lagen) console.log(`      ${l}`);
  console.log(
    `  vor der Abfahrt              containedItems ${pr.containedVor.n} Teile / ` +
      `${pr.containedVor.kg.toFixed(0)} kg  ·  ladeflaecheKg ${pr.flaecheVor.toFixed(0)} kg`
  );
  console.log(
    `  beim Losfahren               containedItems ${pr.containedBeiAbfahrt.n} Teile / ` +
      `${pr.containedBeiAbfahrt.kg.toFixed(0)} kg  ·  ladeflaecheKg ${pr.flaecheBeiAbfahrt.toFixed(0)} kg`
  );
  console.log(
    `  sellContainer                ${pr.verkaufKg.toFixed(0)} kg / ${pr.verkaufEur.toFixed(2)} EUR`
  );
  console.log(
    `  Konto                        ${pr.geldVor.toFixed(2)} -> ${pr.geldNach.toFixed(2)} EUR ` +
      `(${(pr.geldNach - pr.geldVor).toFixed(2)})`
  );
  console.log(
    `  Umschlag                     ${pr.umschlagVor.toFixed(0)} -> ${pr.umschlagNach.toFixed(0)} kg`
  );
  console.log(`  HUD                          „${pr.meldung}"`);
  console.log(`  liegt danach noch auf dem Platz  ${pr.restAufPlatz.toFixed(0)} kg`);
}

async function main(): Promise<void> {
  // Behaelterschilder zeichnen auf eine Leinwand — ohne Browser braucht es die Attrappe.
  leinwandAttrappe();
  await initPhysics();

  console.log("NULLPROBE — ein Abholer ohne Ladung muss 0 kg, 0 EUR und die Leermeldung bringen");
  const leer = fahreAbholung("Nullprobe: nichts aufgeladen", []);
  zeige(leer);
  const nullOk =
    leer.verkaufKg === 0 &&
    leer.verkaufEur === 0 &&
    leer.geldNach === leer.geldVor &&
    leer.umschlagNach === leer.umschlagVor &&
    leer.meldung.startsWith("Container war leer");
  console.log(`\n  Nullprobe ${nullOk ? "bestanden" : "NICHT BESTANDEN"}.`);
  if (!nullOk) {
    console.log("  Keine Zahl aus diesem Lauf ist gueltig.");
    process.exitCode = 1;
    return;
  }

  console.log("\n\nDER FALL VON PATRICK — Stahlschrott aufgeladen, Wagen faehrt ab");
  const voll = fahreAbholung("Abholung steel, 3 Teile", [120, 240, 95]);
  zeige(voll);

  const gross = fahreAbholung("Abholung steel, 6 Teile", [300, 280, 260, 240, 220, 200]);
  zeige(gross);

  console.log("\n\nDERSELBE FALL AUF DEM PLATZ WIE IM SPIEL — Mauern, Behaelter, Starthaufen");
  const echt = fahreAbholung("Abholung steel, voller Platz", [300, 280, 260, 240, 220, 200], true);
  zeige(echt);
  const echtLeer = fahreAbholung("Nullprobe auf vollem Platz", [], true);
  zeige(echtLeer);

  console.log("\n\nDIE DREI FENSTER — was faehrt mit, was wird gewogen, was wird bezahlt?");
  vermesseFenster();

  console.log("\n\nWIEVIEL GEHT IN EINE MULDE?");
  messeMuldeninhalt(250);

  console.log("\n\nDER BETRIEB — Anlieferer laufen, dann die Abholung mittendrin");
  fahreBetrieb();

  console.log("\n\nBEFUND");
  for (const pr of [voll, gross, echt]) {
    const abw = pr.flaecheBeiAbfahrt - pr.containedBeiAbfahrt.kg;
    console.log(
      `  ${pr.name}: Waage zaehlt ${pr.flaecheBeiAbfahrt.toFixed(0)} kg, ` +
        `Verkauf zaehlt ${pr.containedBeiAbfahrt.kg.toFixed(0)} kg — ` +
        `Unterschied ${abw.toFixed(0)} kg` +
        `${Math.abs(abw) > 1 ? "   ← ZWEI ZAEHLSTELLEN, ZWEI ERGEBNISSE" : ""}`
    );
  }
}

void main();
