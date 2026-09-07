// Rapier-Verhalten direkt in Node prüfen: frühes `return false` im Query-Callback
import RAPIER from "@dimforge/rapier3d-compat";
await RAPIER.init();
const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
w.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));
const bodies = [];
for (let i = 0; i < 50; i++) {
  const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation((i % 5) * 0.5, 1 + Math.floor(i / 5) * 0.6, 0).setCcdEnabled(true));
  w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(10), b);
  bodies.push(b);
}
for (let i = 0; i < 60; i++) w.step();
const ball = new RAPIER.Ball(3);
const results = {};
// 1) intersectionsWithShape mit return false
try {
  let n = 0;
  w.intersectionsWithShape({ x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, ball, () => { n++; return false; });
  bodies[0].setLinvel({ x: 1, y: 0, z: 0 }, true);
  w.step();
  w.removeRigidBody(bodies[1]);
  results.intersectionsEarlyReturn = `OK (callback ${n}x; step/setLinvel/removeRigidBody danach fehlerfrei)`;
} catch (e) { results.intersectionsEarlyReturn = "FEHLER: " + e; }
// 2) Query-Callback, der die Welt SCHREIBEND nutzt (setLinvel im Callback)
try {
  w.intersectionsWithShape({ x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, ball, (c) => { c.parent()?.setLinvel({ x: 0, y: 1, z: 0 }, true); return true; });
  w.step();
  results.writeInsideCallback = "OK";
} catch (e) { results.writeInsideCallback = "FEHLER: " + String(e).slice(0, 120); }
// 3) contactPairsWith mit Exception im Callback
try {
  const c0 = bodies[2].collider(0);
  try { w.contactPairsWith(c0, () => { throw new Error("boom"); }); } catch {}
  w.step();
  results.exceptionInsideCallback = "OK (Welt nach Exception im Callback weiter benutzbar)";
} catch (e) { results.exceptionInsideCallback = "FEHLER: " + String(e).slice(0, 120); }
// 4) projectPoint im Callback (wie gripSystem.ts)
try {
  w.intersectionsWithShape({ x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, ball, (c) => { c.projectPoint({ x: 1, y: 1, z: 0 }, true); return true; });
  w.step();
  results.projectPointInsideCallback = "OK";
} catch (e) { results.projectPointInsideCallback = "FEHLER: " + String(e).slice(0, 120); }
// 5) Kosten von CCD: 300 Koerper mit/ohne CCD
const bench = (ccd) => {
  const w2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  w2.integrationParameters.numSolverIterations = 12;
  w2.integrationParameters.numAdditionalFrictionIterations = 6;
  w2.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));
  for (let i = 0; i < 300; i++) {
    const b = w2.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation((i % 10) * 0.45, 1 + Math.floor(i / 10) * 0.5, (i % 7) * 0.45).setCcdEnabled(ccd));
    w2.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(10), b);
  }
  for (let i = 0; i < 120; i++) w2.step();
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) w2.step();
  let awake = 0; w2.bodies.forEach((b) => { if (!b.isSleeping()) awake++; });
  return { msPerStep: +((performance.now() - t0) / 300).toFixed(2), awake };
};
results.bench300_ccd = bench(true);
results.bench300_noccd = bench(false);
const bench2 = (iters, fric) => {
  const w2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  w2.integrationParameters.numSolverIterations = iters;
  w2.integrationParameters.numAdditionalFrictionIterations = fric;
  w2.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));
  for (let i = 0; i < 300; i++) {
    const b = w2.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation((i % 10) * 0.45, 1 + Math.floor(i / 10) * 0.5, (i % 7) * 0.45));
    w2.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(10), b);
  }
  for (let i = 0; i < 60; i++) w2.step();
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) w2.step();
  return +((performance.now() - t0) / 300).toFixed(2);
};
results.bench300_iters12_fric6 = bench2(12, 6);
results.bench300_iters4_fric0_default = bench2(4, 0);
console.log(JSON.stringify(results, null, 2));
