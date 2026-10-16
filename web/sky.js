import * as THREE from 'three';
import { SKY_STYLE, starAppearance } from './sky-style.js';

export function skyDirection(raDegrees, decDegrees) {
  const ra = raDegrees * Math.PI / 180, dec = decDegrees * Math.PI / 180;
  return new THREE.Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), -Math.cos(dec) * Math.sin(ra));
}

function segmentsObject(points, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

export class StellarBackground {
  constructor(catalog, parent) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .01, 10);
    this.layer = document.createElement('div'); this.layer.className = 'label-layer sky-labels'; parent.appendChild(this.layer);
    this.labels = [];
    const addLabel = (text, direction, kind) => {
      const el = document.createElement('div'); el.className = `sky-label ${kind}`; el.textContent = text;
      this.layer.appendChild(el); this.labels.push({ el, direction, kind });
    };
    const positions = [], appearances = [];
    for (const [ra, dec, magnitude] of catalog.stars) {
      const style = starAppearance(magnitude);
      positions.push(...skyDirection(ra, dec).toArray());
      appearances.push(style.diameter, style.opacity, style.ringDiameter);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('appearance', new THREE.Float32BufferAttribute(appearances, 3));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: Math.min(devicePixelRatio, 2) } }, transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 appearance; uniform float pixelRatio;
        varying vec3 style; varying float spriteSize;
        void main() { style = appearance;
          gl_PointSize = max(1.0, (max(style.x, style.z) + 2.0) * pixelRatio);
          spriteSize = gl_PointSize / pixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 style; varying float spriteSize;
        void main() { float r = length(gl_PointCoord - vec2(0.5)) * spriteSize;
          float core = 1.0 - smoothstep(max(0.0, style.x * 0.5 - 0.5), style.x * 0.5 + 0.5, r);
          float ring = step(0.5, style.z) * (1.0 - smoothstep(0.3, 0.85, abs(r - style.z * 0.5)));
          float alpha = max(core * style.y, ring * 0.78);
          if (alpha < 0.001) discard;
          gl_FragColor = vec4(core > ring ? vec3(1.0) : vec3(0.812, 0.847, 0.910), alpha); }`,
    });
    this.stars = new THREE.Points(geometry, this.starMaterial); this.scene.add(this.stars);
    for (const [ra, dec, name] of catalog.names) addLabel(name, skyDirection(ra, dec), 'star-name');
    for (const [ra, dec, name] of catalog.cons) addLabel(name.toUpperCase(), skyDirection(ra, dec), 'constellation-name');
    const lines = [];
    for (const polyline of catalog.lines) {
      for (let i = 1; i < polyline.length; i++) {
        const a = skyDirection(...polyline[i - 1]), b = skyDirection(...polyline[i]);
        const count = Math.max(1, Math.ceil(a.angleTo(b) / (2 * Math.PI / 180)));
        for (let j = 0; j < count; j++) lines.push(...a.clone().lerp(b, j / count).normalize().toArray(), ...a.clone().lerp(b, (j + 1) / count).normalize().toArray());
      }
    }
    this.constellations = segmentsObject(lines, SKY_STYLE.constellation, .6); this.scene.add(this.constellations);
    const grid = [];
    for (let ra = 0; ra < 360; ra += SKY_STYLE.raStepDegrees) {
      for (let dec = -90; dec < 90; dec += 2) grid.push(...skyDirection(ra, dec).toArray(), ...skyDirection(ra, dec + 2).toArray());
      for (let dec = -75; dec <= 75; dec += SKY_STYLE.decStepDegrees) addLabel(`${ra / 15}h${dec ? ` ${dec > 0 ? '+' : '−'}${Math.abs(dec)}°` : ''}`, skyDirection(ra, dec), 'grid-label');
    }
    for (let dec = -75; dec <= 75; dec += SKY_STYLE.decStepDegrees) {
      for (let ra = 0; ra < 360; ra += 2) grid.push(...skyDirection(ra, dec).toArray(), ...skyDirection(ra + 2, dec).toArray());
    }
    this.grid = segmentsObject(grid, SKY_STYLE.grid, .8); this.scene.add(this.grid);
  }

  render(renderer, camera, layers) {
    this.layers = layers;
    this.stars.visible = layers.stars;
    this.constellations.visible = layers.constellations;
    this.grid.visible = layers.grid;
    this.starMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio();
    this.camera.fov = camera.fov; this.camera.aspect = camera.aspect;
    this.camera.quaternion.copy(camera.quaternion); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    renderer.render(this.scene, this.camera);
  }

  positionLabels(width, height, occupied, camera, occluders) {
    for (const item of this.labels) {
      const ndc = item.direction.clone().project(this.camera);
      const enabled = item.kind === 'star-name' ? this.layers.stars : item.kind === 'constellation-name' ? this.layers.constellations : this.layers.grid;
      let visible = enabled && ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < .94 && Math.abs(ndc.y) < .89;
      if (visible) for (const body of occluders) {
        const relative = body.position.clone().sub(camera.position);
        const distance = relative.dot(item.direction);
        if (distance > 0 && relative.clone().addScaledVector(item.direction, -distance).lengthSq() < body.radius ** 2) { visible = false; break; }
      }
      item.el.hidden = !visible;
      if (!visible) continue;
      const box = { x: (ndc.x + 1) * width / 2 + (item.kind === 'star-name' ? 10 : 6), y: (1 - ndc.y) * height / 2 + (item.kind === 'star-name' ? 8 : -12),
        width: item.el.offsetWidth, height: item.el.offsetHeight };
      if (box.y < 55 || box.y + box.height > height - 48 || box.x + box.width > width - 8
        || occupied.some(r => box.x < r.x + r.width + 6 && box.x + box.width + 6 > r.x && box.y < r.y + r.height + 4 && box.y + box.height + 4 > r.y)) {
        item.el.hidden = true; continue;
      }
      occupied.push(box); item.el.style.transform = `translate(${box.x}px,${box.y}px)`;
    }
  }
}
