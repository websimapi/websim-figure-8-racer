import * as THREE from 'three';

export function createTexture(url, repeatX = 1, repeatY = 1) {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// Simple logic to detect mobile device
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

