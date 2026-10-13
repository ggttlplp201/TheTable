import {
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { PostOptions, PostPipeline } from './types.js';

export const COLOR_GRADES = Object.freeze({
  sodium: [1.08, 0.93, 0.74] as const,
  bile: [0.86, 1.03, 0.74] as const,
  rust: [1.14, 0.82, 0.72] as const,
  spectator: [0.88, 0.98, 1.14] as const,
});

export const POST_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const POST_FRAGMENT_SHADER = `
uniform sampler2D sourceTexture;
uniform float timeSeconds;
uniform float grainAmount;
uniform float colorLevels;
uniform float exposure;
uniform float saturation;
uniform vec3 tint;
uniform vec2 resolution;
varying vec2 vUv;

float bayer2(vec2 position) {
  position = floor(position);
  return fract(dot(position, vec2(0.5, position.y * 0.75)));
}
float bayer4(vec2 position) {
  return bayer2(0.5 * position) * 0.25 + bayer2(position);
}
float hash(vec2 position) {
  return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec3 color = texture2D(sourceTexture, vUv).rgb;
  color = pow(max(color * exposure, 0.0), vec3(1.0 / 2.2));
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, saturation) * tint;
  vec2 pixel = floor(vUv * resolution);
  color += (hash(pixel + floor(timeSeconds * 24.0) * 7.13) - 0.5) * grainAmount;
  color += (bayer4(pixel) - 0.5) / colorLevels;
  color = floor(max(color, 0.0) * colorLevels + 0.5) / colorLevels;
  vec2 vignette = vUv - 0.5;
  color *= 1.0 - dot(vignette, vignette) * 1.7;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export function createPostMaterial(texture: Texture, options: PostOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      sourceTexture: { value: texture },
      timeSeconds: { value: 0 },
      grainAmount: { value: options.grain ?? 0.16 },
      colorLevels: { value: options.levels ?? 10 },
      tint: { value: new Vector3(...(options.grade ?? COLOR_GRADES.sodium)) },
      resolution: { value: new Vector2(1, 1) },
      exposure: { value: options.exposure ?? 1.55 },
      saturation: { value: options.saturation ?? 0.72 },
    },
    vertexShader: POST_VERTEX_SHADER,
    fragmentShader: POST_FRAGMENT_SHADER,
  });
}

export function createPostPipeline(
  renderer: WebGLRenderer,
  width: number,
  height: number,
  options: PostOptions = {},
): PostPipeline {
  const target = new WebGLRenderTarget(width, height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  });
  const material = createPostMaterial(target.texture, options);
  const postScene = new Scene();
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  postScene.add(quad);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  material.uniforms.resolution?.value.set(width, height);

  return {
    scene: postScene,
    camera: postCamera,
    texture: target.texture,
    setGrain(amount) {
      if (Number.isFinite(amount)) material.uniforms.grainAmount!.value = Math.max(0, Math.min(.4, amount));
    },
    resize(nextWidth, nextHeight) {
      target.setSize(nextWidth, nextHeight);
      material.uniforms.resolution?.value.set(nextWidth, nextHeight);
    },
    render(scene: Scene, camera: Camera, timeSeconds = 0) {
      if (material.uniforms.timeSeconds) material.uniforms.timeSeconds.value = timeSeconds;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    dispose() {
      target.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
