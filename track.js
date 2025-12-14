import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // GIGANTIC Figure-8 with Bridge (30x scale)
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),                 // 0. Center Low
            new THREE.Vector3(12000, 0, 12000),         // 1. Right Loop Entry
            new THREE.Vector3(30000, 0, 18000),         // 2. Right Loop Wide Corner
            new THREE.Vector3(48000, 0, 0),             // 3. Right Loop Apex
            new THREE.Vector3(30000, 0, -18000),        // 4. Right Loop Return Corner
            new THREE.Vector3(12000, 900, -12000),      // 5. Climbing
            new THREE.Vector3(0, 2100, 0),              // 6. Bridge Peak
            new THREE.Vector3(-12000, 900, 12000),      // 7. Descending
            new THREE.Vector3(-30000, 0, 18000),        // 8. Left Loop Wide Corner
            new THREE.Vector3(-48000, 0, 0),            // 9. Left Loop Apex
            new THREE.Vector3(-30000, 0, -18000),       // 10. Left Loop Return Corner
            new THREE.Vector3(-12000, 0, -12000),       // 11. Return
        ], true, 'catmullrom', 0.1); 

        // --- CUSTOM ROAD GEOMETRY GENERATION ---
        // Manually building the mesh to ensure zero banking/roll ("keep up")
        
        const pointsCount = 15000; // Increased density for huge scale
        const points = path.getSpacedPoints(pointsCount);
        const roadWidth = 1800; // 30x Width
        
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
            const repeatY = 24000; // 30x length repeat
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
        asphaltTex.repeat.set(120, 24000); // Dense tiling
        
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
        const wallHeight = 20; // Taller walls for visibility at scale

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
        const pointsOnCurve = path.getSpacedPoints(1500); 
        const pillarGeo = new THREE.CylinderGeometry(240, 240, 1, 32); // 30x Radius
        const pillarMat = new THREE.MeshStandardMaterial({ map: createTexture('concrete_texture.png') });
        pillarMat.map.repeat.set(1, 10); // Vertical repeat

        pointsOnCurve.forEach((pt) => {
            // Only place pillars if we are high enough off the ground
            const distFromCenter = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
            
            // Scaled clearance: 10->300 height, 90->2700 radius
            if (pt.y > 300 && distFromCenter > 2700) {
                const height = pt.y - 20;
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(pt.x, height / 2, pt.z);
                pillar.scale.set(1, height, 1);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);
            }
        });
        
        // 3. Ground Plane
        const groundGeo = new THREE.PlaneGeometry(300000, 300000); // Planet size ground
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x33aa33, 
            roughness: 1 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -5;
        this.scene.add(ground);

        // Add ground to physics collisions so car can drive on grass
        this.colliders.push(ground);

        return { mesh: trackMesh, path: path };
    }
}

