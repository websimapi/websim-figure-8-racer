import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // Massive Figure-8 with Bridge
        // Center at 0,0,0
        
        const path = new THREE.CatmullRomCurve3([
            // --- UNDERPASS SECTION (Crossing Center Low) ---
            new THREE.Vector3(0, 0, 0),
            
            // --- RIGHT LOOP (Ground Level -> Climbing) ---
            new THREE.Vector3(150, 0, 120),     // Wide turn out
            new THREE.Vector3(280, 0, 0),       // Far Right Apex (Ground)
            new THREE.Vector3(150, 9, -120),    // Climbing return
            
            // --- OVERPASS SECTION (Crossing Center High) ---
            new THREE.Vector3(0, 24, 0),        // High Bridge Clearance
            
            // --- LEFT LOOP (Descending -> Ground) ---
            new THREE.Vector3(-150, 15, 120),   // Descending out
            new THREE.Vector3(-280, 0, 0),      // Far Left Apex (Ground)
            new THREE.Vector3(-150, 0, -120),   // Return to center low
            
        ], true, 'catmullrom', 0.3); // Lower tension for smoother, less twisty curves

        // --- VISUALS ---

        // 1. Road Surface
        const roadShape = new THREE.Shape();
        const roadWidth = 18; // Significantly wider for the larger scale
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

        const asphaltTex = createTexture('asphalt_texture.png', 6, 600); // More repeats for longer track
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
        const pointsOnCurve = path.getSpacedPoints(300); // More sample points for the longer track
        const pillarGeo = new THREE.CylinderGeometry(3, 3, 1, 16); // Even thicker pillars
        const pillarMat = new THREE.MeshStandardMaterial({ map: createTexture('concrete_texture.png') });
        
        pointsOnCurve.forEach((pt) => {
            // Only place pillars if we are high enough off the ground
            // And avoid placing pillars directly in the center (0,0,0) to prevent blocking the underpass
            const distFromCenter = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
            
            // Increased clearance check for the larger underpass
            if (pt.y > 4 && distFromCenter > 20) {
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
        const groundGeo = new THREE.PlaneGeometry(2000, 2000); // Massive ground for driving off-road
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x33aa33, 
            roughness: 1 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.6;
        this.scene.add(ground);

        // Add ground to physics collisions so car can drive on grass
        this.colliders.push(ground);

        return { mesh: trackMesh, path: path };
    }
}

