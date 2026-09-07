import RAPIER from "@dimforge/rapier3d-compat";
await RAPIER.init();
const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const kin = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0));
const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0));
w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(10), b);
const j = w.createImpulseJoint(RAPIER.JointData.fixed({x:0,y:-1,z:0},{x:0,y:0,z:0,w:1},{x:0,y:0,z:0},{x:0,y:0,z:0,w:1}), kin, b, true);
w.step();
w.removeRigidBody(b);
const r = {};
try { w.removeImpulseJoint(j, true); r.removeStaleJoint = "OK"; } catch (e) { r.removeStaleJoint = "FEHLER: " + String(e).slice(0, 150); }
try { b.wakeUp(); r.wakeUpRemovedBody = "OK"; } catch (e) { r.wakeUpRemovedBody = "FEHLER: " + String(e).slice(0, 150); }
try { const t = b.translation(); r.translationRemovedBody = "OK " + JSON.stringify(t); } catch (e) { r.translationRemovedBody = "FEHLER: " + String(e).slice(0, 150); }
try { r.mass = b.mass(); } catch (e) { r.mass = "FEHLER: " + String(e).slice(0, 150); }
try { w.step(); r.stepAfter = "OK"; } catch (e) { r.stepAfter = "FEHLER: " + String(e).slice(0, 150); }
console.log(r);
