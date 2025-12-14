import * as THREE from 'three';

export class Car {
    constructor(scene, input, camera) {
        this.scene = scene;
        this.input = input;
        this.camera = camera;
        
        this.speed = 0;
        this.maxSpeed = 1.4; // Faster for larger track
        this.acceleration = 0.03;
        this.friction = 0.97;
        this.turnSpeed = 0.045;
        this.heading = 0; // Radians

        this.velocity = new THREE.Vector3();
        this.mesh = this.createCarMesh();
        this.mesh.position.set(0, 2, 0); // Start high to drop in
        this.scene.add(this.mesh);

        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
        
        this.grounded = false;
        this.verticalVel = 0;
        this.gravity = 0.02;

        this.engineSound = null;
    }

    initAudio(audioContext, buffer) {
        this.engineSound = audioContext.createBufferSource();
        this.engineSound.buffer = buffer;
        this.engineSound.loop = true;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.1;
        
        this.engineSound.connect(gainNode);
        gainNode.connect(audioContext.destination);
        this.engineSound.start(0);
        this.engineSound.playbackRate.value = 0.5;
        this.engineGain = gainNode;
    }

    createCarMesh() {
        const container = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 2.2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3300, roughness: 0.3, metalness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        container.add(body);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1, 0.4, 1);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.9, -0.2);
        container.add(cabin);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelRot = new THREE.Euler(0, 0, Math.PI / 2);

        const wPos = [
            [-0.7, 0.35, 0.7], [0.7, 0.35, 0.7], // Front
            [-0.7, 0.35, -0.8], [0.7, 0.35, -0.8] // Back
        ];

        wPos.forEach(p => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.position.set(...p);
            w.rotation.copy(wheelRot);
            container.add(w);
        });

        // Headlights
        const lightGeo = new THREE.SphereGeometry(0.15);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        const hl1 = new THREE.Mesh(lightGeo, lightMat);
        const hl2 = new THREE.Mesh(lightGeo, lightMat);
        hl1.position.set(-0.4, 0.5, 1.1);
        hl2.position.set(0.4, 0.5, 1.1);
        container.add(hl1);
        container.add(hl2);

        // Spotlights for night/effect
        const sl1 = new THREE.SpotLight(0xffffee, 10, 30, 0.5, 0.5, 1);
        sl1.position.set(0, 1, 0);
        sl1.target.position.set(0, 0, 10);
        container.add(sl1);
        container.add(sl1.target);

        return container;
    }

    update(colliders) {
        const inputs = this.input.update();
        
        // Acceleration
        if (inputs.throttle !== 0) {
            this.speed += inputs.throttle * this.acceleration;
        } else {
            // Decel
            this.speed *= this.friction;
        }
        
        // Cap speed
        this.speed = Math.max(Math.min(this.speed, this.maxSpeed), -this.maxSpeed/2);

        // Steering (only if moving)
        if (Math.abs(this.speed) > 0.01) {
            this.heading += inputs.steering * this.turnSpeed * Math.sign(this.speed);
        }

        // Calculate Physics Velocity
        this.velocity.x = Math.sin(this.heading) * this.speed;
        this.velocity.z = Math.cos(this.heading) * this.speed;

        // Apply Horizontal movement
        this.mesh.position.x += this.velocity.x;
        this.mesh.position.z += this.velocity.z;

        // Rotation
        this.mesh.rotation.y = this.heading;

        // Vertical Physics (Raycast)
        this.raycaster.set(
            new THREE.Vector3(this.mesh.position.x, this.mesh.position.y + 2, this.mesh.position.z), 
            this.down
        );
        
        const intersects = this.raycaster.intersectObjects(colliders, false);
        
        // Find highest point below car
        let groundHeight = -100;
        let hitFound = false;

        for (let hit of intersects) {
            // Check if hit is reasonably close below
            if (hit.point.y <= this.mesh.position.y + 1 && hit.point.y > groundHeight) {
                groundHeight = hit.point.y;
                hitFound = true;
            }
        }

        if (hitFound) {
            // Snap or smooth to ground
            if (this.mesh.position.y < groundHeight + 0.1) {
                this.mesh.position.y = groundHeight;
                this.verticalVel = 0;
                this.grounded = true;
            } else {
                this.grounded = false;
            }
        } else {
            this.grounded = false;
        }

        if (!this.grounded) {
            this.verticalVel -= this.gravity;
            this.mesh.position.y += this.verticalVel;
        }

        // Camera Follow
        const camOffset = new THREE.Vector3(
            Math.sin(this.heading + Math.PI) * 10,
            6,
            Math.cos(this.heading + Math.PI) * 10
        );
        const targetPos = this.mesh.position.clone().add(camOffset);
        this.camera.position.lerp(targetPos, 0.1);
        this.camera.lookAt(this.mesh.position);

        // Audio Pitch
        if (this.engineSound) {
            const pitch = 0.5 + Math.abs(this.speed) * 1.5;
            this.engineSound.playbackRate.value = pitch;
        }
    }
}

