/**
 * WAS MACHT RAPIER, WENN MAN EINEN ENTFERNTEN KOERPER FRAGT?
 *
 * Die Messung hinter `ItemManager.raeumeVerwaiste` (E-098). Der Befund aus
 * E-097 lautete „`clampSpeeds` ruft `isDynamic()` ohne `isValid()`, harter
 * Absturz nach 5,5 Minuten". Hier steht, wie hart.
 *
 * Gemessen am 17.09.2026:
 *
 *   isValid()    →  false                    gutartig
 *   handle       →  2,1e−314 statt 0         Unsinn, aber ohne Fehler
 *   isDynamic()  →  RuntimeError: unreachable
 *   danach step() → „recursive use of an object detected which would lead to
 *                   unsafe aliasing in rust"  — die WELT ist hin
 *   eine NEUE Welt laeuft danach wieder
 *
 * Die dritte Zeile ist der Absturz, die vierte der Grund, warum er vor allem
 * anderen drankam: Es steht nicht ein Teil still, sondern das Spiel.
 *
 * Aufruf:  npx vite-node tools/absturz-probe.ts
 */
import RAPIER from "@dimforge/rapier3d-compat";

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0));
world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2), b);
console.log("vorher isValid:", b.isValid(), "isDynamic:", b.isDynamic());
world.removeRigidBody(b);
console.log("nachher isValid:", b.isValid());
try {
  console.log("handle nach dem Entfernen:", b.handle);
} catch (e) {
  console.log("handle wirft:", (e as Error).message.slice(0, 60));
}
try {
  console.log("isDynamic:", b.isDynamic());
  console.log("KEIN ABSTURZ");
} catch (e) {
  console.log("ABSTURZ:", (e as Error).name, (e as Error).message.slice(0, 80));
}
try {
  world.step();
  console.log("Welt laeuft nach dem Fehler weiter");
} catch (e) {
  console.log("Welt ist hin:", (e as Error).message.slice(0, 80));
}
try {
  const w2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const b2 = w2.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0));
  w2.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2), b2);
  for (let i = 0; i < 10; i++) w2.step();
  console.log("NEUE Welt laeuft:", b2.translation().y.toFixed(3), "isDynamic:", b2.isDynamic());
} catch (e) {
  console.log("neue Welt ist auch hin:", (e as Error).message.slice(0, 90));
}
