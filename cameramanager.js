/**
 * Enhanced CameraManager with:
 *  - "orbit" mode (OrbitControls)
 *  - "free" mode (WASD + pointer-lock mouse look)
 *  - Planet follow in both modes
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class CameraManager {
  constructor(camera, renderer) {
    this.camera = camera;
    this.renderer = renderer;

    // Camera mode: "orbit" or "free"
    this.cameraMode = "orbit";

    // OrbitControls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.enableZoom = true;
    this.orbitControls.enabled = true;

    // No minDistance => can zoom very close
    this.orbitControls.minDistance = 0;
    // Optionally: this.orbitControls.maxDistance = 10000;

    // Free-cam variables
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveSpeed = 100;
    this.clock = new THREE.Clock();

    // Mouse look (pointer lock) variables
    this.pointerLocked = false;
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSensitivity = 0.002; // Adjust for faster/slower look

    // Planet follow logic (works in both modes now)
    this.followTarget = null;
    // Offset if you want the planet on the right side
    this.followOffset = new THREE.Vector3(-200, 30, 0);

    // Setup WASD event listeners
    this._initKeyListeners();

    // Optional: pointer lock listeners
    this._initPointerLockListeners();
  }

  /**
   * Switch camera mode: "orbit" or "free"
   */
  setMode(mode) {
    this.cameraMode = mode;
    if (mode === "orbit") {
      this.orbitControls.enabled = true;
      // Reset free-cam states
      this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
      // Re-sync clock
      this.clock.elapsedTime = 0;
    } else {
      // free
      this.orbitControls.enabled = false;
      // Re-sync clock
      this.clock.elapsedTime = 0;

      // Initialize yaw/pitch from camera's current rotation
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
      this.yaw = euler.y;
      this.pitch = euler.x;
    }
  }

  /**
   * Called every frame in the main loop.
   */
  update() {
    const delta = this.clock.getDelta();

    if (this.cameraMode === "orbit") {
      // Follow target if set
      if (this.followTarget) {
        // Lerp the orbitControls target to the planet
        this.orbitControls.target.lerp(
          this.followTarget.position,
          0.05
        );
      }
      this.orbitControls.update();
    } else {
      // free mode => WASD + pointer lock
      this._updateFreeCam(delta);
    }

    // In either mode, if we have a follow target, move camera near it
    if (this.followTarget) {
      // Lerp the camera toward target + offset
      const desiredPos = this.followTarget.position.clone().add(this.followOffset);
      this.camera.position.lerp(desiredPos, 0.1);
    }
  }

  /**
   * Set or unset a planet to follow.
   * Works in both orbit + free modes now.
   */
  setFollowTarget(object3D) {
    // If same target => unfollow
    if (this.followTarget === object3D) {
      this.followTarget = null;
    } else {
      this.followTarget = object3D;
    }
  }

  /**
   * Request pointer lock on an HTML element (e.g., a button).
   * The user must click that element to lock the pointer.
   */
  enablePointerLock(element) {
    // You can call this from your main code, e.g.:
    // cameraManager.enablePointerLock(document.getElementById("pointerLockButton"));
    if (!element) return;

    element.addEventListener("click", () => {
      // Only request pointer lock if we are in free mode
      if (this.cameraMode === "free") {
        this.renderer.domElement.requestPointerLock();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * WASD key listeners
   */
  _initKeyListeners() {
    document.addEventListener("keydown", (event) => {
      switch (event.code) {
        case "KeyW":
          this.moveForward = true;
          break;
        case "KeyS":
          this.moveBackward = true;
          break;
        case "KeyA":
          this.moveLeft = true;
          break;
        case "KeyD":
          this.moveRight = true;
          break;
        case "Escape":
          // Pressing Esc => break follow + pointer lock
          this.followTarget = null;
          document.exitPointerLock();
          break;
      }
    });

    document.addEventListener("keyup", (event) => {
      switch (event.code) {
        case "KeyW":
          this.moveForward = false;
          break;
        case "KeyS":
          this.moveBackward = false;
          break;
        case "KeyA":
          this.moveLeft = false;
          break;
        case "KeyD":
          this.moveRight = false;
          break;
      }
    });
  }

  /**
   * Pointer lock + mousemove listeners
   */
  _initPointerLockListeners() {
    // pointerlockchange => track if locked/unlocked
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        this.pointerLocked = true;
      } else {
        this.pointerLocked = false;
      }
    });

    // mousemove => rotate yaw/pitch if pointer locked + free mode
    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) return;
      if (this.cameraMode !== "free") return;

      // Adjust yaw/pitch by mouse movement
      this.yaw -= event.movementX * this.mouseSensitivity;
      this.pitch -= event.movementY * this.mouseSensitivity;

      // clamp pitch between -90° and +90°
      const halfPi = Math.PI / 2;
      this.pitch = Math.max(-halfPi, Math.min(halfPi, this.pitch));

      // apply rotation to camera
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    });
  }

  /**
   * Free cam logic
   */
  _updateFreeCam(delta) {
    const speed = this.moveSpeed * delta;

    // Move forward/back
    if (this.moveForward) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      this.camera.position.addScaledVector(forward, speed);
    }
    if (this.moveBackward) {
      const backward = new THREE.Vector3();
      this.camera.getWorldDirection(backward);
      this.camera.position.addScaledVector(backward, -speed);
    }

    // Move left/right (strafe)
    if (this.moveLeft || this.moveRight) {
      const right = new THREE.Vector3();
      this.camera.getWorldDirection(right);
      right.crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();

      if (this.moveLeft) {
        this.camera.position.addScaledVector(right, -speed);
      }
      if (this.moveRight) {
        this.camera.position.addScaledVector(right, speed);
      }
    }
  }
}
