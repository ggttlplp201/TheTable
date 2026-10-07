import type { Material, Object3D, Texture } from 'three';

interface Disposable {
  dispose(): void;
}

export interface DisposalSummary {
  geometries: number;
  materials: number;
  textures: number;
}

function isTexture(value: unknown): value is Texture {
  return Boolean(value && typeof value === 'object' && 'isTexture' in value);
}

function materialTextures(material: Material): Texture[] {
  const textures: Texture[] = [];
  for (const value of Object.values(material)) {
    if (isTexture(value)) textures.push(value);
  }
  return textures;
}

/** Dispose a standalone object graph. Do not use on graphs sharing kit-owned materials. */
export function disposeObject3D(root: Object3D, removeFromParent = true): DisposalSummary {
  const geometries = new Set<Disposable>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    if ('geometry' in object) {
      const geometry = (object as Object3D & { geometry?: Disposable }).geometry;
      if (geometry) geometries.add(geometry);
    }
    if ('material' in object) {
      const value = (object as Object3D & { material?: Material | Material[] }).material;
      const list = Array.isArray(value) ? value : value ? [value] : [];
      for (const material of list) {
        materials.add(material);
        for (const texture of materialTextures(material)) textures.add(texture);
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  if (removeFromParent) root.removeFromParent();

  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

export class ResourceTracker {
  readonly #resources = new Set<Disposable>();
  #disposed = false;

  track<T extends Disposable>(resource: T): T {
    if (this.#disposed) throw new Error('Cannot track a resource after disposal.');
    this.#resources.add(resource);
    return resource;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const resource of this.#resources) resource.dispose();
    this.#resources.clear();
  }

  get size(): number {
    return this.#resources.size;
  }
}
