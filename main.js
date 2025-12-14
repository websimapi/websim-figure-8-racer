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
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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
        sun.position.set(100, 200, 100);
        sun.castShadow = true;
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        this.scene.add(sun);

        // Game Objects
        this.track = new Track(this.scene);
        const { mesh } = this.track.generate();
        
        this.input = new InputController();
        this.car = new Car(this.scene, this.input, this.camera);
        
        // Audio handling
        this.audioCtx = null;
        this.setupUI();

        // Loop
        this.animate = this.animate.bind(this);
        window.addEventListener('resize', this.onResize.bind(this));
        
        this.animate();
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
        
        this.car.update(this.track.colliders);
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();

