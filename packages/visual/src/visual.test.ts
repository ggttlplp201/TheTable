import { Group, Object3D, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import {
  CHARACTER_IDS,
  ITEM_MODEL_IDS,
  ITEMS_WITHOUT_CLIPS,
  PRESENTATION_CLIPS,
  VisualKit,
  createBlackMarketScene,
  createPublicShopScene,
  createPostMaterial,
  createSeededRandom,
  createTableScene,
  type CanvasFactory,
  type CanvasLike,
} from './index.js';

class RecordingGradient {
  constructor(private readonly record: (entry: string) => void) {}

  addColorStop(offset: number, color: string): void {
    this.record(`gradient:${offset}:${color}`);
  }
}

class RecordingContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  font = '';
  textAlign: CanvasTextAlign = 'start';
  lineWidth = 1;
  readonly log: string[];

  constructor(log: string[]) {
    this.log = log;
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.log.push(`fill:${String(this.fillStyle)}:${x}:${y}:${width}:${height}`);
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.log.push(`stroke:${String(this.strokeStyle)}:${x}:${y}:${width}:${height}`);
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.log.push(`clear:${x}:${y}:${width}:${height}`);
  }

  beginPath(): void { this.log.push('begin'); }
  stroke(): void { this.log.push('strokePath'); }
  moveTo(x: number, y: number): void { this.log.push(`move:${x}:${y}`); }
  lineTo(x: number, y: number): void { this.log.push(`line:${x}:${y}`); }
  closePath(): void { this.log.push('close'); }
  quadraticCurveTo(a: number, b: number, c: number, d: number): void { this.log.push(`curve:${a}:${b}:${c}:${d}`); }
  arc(x: number, y: number, radius: number, start: number, end: number): void { this.log.push(`arc:${x}:${y}:${radius}:${start}:${end}`); }
  fillText(text: string, x: number, y: number): void { this.log.push(`text:${text}:${x}:${y}`); }

  createRadialGradient(): CanvasGradient {
    return new RecordingGradient((entry) => this.log.push(entry)) as unknown as CanvasGradient;
  }
}

function recordingCanvasFactory(log: string[]): CanvasFactory {
  return (width, height) => ({
    width,
    height,
    getContext: () => new RecordingContext(log),
  }) as unknown as CanvasLike;
}

function createKit(seed: string | number = 'smoke'): VisualKit {
  return new VisualKit({ seed, canvasFactory: recordingCanvasFactory([]) });
}

function expectFiniteGraph(root: Object3D): void {
  root.traverse((object) => {
    for (const value of [
      ...object.position.toArray(),
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
      ...object.scale.toArray(),
    ]) expect(Number.isFinite(value)).toBe(true);
  });
}

describe('deterministic texture generation', () => {
  it('produces a repeatable random sequence', () => {
    const first = createSeededRandom('table');
    const second = createSeededRandom('table');
    expect(Array.from({ length: 12 }, first)).toEqual(Array.from({ length: 12 }, second));
  });

  it('draws identical material textures for an identical seed', () => {
    const firstLog: string[] = [];
    const secondLog: string[] = [];
    const differentLog: string[] = [];
    const first = new VisualKit({ seed: 42, canvasFactory: recordingCanvasFactory(firstLog) });
    const second = new VisualKit({ seed: 42, canvasFactory: recordingCanvasFactory(secondLog) });
    const different = new VisualKit({ seed: 43, canvasFactory: recordingCanvasFactory(differentLog) });
    expect(firstLog).toEqual(secondLog);
    expect(firstLog).not.toEqual(differentLog);
    first.dispose();
    second.dispose();
    different.dispose();
  });
});

describe('visual model smoke tests', () => {
  it('constructs every production item and excludes removed prototype IDs', () => {
    const kit = createKit();
    expect(ITEM_MODEL_IDS).toContain('bag');
    expect(ITEM_MODEL_IDS).not.toContain('counterfeit');
    expect(ITEM_MODEL_IDS).not.toContain('pocket');
    for (const id of ITEM_MODEL_IDS) {
      const model = kit.createItem(id);
      expect(model.children.length, id).toBeGreaterThan(0);
      expect(model.userData.itemId).toBe(id);
      expectFiniteGraph(model);
    }
    kit.dispose();
  });

  it('constructs every role and shopkeeper', () => {
    const kit = createKit();
    for (const id of CHARACTER_IDS) {
      const character = kit.createCharacter(id, 0xe0a040, id, 'standing');
      kit.animateCharacter(character, 1.25, 0.4);
      expect(character.userData.characterId).toBe(id);
      expectFiniteGraph(character);
    }
    kit.dispose();
  });

  it('builds data-free table and shop scenes', () => {
    const kit = createKit();
    const table = createTableScene(kit);
    const publicShop = createPublicShopScene(kit);
    const blackMarket = createBlackMarketScene(kit);
    expect(table.scene.children.length).toBeGreaterThan(10);
    expect(publicShop.interactive).toHaveLength(0);
    expect(blackMarket.interactive).toHaveLength(0);
    let centerPistol = false;
    table.scene.traverse((object) => {
      if (object.userData.itemId === 'pistol') centerPistol = true;
    });
    expect(centerPistol).toBe(false);
    kit.dispose();
  });

  it('builds caller-supplied offers, chest states, and post material', () => {
    const kit = createKit();
    const shop = createPublicShopScene(kit, {
      offers: [
        { id: 'offer-a', itemId: 'bag', label: 'Bag' },
        { id: 'offer-b', itemId: 'pistol', sold: true },
      ],
    });
    expect(shop.interactive).toHaveLength(2);
    expect(shop.anchors['offer:offer-a']).toBeDefined();
    expect(kit.createChest('standard', 'open').getObjectByName('lid')?.rotation.x).toBeLessThan(0);
    expect(kit.createChest('black', 'open').getObjectByName('lid')?.rotation.x).toBeLessThan(0);
    const post = createPostMaterial(new Texture());
    expect(post.uniforms.exposure?.value).toBe(1.55);
    post.dispose();
    kit.dispose();
  });
});

describe('presentation clips', () => {
  it('are scrubbable and remain finite at start, middle, and end', () => {
    const kit = createKit();
    for (const [id, presentation] of Object.entries(PRESENTATION_CLIPS)) {
      const model = kit.createItem(id as keyof typeof PRESENTATION_CLIPS);
      const pivot = new Group();
      pivot.add(model);
      for (const time of [presentation.duration, 0, presentation.duration / 2]) {
        presentation.apply(pivot, model, time);
        expectFiniteGraph(pivot);
      }
    }
    expect(ITEMS_WITHOUT_CLIPS).toEqual(['brassIdol', 'glassEye', 'redLedger']);
    kit.dispose();
  });
});

describe('resource lifecycle', () => {
  it('disposes kit-owned geometry exactly once', () => {
    const kit = createKit();
    const model = kit.createItem('bag');
    const mesh = model.children.find((child) => 'geometry' in child) as Object3D & {
      geometry: { addEventListener(type: 'dispose', listener: () => void): void };
    };
    let calls = 0;
    mesh.geometry.addEventListener('dispose', () => { calls += 1; });
    kit.dispose();
    kit.dispose();
    expect(calls).toBe(1);
  });
});
