import * as THREE from 'three';
import { createTexture } from './utils.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of meshes for physics
    }

    generate() {
        // Curve definition
        // GIGANTIC Figure-8 with Bridge (Massive Scale)
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),                 // 0. Center Low
            new THREE.Vector3(50000, 0, 40000),         // 1. Right Loop Entry
            new THREE.Vector3(100000, 0, 0),            // 2. Right Loop Apex
            new THREE.Vector3(50000, 0, -40000),        // 3. Right Loop Exit
            new THREE.Vector3(15000, 1200, -15000),     // 4. Climbing
            new THREE.Vector3(0, 2500, 0),              // 5. Bridge Peak
            new THREE.Vector3(-15000, 1200, 15000),     // 6. Descending
            new THREE.Vector3(-50000, 0, 40000),        // 7. Left Loop Entry
            new THREE.Vector3(-100000, 0, 0),           // 8. Left Loop Apex
            new THREE.Vector3(-50000, 0, -40000),       // 9. Left Loop Exit
            new THREE.Vector3(-15000, 0, -15000),       // 10. Return
        ], true, 'catmullrom', 0.05); 

        // --- CUSTOM ROAD GEOMETRY GENERATION ---
        // Manually building the mesh to ensure zero banking/roll ("keep up")
        
        const pointsCount = 25000; // Increased density for huge scale
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
            const repeatY = 60000; // Texture repeat scale
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
        asphaltTex.repeat.set(120, 60000); // Dense tiling
        
        const mat = new THREE.MeshStandardMaterial({ 
            map: asphaltTex,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const trackMesh = new THREE.Mesh(roadGeo, mat);
        
        // Removed side barriers for smoother off-road experience
        
        trackMesh.castShadow = true;
        trackMesh.receiveShadow = true;
        this.scene.add(trackMesh);
        
        // Physics Collider
        this.colliders.push(trackMesh);

        // 2. Pillars
        // Generate pillars only where the track is elevated
        const pointsOnCurve = path.getSpacedPoints(2000); 
        const pillarGeo = new THREE.CylinderGeometry(240, 240, 1, 32); 
        const pillarMat = new THREE.MeshStandardMaterial({ map: createTexture('concrete_texture.png') });
        pillarMat.map.repeat.set(1, 10); 

        pointsOnCurve.forEach((pt) => {
            // Only place pillars if we are high enough off the ground
            const distFromCenter = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
            
            // Only add pillars near the bridge section
            if (pt.y > 100 && distFromCenter < 25000) {
                const height = pt.y; // Extend to y=0 approx
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(pt.x, height / 2, pt.z);
                pillar.scale.set(1, height, 1);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);
            }
        });
        
        // Add scenery
        this.addScenery(path);

        // 3. Ground Plane
        const groundGeo = new THREE.PlaneGeometry(500000, 500000); // Planet size ground
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x33aa33, 
            roughness: 1,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2; // Flush with road start (0) but slightly under to prevent z-fighting
        ground.frustumCulled = false;
        this.scene.add(ground);

        // Add ground to physics collisions so car can drive on grass
        this.colliders.push(ground);

        return { mesh: trackMesh, path: path };
    }

    addScenery(path) {
        // Procedural trees along the track
        const treeGeo = new THREE.ConeGeometry(80, 200, 8);
        const trunkGeo = new THREE.CylinderGeometry(20, 20, 60, 8);
        
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 });
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 1.0 });
        
        const count = 400;
        const trees = new THREE.InstancedMesh(treeGeo, treeMat, count);
        const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        
        const dummy = new THREE.Object3D();
        const points = path.getSpacedPoints(count);
        
        let instanceIdx = 0;
        
        for (let i = 0; i < points.length; i++) {
            // Offset from track
            const side = Math.random() > 0.5 ? 1 : -1;
            const dist = 2500 + Math.random() * 4000; // Scatter distance
            
            // Calculate approximate perpendicular direction
            const tangent = new THREE.Vector3().subVectors(
                points[Math.min(i+1, points.length-1)], 
                points[i]
            ).normalize();
            const up = new THREE.Vector3(0,1,0);
            const right = new THREE.Vector3().crossVectors(up, tangent).normalize();
            
            const pos = new THREE.Vector3().copy(points[i]).addScaledVector(right, side * dist);
            pos.y = -5; // Ground level
            
            // Random Scale
            const scale = 1.5 + Math.random() * 2.5;
            
            // Trunk
            dummy.position.copy(pos);
            dummy.position.y += 30 * scale; 
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            trunks.setMatrixAt(instanceIdx, dummy.matrix);
            
            // Leaves
            dummy.position.y += 100 * scale;
            dummy.updateMatrix();
            trees.setMatrixAt(instanceIdx, dummy.matrix);
            
            instanceIdx++;
            if (instanceIdx >= count) break;
        }
        
        trees.castShadow = true;
        trees.receiveShadow = true;
        trunks.castShadow = true;
        trunks.receiveShadow = true;
        
        this.scene.add(trees);
        this.scene.add(trunks);
    }
}

