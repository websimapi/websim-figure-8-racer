import * as THREE from 'three';
import { Track } from './track.js';
import { Car } from './car.js';
import { InputController } from './input.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        
        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 20000, 350000);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 500000);
        this.camera.position.set(0, 10, 20);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(30000, 60000, 30000);
        sun.castShadow = true;
        const d = 200000;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        sun.shadow.mapSize.width = 4096;
        sun.shadow.mapSize.height = 4096;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);

        // Game Objects
        this.track = new Track(this.scene);
        const { mesh } = this.track.generate();
        
        this.input = new InputController();
        
        // Generate random car color for local player
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800];
        this.myColor = colors[Math.floor(Math.random() * colors.length)];
        
        this.car = new Car(this.scene, this.input, this.camera, false, this.myColor);
        
        // Multiplayer Setup
        this.peers = {}; // id -> Car instance
        this.room = new window.WebsimSocket();

        // Audio handling
        this.audioCtx = null;
        this.setupUI();

        // Loop
        this.animate = this.animate.bind(this);
        window.addEventListener('resize', this.onResize.bind(this));
        
        // Initialize multiplayer then start loop
        this.initMultiplayer().then(() => {
            this.animate();
        });
    }

    async initMultiplayer() {
        await this.room.initialize();
        console.log("Joined room as", this.room.clientId);
    }

    setupUI() {
        const btn = document.getElementById('start-btn');
        const inst = document.getElementById('instructions');
        
        btn.addEventListener('click', async () => {
            btn.classList.add('hidden');
            inst.classList.add('hidden');
            
            // Init Audio Context on user gesture
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load engine sound
            try {
                const response = await fetch('engine_loop.mp3');
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                this.car.initAudio(this.audioCtx, audioBuffer);
            } catch (e) {
                console.error("Audio load failed", e);
            }
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        
        // 1. Update Local Car
        this.car.update(this.track.colliders);

        // 2. Multiplayer Sync
        // Broadcast my state
        const myData = {
            x: this.car.mesh.position.x,
            y: this.car.mesh.position.y,
            z: this.car.mesh.position.z,
            qx: this.car.mesh.quaternion.x,
            qy: this.car.mesh.quaternion.y,
            qz: this.car.mesh.quaternion.z,
            qw: this.car.mesh.quaternion.w,
            color: this.myColor
        };
        this.room.updatePresence(myData);

        // Process Peers
        const presence = this.room.presence;
        const connectedIds = Object.keys(presence);

        // Add or Update peers
        for (const id of connectedIds) {
            if (id === this.room.clientId) continue; // Skip self

            const data = presence[id];
            if (!this.peers[id]) {
                // Create new peer car
                const peerColor = data.color || 0xffffff;
                const peerCar = new Car(this.scene, null, null, true, peerColor);
                this.peers[id] = peerCar;
            }
            
            // Update peer car
            if (this.peers[id]) {
                this.peers[id].updateRemoteData(data);
                this.peers[id].update(null);
            }
        }

        // Remove disconnected peers
        for (const id of Object.keys(this.peers)) {
            if (!presence[id]) {
                this.scene.remove(this.peers[id].mesh);
                delete this.peers[id];
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();

