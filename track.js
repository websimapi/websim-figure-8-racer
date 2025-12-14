import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // 0,0,0 is the crossover point.
        // Loop 1 (Left, Ground): x < 0, y = 0
        // Loop 2 (Right, Bridge): x > 0, y goes up to bridgeHeight
        
        const bridgeHeight = 8;
        const width = 60; // How wide the loops are
        const depth = 30; // How "tall" the loops are in Z
        
        const points = [];
        
        // --- LOOP 1: LEFT (Ground Level) ---
        // Start at center, going -X
        // Uses simple sinusoidal logic approximated by points
        const stepsLeft = 10;
        for (let i = 0; i <= stepsLeft; i++) {
            const t = i / stepsLeft;
            const angle = Math.PI + (t * 2 * Math.PI); // Half circle logic doesn't quite work for 8
            // Let's manually place waypoints for better control
        }

        // Using specific waypoints for a smooth CatmullRom curve
        const waypoints = [
            // Center (Crossing UNDER) - Passing through
            new THREE.Vector3(0, 0, 0),
            
            // Loop 1 (Left - Ground)
            new THREE.Vector3(-15, 0, 15),
            new THREE.Vector3(-40, 0, 0),
            new THREE.Vector3(-15, 0, -15),
            
            // Returning to Center (Approaching Ramp)
            new THREE.Vector3(-2, 0, 0), // Slight nudge to ensure flat at intersection
            
            // Ramp Up (Transition to Loop 2)
            new THREE.Vector3(10, 2, 10),
            
            // Loop 2 (Right - Rising to Bridge)
            new THREE.Vector3(30, 6, 15),
            new THREE.Vector3(50, bridgeHeight, 0), // Apex of right loop, not bridge yet
            new THREE.Vector3(30, 7, -15), // Starting to turn back to center
            
            // THE BRIDGE (Crossing OVER)
            new THREE.Vector3(0, bridgeHeight, 0),
            
            // Ramp Down (Back to Loop 1 start)
            new THREE.Vector3(-15, 4, 5), // Spiraling down?
            // Wait, if we cross (0, H, 0), we are now on the Left side physically?
            // Figure 8 topology: Center -> Left -> Center -> Right -> Center.
            // If we just crossed Center (Over), we are heading towards the Left Loop.
        ];

        // Let's retry the topology coordinates to ensure it flows into a closed loop
        // Center(Under) -> Left Loop -> Center(Up) is impossible because that's a self-intersection in the array logic
        // We need a full closed loop array.
        
        const curvePoints = [
            // 1. Center (Under) heading Left
            new THREE.Vector3(0, 0, 0),
            
            // 2. Left Loop (Flat)
            new THREE.Vector3(-20, 0, 15),
            new THREE.Vector3(-40, 0, 0),
            new THREE.Vector3(-20, 0, -15),
            
            // 3. Approaching Center from Left (Start climbing for Right Loop)
            // We need to avoid hitting the exact center 0,0,0 coordinate in the array again immediately
            // But visually we want to cross.
            // Let's cross slightly offset or handle bridge logic.
            
            // To make a "Bridge", the track loops back over itself.
            // Let's go to the Right Loop now.
            new THREE.Vector3(10, 0, 0), // Base of ramp
            new THREE.Vector3(25, 4, 15), // Climbing Right loop
            new THREE.Vector3(45, 8, 0),  // Far right, high
            new THREE.Vector3(25, 8, -15), // Turning back
            
            // 4. THE BRIDGE CROSSING
            // We are crossing x=0. Height should be max here.
            new THREE.Vector3(0, 8, 0),
            
            // 5. Connecting back to start
            // We are now at x=0, y=8. We need to get to x=0, y=0.
            // We must go "down" into the Left loop.
            // Since we crossed 0,0, we are now technically in -x space
            new THREE.Vector3(-15, 4, 10), // Spiraling down
            // And close the loop automatically by Three.js
        ];

        // Refined points for smoothness
        const refinedPoints = [
            // START (Center Bottom)
            new THREE.Vector3(0, 0.2, 0),
            
            // LEFT LOOP (Flat)
            new THREE.Vector3(-15, 0.2, 12),
            new THREE.Vector3(-35, 0.2, 0),
            new THREE.Vector3(-15, 0.2, -12),
            
            // CROSSING ZONE (Still low)
            new THREE.Vector3(0, 0.2, 0), 
            
            // RIGHT LOOP (Ramp Up)
            new THREE.Vector3(20, 3, 15),
            new THREE.Vector3(45, 8, 0), // Peak height at far end? 
            // Actually, prompt says "central crossing point where one ... passes above".
            // So height must be at x=0.
            
            // Let's try:
            // Right loop climbs up to cross center
            new THREE.Vector3(25, 6, -15),
            
            // BRIDGE CROSSING
            new THREE.Vector3(0, 8, 0),
            
            // RAMP DOWN (Into Left Loop)
            new THREE.Vector3(-15, 4, 6)
        ];
        
        // Final working curve logic
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),     // Underpass
            new THREE.Vector3(-20, 0, 20),  // Left Turn
            new THREE.Vector3(-50, 0, 0),   // Far Left
            new THREE.Vector3(-20, 0, -20), // Left Return
            new THREE.Vector3(0, 0, 0),     // Center (Start Ramp)
            new THREE.Vector3(20, 2, 20),   // Ramp Up Right
            new THREE.Vector3(50, 6, 0),    // Far Right High
            new THREE.Vector3(20, 8, -20),  // Return High
            new THREE.Vector3(0, 8, 0),     // OVERPASS
            new THREE.Vector3(-15, 4, 10)   // Ramp Down to Start
        ], true); // Closed loop
        
        path.tension = 0.5;

        // --- VISUALS ---

        // 1. Road Surface
        const roadShape = new THREE.Shape();
        const roadWidth = 6;
        const wallHeight = 1.5;
        const wallThick = 0.5;

        // Cross section of road (U shape for barriers)
        // Road bed
        roadShape.moveTo(-roadWidth/2 - wallThick, wallHeight);
        roadShape.lineTo(-roadWidth/2 - wallThick, -0.5); // Outer bottom left
        roadShape.lineTo(roadWidth/2 + wallThick, -0.5);  // Outer bottom right
        roadShape.lineTo(roadWidth/2 + wallThick, wallHeight); // Outer top right
        roadShape.lineTo(roadWidth/2, wallHeight); // Inner top right (barrier top)
        roadShape.lineTo(roadWidth/2, 0); // Road surface right
        roadShape.lineTo(-roadWidth/2, 0); // Road surface left
        roadShape.lineTo(-roadWidth/2, wallHeight); // Inner top left
        
        const roadGeo = new THREE.ExtrudeGeometry(roadShape, {
            extrudePath: path,
            steps: 200,
            bevelEnabled: false
        });

        // Calculate UVs manually for better tiling along the curve
        // Standard ExtrudeGeometry UVs are planar projected usually, need correction for road texturing
        // Actually, ExtrudeGeometry with a path does wrap UVs around the tube-ish shape, 
        // but 'y' is along the path, 'x' is across the shape.
        
        const asphaltTex = createTexture('asphalt_texture.png', 4, 80);
        const mat = new THREE.MeshStandardMaterial({ 
            map: asphaltTex,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const trackMesh = new THREE.Mesh(roadGeo, mat);
        trackMesh.castShadow = true;
        trackMesh.receiveShadow = true;
        this.scene.add(trackMesh);
        
        // Physics Collider: We'll use this mesh for raycasting
        this.colliders.push(trackMesh);

        // 2. Pillars
        // Place pillars where y > 1
        const pointsOnCurve = path.getSpacedPoints(50);
        const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
        const pillarMat = new THREE.MeshStandardMaterial({ map: createTexture('concrete_texture.png') });
        
        pointsOnCurve.forEach((pt) => {
            if (pt.y > 2) {
                // Determine height needed
                const height = pt.y - 0.5; // Subtract road thickness
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(pt.x, height / 2, pt.z);
                pillar.scale.set(1, height, 1);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);
            }
        });
        
        // 3. Ground Plane (Grass)
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const grassTex = createTexture('asset_grass.png', 20, 20); // Placeholder name if generated
        // Using a color for now if grass texture isn't strictly requested, but let's make it nice.
        // I will assume I can make a procedural grass material or just use color if asset limit.
        // Prompt didn't ask for grass asset, I'll use a color grid or basic noise.
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x33aa33, 
            roughness: 1 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.6; // Slightly below track bottom
        this.scene.add(ground);

        return { mesh: trackMesh, path: path };
    }
}

