/**
 * JEDER WEG VOM HOF WIRD ABGERECHNET (E-086).
 *
 * Patrick am Gerät, 16.09.2026: „hab eine fuhre abholen lassen, es gab aber
 * keine einzahlung auf dem konto durch verkauf, umgeschlagen war auch 0." Auf
 * die Nachfrage, ob die Leermeldung „Container war leer — der LKW fährt
 * umsonst" kam: „Nein, gar keine Meldung." Und wie der Wagen losgefahren ist:
 * „hab ihn zur Waage geschickt."
 *
 * GAR KEINE MELDUNG war der Schlüssel. Die Abrechnung meldet in BEIDEN
 * Fällen etwas (`main.ts`: „Verkauft: …" oder „Container war leer …"). Blieb
 * es still, ist sie nie gelaufen — es war also nicht die Frage, ob sie die
 * Ladung findet, sondern ob sie überhaupt gerufen wird.
 *
 * Der Abholer konnte den Hof auf drei Wegen verlassen, und nur zwei davon
 * gingen durch den Fall „waitLoad", der `justDeparted` setzt:
 *
 *   Taste V    `requestPickup()` → `requestRelease()` → „waitLoad"   rechnete ab
 *   Standzeit  240 s abgelaufen  → derselbe Fall „waitLoad"          rechnete ab
 *   Taste J    `zurWaage()`      → `DeliveryVehicle.sendAway()`      RECHNETE NICHT AB
 *
 * `sendAway()` setzte nur `phase = "out"`. `consumeDeparted()` lief leer,
 * `onPickupDepart` feuerte nie, und weil die Meldung an derselben Stelle
 * hängt, blieb auch das HUD stumm. Die Ladung war da längst für die Fahrt
 * verriegelt und verließ den Hof, ohne bezahlt zu werden.
 *
 * DIESELBE FEHLERKLASSE WIE E-070, eine Ebene höher: Dort gab es drei Fenster
 * für eine Frage, hier zwei Ausgänge für ein Ereignis. Deshalb prüft dieser
 * Wächter nicht einen Weg, sondern JEDEN — und zwar an der Eigenschaft, die
 * der Spieler merkt: EIN ABHOLER, DER DEN HOF VERLÄSST, WIRD ABGERECHNET UND
 * SAGT ES.
 *
 * Zu jeder Zahlenschranke gehört eine Gegenprobe, die melden MUSS.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, BESEN, besenForm, type ScrapItem, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";
import { Shift } from "../src/economy/shift";
import { getMaterial } from "../src/materials/catalog";

/** Der Fahrzeugtyp, ohne die Modulgrenze aufzubrechen (wie in E-070). */
type Abholer = NonNullable<VehicleManager["pickupTruck"]>;

beforeAll(async () => {
  await initPhysics();
});

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  account: Account;
  shift: Shift;
  composites: CompositeManager;
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  return { m, items, world, scene, account: new Account(), shift: new Shift(), composites };
}

/** Ein Takt des ganzen Platzes — mit den Weltmatrizen, die sonst der Renderer stellt. */
function takt(p: Platz, dt = 1 / 60): void {
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
  p.scene.updateMatrixWorld(true);
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

function summe(items: Array<{ massKg: number }>): number {
  return items.reduce((a, it) => a + it.massKg, 0);
}

function holeAbholer(p: Platz, order: string | null): Abholer {
  p.m.requestPickup(order);
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
  const t = p.m.pickupTruck;
  expect(t?.waitingForLoad, "der Abholer ist nie an seinem Platz angekommen").toBe(true);
  return t!;
}

/**
 * Die Verdrahtung aus `main.ts` (Zeile 924 ff.), Zeile für Zeile — samt
 * BEIDEN Meldungen. Genau darum geht es hier: Der Spieler muss erfahren,
 * warum kein Geld kam.
 */
interface Abrechnung {
  kg: number;
  eur: number;
  meldung: string;
}
function verdrahte(p: Platz, ablage: { letzte: Abrechnung | null; anzahl: number }): void {
  p.m.onPickupDepart = (truck) => {
    ablage.anzahl++;
    const loaded = truck.containedItems(p.items);
    const sale = p.account.sellContainer(loaded, p.items, p.composites, p.m.pickupOrder);
    if (sale.massKg > 0) {
      p.shift.noteTurnover(sale.massKg);
      ablage.letzte = {
        kg: sale.massKg,
        eur: sale.eur,
        meldung:
          `Verkauft: ${sale.massKg.toFixed(0)} kg ${getMaterial(sale.dominant).name} · ` +
          `${(sale.purity * 100).toFixed(0)} % sortenrein · +${sale.eur.toFixed(0)} €`,
      };
    } else {
      ablage.letzte = {
        kg: 0,
        eur: sale.eur,
        meldung: "Container war leer — der LKW fährt umsonst.",
      };
    }
  };
}

/** Stahl in die Mulde fallen lassen — über die Physik, nicht per Zuweisung. */
function ladeAuf(
  p: Platz,
  truck: Abholer,
  massen: number[],
  fraktionen?: string[]
): ScrapItem[] {
  const innen = truck as unknown as { bedGroup: THREE.Group; bedLen: number };
  const drauf: ScrapItem[] = [];
  for (const [i, kg] of massen.entries()) {
    const wo = innen.bedGroup.localToWorld(
      new THREE.Vector3(0, 1.2, innen.bedLen * (0.25 + 0.5 * (i / Math.max(massen.length - 1, 1))))
    );
    drauf.push(
      p.items.spawnScrap(fraktionen?.[i] ?? "steel", kg, kiste(), wo, new THREE.Quaternion())
    );
    for (let s = 0; s < 45; s++) takt(p);
  }
  for (let s = 0; s < 120; s++) takt(p);
  return drauf;
}

/**
 * DIE DREI WEGE VOM HOF, wie der Spieler sie auslöst.
 *
 * Nicht nachgebaut, sondern benutzt: `requestPickup()` ist Taste V,
 * `zurWaage()` ist Taste J, und „standzeit" drückt gar nichts — genau das tut
 * ein Spieler, der den Wagen stehen lässt.
 */
type Weg = "tasteV" | "tasteJ" | "standzeit";
const WEGE: Weg[] = ["tasteV", "tasteJ", "standzeit"];
const WEGNAME: Record<Weg, string> = {
  tasteV: "Taste V (Container geht raus)",
  tasteJ: "Taste J (zur Waage schicken)",
  standzeit: "Standzeit abgelaufen",
};

function schickeLos(p: Platz, weg: Weg): void {
  if (weg === "tasteV") p.m.requestPickup();
  else if (weg === "tasteJ") p.m.zurWaage();
  // "standzeit": nichts drücken — die 240 s laufen von selbst ab.
}

/**
 * Laufen lassen, bis abgerechnet wurde — oder bis die Geduld am Ende ist.
 *
 * Die Standzeit steht als `DeliveryVehicle.STANDZEIT_S` bei 240 s (E-082); die
 * Grenze ist großzügig darüber gewählt, damit ein langsamer Anlauf sie nicht
 * reißt. Sie ist KEINE Zusicherung über die Dauer — nur ein Abbruch, damit ein
 * stehengebliebener Wagen den Test nicht ewig laufen lässt.
 */
function laufeBisAbgerechnet(
  p: Platz,
  ablage: { letzte: Abrechnung | null; anzahl: number },
  weg: Weg
): void {
  const grenze = weg === "standzeit" ? 60 * 400 : 60 * 200; // SW: reichlich über 240 s
  for (let i = 0; i < grenze && ablage.letzte === null; i++) takt(p);
  for (let i = 0; i < 60 * 3; i++) takt(p);
}

describe("Jeder Weg vom Hof rechnet ab — und sagt es", () => {
  for (const weg of WEGE) {
    it(`Nullprobe · ${WEGNAME[weg]}: 0 kg, 0 €, und die Leermeldung kommt`, () => {
      /*
       * DIE NULLPROBE ZUERST, je Weg einzeln. Ein Weg, der mit leerer Mulde
       * still bleibt, bleibt auch mit voller Mulde still — genau so ist der
       * Fehler auf dem Gerät aufgetreten.
       */
      const p = bauePlatz();
      const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
      verdrahte(p, ablage);
      holeAbholer(p, "steel");
      const geldVor = p.account.moneyEur;
      schickeLos(p, weg);
      laufeBisAbgerechnet(p, ablage, weg);

      expect(ablage.letzte, `über ${WEGNAME[weg]} wurde nicht abgerechnet`).not.toBeNull();
      expect(ablage.anzahl, "die Abrechnung lief mehr als einmal").toBe(1);
      expect(ablage.letzte!.kg).toBe(0);
      expect(ablage.letzte!.eur).toBe(0);
      expect(p.account.moneyEur).toBe(geldVor);
      expect(p.shift.turnoverKg).toBe(0);
      // Und der Spieler erfährt, warum kein Geld kam. Stille ist ein Fehler.
      expect(ablage.letzte!.meldung).toContain("Container war leer");
    });

    it(`volle Fuhre · ${WEGNAME[weg]}: Konto auf den Cent, Umschlag auf das Kilo`, () => {
      const p = bauePlatz();
      const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
      verdrahte(p, ablage);
      const truck = holeAbholer(p, "steel");
      const drauf = ladeAuf(p, truck, [300, 280, 260, 240, 220, 200]);
      const sollKg = summe(drauf);
      expect(sollKg).toBe(1500);
      expect(summe(truck.containedItems(p.items)), "die Ladung liegt nicht auf der Fläche").toBe(
        sollKg
      );

      const geldVor = p.account.moneyEur;
      schickeLos(p, weg);
      laufeBisAbgerechnet(p, ablage, weg);

      expect(
        ablage.letzte,
        `der Abholer ist über ${WEGNAME[weg]} ohne Abrechnung losgefahren`
      ).not.toBeNull();
      expect(ablage.anzahl, "die Fuhre wurde mehr als einmal abgerechnet").toBe(1);
      // 1. Die ganze Fuhre …
      expect(ablage.letzte!.kg).toBeCloseTo(sollKg, 6);
      // 2. … sortenrein zum Katalogpreis (Reinheit 1 → kg × Preis) …
      const preis = getMaterial("steel").sellPricePerKg;
      expect(ablage.letzte!.eur).toBeCloseTo(sollKg * preis, 2);
      // 3. … das Geld ist auf dem Konto …
      expect(p.account.moneyEur - geldVor).toBeCloseTo(sollKg * preis, 2);
      // 4. … der Umschlag ist gewachsen …
      expect(p.shift.turnoverKg).toBeCloseTo(sollKg, 6);
      // 5. … die Teile sind vom Platz …
      for (const it of drauf) {
        expect(p.items.items.includes(it), "verkaufter Schrott liegt noch auf dem Platz").toBe(
          false
        );
      }
      // 6. … und der Spieler hat es gelesen.
      expect(ablage.letzte!.meldung).toContain("Stahlschrott");
    });
  }

  it("Gegenprobe: ein Weg, der die Abrechnung überspringt, MUSS auffallen", () => {
    /*
     * OHNE DIESEN FALL PRÜFTEN DIE FÄLLE OBEN NICHTS. Sie wären auch dann
     * grün, wenn `laufeBisAbgerechnet` einfach lange genug liefe und
     * irgendwann irgendetwas passierte.
     *
     * Hier wird genau der Fehler von E-086 nachgestellt: Der Wagen verlässt
     * den Hof, ohne dass `onPickupDepart` je gerufen wird. Der Fuhrpark bekommt
     * dafür keinen Rückruf — mehr Unterschied ist es nicht. Die Schranken von
     * oben müssen dagegen anschlagen: kein Geld, kein Umschlag, KEINE MELDUNG,
     * und die Ladung ist trotzdem weg.
     */
    const p = bauePlatz();
    const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
    verdrahte(p, ablage);
    const truck = holeAbholer(p, "steel");
    const drauf = ladeAuf(p, truck, [300, 300]);
    const sollKg = summe(drauf);
    const geldVor = p.account.moneyEur;

    // Der abgeklemmte Rückruf — so sah der Fehler auf dem Gerät aus.
    p.m.onPickupDepart = null;
    p.m.zurWaage();
    for (let i = 0; i < 60 * 200 && p.m.pickupTruck !== null; i++) takt(p);

    expect(p.m.pickupTruck, "der Wagen steht noch — dann prüft die Gegenprobe nichts").toBeNull();
    expect(ablage.letzte, "die Gegenprobe hat doch abgerechnet").toBeNull();
    expect(p.account.moneyEur, "ohne Abrechnung kam trotzdem Geld").toBe(geldVor);
    expect(p.shift.turnoverKg, "ohne Abrechnung wuchs trotzdem der Umschlag").toBe(0);
    // Und genau das ist der Schaden: Die Ladung ist bezahlt worden — nein,
    // eben NICHT bezahlt worden, und der Spieler hat nichts davon erfahren.
    expect(sollKg).toBe(600);
  });

  it("Gegenprobe: eine Fuhre wird nicht zweimal bezahlt", () => {
    /*
     * Die andere Richtung derselben Schranke. Seit E-086 setzt JEDER Ausgang
     * `justDeparted` — wer beide nacheinander auslöst, dürfte nicht zweimal
     * kassieren. Ohne den Riegel `abfahrtGemeldet` wäre das Wegschicken per V
     * nach dem Wegschicken per J ein Geldautomat.
     */
    const p = bauePlatz();
    const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
    verdrahte(p, ablage);
    const truck = holeAbholer(p, "steel");
    const drauf = ladeAuf(p, truck, [400, 400]);
    const sollKg = summe(drauf);
    const preis = getMaterial("steel").sellPricePerKg;
    const geldVor = p.account.moneyEur;

    p.m.zurWaage(); // Taste J
    p.m.zurWaage(); // und gleich nochmal
    p.m.requestPickup(); // und Taste V hinterher
    laufeBisAbgerechnet(p, ablage, "tasteJ");

    expect(ablage.anzahl, "die Fuhre wurde mehrfach abgerechnet").toBe(1);
    expect(p.account.moneyEur - geldVor).toBeCloseTo(sollKg * preis, 2);
    expect(p.shift.turnoverKg).toBeCloseTo(sollKg, 6);
  });
});

describe("Was über Taste J geht, geht genauso wie über Taste V", () => {
  /**
   * Die beiden Wege dürfen sich nicht nur beide melden — sie müssen DASSELBE
   * ergeben. Ein Weg, der abrechnet, aber die halbe Fuhre übersieht, wäre
   * wieder eine zweite Wahrheit über dieselbe Ladung (E-070).
   */
  const faelle: Array<{
    name: string;
    massen: number[];
    fraktionen?: string[];
    order: string | null;
  }> = [
    { name: "sortenrein bestellt, sortenrein geladen", massen: [400, 400], order: "steel" },
    {
      name: "sortenrein bestellt, gemischt geladen",
      massen: [400, 400],
      fraktionen: ["steel", "copper"],
      order: "steel",
    },
    {
      name: "gemischt bestellt",
      massen: [400, 400],
      fraktionen: ["steel", "copper"],
      order: null,
    },
  ];

  for (const f of faelle) {
    it(`${f.name}: V und J zahlen denselben Betrag`, () => {
      const fahre = (weg: Weg): { eur: number; kg: number } => {
        const p = bauePlatz();
        const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
        verdrahte(p, ablage);
        const truck = holeAbholer(p, f.order);
        ladeAuf(p, truck, f.massen, f.fraktionen);
        schickeLos(p, weg);
        laufeBisAbgerechnet(p, ablage, weg);
        expect(ablage.letzte, `${WEGNAME[weg]} hat nicht abgerechnet`).not.toBeNull();
        return { eur: ablage.letzte!.eur, kg: ablage.letzte!.kg };
      };
      const v = fahre("tasteV");
      const j = fahre("tasteJ");
      expect(j.kg, "die Wege wiegen verschieden").toBeCloseTo(v.kg, 6);
      expect(j.eur, "die Wege zahlen verschieden").toBeCloseTo(v.eur, 2);
      // Und es ist wirklich etwas passiert — sonst wäre 0 = 0 auch gleich.
      expect(v.kg).toBeGreaterThan(0);
      expect(v.eur).toBeGreaterThan(0);
    });
  }

  it("Gegenprobe: sortenrein und gemischt bringen NICHT dasselbe", () => {
    /*
     * Ohne diesen Fall wäre die Prüfung oben blind gegen eine Abrechnung, die
     * jede Ladung gleich behandelt. Eine gemischte Fuhre bringt deutlich
     * weniger — der Erlös hängt an der Reinheit hoch drei (`account.ts`).
     */
    const fahre = (fraktionen: string[] | undefined): number => {
      const p = bauePlatz();
      const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
      verdrahte(p, ablage);
      const truck = holeAbholer(p, "steel");
      ladeAuf(p, truck, [400, 400], fraktionen);
      schickeLos(p, "tasteJ");
      laufeBisAbgerechnet(p, ablage, "tasteJ");
      return ablage.letzte!.eur;
    };
    const rein = fahre(undefined);
    const gemischt = fahre(["steel", "copper"]);
    expect(gemischt, "gemischt bringt genauso viel wie sortenrein").toBeLessThan(rein);
  });
});

describe("Platzinventar würgt die Abrechnung nicht ab (E-034)", () => {
  /**
   * Der Müllcontainer und der Besen sind Platzinventar: kein Geld, nie. Ihre
   * Zusammensetzung wiegt null Kilo, und `Account.sellContainer` steigt bei
   * `totalKg <= 0` früh aus (E-079). Beides zusammen darf nicht dazu führen,
   * dass eine Fuhre mit Stahl DARUNTER leer ausgeht — und eine Fuhre, auf der
   * nur Inventar liegt, muss trotzdem melden.
   */
  function legeBesenAuf(p: Platz, truck: Abholer): void {
    const innen = truck as unknown as { bedGroup: THREE.Group; bedLen: number };
    const wo = innen.bedGroup.localToWorld(new THREE.Vector3(0, 1.0, innen.bedLen * 0.15));
    p.items.spawnScrap("mixed", BESEN.massKg, besenForm(), wo, new THREE.Quaternion());
    for (let s = 0; s < 60; s++) takt(p);
  }

  for (const weg of WEGE) {
    it(`${WEGNAME[weg]}: der Besen fährt mit, der Stahl wird trotzdem bezahlt`, () => {
      const p = bauePlatz();
      const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
      verdrahte(p, ablage);
      const truck = holeAbholer(p, "steel");
      legeBesenAuf(p, truck);
      const drauf = ladeAuf(p, truck, [300, 300]);
      const sollKg = summe(drauf);
      const preis = getMaterial("steel").sellPricePerKg;
      const geldVor = p.account.moneyEur;

      schickeLos(p, weg);
      laufeBisAbgerechnet(p, ablage, weg);

      expect(ablage.letzte, "mit Platzinventar an Bord fiel die Abrechnung aus").not.toBeNull();
      // Der Stahl wird bezahlt …
      expect(p.account.moneyEur - geldVor).toBeCloseTo(sollKg * preis, 2);
      // … und der Besen bringt keinen Cent dazu: Sein Gewicht (680 kg) taucht
      // weder im Erlös noch im Umschlag auf.
      expect(ablage.letzte!.kg).toBeCloseTo(sollKg, 6);
      expect(p.shift.turnoverKg).toBeCloseTo(sollKg, 6);
    });
  }

  it("nur Platzinventar auf der Fläche: 0 €, aber eine Meldung", () => {
    const p = bauePlatz();
    const ablage = { letzte: null as Abrechnung | null, anzahl: 0 };
    verdrahte(p, ablage);
    const truck = holeAbholer(p, "steel");
    legeBesenAuf(p, truck);
    const geldVor = p.account.moneyEur;

    p.m.zurWaage();
    laufeBisAbgerechnet(p, ablage, "tasteJ");

    expect(ablage.letzte, "eine Fuhre aus lauter Inventar rechnet gar nicht ab").not.toBeNull();
    expect(p.account.moneyEur).toBe(geldVor);
    expect(p.shift.turnoverKg).toBe(0);
    expect(ablage.letzte!.meldung).toContain("Container war leer");
  });

  it("Gegenprobe: der Besen wiegt wirklich etwas — sonst prüft das oben nichts", () => {
    /*
     * Die Prüfungen oben zeigen, dass der Besen NICHT bezahlt wird. Das wäre
     * trivial, wenn er null Kilo wöge: Dann fiele er ohnehin durch jede
     * Rechnung. Er wiegt aber 680 kg und liegt mitten auf der Ladefläche —
     * die Ausfahrtswiegung sieht ihn, die Abrechnung nicht.
     */
    expect(BESEN.massKg).toBeGreaterThan(0);
    expect(besenForm().inventar, "der Besen ist gar nicht als Inventar gekennzeichnet").toBe(
      "besen"
    );
  });
});
