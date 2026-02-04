import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface RhinoLayer {
  index: number;
  name: string;
  visible: boolean;
  color: string;
}

export type LightEffect =
  | 'off'
  | 'pink-glow'
  | 'pink-pulse'
  | 'pink-wave'
  | 'pink-ripple'
  | 'blue-glow'
  | 'blue-pulse'
  | 'blue-wave'
  | 'blue-ripple'
  | 'rainbow-wave'
  | 'rainbow-ripple'
  | 'fire'
  | 'ocean'
  | 'aurora';

export const LIGHT_EFFECTS: { id: LightEffect; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'pink-glow', name: 'Pink Glow' },
  { id: 'pink-pulse', name: 'Pink Pulse' },
  { id: 'pink-wave', name: 'Pink Wave' },
  { id: 'pink-ripple', name: 'Pink Ripple' },
  { id: 'blue-glow', name: 'Blue Glow' },
  { id: 'blue-pulse', name: 'Blue Pulse' },
  { id: 'blue-wave', name: 'Blue Wave' },
  { id: 'blue-ripple', name: 'Blue Ripple' },
  { id: 'rainbow-wave', name: 'Rainbow Wave' },
  { id: 'rainbow-ripple', name: 'Rainbow Ripple' },
  { id: 'fire', name: 'Fire' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'aurora', name: 'Aurora' },
];

export interface LightSettings {
  ambientIntensity: number;
  directionalIntensity: number;
  emitterIntensity: number;
  edgeGlowIntensity: number;
  effectSpeed: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  fogDensity: number;
  showGroundPlane: boolean;
  debugLightingMode: boolean;
}

export const DEFAULT_LIGHT_SETTINGS: LightSettings = {
  ambientIntensity: 0.25,
  directionalIntensity: 0.5,
  emitterIntensity: 1.7,
  edgeGlowIntensity: 1.5,
  effectSpeed: 1.0,
  bloomStrength: 0.07,
  bloomRadius: 0.4,
  bloomThreshold: 0.2,
  fogDensity: 0.0001,
  showGroundPlane: true,
  debugLightingMode: false,
};

const EDGE_LED_LAYER_NAME = 'Edge LED';
const BASE_LIGHTS_LAYER_NAME = 'Base Lights';
const FACE_LAYER_NAME = 'Face';
const EMITTER_GUIDES_LAYER_NAME = 'Emitters';

// Layer names that should have emissive materials
const EMISSIVE_LAYER_NAMES = [EDGE_LED_LAYER_NAME, BASE_LIGHTS_LAYER_NAME] as const;

// Layer name for semi-gloss material
const SEMI_GLOSS_LAYER_NAME = 'Grass Graphic';

const TAU = Math.PI * 2;

type EmissiveLayerType = 'edge-led' | 'base-lights';

interface EmissiveEmitterLight {
  light: THREE.PointLight | THREE.SpotLight;
  target?: THREE.Object3D;
  sourceObject: THREE.Object3D;
  followSourceVisibility: boolean;
  layerType: EmissiveLayerType;
  phase: number;
  baseIntensity: number;
}

interface EffectVisual {
  baseColor: THREE.Color;
  effectType: number;
}

interface EdgeUvSample {
  position: THREE.Vector3;
  u: number;
}

// Effect types for shader:
// 0=solid, 1=pulse, 2=wave, 3=ripple, 4=rainbow-wave, 5=rainbow-ripple, 6=fire, 7=ocean, 8=aurora
function getEffectVisual(effect: LightEffect): EffectVisual {
  switch (effect) {
    case 'pink-glow':
      return { baseColor: new THREE.Color(0xF7B5CD), effectType: 0 };
    case 'pink-pulse':
      return { baseColor: new THREE.Color(0xF7B5CD), effectType: 1 };
    case 'pink-wave':
      return { baseColor: new THREE.Color(0xF7B5CD), effectType: 2 };
    case 'pink-ripple':
      return { baseColor: new THREE.Color(0xF7B5CD), effectType: 3 };
    case 'blue-glow':
      return { baseColor: new THREE.Color(0x5CA8FF), effectType: 0 };
    case 'blue-pulse':
      return { baseColor: new THREE.Color(0x5CA8FF), effectType: 1 };
    case 'blue-wave':
      return { baseColor: new THREE.Color(0x5CA8FF), effectType: 2 };
    case 'blue-ripple':
      return { baseColor: new THREE.Color(0x5CA8FF), effectType: 3 };
    case 'rainbow-wave':
      return { baseColor: new THREE.Color(0xFFFFFF), effectType: 4 };
    case 'rainbow-ripple':
      return { baseColor: new THREE.Color(0xFFFFFF), effectType: 5 };
    case 'fire':
      return { baseColor: new THREE.Color(0xFF6B35), effectType: 6 };
    case 'ocean':
      return { baseColor: new THREE.Color(0x00CED1), effectType: 7 };
    case 'aurora':
      return { baseColor: new THREE.Color(0x7FFF00), effectType: 8 };
    default:
      return { baseColor: new THREE.Color(0xF7B5CD), effectType: 0 };
  }
}

function evaluateEmitterEffect(
  effect: LightEffect,
  time: number,
  phase: number,
  outColor: THREE.Color,
  speed: number = 1.0
): number {
  const t = time * speed;
  switch (effect) {
    case 'off':
      outColor.set(0x000000);
      return 0;
    case 'pink-glow':
      outColor.set(0xF7B5CD);
      return 1;
    case 'pink-pulse': {
      outColor.set(0xF7B5CD);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.0);
      return 0.3 + 0.7 * pulse;
    }
    case 'pink-wave': {
      outColor.set(0xF7B5CD);
      const wave = 0.5 + 0.5 * Math.sin(t * 3.0 + phase * TAU);
      return 0.2 + 0.8 * wave;
    }
    case 'pink-ripple': {
      outColor.set(0xF7B5CD);
      const ripple = 0.5 + 0.5 * Math.sin(t * 4.0 - phase * TAU * 2.0);
      return 0.1 + 0.9 * ripple;
    }
    case 'blue-glow':
      outColor.set(0x5CA8FF);
      return 1;
    case 'blue-pulse': {
      outColor.set(0x5CA8FF);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.0);
      return 0.3 + 0.7 * pulse;
    }
    case 'blue-wave': {
      outColor.set(0x5CA8FF);
      const wave = 0.5 + 0.5 * Math.sin(t * 3.0 + phase * TAU);
      return 0.2 + 0.8 * wave;
    }
    case 'blue-ripple': {
      outColor.set(0x5CA8FF);
      const ripple = 0.5 + 0.5 * Math.sin(t * 4.0 - phase * TAU * 2.0);
      return 0.1 + 0.9 * ripple;
    }
    case 'rainbow-wave': {
      const hue = (t * 0.3 + phase) % 1;
      outColor.setHSL(hue, 0.85, 0.55);
      const wave = 0.5 + 0.5 * Math.sin(t * 2.5 + phase * TAU);
      return 0.4 + 0.6 * wave;
    }
    case 'rainbow-ripple': {
      const hue = (t * 0.2 - phase * 0.5) % 1;
      outColor.setHSL(hue < 0 ? hue + 1 : hue, 0.9, 0.55);
      const ripple = 0.5 + 0.5 * Math.sin(t * 3.5 - phase * TAU * 2.0);
      return 0.2 + 0.8 * ripple;
    }
    case 'fire': {
      // Flickering fire effect with orange-red-yellow
      const flicker = Math.sin(t * 8.0 + phase * 5.0) * Math.sin(t * 12.0 + phase * 7.0);
      const hue = 0.05 + 0.05 * flicker; // Orange-red range
      outColor.setHSL(hue, 1.0, 0.5 + 0.15 * flicker);
      return 0.5 + 0.5 * (0.5 + 0.5 * flicker);
    }
    case 'ocean': {
      // Calm ocean waves with cyan-blue gradient
      const wave1 = Math.sin(t * 1.5 + phase * TAU);
      const wave2 = Math.sin(t * 2.3 + phase * TAU * 1.5);
      const combined = (wave1 + wave2) * 0.5;
      const hue = 0.52 + 0.03 * combined; // Cyan-blue range
      outColor.setHSL(hue, 0.7, 0.45 + 0.1 * combined);
      return 0.4 + 0.6 * (0.5 + 0.5 * combined);
    }
    case 'aurora': {
      // Northern lights with shifting green-blue-purple
      const shift = Math.sin(t * 0.8 + phase * TAU);
      const shimmer = Math.sin(t * 4.0 + phase * 3.0) * 0.3;
      const hue = 0.35 + 0.15 * shift + 0.05 * shimmer; // Green to purple range
      outColor.setHSL(hue, 0.75, 0.5 + 0.15 * shimmer);
      return 0.5 + 0.5 * (0.5 + 0.5 * shift + 0.2 * shimmer);
    }
    default:
      outColor.set(0xF7B5CD);
      return 1;
  }
}

function getLargestAxisName(size: THREE.Vector3): 'x' | 'y' | 'z' {
  if (size.y >= size.x && size.y >= size.z) {
    return 'y';
  }
  if (size.z >= size.x && size.z >= size.y) {
    return 'z';
  }
  return 'x';
}

function sampleMeshWorldPoints(mesh: THREE.Mesh, sampleCount: number): THREE.Vector3[] {
  if (sampleCount <= 0) {
    return [];
  }

  if (!(mesh.geometry instanceof THREE.BufferGeometry)) {
    return [mesh.getWorldPosition(new THREE.Vector3())];
  }

  const geometry = mesh.geometry;
  const positionAttribute = geometry.getAttribute('position');
  if (!positionAttribute) {
    return [mesh.getWorldPosition(new THREE.Vector3())];
  }

  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;
  if (!boundingBox) {
    return [mesh.getWorldPosition(new THREE.Vector3())];
  }

  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  const axis = getLargestAxisName(size);

  const step = Math.max(1, Math.floor(positionAttribute.count / 2048));
  const sampledVertices: Array<{ axisValue: number; point: THREE.Vector3 }> = [];
  const localPoint = new THREE.Vector3();

  for (let i = 0; i < positionAttribute.count; i += step) {
    localPoint.fromBufferAttribute(positionAttribute, i);
    sampledVertices.push({
      axisValue: localPoint[axis],
      point: localPoint.clone()
    });
  }

  if (sampledVertices.length === 0) {
    return [mesh.getWorldPosition(new THREE.Vector3())];
  }

  sampledVertices.sort((a, b) => a.axisValue - b.axisValue);

  const count = Math.min(sampleCount, sampledVertices.length);
  const worldPoints: THREE.Vector3[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const index = Math.round((sampledVertices.length - 1) * t);
    const worldPoint = sampledVertices[index].point.clone();
    mesh.localToWorld(worldPoint);
    worldPoints.push(worldPoint);
  }

  return worldPoints;
}

function sampleMeshUvWorldPoints(mesh: THREE.Mesh, maxSamples: number): EdgeUvSample[] {
  if (maxSamples <= 0 || !(mesh.geometry instanceof THREE.BufferGeometry)) {
    return [];
  }

  const geometry = mesh.geometry;
  const positionAttribute = geometry.getAttribute('position');
  const uvAttribute = geometry.getAttribute('uv');
  if (!positionAttribute || !uvAttribute) {
    return [];
  }

  const count = Math.min(positionAttribute.count, uvAttribute.count);
  if (count === 0) {
    return [];
  }

  const step = Math.max(1, Math.floor(count / maxSamples));
  const localPoint = new THREE.Vector3();
  const localUv = new THREE.Vector2();
  const samples: EdgeUvSample[] = [];

  for (let i = 0; i < count; i += step) {
    localPoint.fromBufferAttribute(positionAttribute, i);
    const worldPoint = localPoint.clone();
    mesh.localToWorld(worldPoint);
    localUv.set(uvAttribute.getX(i), uvAttribute.getY(i));
    const wrappedU = ((localUv.x % 1) + 1) % 1;
    samples.push({
      position: worldPoint,
      u: wrappedU
    });
  }

  return samples;
}

function getNearestUvPhase(worldPoint: THREE.Vector3, uvSamples: EdgeUvSample[]): number | null {
  if (uvSamples.length === 0) {
    return null;
  }

  let nearestSample = uvSamples[0];
  let nearestDistanceSq = worldPoint.distanceToSquared(nearestSample.position);

  for (let i = 1; i < uvSamples.length; i += 1) {
    const distanceSq = worldPoint.distanceToSquared(uvSamples[i].position);
    if (distanceSq < nearestDistanceSq) {
      nearestSample = uvSamples[i];
      nearestDistanceSq = distanceSq;
    }
  }

  return nearestSample.u;
}

function invertUvPhase(uvPhase: number): number {
  return ((1 - uvPhase) % 1 + 1) % 1;
}

function downsampleEvenly<T>(items: T[], maxCount: number): T[] {
  if (maxCount <= 0) {
    return [];
  }
  if (items.length <= maxCount) {
    return items;
  }

  const sampled: T[] = [];
  for (let i = 0; i < maxCount; i += 1) {
    const t = maxCount === 1 ? 0.5 : i / (maxCount - 1);
    const index = Math.round((items.length - 1) * t);
    sampled.push(items[index]);
  }
  return sampled;
}

function neutralizeMaterialEmission(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((mat) => {
    const emissiveMaterial = mat as THREE.MeshStandardMaterial;
    if (emissiveMaterial.emissive instanceof THREE.Color) {
      emissiveMaterial.emissive.set(0x000000);
    }
    if (typeof emissiveMaterial.emissiveIntensity === 'number') {
      emissiveMaterial.emissiveIntensity = 0;
    }
    mat.needsUpdate = true;
  });
}

function getMeshHorizontalAxisDirection(mesh: THREE.Mesh): THREE.Vector3 {
  const direction = new THREE.Vector3();
  if (mesh.geometry instanceof THREE.BufferGeometry) {
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;
    if (boundingBox) {
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const localAxis = size.x >= size.z
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 0, 1);
      direction.copy(localAxis).transformDirection(mesh.matrixWorld);
      direction.y = 0;
      if (direction.lengthSq() > 1e-6) {
        return direction.normalize();
      }
    }
  }

  direction.set(1, 0, 0).transformDirection(mesh.matrixWorld);
  direction.y = 0;
  if (direction.lengthSq() <= 1e-6) {
    direction.set(1, 0, 0);
  }
  return direction.normalize();
}

function getLineWorldPoints(lineObject: THREE.Object3D): THREE.Vector3[] {
  if (!(lineObject instanceof THREE.Line || lineObject instanceof THREE.LineSegments)) {
    return [];
  }
  if (!(lineObject.geometry instanceof THREE.BufferGeometry)) {
    return [];
  }

  const positionAttribute = lineObject.geometry.getAttribute('position');
  if (!positionAttribute || positionAttribute.count < 2) {
    return [];
  }

  const localPoint = new THREE.Vector3();
  const worldPoints: THREE.Vector3[] = [];

  for (let i = 0; i < positionAttribute.count; i += 1) {
    localPoint.fromBufferAttribute(positionAttribute, i);
    const worldPoint = localPoint.clone();
    lineObject.localToWorld(worldPoint);
    worldPoints.push(worldPoint);
  }

  return worldPoints;
}

function getFarthestPointPair(points: THREE.Vector3[]): [THREE.Vector3, THREE.Vector3] {
  let maxDistanceSq = -1;
  let pointA = points[0];
  let pointB = points[1] ?? points[0];

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distanceSq = points[i].distanceToSquared(points[j]);
      if (distanceSq > maxDistanceSq) {
        maxDistanceSq = distanceSq;
        pointA = points[i];
        pointB = points[j];
      }
    }
  }

  return [pointA.clone(), pointB.clone()];
}

function shouldEmitterBeVisible(emitter: EmissiveEmitterLight, effect: LightEffect): boolean {
  if (effect === 'off') {
    return false;
  }
  if (!emitter.followSourceVisibility) {
    return true;
  }
  return emitter.sourceObject.visible;
}

interface HeronWingsViewerProps {
  layers: RhinoLayer[];
  onLayersLoaded: (layers: RhinoLayer[]) => void;
  onResetCamera: () => void;
  registerResetCamera: (fn: () => void) => void;
  lightEffect: LightEffect;
  lightSettings: LightSettings;
}

// Vertex shader for emissive glow
const glowVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for animated glow effects
// Uses UV coordinates for wave/rainbow effects - adjust UVs in Rhino to control flow
// Effect types: 0=solid, 1=pulse, 2=wave, 3=ripple, 4=rainbow-wave, 5=rainbow-ripple, 6=fire, 7=ocean, 8=aurora
const glowFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform int uEffectType;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Noise function for organic effects
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  void main() {
    vec3 color = uColor;
    float intensity = uIntensity;
    float t = uTime * uSpeed;
    float u = vUv.x;

    if (uEffectType == 1) {
      // Pulse effect - dramatic breathing
      float pulse = 0.5 + 0.5 * sin(t * 2.0);
      intensity *= 0.2 + 0.8 * pulse;
    } else if (uEffectType == 2) {
      // Wave effect - flowing gradient along U
      float wave = 0.5 + 0.5 * sin(u * 6.28318 * 2.0 - t * 3.0);
      intensity *= 0.1 + 0.9 * wave;
    } else if (uEffectType == 3) {
      // Ripple effect - radiating outward from center
      float ripple = 0.5 + 0.5 * sin(u * 6.28318 * 3.0 + t * 4.0);
      float ripple2 = 0.5 + 0.5 * sin(u * 6.28318 * 5.0 - t * 2.5);
      intensity *= 0.1 + 0.9 * (ripple * 0.6 + ripple2 * 0.4);
    } else if (uEffectType == 4) {
      // Rainbow wave - color flows along UV
      float hue = fract(u - t * 0.3);
      color = hsv2rgb(vec3(hue, 0.9, 0.7));  // Reduced V from 1.0 to 0.7 to prevent blow-out
      float wave = 0.5 + 0.5 * sin(u * 6.28318 * 2.0 - t * 2.5);
      intensity *= 0.3 + 0.7 * wave;
    } else if (uEffectType == 5) {
      // Rainbow ripple - radiating color waves
      float hue = fract(u * 2.0 + t * 0.2);
      color = hsv2rgb(vec3(hue, 0.95, 0.7));  // Reduced V from 1.0 to 0.7 to prevent blow-out
      float ripple = 0.5 + 0.5 * sin(u * 6.28318 * 4.0 + t * 3.5);
      intensity *= 0.2 + 0.8 * ripple;
    } else if (uEffectType == 6) {
      // Fire effect - flickering oranges and reds
      float flicker = noise(t * 8.0 + u * 10.0) * noise(t * 12.0 + u * 15.0);
      float hue = 0.02 + 0.06 * flicker;
      float sat = 0.9 + 0.1 * flicker;
      float val = 0.6 + 0.4 * flicker;
      color = hsv2rgb(vec3(hue, sat, val));
      intensity *= 0.4 + 0.6 * flicker;
    } else if (uEffectType == 7) {
      // Ocean effect - layered waves
      float wave1 = sin(u * 6.28318 * 1.5 - t * 1.5);
      float wave2 = sin(u * 6.28318 * 2.5 - t * 2.3) * 0.5;
      float wave3 = sin(u * 6.28318 * 4.0 - t * 3.0) * 0.25;
      float combined = (wave1 + wave2 + wave3) / 1.75;
      float hue = 0.52 + 0.04 * combined;
      color = hsv2rgb(vec3(hue, 0.75, 0.7 + 0.3 * combined));
      intensity *= 0.3 + 0.7 * (0.5 + 0.5 * combined);
    } else if (uEffectType == 8) {
      // Aurora effect - shimmering curtains
      float curtain = sin(u * 6.28318 * 3.0 + t * 0.8) * sin(u * 6.28318 * 5.0 - t * 1.2);
      float shimmer = noise(t * 4.0 + u * 20.0) * 0.4;
      float hue = 0.3 + 0.2 * curtain + 0.1 * shimmer;
      color = hsv2rgb(vec3(hue, 0.7, 0.8 + 0.2 * shimmer));
      intensity *= 0.4 + 0.6 * (0.5 + 0.5 * curtain + shimmer);
    }

    // Add glow falloff based on view angle (fresnel-like effect)
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    float fresnel = 1.0 - abs(dot(vNormal, viewDir));
    fresnel = pow(fresnel, 0.5);

    vec3 finalColor = color * intensity * (0.8 + 0.2 * fresnel);

    // Soft saturation-preserving clamp to prevent blown-out whites
    // Uses luminance-based scaling to keep color ratios intact
    float maxChannel = max(finalColor.r, max(finalColor.g, finalColor.b));
    if (maxChannel > 1.0) {
      // Scale down proportionally to preserve saturation
      finalColor = finalColor / maxChannel;
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function HeronWingsViewer({
  layers,
  onLayersLoaded,
  registerResetCamera,
  lightEffect,
  lightSettings
}: HeronWingsViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const initialCameraState = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const emissiveMeshesRef = useRef<THREE.Mesh[]>([]);
  const shaderMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const emissiveEmitterLightsRef = useRef<EmissiveEmitterLight[]>([]);
  const activeLightEffectRef = useRef<LightEffect>(lightEffect);
  const emitterIntensityRef = useRef<number>(lightSettings.emitterIntensity);
  const effectSpeedRef = useRef<number>(lightSettings.effectSpeed);
  const debugModeRef = useRef<boolean>(lightSettings.debugLightingMode);
  const debugHelpersRef = useRef<THREE.Object3D[]>([]);
  const debugUpdatableHelpersRef = useRef<Array<{ update: () => void }>>([]);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const layerIndicesRef = useRef<Map<string, number>>(new Map());
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLight1Ref = useRef<THREE.DirectionalLight | null>(null);
  const directionalLight2Ref = useRef<THREE.DirectionalLight | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);

  const clearDebugHelpers = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    debugHelpersRef.current.forEach((helper) => {
      scene.remove(helper);
      const disposable = helper as THREE.Object3D & { dispose?: () => void };
      if (typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
    });
    debugHelpersRef.current = [];
    debugUpdatableHelpersRef.current = [];
  }, []);

  const rebuildDebugHelpers = useCallback(() => {
    clearDebugHelpers();
    const scene = sceneRef.current;
    if (!scene || !debugModeRef.current) return;

    const helpers: THREE.Object3D[] = [];
    const updatableHelpers: Array<{ update: () => void }> = [];
    const registerHelper = (helper: THREE.Object3D) => {
      scene.add(helper);
      helpers.push(helper);
      const maybeUpdatable = helper as THREE.Object3D & { update?: () => void };
      if (typeof maybeUpdatable.update === 'function') {
        updatableHelpers.push({ update: maybeUpdatable.update.bind(maybeUpdatable) });
      }
    };

    if (directionalLight1Ref.current) {
      registerHelper(new THREE.DirectionalLightHelper(directionalLight1Ref.current, 35, 0x8fc5ff));
      registerHelper(new THREE.CameraHelper(directionalLight1Ref.current.shadow.camera));
    }
    if (directionalLight2Ref.current) {
      registerHelper(new THREE.DirectionalLightHelper(directionalLight2Ref.current, 24, 0xbfbfff));
    }

    emissiveEmitterLightsRef.current.forEach((emitter) => {
      if (emitter.light instanceof THREE.SpotLight) {
        registerHelper(new THREE.SpotLightHelper(emitter.light, 0xff9ad9));
      } else {
        registerHelper(new THREE.PointLightHelper(emitter.light, 3.5, 0x9ad2ff));
      }
    });

    updatableHelpers.forEach((helper) => helper.update());
    debugHelpersRef.current = helpers;
    debugUpdatableHelpersRef.current = updatableHelpers;
  }, [clearDebugHelpers]);

  const resetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current && initialCameraState.current) {
      cameraRef.current.position.copy(initialCameraState.current.position);
      controlsRef.current.target.copy(initialCameraState.current.target);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    registerResetCamera(resetCamera);
  }, [registerResetCamera, resetCamera]);

  // Update layer visibility when layers prop changes
  useEffect(() => {
    if (!modelRef.current) return;

    modelRef.current.traverse((child) => {
      const layerIndex = child.userData?.attributes?.layerIndex;
      if (layerIndex !== undefined) {
        const layer = layers.find(l => l.index === layerIndex);
        if (layer) {
          child.visible = layer.visible;
        }
      }
    });

    emissiveEmitterLightsRef.current.forEach((emitter) => {
      const visible = shouldEmitterBeVisible(emitter, activeLightEffectRef.current);
      emitter.light.visible = visible;
      if (emitter.target) {
        emitter.target.visible = visible;
      }
    });
  }, [layers]);

  // Update light settings when they change
  useEffect(() => {
    debugModeRef.current = lightSettings.debugLightingMode;
    emitterIntensityRef.current = lightSettings.emitterIntensity;
    effectSpeedRef.current = lightSettings.effectSpeed;
    shaderMaterialsRef.current.forEach((material) => {
      material.uniforms.uIntensity.value = lightSettings.edgeGlowIntensity;
      material.uniforms.uSpeed.value = lightSettings.effectSpeed;
    });

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = lightSettings.ambientIntensity;
    }
    if (directionalLight1Ref.current) {
      directionalLight1Ref.current.intensity = lightSettings.directionalIntensity;
    }
    if (directionalLight2Ref.current) {
      directionalLight2Ref.current.intensity = lightSettings.directionalIntensity * 0.3;
    }
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = lightSettings.debugLightingMode ? 0 : lightSettings.bloomStrength;
      bloomPassRef.current.radius = lightSettings.bloomRadius;
      bloomPassRef.current.threshold = lightSettings.bloomThreshold;
    }
    if (sceneRef.current && sceneRef.current.fog instanceof THREE.FogExp2) {
      sceneRef.current.fog.density = lightSettings.debugLightingMode ? 0 : lightSettings.fogDensity;
    }
    if (groundPlaneRef.current) {
      groundPlaneRef.current.visible = lightSettings.showGroundPlane;
    }
    rebuildDebugHelpers();
  }, [lightSettings, rebuildDebugHelpers]);

  // Update shader effect when lightEffect prop changes
  useEffect(() => {
    activeLightEffectRef.current = lightEffect;

    const meshes = emissiveMeshesRef.current;
    const shaderMaterials = shaderMaterialsRef.current;
    const originalMaterials = originalMaterialsRef.current;
    const emitterLights = emissiveEmitterLightsRef.current;
    const currentTime = clockRef.current.getElapsedTime();
    const animatedColor = new THREE.Color();

    if (lightEffect === 'off') {
      // Restore original materials
      meshes.forEach((mesh) => {
        const original = originalMaterials.get(mesh);
        if (original) {
          mesh.material = original;
        }
      });
    } else {
      // Apply shader materials
      const effectVisual = getEffectVisual(lightEffect);

      // Update shader uniforms
      shaderMaterials.forEach((material) => {
        material.uniforms.uColor.value = effectVisual.baseColor;
        material.uniforms.uEffectType.value = effectVisual.effectType;
      });

      // Apply shader materials to meshes
      meshes.forEach((mesh, index) => {
        if (shaderMaterials[index]) {
          mesh.material = shaderMaterials[index];
        }
      });
    }

    emitterLights.forEach((emitter) => {
      const visible = shouldEmitterBeVisible(emitter, lightEffect);
      emitter.light.visible = visible;
      if (emitter.target) {
        emitter.target.visible = visible;
      }
      if (!visible) {
        emitter.light.intensity = 0;
        return;
      }
      const effectMultiplier = evaluateEmitterEffect(lightEffect, currentTime, emitter.phase, animatedColor, effectSpeedRef.current);
      emitter.light.color.copy(animatedColor);
      emitter.light.intensity = emitter.baseIntensity * effectMultiplier * emitterIntensityRef.current;
    });
  }, [lightEffect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1718);

    // Add exponential fog for volumetric light effect
    scene.fog = new THREE.FogExp2(0x1a1718, lightSettings.debugLightingMode ? 0 : lightSettings.fogDensity);
    sceneRef.current = scene;

    // Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post-processing setup
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass for volumetric glow effect
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      lightSettings.debugLightingMode ? 0 : lightSettings.bloomStrength,
      lightSettings.bloomRadius,
      lightSettings.bloomThreshold
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 10;
    controls.maxDistance = 5000;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, lightSettings.ambientIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, lightSettings.directionalIntensity);
    directionalLight1.position.set(100, 200, 100);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.set(2048, 2048);
    directionalLight1.shadow.bias = -0.0002;
    directionalLight1.shadow.normalBias = 0.02;
    directionalLight1.shadow.camera.near = 5;
    directionalLight1.shadow.camera.far = 2500;
    scene.add(directionalLight1);
    directionalLight1Ref.current = directionalLight1;

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, lightSettings.directionalIntensity * 0.3);
    directionalLight2.position.set(-100, 100, -100);
    scene.add(directionalLight2);
    directionalLight2Ref.current = directionalLight2;

    // Start clock
    clockRef.current.start();

    // Load Rhino model
    const loader = new Rhino3dmLoader();
    loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/');

    loader.load(
      '/model/Heron_Wings.3dm',
      (object) => {
        // Rotate from Rhino Z-up to Three.js Y-up coordinate system
        object.rotation.x = -Math.PI / 2;

        modelRef.current = object;
        scene.add(object);
        object.updateMatrixWorld(true);

        // Extract layers and build layer name -> index map
        const rhinoLayers: RhinoLayer[] = [];
        const layerData = object.userData?.layers;
        const layerNameToIndex = new Map<string, number>();

        if (Array.isArray(layerData)) {
          layerData.forEach((layer: { name: string; color: { r: number; g: number; b: number } }, index: number) => {
            const color = layer.color
              ? `rgb(${Math.round(layer.color.r)}, ${Math.round(layer.color.g)}, ${Math.round(layer.color.b)})`
              : '#f7b5cd';

            const layerName = layer.name || `Layer ${index}`;
            layerNameToIndex.set(layerName, index);

            rhinoLayers.push({
              index,
              name: layerName,
              visible: true,
              color
            });
          });
        }

        layerIndicesRef.current = layerNameToIndex;

        // Find emissive layer indices
        const emissiveLayerIndices = new Set<number>();
        EMISSIVE_LAYER_NAMES.forEach(name => {
          const index = layerNameToIndex.get(name);
          if (index !== undefined) {
            emissiveLayerIndices.add(index);
          }
        });
        const edgeLedLayerIndex = layerNameToIndex.get(EDGE_LED_LAYER_NAME);
        const baseLightsLayerIndex = layerNameToIndex.get(BASE_LIGHTS_LAYER_NAME);
        const faceLayerIndex = layerNameToIndex.get(FACE_LAYER_NAME);
        const emitterGuidesLayerIndex = layerNameToIndex.get(EMITTER_GUIDES_LAYER_NAME);

        // Find semi-gloss layer index
        const semiGlossLayerIndex = layerNameToIndex.get(SEMI_GLOSS_LAYER_NAME);

        // Find meshes on emissive layers and create shader materials
        const emissiveMeshes: THREE.Mesh[] = [];
        const shaderMaterials: THREE.ShaderMaterial[] = [];
        const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
        const edgeLedMeshes: THREE.Mesh[] = [];
        const baseLightMeshes: THREE.Mesh[] = [];
        const emitterGuideObjects: THREE.Object3D[] = [];
        let faceNeutralizedCount = 0;

        object.traverse((child) => {
          const layerIndex = child.userData?.attributes?.layerIndex;

          if (
            layerIndex === emitterGuidesLayerIndex &&
            (child instanceof THREE.Line || child instanceof THREE.LineSegments)
          ) {
            emitterGuideObjects.push(child);
          }

          if (child instanceof THREE.Mesh) {
            const isFaceLayer = layerIndex === faceLayerIndex;
            const isEmissiveLayer = layerIndex !== undefined && emissiveLayerIndices.has(layerIndex) && !isFaceLayer;

            child.castShadow = true;
            child.receiveShadow = true;

            if (isFaceLayer) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((material) => material.clone());
              } else {
                child.material = child.material.clone();
              }
              neutralizeMaterialEmission(child.material);
              faceNeutralizedCount += 1;
            }

            // Apply semi-gloss material to Grass Graphic layer
            if (layerIndex === semiGlossLayerIndex) {
              const semiGlossMaterial = new THREE.MeshStandardMaterial({
                color: 0x4f724b, // Slightly lifted green so projected color reads
                roughness: 0.35,
                metalness: 0.1,  // Slight metalness for reflectivity
                envMapIntensity: 0.8,
              });
              child.material = semiGlossMaterial;
            }

            // Apply emissive materials to light layers
            if (isEmissiveLayer) {
              emissiveMeshes.push(child);
              originalMaterials.set(child, child.material);

              // Create shader material for this mesh
              const shaderMaterial = new THREE.ShaderMaterial({
                vertexShader: glowVertexShader,
                fragmentShader: glowFragmentShader,
                uniforms: {
                  uTime: { value: 0 },
                  uColor: { value: new THREE.Color(0xF7B5CD) },
                  uIntensity: { value: lightSettings.edgeGlowIntensity },
                  uSpeed: { value: lightSettings.effectSpeed },
                  uEffectType: { value: 0 }
                },
                side: THREE.DoubleSide,
                transparent: false,
                depthWrite: true
              });

              shaderMaterials.push(shaderMaterial);

              if (layerIndex === edgeLedLayerIndex) {
                edgeLedMeshes.push(child);
              }
              if (layerIndex === baseLightsLayerIndex) {
                baseLightMeshes.push(child);
              }
            }
          }
        });

        if (faceLayerIndex !== undefined) {
          console.info(`[Lighting] Face layer emission neutralized on ${faceNeutralizedCount} mesh(es).`);
        } else {
          console.info('[Lighting] Face layer not found in Rhino model; no Face emission override applied.');
        }

        emissiveMeshesRef.current = emissiveMeshes;
        shaderMaterialsRef.current = shaderMaterials;
        originalMaterialsRef.current = originalMaterials;

        onLayersLoaded(rhinoLayers);

        // Fit camera to model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // Add some padding

        camera.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.5, center.z + cameraZ);
        controls.target.copy(center);
        controls.update();

        const shadowSpan = Math.max(size.x, size.z) * 0.8;
        if (directionalLight1Ref.current) {
          directionalLight1Ref.current.target.position.copy(center);
          scene.add(directionalLight1Ref.current.target);
          if (directionalLight1Ref.current.shadow.camera instanceof THREE.OrthographicCamera) {
            directionalLight1Ref.current.shadow.camera.left = -shadowSpan;
            directionalLight1Ref.current.shadow.camera.right = shadowSpan;
            directionalLight1Ref.current.shadow.camera.top = shadowSpan;
            directionalLight1Ref.current.shadow.camera.bottom = -shadowSpan;
            directionalLight1Ref.current.shadow.camera.near = 5;
            directionalLight1Ref.current.shadow.camera.far = Math.max(size.y * 4, 600);
            directionalLight1Ref.current.shadow.camera.updateProjectionMatrix();
          }
        }
        if (directionalLight2Ref.current) {
          directionalLight2Ref.current.target.position.copy(center);
          scene.add(directionalLight2Ref.current.target);
        }

        const emissiveEmitterLights: EmissiveEmitterLight[] = [];
        const maxEdgeEmitters = 4;
        const maxBaseEmitters = 0;
        const maxShadowCastingEdgeEmitters = 3;
        const maxShadowCastingBaseEmitters = 0;
        let edgeShadowCasterCount = 0;
        let baseShadowCasterCount = 0;
        let edgeRigCount = 0;
        const groundY = box.min.y + 0.1;
        // Reduce throw to 1/4 of the previous setup.
        const edgeEmitterDistance = Math.max(maxDim * 0.175, 24);
        const baseEmitterDistance = Math.max(maxDim * 0.0875, 12);
        const edgeMinIntensity = Math.max(maxDim * 3, 2500);
        const baseMinIntensity = Math.max(maxDim * 4, 3500);
        const edgeTargetGroundLux = 8;
        const baseTargetGroundLux = 11;
        const edgeThrowPadding = 4.0;
        const baseThrowPadding = 4.0;
        const throwExtensionScale = 1.1;
        const fallbackEdgeLineSegmentCount = 3;
        const guideEdgeLightFractions = [1 / 3, 2 / 3];
        const guideEdgeLineSegmentCount = guideEdgeLightFractions.length;
        const edgeLineLength = Math.max(maxDim * 0.16, 24);

        const addEdgeEmitterRig = (
          rigStart: THREE.Vector3,
          rigEnd: THREE.Vector3,
          sourceObject: THREE.Object3D,
          phase: number,
          followSourceVisibility: boolean,
          segmentCount: number,
          segmentFractions?: number[]
        ) => {
          const rigDirection = rigEnd.clone().sub(rigStart);
          rigDirection.y = 0;
          if (rigDirection.lengthSq() <= 1e-6) {
            rigDirection.set(1, 0, 0);
          }
          rigDirection.normalize();

          edgeRigCount += 1;
          const normalizedFractions = segmentFractions?.length
            ? segmentFractions.map((fraction) => THREE.MathUtils.clamp(fraction, 0, 1))
            : null;
          const normalizedSegmentCount = normalizedFractions?.length ?? Math.max(1, Math.round(segmentCount));
          const shadowSegmentIndex = Math.round((normalizedSegmentCount - 1) * 0.5);
          const segmentPositions: THREE.Vector3[] = [];

          if (normalizedFractions) {
            normalizedFractions.forEach((fraction) => {
              segmentPositions.push(rigStart.clone().lerp(rigEnd, fraction));
            });
          } else {
            const horizontalSpan = rigStart.clone().setY(0).distanceTo(rigEnd.clone().setY(0));
            const rigLength = Math.max(horizontalSpan, edgeLineLength);
            const segmentSpacing = normalizedSegmentCount > 1 ? rigLength / (normalizedSegmentCount - 1) : 0;
            const segmentCenter = (normalizedSegmentCount - 1) * 0.5;
            const rigCenter = rigStart.clone().lerp(rigEnd, 0.5);
            for (let segmentIndex = 0; segmentIndex < normalizedSegmentCount; segmentIndex += 1) {
              const offset = (segmentIndex - segmentCenter) * segmentSpacing;
              segmentPositions.push(rigCenter.clone().addScaledVector(rigDirection, offset));
            }
          }

          for (let segmentIndex = 0; segmentIndex < normalizedSegmentCount; segmentIndex += 1) {
            const segmentPosition = segmentPositions[segmentIndex];
            const spotLight = new THREE.SpotLight(0xF7B5CD, 1, edgeEmitterDistance, 0.5, 0.45, 1.5);
            spotLight.position.copy(segmentPosition);
            spotLight.position.y += Math.max(maxDim * 0.015, 0.8);

            const target = new THREE.Object3D();
            target.position.set(
              segmentPosition.x,
              groundY,
              segmentPosition.z
            );
            scene.add(target);
            spotLight.target = target;

            const throwToGround = spotLight.position.distanceTo(target.position);
            const effectiveDistance = (throwToGround + edgeThrowPadding) * throwExtensionScale;
            const photometricIntensity = edgeTargetGroundLux * effectiveDistance * effectiveDistance;
            const emitterRigIntensity = Math.max(edgeMinIntensity, photometricIntensity);
            const emitterBaseIntensity = emitterRigIntensity / normalizedSegmentCount;

            spotLight.intensity = emitterBaseIntensity;
            spotLight.distance = effectiveDistance;

            const isShadowSegment = segmentIndex === shadowSegmentIndex;
            if (isShadowSegment && edgeShadowCasterCount < maxShadowCastingEdgeEmitters) {
              spotLight.castShadow = true;
              spotLight.shadow.mapSize.set(1024, 1024);
              spotLight.shadow.bias = -0.0003;
              spotLight.shadow.normalBias = 0.03;
              spotLight.shadow.camera.near = 1;
              spotLight.shadow.camera.far = effectiveDistance;
              edgeShadowCasterCount += 1;
            }

            scene.add(spotLight);
            emissiveEmitterLights.push({
              light: spotLight,
              target,
              sourceObject,
              followSourceVisibility,
              layerType: 'edge-led',
              phase: (phase + segmentIndex / Math.max(normalizedSegmentCount * 6, 1)) % 1,
              baseIntensity: emitterBaseIntensity
            });
          }
        };

        const addBaseEmitter = (position: THREE.Vector3, sourceObject: THREE.Object3D, phase: number) => {
          const spotLight = new THREE.SpotLight(0xF7B5CD, 1, baseEmitterDistance, 0.92, 0.35, 1.35);
          spotLight.position.copy(position);
          spotLight.position.y += Math.max(maxDim * 0.01, 0.35);
          const target = new THREE.Object3D();
          target.position.set(position.x, groundY, position.z);
          scene.add(target);
          spotLight.target = target;
          const throwToGround = spotLight.position.distanceTo(target.position);
          const effectiveDistance = (throwToGround + baseThrowPadding) * throwExtensionScale;
          const photometricIntensity = baseTargetGroundLux * effectiveDistance * effectiveDistance;
          const emitterBaseIntensity = Math.max(baseMinIntensity, photometricIntensity);
          spotLight.intensity = emitterBaseIntensity;
          spotLight.distance = effectiveDistance;
          if (baseShadowCasterCount < maxShadowCastingBaseEmitters) {
            spotLight.castShadow = true;
            spotLight.shadow.mapSize.set(1024, 1024);
            spotLight.shadow.bias = -0.0005;
            spotLight.shadow.normalBias = 0.03;
            spotLight.shadow.camera.near = 0.3;
            spotLight.shadow.camera.far = effectiveDistance;
            baseShadowCasterCount += 1;
          }
          scene.add(spotLight);
          emissiveEmitterLights.push({
            light: spotLight,
            target,
            sourceObject,
            followSourceVisibility: true,
            layerType: 'base-lights',
            phase,
            baseIntensity: emitterBaseIntensity
          });
        };

        const edgeUvSamples = downsampleEvenly(
          edgeLedMeshes.flatMap((mesh) => sampleMeshUvWorldPoints(mesh, 320)),
          4000
        );

        const edgeGuideRigs: Array<{
          start: THREE.Vector3;
          end: THREE.Vector3;
          sourceObject: THREE.Object3D;
          phase: number;
        }> = [];

        emitterGuideObjects.forEach((guideObject, guideIndex) => {
          const points = getLineWorldPoints(guideObject);
          if (points.length < 2) {
            return;
          }
          const [start, end] = getFarthestPointPair(points);
          if (start.distanceToSquared(end) <= 1) {
            return;
          }
          const guideCenter = start.clone().lerp(end, 0.5);
          const uvPhase = getNearestUvPhase(guideCenter, edgeUvSamples);
          edgeGuideRigs.push({
            start,
            end,
            sourceObject: guideObject,
            phase: uvPhase !== null
              ? invertUvPhase(uvPhase)
              : (guideIndex / Math.max(emitterGuideObjects.length, 1))
          });
        });

        const edgeCandidates: Array<{
          sourceObject: THREE.Object3D;
          point: THREE.Vector3;
          phase: number;
          direction: THREE.Vector3;
        }> = [];
        edgeLedMeshes.forEach((mesh, meshIndex) => {
          const meshBounds = new THREE.Box3().setFromObject(mesh);
          const meshSize = meshBounds.getSize(new THREE.Vector3());
          const meshSpan = Math.max(meshSize.x, meshSize.y, meshSize.z);
          const sampleCount = Math.min(4, Math.max(1, Math.round(meshSpan / Math.max(maxDim * 0.14, 8))));
          const direction = getMeshHorizontalAxisDirection(mesh);
          const points = sampleMeshWorldPoints(mesh, sampleCount);
          points.forEach((point, pointIndex) => {
            const fallbackPhase = (meshIndex + pointIndex / Math.max(points.length, 1)) / Math.max(edgeLedMeshes.length, 1);
            const uvPhase = getNearestUvPhase(point, edgeUvSamples);
            edgeCandidates.push({
              sourceObject: mesh,
              point,
              phase: uvPhase !== null ? invertUvPhase(uvPhase) : (fallbackPhase % 1),
              direction
            });
          });
        });

        if (edgeGuideRigs.length > 0) {
          edgeGuideRigs.forEach((guideRig) => {
            addEdgeEmitterRig(
              guideRig.start,
              guideRig.end,
              guideRig.sourceObject,
              guideRig.phase,
              false,
              guideEdgeLineSegmentCount,
              guideEdgeLightFractions
            );
          });
        } else {
          const highestEdgeY = edgeCandidates.reduce((highest, candidate) => Math.max(highest, candidate.point.y), -Infinity);
          const canopyBand = Math.max(maxDim * 0.08, 5);
          const canopyEdgeCandidates = edgeCandidates.filter((candidate) => highestEdgeY - candidate.point.y <= canopyBand);
          downsampleEvenly(canopyEdgeCandidates, maxEdgeEmitters).forEach((candidate) => {
            const rigHalf = edgeLineLength * 0.5;
            const start = candidate.point.clone().addScaledVector(candidate.direction, -rigHalf);
            const end = candidate.point.clone().addScaledVector(candidate.direction, rigHalf);
            addEdgeEmitterRig(start, end, candidate.sourceObject, candidate.phase, true, fallbackEdgeLineSegmentCount);
          });
        }

        const baseCandidates: Array<{ mesh: THREE.Mesh; point: THREE.Vector3; phase: number }> = [];
        baseLightMeshes.forEach((mesh, meshIndex) => {
          const points = sampleMeshWorldPoints(mesh, 1);
          points.forEach((point) => {
            const phase = meshIndex / Math.max(baseLightMeshes.length, 1);
            baseCandidates.push({
              mesh,
              point,
              phase: phase % 1
            });
          });
        });
        downsampleEvenly(baseCandidates, maxBaseEmitters).forEach((candidate) => {
          addBaseEmitter(candidate.point, candidate.mesh, candidate.phase);
        });

        emissiveEmitterLightsRef.current = emissiveEmitterLights;
        const avgEmitterDistance = emissiveEmitterLights.length > 0
          ? emissiveEmitterLights.reduce((sum, emitter) => {
            const spot = emitter.light as THREE.SpotLight;
            return sum + (typeof spot.distance === 'number' ? spot.distance : 0);
          }, 0) / emissiveEmitterLights.length
          : 0;
        const avgEmitterIntensity = emissiveEmitterLights.length > 0
          ? emissiveEmitterLights.reduce((sum, emitter) => sum + emitter.baseIntensity, 0) / emissiveEmitterLights.length
          : 0;
        console.info(
          `[Lighting] Active emitter lights: ${emissiveEmitterLights.length} (edge rigs: ${edgeRigCount}, guide rigs: ${edgeGuideRigs.length}, UV samples: ${edgeUvSamples.length}, guide segments/rig: ${guideEdgeLineSegmentCount}, fallback segments/rig: ${fallbackEdgeLineSegmentCount}, edge shadow casters: ${edgeShadowCasterCount}, base shadow casters: ${baseShadowCasterCount}, avg throw: ${avgEmitterDistance.toFixed(2)}, avg intensity: ${avgEmitterIntensity.toFixed(0)}).`
        );
        rebuildDebugHelpers();

        const initialEmitterColor = new THREE.Color();
        const initialTime = clockRef.current.getElapsedTime();
        emissiveEmitterLights.forEach((emitter) => {
          const visible = shouldEmitterBeVisible(emitter, activeLightEffectRef.current);
          emitter.light.visible = visible;
          if (emitter.target) {
            emitter.target.visible = visible;
          }
          if (!visible) {
            emitter.light.intensity = 0;
            return;
          }
          const effectMultiplier = evaluateEmitterEffect(
            activeLightEffectRef.current,
            initialTime,
            emitter.phase,
            initialEmitterColor,
            effectSpeedRef.current
          );
          emitter.light.color.copy(initialEmitterColor);
          emitter.light.intensity = emitter.baseIntensity * effectMultiplier * emitterIntensityRef.current;
        });

        // Add matte ground plane that receives light
        const groundSize = Math.max(size.x, size.z) * 3;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
          color: 0x2a2829,
          roughness: 0.78, // Slightly brighter matte finish to reveal cast light
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
        const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        groundPlane.rotation.x = -Math.PI / 2; // Lay flat
        groundPlane.position.set(center.x, box.min.y - 5, center.z); // Position below model to avoid coplanar artifacts
        groundPlane.receiveShadow = true;
        groundPlane.visible = lightSettings.showGroundPlane;
        scene.add(groundPlane);
        groundPlaneRef.current = groundPlane;

        // Store initial camera state for reset
        initialCameraState.current = {
          position: camera.position.clone(),
          target: center.clone()
        };
      },
      (progress) => {
        const percentComplete = progress.total > 0
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0;
        console.log(`Loading model: ${percentComplete}%`);
      },
      (error) => {
        console.error('Error loading Rhino model:', error);
      }
    );

    // Animation loop
    const animatedEmitterColor = new THREE.Color();
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Update shader uniforms with time
      const elapsedTime = clockRef.current.getElapsedTime();
      shaderMaterialsRef.current.forEach((material) => {
        material.uniforms.uTime.value = elapsedTime;
      });
      emissiveEmitterLightsRef.current.forEach((emitter) => {
        const visible = shouldEmitterBeVisible(emitter, activeLightEffectRef.current);
        emitter.light.visible = visible;
        if (emitter.target) {
          emitter.target.visible = visible;
        }
        if (!visible) {
          emitter.light.intensity = 0;
          return;
        }

        const effectMultiplier = evaluateEmitterEffect(
          activeLightEffectRef.current,
          elapsedTime,
          emitter.phase,
          animatedEmitterColor,
          effectSpeedRef.current
        );
        emitter.light.color.copy(animatedEmitterColor);
        emitter.light.intensity = emitter.baseIntensity * effectMultiplier * emitterIntensityRef.current;
      });
      if (debugModeRef.current) {
        debugUpdatableHelpersRef.current.forEach((helper) => helper.update());
      }

      controls.update();

      // Use composer for post-processing (bloom effect)
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // Update composer size
      if (composerRef.current) {
        composerRef.current.setSize(width, height);
      }
      if (bloomPassRef.current) {
        bloomPassRef.current.resolution.set(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      controls.dispose();
      renderer.dispose();
      clearDebugHelpers();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      emissiveEmitterLightsRef.current.forEach((emitter) => {
        scene.remove(emitter.light);
        if (emitter.target) {
          scene.remove(emitter.target);
        }
        emitter.light.shadow.map?.dispose();
      });
      emissiveEmitterLightsRef.current = [];

      // Dispose of shader materials
      shaderMaterialsRef.current.forEach(material => material.dispose());

      // Dispose of composer
      if (composerRef.current) {
        composerRef.current.dispose();
      }

      // Dispose of geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
    };
    // Note: lightSettings is used for initial values, updates are handled by separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLayersLoaded]);

  return (
    <div
      ref={containerRef}
      className="heron-viewer-container"
    />
  );
}
