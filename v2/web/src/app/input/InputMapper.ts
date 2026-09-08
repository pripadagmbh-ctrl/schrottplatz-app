import { resetControlFrame, type ControlFrame } from "@/sim/control/ControlFrame";
import type { ControlsFile } from "@/data/types";
import { KeyboardMouseAdapter } from "./KeyboardMouseAdapter";
import { TouchAdapter } from "./TouchAdapter";
import { clamp } from "@/shared/math";

/**
 * Mischt Tastatur/Maus und Touch in einen ControlFrame (Architektur Kap. 5). Beide Adapter addieren,
 * der Mapper klemmt auf −1..1. Touch-Oberfläche erscheint nur, wenn das Gerät Touch hat (pointer: coarse);
 * eine angeschlossene Tastatur funktioniert daneben weiter.
 */
export class InputMapper {
  readonly keyboard: KeyboardMouseAdapter;
  readonly touch: TouchAdapter | null;

  constructor(canvas: HTMLCanvasElement, parent: HTMLElement, controls: ControlsFile, rotatorStepDeg: number, rotatorRateDegS: number) {
    this.keyboard = new KeyboardMouseAdapter(canvas, controls, rotatorStepDeg, rotatorRateDegS);
    const hasTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    this.touch = hasTouch ? new TouchAdapter(parent, controls) : null;
  }

  fill(f: ControlFrame, dt: number, grappleClosure: number): void {
    resetControlFrame(f);
    this.keyboard.add(f, dt);
    this.touch?.add(f, dt);
    if (grappleClosure <= 0) this.keyboard.notifyOpen();
    f.drive = clamp(f.drive, -1, 1); f.steer = clamp(f.steer, -1, 1); f.cab = clamp(f.cab, -1, 1);
    f.boom = clamp(f.boom, -1, 1); f.stick = clamp(f.stick, -1, 1); f.grapple = clamp(f.grapple, -1, 1); f.rotator = clamp(f.rotator, -1, 1);
  }

  dispose(): void { this.keyboard.dispose(); this.touch?.dispose(); }
}
