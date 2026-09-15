/**
 * Wächter für das Abkippen.
 *
 * ANLASS, ZWEIMAL DERSELBE (13.09. und 15.09.2026, Patrick):
 *   „die Kipper heben das Material nicht an, sondern es bleibt auf dem Chassis
 *    und taucht unter der Ladefläche"
 *   „Teile fallen immer noch beim Kippen durch die Ladefläche"
 *   „beim Kippen sind Teile ganz woanders auf dem Platz gelandet, nicht mal in
 *    der Nähe vom LKW"
 *
 * WAS ES WAR (E-071, Bild für Bild gemessen): In dem Augenblick, in dem die
 * Mulde zu kippen anfing, verlor Rapier die Paarung zwischen Muldenkollider
 * und Ladung, und die ganze Fuhre fiel im freien Fall — exakt 9,81 m/s² —
 * durch den 0,60 m dicken Muldenboden hindurch. Was dabei wieder aufgefangen
 * wurde, drückte der Löser mit einem einzigen Stoß heraus: gemessen 65,7 m/s
 * an einem Stück, das 0,37 m tief im Kollider steckte. Der „Katapult" war also
 * nie das Kippen, sondern die Entdurchdringung.
 *
 * DIE ENERGIERECHNUNG, die das ohne Physik-Kenntnisse entscheidet: Die Brücke
 * braucht 4,2 s für 58°. Ihre Oberfläche bewegt sich dabei mit höchstens
 * 1,45 m/s, und ganz aufgerichtet liegt ihr höchster Punkt 6,14 m über dem
 * Boden. Mehr als √(2 · 9,81 · 6,14) + 1,45 = 12,4 m/s (45 km/h) kann ein
 * Stück aus diesem Vorgang nicht mitnehmen — das sind 60 Joule je Kilogramm.
 * Gemessen wurden 585 km/h, das sind 13.200 Joule je Kilogramm. Faktor 220.
 * Wo eine Bewegung das Zweihundertfache ihres eigenen Energieinhalts abgibt,
 * ist nicht die Form schuld, sondern der Löser.
 *
 * DIESER WÄCHTER PRÜFT VIER EIGENSCHAFTEN, nicht den Weg dorthin:
 *   1. Die Fuhre fällt nicht durch die Brücke.
 *   2. Sie wird nicht geschleudert.
 *   3. Sie landet in der Nähe des LKW und nicht irgendwo auf dem Platz.
 *   4. Die Brücke wird wieder frei.
 *
 * ER FÄHRT DIE FUHRE, DIE DAS SPIEL WÜRFELT (`spielFuhre`, `rollCustomer`),
 * nicht mehr die milde feste Prüfladung. Bis E-071 hielt er 155/500 km/h an
 * 5.000 kg bei Füllgrad 0,60, während derselbe Apparat mit der Händlerfuhre
 * 159/585 maß — über der eigenen Schranke. Der Wächter war grün und das Spiel
 * kaputt. Er ist dadurch langsamer geworden; das ist der Preis dafür, dass er
 * misst, was der Spieler erlebt (offener Punkt 12, jetzt erledigt).
 *
 * JEDE SCHRANKE HAT EINE GEGENPROBE: derselbe Prüfcode auf einen absichtlich
 * kaputten Eingang. Eine Schranke, die nie rot wird, prüft nichts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { pruefKunde, spielFuhre } from "./pruefkunde";
import { SAATEN, reihe, type Reihe } from "./kipperlauf";

/*
 * DER GEMESSENE STAND vom 15.09.2026, gewürfelte Händlerfuhre, 24 Saaten,
 * ganzer Zyklus, nur dynamische Körper:
 *
 *                              Mittel  Median  Höchst   durch  liegt  Endabstand
 *   vor E-071 (Quader 0,60)     147     123     430     86 %    4 %   2,7 / 27,0 m
 *   gebaut (E-071)               29      19     106      0 %   31 %   3,1 /  5,8 m
 *
 * Die Schranken halten diesen Stand mit Luft nach oben fest. Wieviel Luft: Der
 * Kipper ist eine CHAOTISCHE Größe — bei unverändertem Quelltext streuen
 * dieselben 24 Ladungen weit, und der Höchstwert aus 24 Würfen ist die
 * schwächste Zahl der Reihe (ein einziger Ausreißer kippt ihn). Deshalb steht
 * das MITTEL eng und der Höchstwert weit; geurteilt wird nach Mittel und
 * Median.
 */
const MITTEL_MAX = 55; // km/h — gemessen 29
const MEDIAN_MAX = 40; // km/h — gemessen 19
const HOECHST_MAX = 200; // km/h — gemessen 106
/** Höchster Anteil, der beim Kippen unter die Brücke geraten darf. */
const DURCH_MAX = 0.1; // gemessen 0,00 über 24 Saaten
/**
 * Höchster Anteil, der am Ende noch auf der Brücke liegt.
 *
 * 31 % SIND VIEL, UND DAS IST KEIN ZUFALL: Schrott hat in `scrapItems.ts`
 * Reibung 2,2 (Regel MAX, „Schrott verhakt sich"), der Kipper hebt auf 58°,
 * und tan 58° = 1,60 < 2,2. Eine ruhende Fuhre RUTSCHT auf dieser Neigung
 * rechnerisch überhaupt nicht — was herunterkommt, kommt durch Kollern,
 * Nachrutschen und das gekippte Anziehen (`tipCreep`) herunter. Vor E-071 war
 * die Zahl 4 %, aber nur, weil 86 % gar nicht erst liegen blieben, sondern
 * durch die Brücke fielen. Der Vergleich der beiden Zahlen ist also kein
 * Rückschritt, sondern der Unterschied zwischen „weg" und „durchgefallen".
 * Steilerer Winkel oder weniger Reibung ist ein eigenes Paket und eine
 * Gestaltungsfrage (`docs/offene-punkte.md`).
 */
const LIEGT_MAX = 0.45; // gemessen 0,31
/** Wie weit ein Stück am Ende höchstens vom LKW liegen darf (m). */
const ABSTAND_MAX = 12; // gemessen 5,8; vor E-071 27,0

let gemessen: Reihe;

beforeAll(async () => {
  await initPhysics();
  gemessen = reihe({ name: "gewuerfelte Haendlerfuhre", kunde: spielFuhre }, SAATEN);
}, 900000);

/* ------------------------------------------------------------------ *
 *  Die Urteile als reine Funktionen — damit die Gegenprobe DENSELBEN
 *  Prüfcode auf einen kaputten Eingang werfen kann und nicht eine
 *  zweite, ähnlich aussehende Abschrift davon.
 * ------------------------------------------------------------------ */
export const urteile = {
  faelltNichtDurch: (r: Reihe): boolean => r.durch <= DURCH_MAX,
  schleudertNicht: (r: Reihe): boolean =>
    r.mittel < MITTEL_MAX && r.median < MEDIAN_MAX && r.hoechst < HOECHST_MAX,
  bleibtInDerNaehe: (r: Reihe): boolean => r.abstandMax < ABSTAND_MAX,
  brueckeWirdFrei: (r: Reihe): boolean => r.rest <= LIEGT_MAX,
};

/** Eine Reihe von Hand, um die Urteile gegen einen kaputten Eingang zu halten. */
function erfundeneReihe(x: Partial<Reihe>): Reihe {
  return {
    name: "erfunden",
    mittel: 29,
    hoechst: 106,
    median: 19,
    werte: [29],
    teile: 11,
    masseKg: 8479,
    fuellgrad: 0.7,
    rest: 0.31,
    durch: 0,
    abstandMax: 5.8,
    abstandMittel: 3.1,
    inDerMulde: 0,
    ...x,
  };
}

describe("Kipper", () => {
  it("laesst die Fuhre nicht durch die Bruecke fallen", () => {
    expect(gemessen.teile, "keine Ladung auf der Flaeche").toBeGreaterThanOrEqual(5);
    expect(
      urteile.faelltNichtDurch(gemessen),
      `${(gemessen.durch * 100).toFixed(0)} % der Fuhre geraten beim Kippen unter die Bruecke ` +
        `(erlaubt ${(DURCH_MAX * 100).toFixed(0)} %)`
    ).toBe(true);
  });

  it("GEGENPROBE: koerperlose Bruecke wird gemeldet", () => {
    /*
     * Nicht erfunden, sondern gefahren: Dieselben Fuhren, aber die Kollider
     * der Mulde werden beim Halt abgeschaltet. Dann MUSS die Fuhre unten
     * durch — und der Prüfcode muss das sagen. Drei Saaten reichen; der
     * Unterschied ist kein Randfall, sondern 0 gegen rund 90 %.
     */
    const kaputt = reihe(
      { name: "Bruecke koerperlos", kunde: spielFuhre, brueckeAbschalten: true },
      SAATEN.slice(0, 3)
    );
    expect(kaputt.durch, "die abgeschaltete Bruecke haelt die Fuhre trotzdem?").toBeGreaterThan(0.5);
    expect(urteile.faelltNichtDurch(kaputt), "Pruefcode meldet den Durchfall nicht").toBe(false);
  }, 300000);

  it("schleudert die Ladung nicht davon", () => {
    const liste = gemessen.werte.map((w) => w.toFixed(0)).join(" ");
    expect(
      urteile.schleudertNicht(gemessen),
      `Mittel ${gemessen.mittel.toFixed(0)} / Median ${gemessen.median.toFixed(0)} / ` +
        `Hoechst ${gemessen.hoechst.toFixed(0)} km/h ueber ${SAATEN.length} Ladungen (${liste})`
    ).toBe(true);
  });

  it("GEGENPROBE: zu schnelle Reihen werden gemeldet", () => {
    expect(urteile.schleudertNicht(erfundeneReihe({ mittel: MITTEL_MAX + 1 }))).toBe(false);
    expect(urteile.schleudertNicht(erfundeneReihe({ median: MEDIAN_MAX + 1 }))).toBe(false);
    expect(urteile.schleudertNicht(erfundeneReihe({ hoechst: HOECHST_MAX + 1 }))).toBe(false);
    // und der gemessene Stand darf davon NICHT getroffen werden
    expect(urteile.schleudertNicht(erfundeneReihe({}))).toBe(true);
  });

  it("laesst die Fuhre in der Naehe des LKW liegen", () => {
    /*
     * Die Zahl, die Patrick tatsächlich erlebt. Er sieht keine km/h — er
     * findet einen Kühler im Kabellager. 430 km/h sind 119 m/s; der Platz ist
     * rund 70 m lang, ein Stück ist damit in einer halben Sekunde am anderen
     * Ende. Vor E-071 lagen 8 von 265 Stücken über 10 m vom LKW entfernt, das
     * weiteste 27,0 m. Jetzt keines.
     */
    expect(
      urteile.bleibtInDerNaehe(gemessen),
      `weitestes Stueck ${gemessen.abstandMax.toFixed(1)} m vom LKW ` +
        `(Mittel ${gemessen.abstandMittel.toFixed(1)} m, erlaubt ${ABSTAND_MAX} m)`
    ).toBe(true);
  });

  it("GEGENPROBE: weit verstreute Fuhren werden gemeldet", () => {
    expect(urteile.bleibtInDerNaehe(erfundeneReihe({ abstandMax: 27 })), "27 m durchgewinkt").toBe(
      false
    );
    expect(urteile.bleibtInDerNaehe(erfundeneReihe({}))).toBe(true);
  });

  it("hat die Bruecke am Ende des Zyklus weitgehend frei", () => {
    expect(
      urteile.brueckeWirdFrei(gemessen),
      `${(gemessen.rest * 100).toFixed(0)} % liegen am Ende noch auf der Bruecke ` +
        `(erlaubt ${(LIEGT_MAX * 100).toFixed(0)} %)`
    ).toBe(true);
  });

  it("GEGENPROBE: eine volle Bruecke wird gemeldet", () => {
    expect(urteile.brueckeWirdFrei(erfundeneReihe({ rest: 0.6 })), "60 % durchgewinkt").toBe(false);
    expect(urteile.brueckeWirdFrei(erfundeneReihe({}))).toBe(true);
  });

  it("kippt sortenrein in die Mulde an der Ostwand statt vor dem Bagger", () => {
    /*
     * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden auf
     * der Ostseite rechts kippen, nicht bei mir."
     *
     * Geprueft wird das Ergebnis, nicht der Weg: Der Grossteil der Fuhre muss
     * in der Mulde liegen. Daran haengt die Tiefe der Mulden — mit den alten
     * 4,4 m landete gemessen nur ein Drittel darin, der Rest davor.
     *
     * Feste Pruefladung statt gewuerfelter: Hier geht es um die ROUTE, und die
     * haengt an der Fraktion. Der Fuellgrad 0,85 ist der, mit dem ein Haendler
     * am haeufigsten kommt; 5.000 kg Alu wuerden gar nicht auf den Wagen
     * passen (E-062).
     */
    const r = reihe(
      {
        name: "sortenrein Alu",
        kunde: () =>
          pruefKunde({ fuellgrad: 0.85, sortenrein: "alu", vehicle: "kipper", aufbau: "flach" }),
      },
      SAATEN.slice(0, 4)
    );
    expect(r.teile, "keine Ladung").toBeGreaterThan(6);
    expect(
      r.inDerMulde,
      `nur ${(r.inDerMulde * 100).toFixed(0)} % liegen in der Mulde`
    ).toBeGreaterThan(0.6);
  }, 300000);
});
