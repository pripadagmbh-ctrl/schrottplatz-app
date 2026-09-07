import RAPIER from "@dimforge/rapier3d-compat";
await RAPIER.init();
const mk = (n) => {
  const w2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  w2.integrationParameters.numSolverIterations = 12;
  w2.integrationParameters.numAdditionalFrictionIterations = 6;
  w2.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));
  for (let i = 0; i < n; i++) {
    const b = w2.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation((i % 10) * 0.45, 1 + Math.floor(i / 10) * 0.5, (i % 7) * 0.45).setCcdEnabled(true));
    w2.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(10), b);
  }
  return w2;
};
const t = (w, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) w.step(); return +((performance.now() - t0) / n).toFixed(2); };
const awake = (w) => { let a = 0; w.bodies.forEach((b) => { if (!b.isSleeping()) a++; }); return a; };
for (const n of [130, 260, 400]) {
  const w = mk(n);
  t(w, 30);
  const early = t(w, 60); const a1 = awake(w);
  t(w, 600);
  const late = t(w, 200); const a2 = awake(w);
  w.bodies.forEach((b) => b.wakeUp());
  const woken = t(w, 30);
  console.log({ n, earlyMs: early, awakeEarly: a1, lateMs: late, awakeLate: a2, allWokenMs: woken });
}
