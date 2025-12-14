import nipplejs from 'nipplejs';
import { isMobile } from './utils.js';

export class InputController {
    constructor() {
        this.forward = false;
        this.backward = false;
        this.left = false;
        this.right = false;
        
        // Joystick values (-1 to 1)
        this.throttle = 0;
        this.steering = 0;

        this.initKeyboard();
        if (isMobile) {
            this.initJoystick();
            // Show joystick container
            const el = document.getElementById('mobile-controls');
            if(el) el.style.display = 'block';
        }
    }

    initKeyboard() {
        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));
    }

    onKey(e, pressed) {
        switch(e.code) {
            case 'ArrowUp':
            case 'KeyW': this.forward = pressed; break;
            case 'ArrowDown':
            case 'KeyS': this.backward = pressed; break;
            case 'ArrowLeft':
            case 'KeyA': this.left = pressed; break;
            case 'ArrowRight':
            case 'KeyD': this.right = pressed; break;
        }
    }

    initJoystick() {
        const zone = document.getElementById('mobile-controls');
        this.manager = nipplejs.create({
            zone: zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
            size: 100
        });

        this.manager.on('move', (evt, data) => {
            if (data.vector) {
                // Determine throttle (y) and steering (x)
                // NippleJS y is inverted relative to typical 3D (up is positive)
                this.throttle = data.vector.y; 
                this.steering = data.vector.x;
            }
        });

        this.manager.on('end', () => {
            this.throttle = 0;
            this.steering = 0;
        });
    }

    update() {
        if (!isMobile) {
            // Convert boolean keys to analog-like values for smoother transitions
            const targetThrottle = (this.forward ? 1 : 0) - (this.backward ? 1 : 0);
            const targetSteer = (this.left ? 1 : 0) - (this.right ? 1 : 0);
            
            this.throttle = targetThrottle;
            this.steering = -targetSteer; // Invert steering for standard mapping
        }
        
        return {
            throttle: this.throttle,
            steering: this.steering
        };
    }
}

