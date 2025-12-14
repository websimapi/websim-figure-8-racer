import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // Large Figure-8 with Bridge
        // Center at 0,0,0
        // Crosses at diagonals for better flow
        
        const path = new THREE.CatmullRomCurve3([
            // --- UNDERPASS SECTION (Crossing Center Low) ---
            new THREE.Vector3(0, 0, 0),         // Center Low
            
            // --- RIGHT LOOP (Climbing) ---
            new THREE.Vector3(50, 4, 40),       // Gentle climb out
            new THREE.Vector3(90, 8, 0),        // Far Right Apex (Mid Height)
            new THREE.Vector3(50, 12, -40),     // Climbing back in
            
            // --- OVERPASS SECTION (Crossing Center High) ---
            new THREE.Vector3(0, 14, 0),        // Center High (Bridge)
            
            // --- LEFT LOOP (Descending) ---
            new THREE.Vector3(-50, 10, 40),     // Descending out
            new THREE.Vector3(-90, 4, 0),       // Far Left Apex (Low)
            new THREE.Vector3(-50, 0, -40),     // Returning to ground
            
            // Close the loop
            // The curve is closed: true, so it connects back to (0,0,0)
        ], true, 'catmullrom', 0.5);

        // --- VISUALS ---

        // 1. Road Surface
        const roadShape = new THREE.Shape();
        const roadWidth = 10; // Wider track
        const wallHeight = 2;
        const wallThick = 0.8;

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
            steps: 400, // Higher resolution for smoother curves
            bevelEnabled: false
        });

        const asphaltTex = createTexture('asphalt_texture.png', 6, 150); // Adjusted tiling
        const mat = new THREE.MeshStandardMaterial({ 
            map: asphaltTex,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const trackMesh = new THREE.Mesh(roadGeo, mat);
        trackMesh.castShadow = true;
        trackMesh.receiveShadow = true;
        this.scene.add(trackMesh);
        
        // Physics Collider
        this.colliders.push(trackMesh);

        // 2. Pillars
        // Generate pillars only where the track is elevated
        const pointsOnCurve = path.getSpacedPoints(80);
        const pillarGeo = new THREE.CylinderGeometry(2, 2, 1, 16); // Thicker pillars
        const pillarMat = new THREE.MeshStandardMaterial({ map: createTexture('concrete_texture.png') });
        
        pointsOnCurve.forEach((pt) => {
            // Only place pillars if we are high enough off the ground
            // And avoid placing pillars directly in the center (0,0,0) to prevent blocking the underpass
            const distFromCenter = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
            
            if (pt.y > 2.5 && distFromCenter > 8) {
                const height = pt.y - 0.5;
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(pt.x, height / 2, pt.z);
                pillar.scale.set(1, height, 1);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);
            }
        });
        
        // 3. Ground Plane
        const groundGeo = new THREE.PlaneGeometry(500, 500); // Larger ground
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x33aa33, 
            roughness: 1 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.6;
        this.scene.add(ground);

        return { mesh: trackMesh, path: path };
    }
}

