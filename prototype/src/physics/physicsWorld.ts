import RAPIER from "@dimforge/rapier3d-compat";

/** Dünner Wrapper um die Rapier-Welt: fester 60-Hz-Step, Zählstatistik fürs Debug-Overlay. */
export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
  }

  step(): void {
    this.world.step();
  }

  counts(): { bodies: number; awake: number } {
    let bodies = 0;
    let awake = 0;
    this.world.bodies.forEach((b) => {
      bodies++;
      if (!b.isSleeping()) awake++;
    });
    return { bodies, awake };
  }
}

/** Rapier-WASM initialisieren — muss vor dem ersten `new PhysicsWorld()` laufen. */
export async function initPhysics(): Promise<void> {
  await RAPIER.init();
}

export { RAPIER };
