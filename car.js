import * as THREE from 'three';

export class Car {
    constructor(scene, input, camera, isRemote = false, color = 0xff3300) {
        this.scene = scene;
        this.input = input;
        this.camera = camera;
        this.isRemote = isRemote;
        this.color = color;
        
        // Physics Configuration
        this.acceleration = 1.2; 
        this.drag = 0.98; 
        this.grip = 0.96; 
        this.turnSpeed = 0.015; 
        this.gravity = 1.0; 
        this.maxReverseSpeed = 50;

        this.heading = 0; 
        this.velocity = new THREE.Vector3(); 
        this.verticalVel = 0;
        
        this.mesh = this.createCarMesh(color);
        this.mesh.position.set(0, 20, 0); 
        this.scene.add(this.mesh);

        this.raycaster = new THREE.Raycaster();
        this.down = new THREE.Vector3(0, -1, 0);
        
        this.grounded = false;
        this.engineSound = null;

        // Remote interpolation
        this.targetPos = new THREE.Vector3();
        this.targetQuat = new THREE.Quaternion();
        this.hasReceivedData = false;
    }

    initAudio(audioContext, buffer) {
        if (this.isRemote) return; // No audio for remote cars to save perf
        
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

    createCarMesh(color) {
        const container = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 2.2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.5 });
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

        if (!this.isRemote) {
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
        }

        return container;
    }

    updateRemoteData(data) {
        if (!this.hasReceivedData) {
            this.mesh.position.set(data.x, data.y, data.z);
            this.mesh.quaternion.set(data.qx, data.qy, data.qz, data.qw);
            this.hasReceivedData = true;
        }
        this.targetPos.set(data.x, data.y, data.z);
        this.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
    }

    update(colliders) {
        if (this.isRemote) {
            this.mesh.position.lerp(this.targetPos, 0.2);
            this.mesh.quaternion.slerp(this.targetQuat, 0.2);
            return;
        }

        const inputs = this.input.update();

        // --- 1. Horizontal Physics (Vector Based) ---
        
        // Apply Drag
        this.velocity.multiplyScalar(this.drag);

        // Apply Throttle (Force)
        if (inputs.throttle !== 0) {
            const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
            // Reduce acceleration if trying to reverse rapidly or go over speed limit (simple cap)
            this.velocity.addScaledVector(forward, inputs.throttle * this.acceleration);
        }

        // Steering
        // Only steer effectively if moving
        const speed = this.velocity.length();
        if (speed > 0.5) {
            // Reverse steering if going backward
            const direction = this.velocity.dot(new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)));
            const dirSign = direction > 0 ? 1 : -1;
            
            // Steer
            this.heading += inputs.steering * this.turnSpeed * dirSign * Math.min(speed / 20, 1.0);
        }

        // Wall Collision (Improved with Bouncing)
        if (speed > 0.1) {
            // Raycast forward-ish
            const velocityDir = this.velocity.clone().normalize();
            // Also check slightly left/right to catch sideswipes
            const angles = [0, 0.5, -0.5]; // radians offset
            
            for(let ang of angles) {
                const checkDir = velocityDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), ang);
                const rayOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
                this.raycaster.set(rayOrigin, checkDir);
                
                const hits = this.raycaster.intersectObjects(colliders, true);
                let hitWall = null;
                
                for (let hit of hits) {
                    if (hit.object.name === 'wall' && hit.distance < 3.0) {
                        hitWall = hit;
                        break;
                    }
                }

                if (hitWall) {
                    const normal = hitWall.face.normal.clone();
                    
                    // Reflect Velocity: v' = v - 2 * (v . n) * n
                    const vDotN = this.velocity.dot(normal);
                    
                    // Only reflect if we are moving INTO the wall
                    if (vDotN < 0) {
                        // Bouncy reflection
                        const restitution = 0.5; // How much speed we keep
                        const reflection = normal.clone().multiplyScalar(2 * vDotN);
                        this.velocity.sub(reflection).multiplyScalar(restitution);
                        
                        // Force push out
                        const pushOut = normal.clone().multiplyScalar(3.1 - hitWall.distance);
                        this.mesh.position.add(pushOut);
                    }
                    break; // One collision per frame is enough
                }
            }
        }

        // Lateral Grip / Drifting
        // Convert velocity to local space
        const cosAngle = Math.cos(this.heading);
        const sinAngle = Math.sin(this.heading);
        
        // Project velocity onto local axes
        const localZ = this.velocity.x * sinAngle + this.velocity.z * cosAngle; // Forward speed
        const localX = this.velocity.x * cosAngle - this.velocity.z * sinAngle; // Sideways speed (Drift)

        // Apply Grip to sideways speed
        const newLocalX = localX * this.grip;
        
        // Reconstruct Global Velocity
        this.velocity.x = newLocalX * cosAngle + localZ * sinAngle;
        this.velocity.z = -newLocalX * sinAngle + localZ * cosAngle;

        // Apply Position Change
        this.mesh.position.x += this.velocity.x;
        this.mesh.position.z += this.velocity.z;


        // --- 2. Vertical Physics (Raycast) ---
        
        // Raycast relative to car (look down from slightly above)
        // This prevents snapping to bridges far overhead
        const rayOriginY = this.mesh.position.y + 10; 
        
        this.raycaster.set(
            new THREE.Vector3(this.mesh.position.x, rayOriginY, this.mesh.position.z), 
            this.down
        );
        
        const intersects = this.raycaster.intersectObjects(colliders, true);
        
        let groundHeight = -Infinity;
        let groundNormal = new THREE.Vector3(0, 1, 0);
        let hitFound = false;

        for (let hit of intersects) {
            // Filter: Ignore vertical walls for ground snapping
            if (hit.object.name !== 'wall' && hit.point.y > groundHeight && hit.face.normal.y > 0.5) {
                groundHeight = hit.point.y;
                groundNormal = hit.face.normal;
                hitFound = true;
            }
        }

        // Logic to snap to ground or fall
        const hoverHeight = 1.2; // Height of car origin above ground
        
        if (hitFound) {
            const dist = this.mesh.position.y - (groundHeight + hoverHeight);
            
            // Snap threshold (if close enough, stick to road)
            if (dist < 10.0 && dist > -5.0) {
                this.mesh.position.y = groundHeight + hoverHeight;
                this.verticalVel = 0;
                this.grounded = true;
            } else {
                // Too far above/below valid hit, treat as air
                this.grounded = false;
            }
        } else {
            this.grounded = false;
        }

        // Apply Gravity / Air Physics
        if (!this.grounded) {
            this.verticalVel -= this.gravity;
            this.mesh.position.y += this.verticalVel;
            
            // Floor Clamp (Infinite Ground Plane)
            if (this.mesh.position.y < -0.2 + hoverHeight) {
                 this.mesh.position.y = -0.2 + hoverHeight;
                 this.verticalVel = 0;
                 this.grounded = true;
                 groundNormal.set(0, 1, 0); // Flat ground
            } else {
                 // In air, slowly upright the car
                 groundNormal.set(0, 1, 0);
            }
        }


        // --- 3. Orientation ---
        
        // Yaw
        const yawQ = new THREE.Quaternion();
        yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
        
        // Pitch/Roll (Slope)
        const slopeQ = new THREE.Quaternion();
        slopeQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), groundNormal);
        
        // Combine
        const finalQ = new THREE.Quaternion();
        finalQ.multiplyQuaternions(slopeQ, yawQ);
        
        // Smooth rotation
        this.mesh.quaternion.slerp(finalQ, 0.15);


        // --- 4. Camera Follow (RIGID) ---
        // Completely rigid follow to prevent "too far away" issue
        if (this.camera) {
            const relativeOffset = new THREE.Vector3(0, 6.0, -15); 
            const cameraOffset = relativeOffset.clone().applyQuaternion(this.mesh.quaternion);
            
            // Directly set position, do not lerp
            const targetPos = this.mesh.position.clone().add(cameraOffset);
            this.camera.position.copy(targetPos);
            
            // Look slightly above the car
            this.camera.lookAt(this.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0)));
        }


        // --- 5. Audio ---
        if (this.engineSound) {
            const velocityMag = this.velocity.length();
            const pitch = 0.5 + (velocityMag / 100); // 100 is approx max speed ref
            this.engineSound.playbackRate.value = Math.max(0.2, Math.min(pitch, 2.0));
        }

        // Respawn if glitching deep
        if (this.mesh.position.y < -500) {
            this.mesh.position.set(0, 20, 0);
            this.velocity.set(0,0,0);
            this.verticalVel = 0;
        }
    }
}

