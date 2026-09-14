import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { TearTarget } from "../dismantle/composites";

/**
 * Greifsystem nach Briefing Kap. 6.2:
 * - Beim Schließen (Schwelle 70 %) einmalige Sensorabfrage (Kugel am Greifer-Palm).
 * - Für jedes getroffene dynamische Objekt: Fixed Joint an den kinematischen Greiferkörper.
 * - Limits: max. 5 Objekte, max. 2000 kg gesamt (Startwerte).
 * - Öffnen löst alle Joints, Objekte fallen mit aktueller Geschwindigkeit weiter.
 * Abrutschen (8 %/s unter Last) kommt in M1 — M0 hält, was gegriffen ist.
 */

const MAX_ITEMS = 5; // (SW)
const MAX_TOTAL_KG = 3500; // (SW) — eine ganze Karosse muss hochgehen
// Greif-Fenster: solange die Spinne schließt und noch nicht ganz zu ist, wird
// kontinuierlich zugepackt — so lassen sich fallende Objekte auffangen.
const GRAB_WINDOW_START = 0.6;
const GRAB_WINDOW_END = 0.98;
const SENSOR_RADIUS = 1.05; // m (SW) — Wirkradius der größeren Spinne
/** So lange muss die Spinne ganz zu gehalten werden, bis das Teil nachgibt */
const CRUSH_TIME = 1.1;
/**
 * Kein Zusammensaugen (Auftrag 11.09.2026, Phase 1.4).
 *
 * Ein gefasstes Teil wanderte bisher nach dem Zupacken seitlich in den Korb —
 * bis zu 0,35 m. Das sah aus, als sauge die Spinne es an, und genau das soll
 * sie nicht. Es bleibt jetzt dort, wo es gefasst wurde, und faehrt nur mit.
 *
 * Dass trotzdem nichts neben der Spinne haengt, leistet die Pruefung beim
 * Zupacken: Gefasst wird nur, was wirklich zwischen den Schalen liegt
 * (`insideGrapple`). Wer dort nicht hineinragt, wird gar nicht erst gegriffen.
 */
/** Wie viele Schritte in die Loslass-Geschwindigkeit gemittelt werden */
const RELEASE_AVG_STEPS = 3;
/** Zusaetzlicher Abwaertsimpuls beim Loslassen (m/s) */
const RELEASE_DOWN = 0.2;
/** So viele Schalen muessen anliegen, wenn das Teil nicht mittig im Korb sitzt */
const MIN_KRALLEN = 2;

/**
 * Eine Greifstelle: welcher Koerper, wo die Schale ihn fasst und mit welcher
 * Kraft. Das ist die Schnittstelle, an der das Schadensmodell andockt
 * (Auftrag 11.09.2026, Phase 1.6).
 */
export interface GreifKontakt {
  body: RAPIER.RigidBody;
  /** Weltpunkt auf der Oberflaeche des Teils */
  punkt: THREE.Vector3;
  /** Betrag der Greifkraft in Newton */
  kraftN: number;
}

interface GrippedItem {
  body: RAPIER.RigidBody;
  massKg: number;
  /** Pose beim Zupacken, relativ zur Spinne — sie bleibt, siehe oben */
  vonPos: THREE.Vector3;
  vonQuat: THREE.Quaternion;
  /** Wo die Schale das Teil fasst — relativ zur Spinne, also mitfahrend */
  kontaktRel: THREE.Vector3;
}

export class GripSystem {
  private items: GrippedItem[] = [];
  private sensorShape = new RAPIER.Ball(SENSOR_RADIUS);
  /**
   * Wie viel Gewalt gerade auf die gefasste Baugruppe wirkt: 0 = ruhig
   * halten, 1 = kräftig drehen und reißen. Von main aus Rotator- und
   * Achsbewegung gebildet.
   */
  getViolence: (() => number) | null = null;

  /** Traglast-Faktor aus dem Baggerausbau — von main gesetzt */
  getCapacityBonus: (() => number) | null = null;

  /** Hooks für Events (Audio/HUD) — von main verdrahtet, kein Modul-Import nötig */
  onGrabbed: ((bodies: RAPIER.RigidBody[]) => void) | null = null;
  onReleased: ((count: number) => void) | null = null;
  onTear: ((name: string) => void) | null = null;
  /** liefert eine abreißbare Baugruppe nahe des Sensors (Verbundobjekte, Kap. 8) */
  partResolver: ((pos: THREE.Vector3) => TearTarget | null) | null = null;
  /**
   * Prüft, ob ein Weltpunkt im Schalenkorb der Spinne liegt. Ohne diese Prüfung
   * würde alles im Sensorradius angehoben, auch was neben dem Greifer liegt.
   */
  insideGrapple: ((worldPos: THREE.Vector3) => boolean) | null = null;
  /**
   * Wie viele Schalen liegen an diesem Koerper an? Gefasst wird nur, was
   * wirklich in der Spinne liegt — entweder mit mehreren Schalen daran oder
   * mit dem Schwerpunkt mitten im Korb (Auftrag 11.09.2026, Phase 1.4).
   */
  krallenKontakte: ((body: RAPIER.RigidBody) => number) | null = null;
  private probe = new THREE.Vector3();
  /** Letzte Weltpositionen der Spinne — daraus die Loslass-Geschwindigkeit */
  private spinneSpur: THREE.Vector3[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  /**
   * Schonfrist nach dem Loslassen melden. Der Bagger schaltet dann seine
   * Krallen-Kollider kurz ab — beim Oeffnen sind sie noch fast zu und die
   * Spinne sinkt noch, sonst quetschen sie das Teil gegen den Boden und es
   * schiesst weg (v2 E-018: "Teile fliegen umher").
   */
  onReleaseGrace: (() => void) | null = null;
  private tearState: { id: string; name: string; seconds: number; progress: number } | null = null;

  constructor(
    private world: RAPIER.World,
    private grappleBody: RAPIER.RigidBody
  ) {}

  get grippedCount(): number {
    return this.items.length;
  }

  get totalMassKg(): number {
    return this.items.reduce((s, i) => s + i.massKg, 0);
  }

  get grippedBodies(): RAPIER.RigidBody[] {
    return this.items.map((i) => i.body);
  }

  /**
   * Pro Physik-Step aufrufen.
   * @param closure aktueller Schließgrad 0..1
   * @param closing true solange der Spieler die Greif-Taste hält
   * @param sensorPos Weltposition des Sensor-Zentrums (zwischen den Fingern)
   */
  /** Aktueller Reiß-Fortschritt (fürs HUD), null wenn nicht am Reißen. */
  get tearing(): { name: string; progress01: number } | null {
    if (!this.tearState) return null;
    return {
      name: this.tearState.name,
      progress01: Math.min(this.tearState.progress / this.tearState.seconds, 1),
    };
  }

  /**
   * Zusammendrücken: Hält der Spieler die Spinne ganz zu, quetscht sie, was
   * sie gefasst hat. Der Aufrufer entscheidet über `crusher`, welche Teile
   * nachgeben — Stahlträger tun das nicht.
   */
  crusher: ((body: RAPIER.RigidBody) => boolean) | null = null;
  private crushT = 0;

  private updateCrush(closure: number, dt: number): void {
    if (!this.crusher || this.items.length === 0 || closure < 0.93) {
      this.crushT = 0;
      return;
    }
    this.crushT += dt;
    if (this.crushT < CRUSH_TIME) return;
    this.crushT = 0;
    for (const it of this.items) {
      if (it.body.isValid()) this.crusher(it.body);
    }
  }

  update(closure: number, closing: boolean, sensorPos: THREE.Vector3, dt: number): void {
    this.closureJetzt = closure;
    this.trackGrapple(dt);
    this.carryHeld();
    this.updateCrush(closure, dt);
    if (!closing) {
      // Loslassen wirft sofort ab — und die Spinne ist direkt wieder scharf
      // (schnelles Auf/Zu zum Auffangen und Umsortieren im Fallen).
      if (this.items.length > 0) this.releaseAll();
      this.tearState = null;
      return;
    }

    // Reiß-Mechanik: Baugruppe nahe des Sensors? Dann Part statt Rumpf fassen.
    if (closure >= GRAB_WINDOW_START && this.items.length === 0) {
      const target = this.partResolver?.(sensorPos) ?? null;
      if (target) {
        if (!this.tearState || this.tearState.id !== target.id) {
          this.tearState = {
            id: target.id,
            name: target.name,
            seconds: target.tearSeconds,
            progress: 0,
          };
        }
        const d = sensorPos.distanceTo(target.anchorWorld);
        if (d < 2.5) {
          // Gefasst halten löst die Baugruppe. Wer dabei Gewalt anwendet —
          // die Spinne dreht oder mit dem Arm reißt —, ist deutlich
          // schneller: So reißt man einen Motor in Wirklichkeit heraus,
          // nicht durch geduldiges Ziehen (Wunsch 02.09.2026).
          const gewalt = this.getViolence?.() ?? 0;
          this.tearState.progress += dt * (1 + gewalt * 2.5);
          if (this.tearState.progress >= this.tearState.seconds) {
            const body = target.tear();
            this.attachBody(body);
            this.onTear?.(target.name);
            this.tearState = null;
          }
          return; // solange die Part gefasst ist, nicht zusätzlich den Rumpf greifen
        }
        this.tearState = null;
      } else {
        this.tearState = null;
      }
    }

    if (closure >= GRAB_WINDOW_START && closure <= GRAB_WINDOW_END) {
      this.tryGrab(sensorPos);
    }
  }

  private tryGrab(sensorPos: THREE.Vector3): void {
    // Liegt eine abreißbare Baugruppe im Greifbereich, hat sie Vorrang: Wer
    // einen Motor herausreißen will, soll nicht stattdessen das Blech davor
    // fassen, das dann alles Weitere blockiert (Design-Fix 02.09.2026).
    if (this.partResolver?.(sensorPos)) return;
    const candidates: RAPIER.RigidBody[] = [];
    this.world.intersectionsWithShape(
      { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
      { x: 0, y: 0, z: 0, w: 1 },
      this.sensorShape,
      (collider) => {
        const body = collider.parent();
        if (body && body.isDynamic() && !candidates.includes(body)) {
          // Nur fassen, was wirklich zwischen den Schalen liegt. Geprüft wird
          // der nächstgelegene Punkt der Oberfläche, nicht der Schwerpunkt:
          // bei einem Auto liegt der in der Fahrzeugmitte und damit nie im
          // Schalenkorb — Karossen waren deshalb kaum zu fassen.
          if (this.insideGrapple) {
            const proj = collider.projectPoint(
              { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
              true
            );
            if (!proj) return true;
            this.probe.set(proj.point.x, proj.point.y, proj.point.z);
            if (!this.insideGrapple(this.probe)) return true;
          }
          /*
           * Kontaktbedingung: Eine Kiste, die mit einer Ecke in den Korb
           * ragt, bestand die Pruefung oben — und hing dann halb neben der
           * Spinne in der Luft. Jetzt braucht es entweder zwei anliegende
           * Schalen oder den Schwerpunkt mitten im Korb.
           */
          if (this.krallenKontakte) {
            const mitte = body.translation();
            const mittig =
              this.insideGrapple?.(this.probe.set(mitte.x, mitte.y, mitte.z)) ?? false;
            if (!mittig && this.krallenKontakte(body) < MIN_KRALLEN) return true;
          }
          candidates.push(body);
        }
        return true; // weitersuchen
      }
    );

    // Schwerstes zuerst greifen — wer in einen Haufen greift, bekommt das große Teil sicher.
    candidates.sort((a, b) => b.mass() - a.mass());

    let added = 0;
    for (const body of candidates) {
      if (this.attachBody(body)) added++;
    }
    if (added > 0) this.onGrabbed?.(this.grippedBodies);
  }

  /*
   * --- Schnittstelle fuers Schadensmodell (Auftrag 11.09.2026, Phase 1.6) ---
   *
   * Die Spinne meldet, WO sie zupackt und WIE FEST. Mehr braucht ein
   * Schadensmodell nicht, um an derselben Stelle eine Beule einzudruecken,
   * an der die Schale sitzt — und nicht irgendwo in der Mitte des Teils.
   *
   * Die Kraft ist keine gemessene Kontaktkraft (die liefert Rapier fuer
   * kinematische Koerper nicht brauchbar), sondern ein Modell aus drei
   * Groessen, die im Spiel sichtbar sind: Schliessdruck der Schalen, Gewicht
   * am Haken und Gewalt beim Drehen und Reissen. Die Zahl ist damit
   * nachvollziehbar und stabil — und sie steigt genau dann, wenn es im Bild
   * auch ruppig zugeht.
   */
  /** Greifkraft der Schalen bei voll geschlossener Spinne (N) */
  private static readonly SCHLIESSKRAFT_N = 160_000;
  /** Anteil, den das Gewicht der Last beitraegt */
  private static readonly LASTANTEIL = 1.6;
  /** Zuschlag bei voller Gewalt (Drehen, Reissen) */
  private static readonly GEWALT_ZUSCHLAG = 0.8;

  /** Wird beim Zupacken gerufen: einmal je gefasstem Koerper. */
  onKontakt: ((k: GreifKontakt) => void) | null = null;

  /** Aktueller Schliessgrad, von update() gesetzt — geht in die Kraft ein. */
  private closureJetzt = 0;

  /**
   * Greifstellen mit Kraft, je Schritt aktuell. Das Schadensmodell liest sie
   * einfach aus; wer lieber auf das Ereignis hoert, nimmt `onKontakt`.
   */
  get kontakte(): GreifKontakt[] {
    const gewalt = this.getViolence?.() ?? 0;
    const anteil = this.items.length > 0 ? 1 / this.items.length : 1;
    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    const gQuat = new THREE.Quaternion(gRot.x, gRot.y, gRot.z, gRot.w);
    const out: GreifKontakt[] = [];
    for (const it of this.items) {
      if (!it.body.isValid()) continue;
      const punkt = it.kontaktRel
        .clone()
        .applyQuaternion(gQuat)
        .add(new THREE.Vector3(gPos.x, gPos.y, gPos.z));
      out.push({
        body: it.body,
        punkt,
        kraftN: this.kraftFuer(it.massKg, gewalt, anteil),
      });
    }
    return out;
  }

  private kraftFuer(massKg: number, gewalt: number, anteil: number): number {
    const schalen = GripSystem.SCHLIESSKRAFT_N * this.closureJetzt * anteil;
    const last = massKg * 9.81 * GripSystem.LASTANTEIL;
    return (schalen + last) * (1 + gewalt * GripSystem.GEWALT_ZUSCHLAG);
  }

  private meldeKontakt(body: RAPIER.RigidBody, punkt: THREE.Vector3): void {
    if (!this.onKontakt) return;
    const gewalt = this.getViolence?.() ?? 0;
    this.onKontakt({
      body,
      punkt: punkt.clone(),
      kraftN: this.kraftFuer(body.mass(), gewalt, 1),
    });
  }

  /** Körper per Fixed Joint an den Greifer koppeln (auch von der Reiß-Mechanik genutzt). */
  attachBody(body: RAPIER.RigidBody): boolean {
    if (this.items.length >= MAX_ITEMS) return false;
    if (this.items.some((it) => it.body.handle === body.handle)) return false; // schon gegriffen
    if (this.totalMassKg + body.mass() > MAX_TOTAL_KG * (this.getCapacityBonus?.() ?? 1))
      return false;

    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    const gQuat = new THREE.Quaternion(gRot.x, gRot.y, gRot.z, gRot.w);
    const gQuatInv = gQuat.clone().invert();

    // Pose des Teils relativ zur Spinne im Moment des Zupackens
    const p = body.translation();
    const r = body.rotation();
    const vonPos = new THREE.Vector3(p.x - gPos.x, p.y - gPos.y, p.z - gPos.z).applyQuaternion(
      gQuatInv
    );
    const vonQuat = gQuatInv.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w));

    // Kinematisch statt per Gelenk (Vorbild v2, Entscheidung M2-1). Gelenke
    // zappeln unter Last, explodieren bei Kollisionen und lassen sich nicht in
    // eine Pose fuehren.
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.wakeUp();
    // Greifstelle: der Punkt der Oberflaeche, der der Spinnenmitte am
    // naechsten liegt. Den meldet die Schnittstelle ans Schadensmodell
    // weiter (Phase 1.6) — dort wird die Beule eingedrueckt, nicht
    // irgendwo in der Mitte des Teils.
    const kontakt = new THREE.Vector3(gPos.x, gPos.y, gPos.z);
    const col = body.collider(0);
    if (col) {
      const proj = col.projectPoint({ x: gPos.x, y: gPos.y, z: gPos.z }, true);
      if (proj) kontakt.set(proj.point.x, proj.point.y, proj.point.z);
    }
    // relativ zur Spinne merken, damit die Greifstelle mitfaehrt
    const kontaktRel = kontakt
      .clone()
      .sub(new THREE.Vector3(gPos.x, gPos.y, gPos.z))
      .applyQuaternion(gQuatInv);
    this.items.push({ body, massKg: body.mass(), vonPos, vonQuat, kontaktRel });
    this.meldeKontakt(body, kontakt);
    return true;
  }

  /**
   * Gefasste Teile der Spinne nachfuehren. Je Schritt aufrufen, nachdem die
   * Spinne ihre neue Pose hat.
   */
  private carryHeld(): void {
    if (this.items.length === 0) return;
    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    this.tmpQ.set(gRot.x, gRot.y, gRot.z, gRot.w);
    for (const it of this.items) {
      if (!it.body.isValid()) continue;
      // Pose halten, nicht verschieben: Das Teil haengt da, wo es gefasst wurde
      this.tmpA.copy(it.vonPos);
      this.tmpQ2.copy(it.vonQuat);
      this.tmpA.applyQuaternion(this.tmpQ);
      it.body.setNextKinematicTranslation({
        x: gPos.x + this.tmpA.x,
        y: gPos.y + this.tmpA.y,
        z: gPos.z + this.tmpA.z,
      });
      this.tmpQ2.premultiply(this.tmpQ);
      it.body.setNextKinematicRotation({
        x: this.tmpQ2.x,
        y: this.tmpQ2.y,
        z: this.tmpQ2.z,
        w: this.tmpQ2.w,
      });
    }
  }

  /** Spur der Spinne mitschreiben — daraus kommt die Loslass-Geschwindigkeit. */
  private trackGrapple(dt: number): void {
    const t = this.grappleBody.translation();
    this.spinneSpur.push(new THREE.Vector3(t.x, t.y, t.z));
    if (this.spinneSpur.length > RELEASE_AVG_STEPS + 1) this.spinneSpur.shift();
    this.spinneDt = dt;
  }

  private spinneDt = 1 / 60;

  /**
   * Mittlere Geschwindigkeit der Spinne ueber die letzten Schritte. Ein
   * einzelner Schritt schwankt zu stark — wer schwungvoll abwirft, soll den
   * Schwung mitgeben, aber kein Zittern.
   */
  private grappleVelocity(out: THREE.Vector3): THREE.Vector3 {
    const n = this.spinneSpur.length;
    if (n < 2 || this.spinneDt <= 0) return out.set(0, 0, 0);
    return out
      .copy(this.spinneSpur[n - 1]!)
      .sub(this.spinneSpur[0]!)
      .divideScalar((n - 1) * this.spinneDt);
  }

  releaseAll(): void {
    const count = this.items.length;
    const v = this.grappleVelocity(this.tmpB);
    for (const item of this.items) {
      if (!item.body.isValid()) continue;
      item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      // Den Schwung der Spinne mitgeben, dazu etwas nach unten: So faellt das
      // Teil, statt in der Luft stehen zu bleiben, und ein Wurf bleibt ein Wurf.
      item.body.setLinvel({ x: v.x, y: v.y - RELEASE_DOWN, z: v.z }, true);
      item.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      item.body.wakeUp();
    }
    this.items = [];
    if (count > 0) {
      this.onReleased?.(count);
      this.onReleaseGrace?.();
    }
  }
}
