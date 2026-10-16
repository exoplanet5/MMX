import * as THREE from 'three';

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
    const positions = [], magnitudes = [];
    for (const [ra, dec, magnitude] of catalog.stars) { positions.push(...skyDirection(ra, dec).toArray()); magnitudes.push(magnitude); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('magnitude', new THREE.Float32BufferAttribute(magnitudes, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: Math.min(devicePixelRatio, 2) } }, transparent: true, depthWrite: false,
      vertexShader: `attribute float magnitude; uniform float pixelRatio; varying float strength;
        void main() { strength = clamp(0.95 - 0.13 * magnitude, 0.28, 0.98);
          gl_PointSize = max(1.2, 5.4 - 0.9 * magnitude) * pixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float strength;
        void main() { float r = length(gl_PointCoord - vec2(0.5));
          if (r > 0.5) discard; gl_FragColor = vec4(0.86, 0.91, 1.0, strength * (1.0 - smoothstep(0.15, 0.5, r))); }`,
    });
    this.stars = new THREE.Points(geometry, this.starMaterial); this.scene.add(this.stars);
    for (const [ra, dec, name] of catalog.names) addLabel(name, skyDirection(ra, dec), 'star-name');
    const lines = [];
    for (const polyline of catalog.lines) {
      for (let i = 1; i < polyline.length; i++) {
        const a = skyDirection(...polyline[i - 1]), b = skyDirection(...polyline[i]);
        const count = Math.max(1, Math.ceil(a.angleTo(b) / (2 * Math.PI / 180)));
        for (let j = 0; j < count; j++) lines.push(...a.clone().lerp(b, j / count).normalize().toArray(), ...a.clone().lerp(b, (j + 1) / count).normalize().toArray());
      }
    }
    this.constellations = segmentsObject(lines, '#6e96d7', .31); this.scene.add(this.constellations);
    const grid = [];
    for (let ra = 0; ra < 360; ra += 30) {
      for (let dec = -90; dec < 90; dec += 2) grid.push(...skyDirection(ra, dec).toArray(), ...skyDirection(ra, dec + 2).toArray());
      for (const dec of [-60, -30, 0, 30, 60]) addLabel(`${ra / 15}h${dec ? ` ${dec > 0 ? '+' : '−'}${Math.abs(dec)}°` : ''}`, skyDirection(ra, dec), 'grid-label');
    }
    for (let dec = -60; dec <= 60; dec += 30) {
      for (let ra = 0; ra < 360; ra += 2) grid.push(...skyDirection(ra, dec).toArray(), ...skyDirection(ra + 2, dec).toArray());
    }
    this.grid = segmentsObject(grid, '#667583', .25); this.scene.add(this.grid);
  }

  render(renderer, camera, layers) {
    this.layers = layers;
    this.stars.visible = layers.stars;
    this.constellations.visible = layers.constellations;
    this.grid.visible = layers.grid;
    this.camera.fov = camera.fov; this.camera.aspect = camera.aspect;
    this.camera.quaternion.copy(camera.quaternion); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    renderer.render(this.scene, this.camera);
  }

  positionLabels(width, height, occupied, camera, occluders) {
    for (const item of this.labels) {
      const ndc = item.direction.clone().project(this.camera);
      let visible = (item.kind === 'star-name' ? this.layers.stars : this.layers.grid)
        && ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < .94 && Math.abs(ndc.y) < .89;
      if (visible) for (const body of occluders) {
        const relative = body.position.clone().sub(camera.position);
        const distance = relative.dot(item.direction);
        if (distance > 0 && relative.clone().addScaledVector(item.direction, -distance).lengthSq() < body.radius ** 2) { visible = false; break; }
      }
      item.el.hidden = !visible;
      if (!visible) continue;
      const box = { x: (ndc.x + 1) * width / 2 + 6, y: (1 - ndc.y) * height / 2 - 12,
        width: item.el.offsetWidth, height: item.el.offsetHeight };
      if (box.y < 55 || box.y + box.height > height - 48 || box.x + box.width > width - 8
        || occupied.some(r => box.x < r.x + r.width + 6 && box.x + box.width + 6 > r.x && box.y < r.y + r.height + 4 && box.y + box.height + 4 > r.y)) {
        item.el.hidden = true; continue;
      }
      occupied.push(box); item.el.style.transform = `translate(${box.x}px,${box.y}px)`;
    }
  }
}
