import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Mesh, NearestFilter, Texture, type BufferGeometry, type Material, type MeshLambertMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualKit, type WildcardCardId } from './kit.js';
import { drawWildcardHi, WILDCARDS } from './reference-kit.js';
import type { CanvasFactory, CanvasLike } from './types.js';

class ArtCanvas {
  readonly calls: Array<[string, ...unknown[]]> = [];
  readonly context: CanvasRenderingContext2D;
  pixels?: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    const canvas = this;
    this.context = new Proxy({ canvas }, {
      get(target, key: string) {
        if (key in target) return Reflect.get(target, key);
        if (key === 'measureText') return (text: string) => ({ width: text.length * 9 });
        if (key === 'createRadialGradient') return () => ({ addColorStop: (...args: unknown[]) => canvas.calls.push(['colorStop', ...args]) });
        if (key === 'getImageData') return (_x: number, _y: number, width: number, height: number) => {
          const data = new Uint8ClampedArray(width * height * 4);
          for (let i = 0; i < data.length; i += 4) { data[i] = 110; data[i + 1] = 90; data[i + 2] = 70; data[i + 3] = 255; }
          return { data, width, height };
        };
        if (key === 'putImageData') return (image: ImageData) => { canvas.pixels = image.data; };
        return (...args: unknown[]) => { canvas.calls.push([key, ...args.map(arg => arg instanceof ArtCanvas ? `${arg.width}x${arg.height}` : arg)]); };
      },
      set(target, key, value) { Reflect.set(target, key, value); return true; },
    }) as unknown as CanvasRenderingContext2D;
  }
  getContext() { return this.context; }
}

function fixture() {
  const canvases: ArtCanvas[] = [];
  const canvasFactory: CanvasFactory = (width, height) => {
    const canvas = new ArtCanvas(width, height); canvases.push(canvas); return canvas as unknown as CanvasLike;
  };
  const kit = new VisualKit({ seed: 77, canvasFactory });
  return { kit, canvases };
}
function material(card: ReturnType<VisualKit['wildcardCard']>, name: 'face' | 'back') {
  return (card.getObjectByName(name) as Mesh).material as MeshLambertMaterial;
}
const aliases = [
  ['supply-drop', 'supply'], ['forced-exchange', 'exchange'], ['search-warrant', 'warrant'], ['second-chance', 'second'],
] as const;

afterEach(() => vi.unstubAllGlobals());

describe('supplied Wildcard artwork', () => {
  it('preserves every original vector art instruction apart from canonical-ID normalization', () => {
    const source = readFileSync(new URL('./reference-kit.js', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('export function drawWildcardHi(g, id) {'), source.indexOf('export function jobIconURL'))
      .replace('export function drawWildcardHi', 'function drawWildcardHi')
      .replace('\n  id = wildcardArtId(id);', '').trim();
    // Original Art Style Samples (7)/handoff-wildcards/source/game-kit.js drawWildcardHi.
    expect(createHash('sha256').update(body).digest('hex')).toBe('bef0d234dd4e33d9df63d574b5555a722fd02c493ddcfea3a67ebceb6c419898');
    expect(WILDCARDS).toHaveLength(10);
    expect(WILDCARDS.every(card => Object.keys(card).sort().join(',') === 'id,name')).toBe(true);
  });

  it.each(aliases)('maps canonical %s to original %s before seeded paper wear and emblem drawing', (canonical, original) => {
    const first = new ArtCanvas(192, 288), second = new ArtCanvas(192, 288);
    drawWildcardHi(first.context, canonical); drawWildcardHi(second.context, original);
    expect(first.calls).toEqual(second.calls);
    expect(first.calls.filter(([name]) => name === 'fillText').map(([, text]) => text)).toEqual(
      WILDCARDS.find(card => card.id === original)!.name.split(' ').concat(['III', 'V', 'VI', 'X'][aliases.findIndex(pair => pair[0] === canonical)]!),
    );
  });

  it('renders all ten named emblems and the unnamed common back through injected canvases', () => {
    const { kit, canvases } = fixture();
    const canonical = WILDCARDS.map(card => aliases.find(pair => pair[1] === card.id)?.[0] ?? card.id) as WildcardCardId[];
    const traces = new Set<string>();
    for (const id of [...canonical, 'back'] as const) {
      const texture = kit.wildcardTex(id), canvas = texture.userData.canvas as ArtCanvas;
      expect([canvas.width, canvas.height]).toEqual([192, 288]);
      expect(texture.magFilter).toBe(NearestFilter); expect(texture.minFilter).toBe(NearestFilter); expect(texture.generateMipmaps).toBe(false);
      expect(canvas.calls).toContainEqual(['scale', 2, 2]);
      expect(canvas.calls).toContainEqual(['drawImage', '96x144', 0, 0, 192, 288]);
      expect(canvas.calls.some(([name]) => name === 'fillText')).toBe(id !== 'back');
      traces.add(JSON.stringify(canvas.calls));
      const count = canvases.length; expect(kit.wildcardTex(id)).toBe(texture); expect(canvases).toHaveLength(count);
    }
    expect(traces.size).toBe(11);
    const pixels = canvases.filter(canvas => canvas.width === 96 && canvas.height === 144);
    expect(pixels).toHaveLength(11);
    const palette = [0, 32, 64, 96, 128, 159, 191, 223, 255];
    for (const canvas of pixels) expect([...new Set(canvas.pixels)].every(value => palette.includes(value))).toBe(true);
    kit.dispose();
  });

  it('creates back-only private props and swaps both diffuse/emissive maps without allocating geometry', () => {
    const { kit, canvases } = fixture(), card = kit.wildcardCard('back');
    expect(material(card, 'face').map).toBe(material(card, 'back').map);
    expect(material(card, 'face').emissiveMap).toBe(material(card, 'back').map);
    expect((material(card, 'face').map!.userData.canvas as ArtCanvas).calls.some(([name]) => name === 'fillText')).toBe(false);
    expect(canvases.filter(canvas => canvas.width === 192)).toHaveLength(1);
    const children = [...card.children], geometries = children.map(child => (child as Mesh).geometry);
    kit.setWildcardFace(card, 'search-warrant'); kit.setWildcardGlow(card, .4);
    expect(material(card, 'face').map).toBe(kit.wildcardTex('search-warrant'));
    expect(material(card, 'face').emissiveMap).toBe(material(card, 'face').map);
    expect(material(card, 'back').map).toBe(kit.wildcardTex('back'));
    const resources = kit.resourceCount;
    for (let i = 0; i < 20; i++) { kit.setWildcardFace(card, 'search-warrant'); kit.setWildcardGlow(card, i); }
    expect(kit.resourceCount).toBe(resources); expect(card.children).toEqual(children);
    expect(card.children.map(child => (child as Mesh).geometry)).toEqual(geometries);
    expect(material(card, 'face').emissiveIntensity).toBe(.55);
    kit.setWildcardFace(card, 'back'); expect(material(card, 'face').emissiveMap).toBe(kit.wildcardTex('back'));
    expect(card.userData.wcId).toBe('back'); kit.dispose();
  });

  it('keeps supplied deterministic deck dimensions, slab offsets and top-back placement', () => {
    const { kit } = fixture(), first = kit.wildcardDeck(10), second = kit.wildcardDeck(10);
    expect(first.children).toHaveLength(11); expect(first.userData.topY).toBe(.018);
    expect(first.children.map(child => [child.position.toArray(), child.rotation.toArray()])).toEqual(second.children.map(child => [child.position.toArray(), child.rotation.toArray()]));
    const slab = first.children[0] as Mesh;
    expect(slab.geometry).toMatchObject({ parameters: { width: .142, height: .0018, depth: .2 } });
    expect(first.getObjectByName('top')!.position.y).toBeCloseTo(.0183);
    expect(((first.getObjectByName('top') as Mesh).material as MeshLambertMaterial).map).toBe(kit.wildcardTex('back'));
    kit.dispose();
  });

  it('redraws cached textures once when VT323 loads and ignores completion after disposal', async () => {
    let finish!: () => void;
    const loaded = new Promise<void>(resolve => { finish = resolve; });
    vi.stubGlobal('document', { fonts: { check: () => false, load: vi.fn(() => loaded) } });
    const { kit } = fixture(), card = kit.wildcardCard('seize'), texture = kit.wildcardTex('seize');
    const canvas = texture.userData.canvas as ArtCanvas, count = canvas.calls.length, version = texture.version;
    finish(); await loaded; await Promise.resolve();
    expect(canvas.calls.length).toBeGreaterThan(count); expect(texture.version).toBeGreaterThan(version);
    expect(material(card, 'face').map).toBe(texture); kit.dispose();

    let finishLate!: () => void;
    const late = new Promise<void>(resolve => { finishLate = resolve; });
    vi.stubGlobal('document', { fonts: { check: () => false, load: () => late } });
    const next = fixture(), disposed = next.kit.wildcardTex('destroy');
    const before = disposed.version; next.kit.dispose(); finishLate(); await late; await Promise.resolve();
    expect(disposed.version).toBe(before); expect(next.kit.resourceCount).toBe(0);
  });

  it('disposes shared textures, swapped-out faces, materials and geometry exactly once', () => {
    const { kit } = fixture(), card = kit.wildcardCard('seize'), deck = kit.wildcardDeck(1);
    const resources = new Set<BufferGeometry | Material | Texture>([kit.wildcardTex('seize'), kit.wildcardTex('destroy')]);
    kit.setWildcardFace(card, 'destroy');
    for (const root of [card, deck]) root.traverse(object => {
      const mesh = object as Mesh; if (mesh.geometry) resources.add(mesh.geometry);
      for (const value of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        resources.add(value); for (const texture of Object.values(value)) if (texture instanceof Texture) resources.add(texture);
      }
    });
    const calls = new Map([...resources].map(resource => [resource, 0]));
    for (const resource of resources) resource.addEventListener('dispose', () => calls.set(resource, calls.get(resource)! + 1));
    kit.dispose(); kit.dispose(); expect([...calls.values()].every(count => count === 1)).toBe(true); expect(kit.resourceCount).toBe(0);
  });
});
