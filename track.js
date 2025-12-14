import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // Massive Figure-8 with Bridge - Adjusted for smoother driving
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),          // Center Low
            new THREE.Vector3(180, 0, 140),      // Wide right turn start
            new THREE.Vector3(320, 0, 0),        // Far Right Apex
            new THREE.Vector3(180, 8, -140),     // Return loop, starting climb
            new THREE.Vector3(0, 22, 0),         // Bridge Peak (Crossing)
            new THREE.Vector3(-180, 14, 140),    // Descending loop
            new THREE.Vector3(-320, 0, 0),       // Far Left Apex
            new THREE.Vector3(-180, 0, -140),    // Return to center
        ], true, 'catmullrom', 0.1); // Very low tension for gentle curves

        // --- CUSTOM ROAD GEOMETRY GENERATION ---
        // Manually building the mesh to ensure zero banking/roll ("keep up")
        
        const pointsCount = 1200;
        const points = path.getSpacedPoints(pointsCount);
        const roadWidth = 24; // Very wide for drivability
        
        const positions = [];
        const uvs = [];
        const indices = [];

        // Temporary vectors
        const up = new THREE.Vector3(0, 1, 0);
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const pL = new THREE.Vector3();
        const pR = new THREE.Vector3();

        // 1. Build the Ribbon
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            
            // Calculate Forward Tangent
            if (i < points.length - 1) {
                forward.subVectors(points[i+1], p).normalize();
            } else {
                // Wrap around tangent
                forward.subVectors(points[1], points[0]).normalize(); 
            }

            // Calculate Right Vector (always flat relative to world Y)
            // Cross Up with Forward gives a horizontal Right vector
            right.crossVectors(up, forward).normalize();

            // Vertices
            pL.copy(p).addScaledVector(right, -roadWidth / 2); // Left edge
            pR.copy(p).addScaledVector(right, roadWidth / 2);  // Right edge

            positions.push(pL.x, pL.y, pL.z); // Vertex 2*i
            positions.push(pR.x, pR.y, pR.z); // Vertex 2*i + 1

            // UVs
            const dist = i / points.length;
            const repeatY = 200; 
            uvs.push(0, dist * repeatY);
            uvs.push(1, dist * repeatY);

            // Indices (Quads)
            if (i < points.length - 1) {
                const a = i * 2;
                const b = i * 2 + 1;
                const c = (i + 1) * 2;
                const d = (i + 1) * 2 + 1;

                // Face 1
                indices.push(a, d, b);
                // Face 2
                indices.push(a, c, d);
            }
        }

        const roadGeo = new THREE.BufferGeometry();
        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        roadGeo.setIndex(indices);
        roadGeo.computeVertexNormals();

        // Material
        const asphaltTex = createTexture('asphalt_texture.png', 1, 1); 
        asphaltTex.repeat.set(2, 100); // Adjust repeat manually
        
        const mat = new THREE.MeshStandardMaterial({ 
            map: asphaltTex,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const trackMesh = new THREE.Mesh(roadGeo, mat);
        
        // Create side barriers (Visual only, simple strips)
        // Re-use points to make walls
        const wallGeo = new THREE.BufferGeometry();
        const wallPos = [];
        const wallInd = [];
        const wallHeight = 1.5;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
             // Recalc forward/right same as above
             if (i < points.length - 1) {
                forward.subVectors(points[i+1], p).normalize();
            } else {
                forward.subVectors(points[1], points[0]).normalize(); 
            }
            right.crossVectors(up, forward).normalize();

            const pL = new THREE.Vector3().copy(p).addScaledVector(right, -roadWidth / 2);
            const pR = new THREE.Vector3().copy(p).addScaledVector(right, roadWidth / 2);

            // Left Wall
            wallPos.push(pL.x, pL.y, pL.z);                 // Bottom
            wallPos.push(pL.x, pL.y + wallHeight, pL.z);    // Top

            // Right Wall
            wallPos.push(pR.x, pR.y, pR.z);                 // Bottom
            wallPos.push(pR.x, pR.y + wallHeight, pR.z);    // Top

            if (i < points.length - 1) {
                // Indices for walls
                // Left Wall (vertices 4*i, 4*i+1) -> connect to 4*(i+1)...
                const base = i * 4;
                const next = (i + 1) * 4;
                
                // Left Wall Quad
                // b, b+1, n+1, n
                wallInd.push(base, next, base + 1);
                wallInd.push(base + 1, next, next + 1);

                // Right Wall Quad
                // b+2, b+3, n+3, n+2
                wallInd.push(base + 2, base + 3, next + 2);
                wallInd.push(base + 3, next + 3, next + 2);
            }
        }
        
        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
        wallGeo.setIndex(wallInd);
        wallGeo.computeVertexNormals();
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const walls = new THREE.Mesh(wallGeo, wallMat);
        trackMesh.add(walls);
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

