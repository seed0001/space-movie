import * as THREE from 'three';

// CameraDirector — cinematic camera work.
// While `active`, Game.updateCamera is suppressed (game.cameraLocked) and
// this class owns the camera every frame. Shots are specified by type +
// target and evolve over time (orbits sweep, flybys track, chases lag).

export class CameraDirector {
    constructor(camera, game) {
        this.camera = camera;
        this.game = game;
        this.active = false;
        this.shot = null;
        this.time = 0;
        this.shake = 0;          // decays; set by fx/battle
        this._tmp = new THREE.Vector3();
        this._look = new THREE.Vector3();
    }

    engage() {
        this.active = true;
        this.game.cameraLocked = true;
    }

    release() {
        this.active = false;
        this.shot = null;
        this.game.cameraLocked = false;
    }

    addShake(amount) {
        this.shake = Math.min(1.5, this.shake + amount);
    }

    // spec: {type, target, seconds}. Target resolution is injected by the
    // director via resolveTarget so this class stays scene-agnostic.
    setShot(spec, resolveTarget) {
        this.engage();
        const subject = resolveTarget(spec.target || 'player');
        const size = subject.size || 50;

        this.shot = {
            type: spec.type || 'orbit',
            subject,
            size,
            seconds: spec.seconds || 6,
            // Random-but-stable parameters so each shot composes differently
            phase: Math.random() * Math.PI * 2,
            elevation: 0.15 + Math.random() * 0.5,
            direction: Math.random() < 0.5 ? 1 : -1,
        };
        this.time = 0;

        // Cut (not glide) to the opening frame of the new shot
        this.positionCamera(0, true);
    }

    update(delta) {
        if (!this.active || !this.shot) return;
        this.time += delta;
        this.positionCamera(delta, false);
    }

    positionCamera(delta, hardCut) {
        const s = this.shot;
        const subjectPos = s.subject.getPosition(this._tmp);
        const t = this.time;
        const size = s.size;
        const cam = this.camera;

        let desired = new THREE.Vector3();
        let lookAt = this._look.copy(subjectPos);

        switch (s.type) {
            case 'wide': {
                // Distant, slowly drifting master shot
                const dist = size * 14;
                const ang = s.phase + t * 0.02 * s.direction;
                desired.set(
                    subjectPos.x + Math.cos(ang) * dist,
                    subjectPos.y + dist * s.elevation * 0.6,
                    subjectPos.z + Math.sin(ang) * dist
                );
                break;
            }
            case 'orbit': {
                const dist = size * 4.5;
                const ang = s.phase + t * 0.22 * s.direction;
                desired.set(
                    subjectPos.x + Math.cos(ang) * dist,
                    subjectPos.y + dist * s.elevation,
                    subjectPos.z + Math.sin(ang) * dist
                );
                break;
            }
            case 'flyby': {
                // Camera holds a line; subject sweeps past
                const travel = (t / s.seconds - 0.5) * size * 10;
                const side = new THREE.Vector3(Math.cos(s.phase), 0, Math.sin(s.phase));
                desired.copy(subjectPos)
                    .addScaledVector(side, size * 2.2)
                    .add(new THREE.Vector3(0, size * 0.8, 0))
                    .addScaledVector(side.clone().cross(new THREE.Vector3(0, 1, 0)), travel * 0.15);
                break;
            }
            case 'chase': {
                // Behind and above, loose lag
                const q = s.subject.getQuaternion?.();
                const back = q ? new THREE.Vector3(0, 0, -1).applyQuaternion(q) : new THREE.Vector3(0, 0, -1);
                desired.copy(subjectPos).addScaledVector(back, size * 3.2)
                    .add(new THREE.Vector3(0, size * 1.1, 0));
                const fwd = q ? new THREE.Vector3(0, 0, 1).applyQuaternion(q) : new THREE.Vector3(0, 0, 1);
                lookAt.addScaledVector(fwd, size * 3);
                break;
            }
            case 'closeup': {
                const dist = size * 1.8;
                const ang = s.phase + t * 0.06 * s.direction;
                desired.set(
                    subjectPos.x + Math.cos(ang) * dist,
                    subjectPos.y + dist * 0.25,
                    subjectPos.z + Math.sin(ang) * dist
                );
                break;
            }
            case 'twoshot': {
                // Frame subject plus its companion offset; slow push-in
                const push = 1 - Math.min(1, t / s.seconds) * 0.25;
                const dist = size * 3.4 * push;
                const ang = s.phase;
                desired.set(
                    subjectPos.x + Math.cos(ang) * dist,
                    subjectPos.y + dist * 0.35,
                    subjectPos.z + Math.sin(ang) * dist
                );
                break;
            }
            case 'pov': {
                const q = s.subject.getQuaternion?.();
                const fwd = q ? new THREE.Vector3(0, 0, 1).applyQuaternion(q) : new THREE.Vector3(0, 0, 1);
                desired.copy(subjectPos).addScaledVector(fwd, size * 0.6)
                    .add(new THREE.Vector3(0, size * 0.3, 0));
                lookAt.copy(subjectPos).addScaledVector(fwd, size * 30);
                break;
            }
            case 'planet': {
                // Grand establishing arc around a big body
                const dist = size * 2.6;
                const ang = s.phase + t * 0.05 * s.direction;
                desired.set(
                    subjectPos.x + Math.cos(ang) * dist,
                    subjectPos.y + dist * 0.18,
                    subjectPos.z + Math.sin(ang) * dist
                );
                break;
            }
            default: {
                const dist = size * 5;
                desired.set(subjectPos.x + dist, subjectPos.y + dist * 0.4, subjectPos.z + dist);
            }
        }

        if (hardCut) {
            cam.position.copy(desired);
        } else {
            // Smooth glide within a shot (cuts happen in setShot)
            cam.position.lerp(desired, Math.min(1, delta * 3.0));
        }

        // Handheld shake, decaying
        if (this.shake > 0.001) {
            const sh = this.shake * size * 0.05;
            cam.position.x += (Math.random() - 0.5) * sh;
            cam.position.y += (Math.random() - 0.5) * sh;
            cam.position.z += (Math.random() - 0.5) * sh;
            this.shake *= Math.pow(0.25, delta);
        }

        cam.lookAt(lookAt);
    }
}
