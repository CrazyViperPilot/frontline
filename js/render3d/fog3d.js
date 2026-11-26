// 3D-Nebel (Plan „3D mit three.js“, Paket „3D-Nebel“): Kriegsnebel als Mesh auf demselben Höhennetz wie der 3D-Boden (Geometrie wird
// geteilt, nicht kopiert). Aussehen genau wie ground.js renderFog (isometrischer Zweig): Shader FS_FOG, Rauschtextur des Bodens,
// Nebeltextur aus relief.fogData. Ersetzt in der Ansicht 3D den zweiten WebGL-Kontext von ground.js für den Nebel.
// Textur: RGFormat (WebGL2; three 0.187 kennt kein LuminanceAlphaFormat): .r = in Sicht, .g = erkundet (FS_FOG liest dort .a).
// Ergebnis ist vormultipliert (Farbe * a, a): premultipliedAlpha, ohne Tiefentest, ohne Farbraum-Umrechnung.
import * as THREE from '../vendor/three/three.module.min.js';
import { FS_FOG } from '../render/ground.js';

// Lage und Neigung kommen aus dem Höhennetz des Bodens (position, aH) wie in ground3d.js
const VS = `
attribute vec3 aH;
varying vec2 vPos;
varying float vH;
varying vec2 vG;
void main() {
  vPos = position.xy;
  vH = aH.x;
  vG = aH.yz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Zwei-Kanal-Textur: erkundet liegt hier in g statt im Alpha von LUMINANCE_ALPHA
const FS = FS_FOG.replace('f.a', 'f.g');

export class Fog3D {
  /** ground3d: Ground3D (Geometrie mesh.geometry und Rauschtextur uniforms.uNoise werden mitbenutzt). */
  constructor(ground3d) {
    this.uniforms = {
      uFog: { value: null },
      uNoise: { value: ground3d.uniforms.uNoise.value },
      uDrift: { value: new THREE.Vector4() },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(ground3d.mesh.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.group = new THREE.Group();
    this.group.name = 'nebel';
    this.group.add(this.mesh);
    this.tex = null;
    this.size = '';
    this.stamp = undefined;
  }

  /** fog = relief.fogData(...): { cols, rows, data, stamp }; t = Zeit in Sekunden (Wolkenzug). */
  update(fog, t) {
    const size = fog.cols + 'x' + fog.rows;
    if (size !== this.size) {
      this.tex?.dispose();
      const tex = new THREE.DataTexture(fog.data, fog.cols, fog.rows, THREE.RGFormat, THREE.UnsignedByteType);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      tex.flipY = false;
      tex.unpackAlignment = 1;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      this.tex = tex;
      this.uniforms.uFog.value = tex;
      this.size = size;
      this.stamp = fog.stamp;
    } else if (fog.stamp === undefined || fog.stamp !== this.stamp) {
      this.tex.image.data = fog.data; // nur bei geändertem Nebel neu laden
      this.tex.needsUpdate = true;
      this.stamp = fog.stamp;
    }
    const fr = (x) => x - Math.floor(x);
    this.uniforms.uDrift.value.set(fr(t * 0.0016), fr(t * 0.0006), fr(0.37 - t * 0.0022), fr(0.71 + t * 0.0009));
  }

  /** Geometrie und Rauschtextur gehören dem Boden; hier nur Material und Nebeltextur. */
  dispose() {
    this.material.dispose();
    this.tex?.dispose();
  }
}
