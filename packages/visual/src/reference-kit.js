// Canonical Patch 4 design source, also re-exported by apps/web/src/reference-game-kit.js.
// The Low Table — shared 3D asset kit (items, chests, characters, post FX)
export const GRADES = { Sodium:[1.08,.93,.74], Bile:[.86,1.03,.74], Rust:[1.14,.82,.72], Spectator:[.88,.98,1.14] };
export const ITEMS = [
  { id:'knife', name:'Knife', rarity:'Common', glyph:'◆◇◇', price:2, use:'One-use', cat:'Weapon', desc:'Close-range threat. Breaks after one use.', counters:'Armor absorbs it' },
  { id:'pistol', name:'Pistol', rarity:'Rare', glyph:'◆◆◆', price:6, use:'Reusable', cat:'Weapon', desc:'Heavy threat. Needs a Bullet to fire.', counters:'Armor · Handcuffs' },
  { id:'bullet', name:'Bullet', rarity:'Common', glyph:'◆◇◇', price:1, use:'One-use', cat:'Weapon', desc:'One round for the Pistol.', counters:'Combines with Pistol' },
  { id:'poison', name:'Poison', rarity:'Uncommon', glyph:'◆◆◇', price:3, use:'One-use', cat:'Medical', desc:'Target loses HP each tick until cured.', counters:'Cured by Antidote' },
  { id:'medicine', name:'Medicine', rarity:'Common', glyph:'◆◇◇', price:2, use:'One-use', cat:'Medical', desc:'Restore 1 HP. Can self-revive when Downed.', counters:'—' },
  { id:'stimulant', name:'Stimulant', rarity:'Uncommon', glyph:'◆◆◇', price:5, use:'One-use', cat:'Medical', desc:'Restore 2 HP. Excess grants up to 2 temporary HP.', counters:'Cannot revive' },
  { id:'antidote', name:'Antidote', rarity:'Uncommon', glyph:'◆◆◇', price:3, use:'One-use', cat:'Medical', desc:'Clears Poison immediately.', counters:'Counters Poison' },
  { id:'armor', name:'Armor', rarity:'Uncommon', glyph:'◆◆◇', price:4, use:'One-use', cat:'Defense', desc:'Absorbs the next hit, then breaks.', counters:'Blocks Knife · Pistol' },
  { id:'cloth', name:'Cloth', rarity:'Common', glyph:'◆◇◇', price:1, use:'Reusable', cat:'Tool', desc:'Covers a held item so a threat can bluff.', counters:'Spyglass sees under' },
  { id:'pocket', name:'Extra Pocket', rarity:'Uncommon', glyph:'◆◆◇', price:4, use:'Passive', cat:'Storage', desc:'A second hidden Pocket. Others only see if it is full.', counters:'Pickpocket' },
  { id:'safe', name:'Safe', rarity:'Rare', glyph:'◆◆◆', price:5, use:'Passive', cat:'Storage', desc:'Lock one Pocket inside it. Pickpocket cannot reach it.', counters:'Blocks Pickpocket' },
  { id:'spyglass', name:'Spyglass', rarity:'Uncommon', glyph:'◆◆◇', price:3, use:'One-use', cat:'Tool', desc:'Privately look under one Cloth or into one Pocket.', counters:'Reveals Cloth' },
  { id:'pickpocket', name:'Pickpocket', rarity:'Rare', glyph:'◆◆◆', price:5, use:'One-use', cat:'Tool', desc:'Take the contents of one unprotected Pocket.', counters:'Blocked by Safe' },
  { id:'key', name:'Key', rarity:'Common', glyph:'◆◇◇', price:2, use:'One-use', cat:'Key', desc:'Opens the Standard Chest.', counters:'—' },
  { id:'lockpick', name:'Lockpick', rarity:'Uncommon', glyph:'◆◆◇', price:3, use:'One-use', cat:'Key', desc:'Opens the Standard Chest or frees Handcuffs.', counters:'Frees Handcuffs' },
  { id:'crowbar', name:'Crowbar', rarity:'Uncommon', glyph:'◆◆◇', price:4, use:'One-use', cat:'Tool', desc:'Forces the Standard Chest. Loud — logged publicly.', counters:'—' },
  { id:'blackkey', name:'Black Key', rarity:'Special', glyph:'✦', price:null, use:'One-use', cat:'Key', desc:'The only way into the Black Chest.', counters:'—' },
  { id:'handcuffs', name:'Handcuffs', rarity:'Uncommon', glyph:'◆◆◇', price:3, use:'One-use', cat:'Control', desc:'Target loses their next turn.', counters:'Lockpick frees' },
  { id:'counterfeit', name:'Counterfeit Gold', rarity:'Common', glyph:'◆◇◇', price:2, use:'One-use', cat:'Economy', desc:'Passes as Gold in trades. Look closely.', counters:'Spyglass exposes' },
  { id:'brassidol', name:'Brass Idol', rarity:'Artifact', glyph:'✧', price:null, use:'Reusable', cat:'Artifact', desc:'Artifact. Cannot be sold.', counters:'—' },
  { id:'glasseye', name:'Glass Eye', rarity:'Artifact', glyph:'✧', price:null, use:'Reusable', cat:'Artifact', desc:'Artifact. Cannot be sold.', counters:'—' },
  { id:'redledger', name:'Red Ledger', rarity:'Artifact', glyph:'✧', price:null, use:'Reusable', cat:'Artifact', desc:'Artifact. Cannot be sold.', counters:'—' },
  { id:'passage', name:'Passage Token', rarity:'Quest', glyph:'⬡', price:null, use:'Quest', cat:'Quest', desc:'Permission to leave the table.', counters:'—' }
];
export const STATES = [
  { id:'armor_broken', name:'Armor · Spent', rarity:'State', glyph:'·' },
  { id:'coin', name:'Gold', rarity:'Currency', glyph:'¢' },
  { id:'chest_std', name:'Chest · Closed', rarity:'Standard', glyph:'▢' },
  { id:'chest_std_open', name:'Chest · Opened', rarity:'Standard', glyph:'▢' },
  { id:'chest_std_used', name:'Chest · Cooldown', rarity:'Standard', glyph:'▢' },
  { id:'chest_black', name:'Black · Sealed', rarity:'Premium', glyph:'■' },
  { id:'chest_black_open', name:'Black · Open', rarity:'Premium', glyph:'■' }
];
export const POST_VS = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
export const POST_FS = 'uniform sampler2D tD; uniform float uT,uG,uL,uE,uS; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;\n' +
  'float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}\nfloat b4(vec2 a){return b2(.5*a)*.25+b2(a);}\n' +
  'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\n' +
  'void main(){vec3 c=texture2D(tD,vUv).rgb; c=pow(max(c*uE,0.),vec3(1./2.2));\nfloat l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uS)*uTint;\n' +
  'vec2 p=floor(vUv*uRes); c+=(h(p+floor(uT*24.)*7.13)-.5)*uG; c+=(b4(p)-.5)/uL;\nc=floor(max(c,0.)*uL+.5)/uL; vec2 d=vUv-.5; c*=1.-dot(d,d)*1.7;\ngl_FragColor=vec4(clamp(c,0.,1.),1.);}';
export function makePost(T, tex, c = {}) {
  return new T.ShaderMaterial({ uniforms: { tD: { value: tex }, uT: { value: 0 }, uG: { value: c.grain ?? .16 }, uL: { value: c.levels ?? 10 }, uTint: { value: new T.Vector3(...(c.grade || GRADES.Sodium)) }, uRes: { value: new T.Vector2(1, 1) }, uE: { value: c.exp ?? 1.55 }, uS: { value: c.sat ?? .72 } }, vertexShader: POST_VS, fragmentShader: POST_FS });
}
export function install(t, T) { t.T = T; Object.getOwnPropertyNames(Kit.prototype).forEach(n => { if (n !== 'constructor') t[n] = Kit.prototype[n].bind(t); }); t.m = t.materials(); t.defs = t.itemDefs(); return t; }
export function renderIconURLs(T, ids, size = 48, yaw = .6) {
  const k = install({}, T), out = {};
  const r = new T.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(size, size, false); r.setClearColor(0x000000, 0);
  const s = new T.Scene(), kl = new T.DirectionalLight(0xffd9a0, 2.6); kl.position.set(-1, 2, 1.5); s.add(kl);
  const rim = new T.DirectionalLight(0x6a8aa0, 1.4); rim.position.set(1.5, .5, -1.5); s.add(rim); s.add(new T.AmbientLight(0x3a3028, .9));
  const cam = new T.PerspectiveCamera(30, 1, .01, 10);
  ids.forEach(id => { const d = k.defs[id]; if (!d) return; const o = d.b(), sp = new T.Box3().setFromObject(o).getBoundingSphere(new T.Sphere()); o.position.sub(sp.center); const piv = new T.Group(); piv.add(o); piv.rotation.set(d.tilt ?? .3, yaw, 0); s.add(piv); cam.position.set(0, 0, sp.radius / Math.sin(15 * Math.PI / 180) * 1.02); cam.lookAt(0, 0, 0); r.render(s, cam); out[id] = r.domElement.toDataURL(); s.remove(piv); });
  r.dispose(); return out;
}
export function renderPortraitURLs(T, list, w = 120, h = 150) {
  const k = install({}, T), out = {};
  const r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h, false); r.shadowMap.enabled = true; r.shadowMap.type = T.BasicShadowMap;
  const rt = new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const post = makePost(T, rt.texture, {}); post.uniforms.uRes.value.set(w, h);
  const ps = new T.Scene(), pq = new T.Mesh(new T.PlaneGeometry(2, 2), post); pq.frustumCulled = false; ps.add(pq); const pc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const s = new T.Scene(); s.background = new T.Color(0x030303);
  const wall = new T.Mesh(new T.PlaneGeometry(7, 5), new T.MeshLambertMaterial({ color: 0x2a2420 })); wall.position.set(0, 2, -1.2); wall.receiveShadow = true; s.add(wall);
  const sp = new T.SpotLight(0xffd9a0, 18, 0, .5, .6, 2); sp.position.set(-.4, 3.8, 1.6); sp.castShadow = true; const tg = new T.Object3D(); tg.position.set(0, 1.4, 0); s.add(tg); sp.target = tg; s.add(sp);
  const rim = new T.PointLight(0xffffff, 3.5, 3.5, 2); rim.position.set(.7, 2.3, -.7); s.add(rim); s.add(new T.AmbientLight(0x2a221c, .75));
  const cam = new T.PerspectiveCamera(30, w / h, .05, 10); cam.position.set(0, 1.8, 2.2); cam.lookAt(0, 1.68, 0);
  list.forEach(({ key, hex }) => { const g = k.character(key, hex, '', 'standing'); k.idle(g, 0, 0, true); g.rotation.y = -.25; s.add(g); rim.color.setHex(hex); r.setRenderTarget(rt); r.render(s, cam); r.setRenderTarget(null); r.render(ps, pc); out[key] = r.domElement.toDataURL(); s.remove(g); });
  r.dispose(); return out;
}
export class Kit {
  wildcardTex(id = 'back') {
    const artId = wildcardArtId(id);
    this._wcTex = this._wcTex || {}; if (this._wcTex[artId]) return this._wcTex[artId];
    const cv = this.canvasFactory ? this.canvasFactory(192, 288) : document.createElement('canvas'); cv.width = 192; cv.height = 288;
    const g = cv.getContext('2d'); if (!g) throw new Error('Wildcard artwork requires a 2D canvas context.');
    g.scale(2, 2); drawWildcard(g, artId, this.canvasFactory);
    const t = new this.T.CanvasTexture(cv); t.magFilter = this.T.NearestFilter; t.minFilter = this.T.NearestFilter; t.generateMipmaps = false; t.userData = { canvas: cv };
    this._wcTex[artId] = t;
    this.trackResource?.(t);
    // Names initially use the supplied Courier fallback. Refresh the same canvas/texture once VT323 is ready.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (artId !== 'back' && fonts && !fonts.check('20px VT323')) {
      this._wcFontReady = this._wcFontReady || fonts.load('20px VT323');
      this._wcFontReady.then(() => {
        if (this._wcTex?.[artId] !== t) return;
        g.setTransform(2, 0, 0, 2, 0, 0); drawWildcard(g, artId, this.canvasFactory); t.needsUpdate = true;
      }).catch(() => {});
    }
    return t;
  }
  wildcardCard(id = 'back') {
    const T = this.T, w = .142, h = .2, g = new T.Group();
    const edge = new T.Mesh(new T.BoxGeometry(w, .0016, h), new T.MeshLambertMaterial({ color: 0x8a5a26 })); edge.castShadow = true; g.add(edge);
    const tb = this.wildcardTex('back'), back = new T.Mesh(new T.PlaneGeometry(w * .985, h * .985), new T.MeshLambertMaterial({ map: tb, emissive: 0xffffff, emissiveMap: tb, emissiveIntensity: 0 })); back.rotation.x = -Math.PI / 2; back.position.y = .00085; back.name = 'back';
    const tf = this.wildcardTex(id), face = new T.Mesh(new T.PlaneGeometry(w * .985, h * .985), new T.MeshLambertMaterial({ map: tf, emissive: 0xffffff, emissiveMap: tf, emissiveIntensity: 0 })); face.rotation.x = Math.PI / 2; face.position.y = -.00085; face.name = 'face';
    g.add(back, face); g.userData.wcId = id; return g;
  }
  setWildcardGlow(card, v) { ['face', 'back'].forEach(n => { const o = card.getObjectByName(n); if (o) o.material.emissiveIntensity = Math.max(0, Math.min(.55, v)); }); }
  setWildcardFace(card, id) { const f = card.getObjectByName('face'), texture = this.wildcardTex(id); f.material.map = texture; f.material.emissiveMap = texture; f.material.needsUpdate = true; card.userData.wcId = id; }
  releaseWildcardCache() { this._wcTex = {}; this._wcFontReady = undefined; }
  wildcardDeck(n = 14) {
    n = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 14;
    const T = this.T, g = new T.Group(), side = new T.MeshLambertMaterial({ color: 0x9a6c2c }), dark = new T.MeshLambertMaterial({ color: 0x553414 }), rnd = seeded(7);
    this.trackResource?.(side); this.trackResource?.(dark);
    for (let i = 0; i < n; i++) { const c = new T.Mesh(new T.BoxGeometry(.142, .0018, .2), i % 3 ? side : dark); c.position.set((rnd() - .5) * .006, .0009 + i * .0018, (rnd() - .5) * .006); c.rotation.y = (rnd() - .5) * .06; c.castShadow = true; c.receiveShadow = true; g.add(c); }
    const top = new T.Mesh(new T.PlaneGeometry(.14, .198), new T.MeshLambertMaterial({ map: this.wildcardTex('back') })); top.rotation.x = -Math.PI / 2; top.position.y = n * .0018 + .0003; top.name = 'top'; g.add(top);
    g.userData.label = 'WILDCARD DECK'; g.userData.topY = n * .0018; (this.pick ||= []).push(g);
    return g;
  }
  tex(w, h, draw, rep) {
    const T = this.T, c = this.canvasFactory ? this.canvasFactory(w, h) : document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  noise(g, w, h, n, cols) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1 + (Math.random() * 2 | 0), 1); } }
  M(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const o = new this.T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o;
  }
  G(...k) { const g = new this.T.Group(); k.forEach(o => g.add(o)); return g; }
  materials() {
    const T = this.T, L = (c, o = {}) => new T.MeshLambertMaterial({ color: c, ...o }), P = (c, s = 40, o = {}) => new T.MeshPhongMaterial({ color: c, shininess: s, specular: 0x77756e, ...o });
    const wood = this.tex(64, 64, (g, w, h) => { g.fillStyle = '#4a2e1c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${20 + Math.random() * 40},${10 + Math.random() * 20},5,${Math.random() * .5})`; g.fillRect(0, y, w, 1); } this.noise(g, w, h, 500, ['rgba(0,0,0,.3)', 'rgba(120,80,50,.2)']); }, [1, 1]);
    const cloth = this.tex(32, 32, (g, w, h) => { g.fillStyle = '#2a201b'; g.fillRect(0, 0, w, h); this.noise(g, w, h, 400, ['rgba(0,0,0,.4)', 'rgba(80,60,50,.3)']); });
    return {
      metal: P(0x7a776f, 70), dark: P(0x2b2826, 30, { specular: 0x333333 }), brass: P(0xa47a38, 45, { specular: 0xd0a868 }),
      wood: L(0xffffff, { map: wood }), bone: L(0xd6c9ab), white: L(0xe6e1d6), cloth: L(0xffffff, { map: cloth }), leather: L(0x3b2416),
      black: P(0x161210, 50, { specular: 0x555555 }), red: L(0x7c1f19), copper: P(0x9a5a34, 50), rust: L(0x5e3424), skin: L(0x6e5a48), iris: L(0x3e7a70),
      silver: P(0xd8dce0, 120, { specular: 0xffffff, emissive: 0x2a2e32 }), eye: new T.MeshBasicMaterial({ color: 0xcfc4a8 }), gGreen: P(0x4c7a24, 90, { transparent: true, opacity: .88, emissive: 0x2c5a0a }), gPale: P(0xd6ddd2, 90, { transparent: true, opacity: .9 }),
      gAmb: P(0xc08a30, 90, { transparent: true, opacity: .85, emissive: 0x2a1804 }),
      metalD: P(0x7a776f, 70, { side: T.DoubleSide }), brassD: P(0xa47a38, 45, { specular: 0xd0a868, side: T.DoubleSide }), rustD: L(0x5e3424, { side: T.DoubleSide }), brassW: P(0x8a6c36, 25, { specular: 0x8a7a50 }), brassPale: P(0xc4a85a, 60, { specular: 0xe0d090 }), lead: P(0x55555a, 20), spine: L(0x4a120e),
      tin: P(0x50555a, 55), velvet: L(0x4a1210),
      redGlow: new T.MeshBasicMaterial({ color: 0xd8301e }), greenGlow: new T.MeshBasicMaterial({ color: 0x4f7a48 }), bulb: new T.MeshBasicMaterial({ color: 0xffe6b0 })
    };
  }
  itemDefs() {
    const T = this.T, m = this.m, B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, s = 8) => new T.CylinderGeometry(a, b, h, s);
    const M = this.M.bind(this), G = this.G.bind(this), PI = Math.PI;
    return {
      knife: { tilt: .9, b: () => { const bl = G(M(B(.22, .012, .05), m.metal, .1, .02, 0), M(new T.ConeGeometry(.025, .07, 3), m.metal, .245, .02, 0, 0, 0, -PI / 2)); bl.name = 'blade'; return G(bl, M(B(.13, .035, .04), m.wood, -.08, .02, 0), M(B(.015, .045, .085), m.brass, -.01, .02, 0)); } },
      pistol: { tilt: .25, flat: [-PI / 2, 0, 0, .03], b: () => { const cyl = M(C(.04, .04, .075, 6), m.metal, .04, .09, 0, 0, 0, PI / 2); cyl.name = 'cyl'; const hm = M(B(.025, .03, .02), m.dark, -.055, .14, 0); hm.name = 'hammer'; return G(M(C(.022, .022, .2), m.metal, .14, .1, 0, 0, 0, PI / 2), M(B(.14, .075, .05), m.dark, .02, .09, 0), cyl, M(B(.055, .13, .045), m.wood, -.075, .025, 0, 0, 0, -.35), M(new T.TorusGeometry(.024, .006, 4, 8, PI), m.dark, 0, .05, 0, 0, 0, PI), hm, M(B(.012, .02, .012), m.metal, .23, .125, 0)); } },
      bullet: { tilt: .3, b: () => G(M(C(.011, .011, .04, 10), m.brass, 0, .025, 0), M(C(.013, .013, .005, 10), m.brass, 0, .0025, 0), M(C(.003, .011, .022, 10), m.copper, 0, .056, 0)) },
      poison: { tilt: .3, b: () => { const ck = M(C(.021, .017, .045, 6), m.leather, 0, .27, 0); ck.name = 'cork'; return G(M(new T.SphereGeometry(.078, 9, 7), m.gGreen, 0, .078, 0), M(C(.022, .024, .11, 7), m.gGreen, 0, .19, 0), M(C(.031, .031, .012, 7), m.gGreen, 0, .246, 0), ck, M(C(.034, .034, .014, 7), m.red, 0, .25, 0), M(B(.05, .065, .004), m.bone, .035, .15, .055, 0, .3, .25), M(B(.022, .022, .006), m.red, .036, .15, .058, 0, .3, .25)); } },
      medicine: { tilt: .25, b: () => { const cap = G(M(C(.038, .038, .035, 12), m.white, 0, 0, 0), M(B(.03, .004, .009), m.red, 0, .018, 0), M(B(.009, .004, .03), m.red, 0, .018, 0)); cap.name = 'cap'; cap.position.y = .145; const seal = G(M(C(.031, .031, .004, 12), m.silver, 0, 0, .031)); seal.name = 'seal'; seal.position.set(0, .132, -.031); return G(M(C(.055, .055, .11, 12), m.gPale, 0, .055, 0), M(C(.057, .057, .05, 12), m.bone, 0, .055, 0), M(B(.04, .012, .01), m.red, 0, .055, .058), M(B(.012, .04, .01), m.red, 0, .055, .058), M(C(.03, .034, .02, 12), m.dark, 0, .12, 0), seal, cap); } },
      stimulant: { tilt: .3, b: () => G(M(C(.026, .026, .075, 10), m.gAmb, 0, .0395, 0), M(C(.0275, .0275, .034, 10), m.bone, 0, .042, 0), M(B(.013, .004, .003), m.red, 0, .044, .028), M(B(.004, .013, .003), m.red, 0, .044, .028), M(C(.026, .012, .02, 10), m.gAmb, 0, .087, 0), M(C(.008, .008, .018, 8), m.gAmb, 0, .105, 0), M(C(.011, .011, .013, 8), m.metalD, 0, .12, 0), M(C(.027, .027, .004, 10), m.metalD, 0, .002, 0)) },
      antidote: { tilt: .35, flat: [0, 0, PI / 2, .03], b: () => { const dose = M(C(.02, .02, .16, 8), m.gAmb, 0, .13, 0); dose.name = 'dose'; const pl = G(M(C(.007, .007, .07, 6), m.metal, 0, .25, 0), M(C(.03, .03, .01, 8), m.metal, 0, .29, 0)); pl.name = 'plunger'; return G(dose, M(C(.024, .024, .16, 8), m.gPale, 0, .13, 0), M(C(.025, .025, .015, 8), m.metal, 0, .05, 0), M(C(.025, .025, .015, 8), m.metal, 0, .21, 0), M(B(.08, .01, .025), m.metal, 0, .215, 0), pl, M(C(.015, .009, .03, 6), m.silver, 0, .03, 0), M(C(.006, .006, .075, 4), m.silver, 0, -.02, 0), M(new T.ConeGeometry(.006, .028, 4), m.silver, 0, -.071, 0, Math.PI, 0, 0)); } },
      key: { tilt: .9, b: () => G(M(new T.TorusGeometry(.035, .01, 4, 10), m.brass, -.08, .01, 0, PI / 2, 0, 0), M(B(.13, .014, .014), m.brass, .02, .01, 0), M(B(.014, .014, .03), m.brass, .06, .01, .02), M(B(.014, .014, .022), m.brass, .08, .01, .016)) },
      blackkey: { tilt: .8, flat: [0, 0, 0, .025], b: () => { const gem = M(new T.OctahedronGeometry(.016, 0), m.redGlow, -.09, .03, .036); gem.name = 'gem'; return G(M(new T.OctahedronGeometry(.05, 0), m.black, -.09, .03, 0), gem, M(new T.TorusGeometry(.03, .006, 4, 10), m.brass, -.035, .02, 0, 0, PI / 2, 0), M(B(.15, .016, .016), m.black, .04, .02, 0), M(B(.016, .016, .04), m.black, .08, .02, .025), M(B(.016, .016, .02), m.black, .1, .02, .015), M(B(.016, .016, .05), m.black, .12, .02, .03)); } },
      crowbar: { tilt: .9, b: () => G(M(B(.36, .022, .022), m.rust, 0, .015, 0), M(new T.TorusGeometry(.04, .012, 4, 8, PI), m.rust, -.18, .015, .04, PI / 2, 0, PI / 2), M(B(.05, .008, .03), m.rust, .2, .012, 0, 0, .3, 0)) },
      spyglass: { tilt: .35, b: () => { const t2 = M(C(.025, .025, .1, 8), m.brass, .04, .036, 0, 0, 0, PI / 2), t3 = M(C(.02, .02, .06, 8), m.brass, .11, .036, 0, 0, 0, PI / 2); t2.name = 'tube2'; t3.name = 'tube3'; return G(M(C(.03, .03, .12, 8), m.leather, -.06, .036, 0, 0, 0, PI / 2), t2, t3, M(C(.036, .03, .02, 8), m.brass, -.12, .036, 0, 0, 0, PI / 2), M(C(.03, .03, .005, 8), m.gPale, -.131, .036, 0, 0, 0, PI / 2)); } },
      glasseye: { tilt: .1, b: () => G(M(new T.SphereGeometry(.055, 10, 8), m.white, 0, .055, 0), M(C(.026, .026, .01, 12), m.iris, 0, .055, .05, PI / 2, 0, 0), M(C(.012, .012, .012, 10), m.black, 0, .055, .056, PI / 2, 0, 0)) },
      passage: { tilt: 1.0, b: () => G(M(C(.075, .075, .014, 14), m.brass, 0, .007, 0), M(C(.06, .06, .004, 14), m.dark, 0, .016, 0), M(B(.04, .004, .05), m.brass, 0, .02, .01), M(C(.02, .02, .0045, 8), m.brass, 0, .02, -.015)) },
      armor: { tilt: .35, b: () => G(M(new T.CylinderGeometry(.11, .1, .17, 10, 1, true, -1.1, 2.2), m.metalD, 0, .085, 0), M(new T.CylinderGeometry(.113, .113, .02, 10, 1, true, -1.1, 2.2), m.brassD, 0, .165, 0), M(new T.CylinderGeometry(.103, .103, .02, 10, 1, true, -1.1, 2.2), m.brassD, 0, .008, 0), ...[[-.7, .13], [.7, .13], [-.7, .04], [.7, .04]].map(([a, y]) => M(new T.SphereGeometry(.009, 4, 3), m.brass, Math.sin(a) * .112, y, Math.cos(a) * .112)), M(B(.03, .2, .012), m.leather, -.105, .085, -.02, 0, -1.0, 0), M(B(.03, .2, .012), m.leather, .105, .085, -.02, 0, 1.0, 0)) },
      armor_broken: { tilt: .35, b: () => G(M(new T.CylinderGeometry(.11, .1, .17, 6, 1, true, -1.1, 1.0), m.rustD, -.01, .085, 0, 0, 0, .06), M(new T.CylinderGeometry(.11, .1, .12, 5, 1, true, .12, .98), m.rustD, .035, .05, .012, .1, 0, -.4), M(new T.CylinderGeometry(.113, .113, .02, 6, 1, true, -1.1, 1.0), m.brassD, -.01, .165, 0, 0, 0, .06), M(B(.03, .2, .012), m.leather, -.105, .085, -.02, 0, -1.0, 0), M(B(.014, .012, .012), m.metal, .05, .006, .1), M(B(.018, .01, .012), m.metal, .1, .006, .07)) },
      pocket: { tilt: .45, b: () => this.pocketTin(false) },
      safe: { tilt: .3, b: () => { const W2 = .2, H2 = .16, D2 = .16;
        const dial = G(M(C(.025, .025, .012, 12), m.brass, 0, 0, 0, PI / 2, 0, 0), M(B(.004, .01, .004), m.black, 0, .019, .007)); dial.name = 'dial'; dial.position.set(.08, .012, .01);
        const hd = M(B(.01, .04, .012), m.brass, .15, -.01, .013); hd.name = 'handle';
        const door = G(M(B(W2 - .004, H2 - .004, .014), m.metal, W2 / 2, 0, 0), dial, hd, M(B(.01, .03, .012), m.brass, .004, .045, 0), M(B(.01, .03, .012), m.brass, .004, -.045, 0)); door.name = 'door'; door.position.set(-W2 / 2, H2 / 2, D2 / 2 + .007);
        return G(M(B(W2, .015, D2), m.dark, 0, .0075, 0), M(B(W2, .015, D2), m.dark, 0, H2 - .0075, 0), M(B(.015, H2, D2), m.dark, -W2 / 2 + .0075, H2 / 2, 0), M(B(.015, H2, D2), m.dark, W2 / 2 - .0075, H2 / 2, 0), M(B(W2, H2, .015), m.dark, 0, H2 / 2, -D2 / 2 + .0075), M(B(W2 - .03, H2 - .03, .004), m.velvet, 0, H2 / 2, -D2 / 2 + .017), door, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => M(B(.02, .008, .02), m.brass, a * .085, -.004, b * .065))); } },
      pickpocket: { tilt: .9, b: () => G(M(C(.006, .006, .22, 5), m.metal, .03, .012, 0, 0, 0, PI / 2), M(new T.TorusGeometry(.025, .005, 4, 8, PI * 1.2), m.metal, .14, .012, -.025, PI / 2, 0, 0), M(C(.016, .014, .09, 7), m.leather, -.09, .014, 0, 0, 0, PI / 2), ...[-.12, -.09, -.06].map(x => M(C(.017, .017, .006, 7), m.brass, x, .014, 0, 0, 0, PI / 2))) },
      lockpick: { tilt: .8, b: () => G(M(B(.2, .012, .11), m.leather, 0, .006, 0), M(C(.022, .022, .11, 8), m.leather, .1, .022, 0, PI / 2, 0, 0), M(B(.012, .014, .115), m.bone, -.07, .013, 0), ...[[-.04, 0], [-.01, .12], [.02, -.1], [.05, .06]].map(([x, r], i) => { const g = G(M(B(.007, .006, .13), i % 2 ? m.silver : m.metal, 0, 0, -.07), M(new T.TorusGeometry(.009, .003, 3, 6), m.brass, 0, 0, 0, PI / 2, 0, 0)); g.position.set(x, .017, .04); g.rotation.y = r; g.name = 'pick' + i; return g; })) },
      handcuffs: { tilt: .9, b: () => { const cf = s => { const g = G(M(new T.TorusGeometry(.045, .01, 5, 12), m.metal, 0, 0, 0, PI / 2, 0, 0), M(B(.022, .026, .032), m.metal, s * .045, 0, 0), M(B(.012, .02, .014), m.dark, -s * .042, 0, 0)); g.position.set(s * .07, .012, 0); g.name = s < 0 ? 'cuffL' : 'cuffR'; return g; }; return G(cf(-1), cf(1), M(new T.TorusGeometry(.009, .003, 3, 6), m.metal, -.01, .012, 0), M(new T.TorusGeometry(.009, .003, 3, 6), m.metal, .01, .012, 0, 0, PI / 2, 0)); } },
      counterfeit: { tilt: 1.0, b: () => G(M(new T.CylinderGeometry(.07, .07, .014, 14, 1, false, 0, PI), m.brass, 0, .007, 0), M(new T.CylinderGeometry(.07, .07, .014, 14, 1, false, PI, PI), m.brassPale, .003, .008, 0), M(new T.CylinderGeometry(.071, .071, .004, 14), m.lead, 0, .007, 0), M(new T.TorusGeometry(.062, .004, 3, 14), m.brass, 0, .015, 0, PI / 2, 0, 0), M(B(.026, .006, .026), m.black, .014, .014, .006, 0, .35, 0)) },
      brassidol: { tilt: .15, b: () => { const body = M(new T.SphereGeometry(.05, 8, 6), m.brassW, 0, .08, 0); body.scale.set(1, 1.15, .85); return G(M(C(.05, .056, .025, 8), m.brassW, 0, .0125, 0), M(C(.04, .05, .015, 8), m.dark, 0, .032, 0), body, M(new T.SphereGeometry(.032, 8, 6), m.brassW, 0, .155, 0), M(new T.ConeGeometry(.012, .03, 4), m.brassW, -.022, .185, 0, 0, 0, .4), M(new T.ConeGeometry(.012, .03, 4), m.brassW, .022, .185, 0, 0, 0, -.4), M(B(.012, .006, .004), m.black, -.011, .158, .03), M(B(.012, .006, .004), m.black, .011, .158, .03), M(new T.TorusGeometry(.03, .007, 4, 10), m.brassW, 0, .08, .03), M(new T.OctahedronGeometry(.011, 0), m.red, 0, .1, .045)); } },
      redledger: { tilt: .9, b: () => G(M(B(.16, .012, .2), m.red, 0, .006, 0), M(B(.15, .03, .19), m.bone, .004, .027, 0), M(B(.16, .012, .2), m.red, 0, .048, 0), M(B(.014, .054, .2), m.spine, -.08, .027, 0), M(B(.166, .058, .025), m.leather, 0, .027, -.04), M(C(.024, .024, .008, 10), m.brass, .045, .056, .05), M(B(.03, .004, .006), m.black, .045, .061, .05)) },
      cloth: { tilt: .4, b: () => { const d = M(new T.SphereGeometry(.12, 8, 5, 0, PI * 2, 0, PI / 2), m.cloth, 0, 0, 0); d.scale.set(1.05, .55, .9); return G(d, ...[.3, 1.9, 3.5, 5.0].map(a => M(B(.07, .008, .07), m.cloth, Math.cos(a) * .12, .004, Math.sin(a) * .11, 0, a + PI / 4, 0)), M(B(.12, .004, .006), m.bone, 0, .066, .02, 0, .3, 0)); } },
      coin: { tilt: 1.0, b: () => this.coinMesh() },
      chest_std: { tilt: .35, b: () => this.chest(false, 'closed') }, chest_std_open: { tilt: .45, b: () => this.chest(false, 'open') }, chest_std_used: { tilt: .35, b: () => this.chest(false, 'used') },
      chest_black: { tilt: .35, b: () => this.chest(true, 'closed') }, chest_black_open: { tilt: .5, b: () => this.chest(true, 'open') }
    };
  }
  place(scene, id, x, z, ry = 0, s = 1.4, label) {
    const d = this.defs[id], o = d.b(), fl = d.flat || [0, 0, 0, 0];
    const p = this.G(o); o.rotation.set(fl[0], fl[1], fl[2]); o.position.y = fl[3];
    p.scale.setScalar(s); p.position.set(x, .962, z); p.rotation.y = ry;
    p.userData.label = label || ITEMS.find(i => i.id === id)?.name.toUpperCase() || id.toUpperCase();
    scene.add(p); this.pick.push(p); return p;
  }
  F(col, ds) { this._fc = this._fc || {}; const k = col + (ds ? 'd' : ''); return this._fc[k] || (this._fc[k] = new this.T.MeshPhongMaterial({ color: col, flatShading: true, shininess: 10, specular: 0x222222, side: ds ? this.T.DoubleSide : this.T.FrontSide })); }
  character(role, col, name, pose = 'seated') {
    const T = this.T, m = this.m, M = this.M.bind(this), F = this.F.bind(this), PI = Math.PI, st = pose === 'standing';
    const B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, s = 10) => new T.CylinderGeometry(a, b, h, s);
    const cap = (r, l, mat, x, y, z, rx = 0, ry = 0, rz = 0) => M(new T.CapsuleGeometry(r, l, 3, 8), mat, x, y, z, rx, ry, rz);
    const ell = (sx, sy, sz, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = M(new T.SphereGeometry(1, 12, 9), mat, x, y, z, rx, ry, rz); o.scale.set(sx, sy, sz); return o; };
    // Lathe around Y: pts = [[radius, worldY]], 'at' = centre angle of the arc (0 = front, PI = back).
    const lathe = (pts, mat, sz = .64, a = PI * 2, at = 0, seg = 16) => { const o = M(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg, at - a / 2, a), mat); o.scale.z = sz; return o; };
    const sph = (r, mat, x, y, z, d = 4) => M(new T.SphereGeometry(r, d + 2, d), mat, x, y, z);
    const tor = (r, t, mat, x, y, z, rx = 0, ry = 0, rz = 0, arc = PI * 2) => M(new T.TorusGeometry(r, t, 4, 12, arc), mat, x, y, z, rx, ry, rz);
    const glow = c => new T.MeshBasicMaterial({ color: c });
    const chain = (p, q, n, mat, s = .012, sag = 0) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return tor(s, s * .33, mat, p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - Math.sin(u * PI) * sag, p[2] + (q[2] - p[2]) * u, i % 2 ? PI / 2 : 0, 0, Math.atan2(q[1] - p[1], q[0] - p[0])); });
    const LOOK = {
      enforcer: [0x22262a, 0x8a7464, 0x1a1c1e], medic: [0x7e786a, 0x9a8676, 0x34322e], smuggler: [0x2c241e, 0x4e3e30, 0x221c18],
      locksmith: [0x3a3026, 0x8a7058, 0x2a221c], broker: [0x1e2026, 0x7a6656, 0x18191c], scavenger: [0x3c3a2a, 0x6a5444, 0x2e2a20],
      tallyman: [0x3a3226, 0x9a8270, 0x241e18], fence: [0x1a1412, 0x3a2c22, 0x120e0c], dealer: [0x17130f, 0x5e4c3e, 0x0f0c0a] }[role];
    const cl = F(LOOK[0]), sk = F(LOOK[1]), pa = F(LOOK[2]), bo = F(0x151210), dark = F(0x0a0806);
    const band = new T.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: .25 });
    const lea = F(0x3b2416), leaD = F(0x24160e), bone = F(0xd6c9ab), cloth = F(0xb8ae98), steel = m.metal, brass = m.brass, rust = m.rust, red = F(0x7c1f19);
    const steelD = new T.MeshPhongMaterial({ color: 0x7a776f, shininess: 70, specular: 0x77756e, side: T.DoubleSide, flatShading: true });
    const eyeGlow = glow(role === 'scavenger' ? 0x9fd860 : 0xe8dcc0);
    const slim = role === 'tallyman' || role === 'fence' ? .9 : role === 'enforcer' ? 1.1 : 1;
    const g = new T.Group(), up = new T.Group(), head = new T.Group();
    up.position.y = st ? .98 : .76; g.add(up); head.position.y = .8; up.add(head);
    const U = (...k) => k.flat().forEach(o => { o.position.y -= .76; up.add(o); });
    const Hd = (...k) => k.flat().forEach(o => { o.position.y -= 1.56; head.add(o); });
    const belt = (mat, y = .98, r = .27) => { const o = M(C(r * slim, r * slim * .99, .055, 14), mat, 0, y, 0); o.scale.z = .66; return o; };
    // ---- base body: one rounded lathe coat, sloped shoulders, seat-colour sash
    U(lathe([[0, .78], [.22, .8], [.27, .9], [.26, 1.05], [.29, 1.28], [.31, 1.4], [.27, 1.5], [.12, 1.56], [0, 1.57]].map(([r, y]) => [r * slim, y]), cl, .62, PI * 2, 0, 22),
      [-1, 1].map(s => ell(.11, .085, .115, cl, s * .3 * slim, 1.45, 0, 0, 0, -s * .25)), M(C(.055, .065, .1, 8), sk, 0, 1.56, 0));
    { const sash = M(C(.262 * slim, .268 * slim, .065, 14), band, 0, .9, 0); sash.scale.z = .66; U(sash); }
    if (st) { const lo = { enforcer: .26, broker: .3, fence: .2, smuggler: .34 }[role] ?? .44; U(lathe([[.27 * slim, .9], [.3 * slim, .7], [.34 * slim, lo + .02], [.335 * slim, lo]], cl, .7, PI * 2 - .55, PI)); }
    // ---- head: skull, jaw, recessed sockets with pin-prick glints, brow, nose, ears
    const faceParts = (o = {}) => {
      const p = [ell(.15, .172, .158, sk, 0, 1.735, 0), ell(.112, .075, .11, sk, 0, 1.648, .028)];
      if (!o.noEyes) p.push(...[-.058, .058].flatMap(x => [ell(.036, .024, .014, dark, x, 1.752, .14), sph(.0085, eyeGlow, x, 1.752, .151)]));
      if (!o.noNose) p.push(ell(.018, .036, .026, sk, 0, 1.712, .152, -.2));
      if (!o.noBrow) p.push(ell(.13, .026, .05, sk, 0, 1.788, .118));
      if (!o.noMouth) p.push(M(B(o.grin ? .1 : .055, .006, .006), dark, 0, 1.652, .137));
      if (!o.noEars) p.push(...[-1, 1].map(s => ell(.02, .038, .026, sk, s * .152, 1.735, 0)));
      return p;
    };
    const mkHand = (mat, o = {}) => {
      const h = new T.Group(), fl = o.long ? .085 : .045;
      h.add(ell(.048, .055, .032, mat, 0, -.005, 0));
      [-.027, -.009, .009, .027].forEach((x, i) => { const f = cap(.0105, fl - (i === 0 || i === 3 ? .012 : 0), o.fingers || mat, x, -.06 - fl / 2, .004, .25); h.add(f); if (o.rings && o.rings.includes(i)) h.add(tor(.014, .004, brass, x, -.072, .006, PI / 2)); });
      h.add(cap(.012, .03, o.fingers || mat, .045, -.025, .015, 0, 0, .7));
      return h;
    };
    const handMat = { medic: F(0xc8c0a8), enforcer: lea, smuggler: leaD, scavenger: F(0x4a3a2a) }[role] || sk;
    const arm = side => {
      const sh = new T.Group(); sh.position.set(side * .36 * slim, .68, 0); up.add(sh);
      sh.add(cap(.068, .28, cl, 0, -.2, 0));
      const el = new T.Group(); el.position.y = -.42; sh.add(el); el.add(cap(.06, .26, cl, 0, -.18, 0), M(C(.068, .064, .05, 10), cl, 0, -.33, 0));
      const hand = new T.Group(); hand.position.y = -.39; el.add(hand);
      hand.add(mkHand(handMat, { long: role === 'fence' || role === 'tallyman' || role === 'locksmith', rings: role === 'broker' ? [1, 3] : role === 'fence' ? (side < 0 ? [0, 1, 2] : [1, 2, 3]) : null, fingers: role === 'smuggler' ? F(0x6e5a48) : role === 'tallyman' ? F(0x2a2420) : null }));
      if (st) { sh.rotation.z = side * .1; return { sh, el, hand, bx: 0, be: -.15 }; }
      sh.rotation.z = -side * .12; return { sh, el, hand, bx: -.4, be: -1.1 };
    };
    const aL = arm(-1), aR = arm(1), P = { up, head, aL, aR, role, gx: 0 }; g.userData.P = P;
    // ---- legs, or a spindle-back chair when seated
    if (st) [-1, 1].forEach(sd => g.add(cap(.105, .3, pa, sd * .1, .7, 0, 0, 0, sd * .03), ell(.085, .075, .088, pa, sd * .107, .48, .01), cap(.082, .26, pa, sd * .112, .3, 0, 0, 0, sd * .02), M(C(.088, .094, .14, 10), bo, sd * .115, .12, 0), ell(.088, .062, .155, bo, sd * .115, .05, .05), M(B(.17, .02, .2), bo, sd * .115, .01, .03)));
    else { const w = m.wood; g.add(M(B(.62, .06, .58), w, 0, .5, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => M(C(.025, .022, .5, 6), w, a * .27, .25, b * .25)), ...[-.24, -.08, .08, .24].map(x => M(C(.018, .018, 1.05, 6), w, x, 1.06, -.32)), M(B(.66, .06, .07), w, 0, 1.62, -.32), M(B(.62, .05, .05), w, 0, .7, -.32),
      cap(.09, .3, pa, -.12, .58, .18, PI / 2), cap(.09, .3, pa, .12, .58, .18, PI / 2), cap(.075, .34, pa, -.12, .3, .35), cap(.075, .34, pa, .12, .3, .35), ell(.07, .05, .13, bo, -.12, .04, .4), ell(.07, .05, .13, bo, .12, .04, .4)); }
    const plate = (txt, w, h, x, y, z) => M(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ map: this.tex(32, 16, (c, cw, ch) => { c.fillStyle = '#c8bb9c'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#1a1410'; c.font = 'bold 11px monospace'; c.fillText(txt, 3, 12); }) }), x, y, z);

    if (role === 'dealer') {     // THE DEALER (tutorial): dark worn suit, low brim that keeps the face in shadow, sleeve garters, a brass nameplate
      const hat = F(0x0e0c0a), shirt = F(0x6e6656), tie = F(0x3a1610), vest = F(0x231c16), gar = new T.MeshPhongMaterial({ color: 0x8a6a30, shininess: 50, specular: 0x6a5a40, flatShading: true });
      const brim = M(C(.255, .265, .014, 18), hat, 0, 1.872, .02, .1, 0, 0); brim.scale.z = .92;
      Hd(faceParts({ noMouth: true, noBrow: true }), brim, M(C(.135, .152, .13, 14), hat, 0, 1.94, 0, .06), M(C(.154, .154, .026, 14), F(0x2a1810), 0, 1.888, 0, .08),
        ell(.13, .04, .06, F(0x0a0806), 0, 1.79, .1), M(B(.05, .006, .006), dark, 0, 1.655, .138));
      U([-1, 1].map(s => M(B(.04, .16, .012), shirt, s * .028, 1.4, .19, -.12, 0, s * .32)), [-1, 1].map(s => M(B(.06, .04, .012), shirt, s * .05, 1.47, .178, -.3, 0, s * .45)),
        M(B(.038, .26, .012), tie, 0, 1.3, .2), M(B(.05, .04, .016), tie, 0, 1.44, .19),
        [-1, 1].map(s => M(B(.13, .36, .02), vest, s * .1, 1.24, .185, 0, s * -.32, s * .1)), [1.32, 1.24, 1.16].map(y => sph(.009, brass, .012, y, .205)),
        M(B(.07, .006, .03), shirt, -.16, 1.36, .19, 0, 0, .1), chain([-.06, 1.2, .2], [-.18, 1.22, .19], 6, brass, .007, .02));
      [aL, aR].forEach(a => { a.el.add(tor(.072, .011, gar, 0, -.06, 0, PI / 2)); a.hand.add(tor(.05, .013, shirt, 0, .03, 0, PI / 2)); });
      if (st) { aR.bx = -.25; aR.be = -1.2; const cd = M(B(.06, .085, .003), F(0xb48a40), 0, -.07, .05, .2); aR.hand.add(cd); }
      else {
        const np = new T.Group(), tx = this.tex(96, 20, (c, w, h) => { c.fillStyle = '#7a5a26'; c.fillRect(0, 0, w, h); c.fillStyle = '#a8843c'; c.fillRect(1, 1, w - 2, h - 2); c.fillStyle = '#5a3e18'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1); c.fillStyle = '#24160a'; c.font = '14px VT323, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('THE DEALER', w / 2, h / 2 + 1); });
        tx.magFilter = T.NearestFilter;
        np.add(M(B(.3, .056, .05), F(0x3a2614), 0, .028, 0), M(new T.PlaneGeometry(.28, .052), new T.MeshLambertMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: .18 }), 0, .03, .0255));
        np.children[1].rotation.x = -.35; np.position.set(0, .962, .9); g.add(np);
        const dk = this.G(...Array.from({ length: 8 }, (_, i) => M(B(.07, .0025, .1), i % 2 ? F(0x8a6a30) : F(0x5a3e18), 0, i * .0025, 0)));
        dk.position.set(.2, .962, .74); dk.rotation.y = .3; g.add(dk);
      }
      P.dealer = true;
    }
    if (role === 'enforcer') {   // the debt collector: iron jaw cage, eyepatch, stitched brow, chain and truncheon
      Hd(faceParts({ noMouth: true }),
        M(new T.CylinderGeometry(.122, .118, .1, 12, 1, true, -1.2, 2.4), steelD, 0, 1.645, .02), [-.9, -.45, 0, .45, .9].map(a => M(B(.009, .1, .01), steel, Math.sin(a) * .123, 1.645, .02 + Math.cos(a) * .123, 0, a, 0)), [-1.1, 1.1].map(a => sph(.012, brass, Math.sin(a) * .125, 1.68, .02 + Math.cos(a) * .125)),
        ell(.04, .032, .014, F(0x111111), .058, 1.752, .153), tor(.157, .005, F(0x111111), 0, 1.765, 0, PI / 2 - .22, 0, 0), [0, 1, 2].map(i => M(B(.024, .005, .005), bone, -.09 + i * .014, 1.808 - i * .012, .128, 0, 0, .9)),
        ell(.165, .05, .172, F(0x1a1c1e), 0, 1.862, -.004), ell(.12, .012, .085, F(0x1a1c1e), 0, 1.843, .15), M(C(.025, .025, .012, 8), F(0x1a1c1e), 0, 1.9, 0));
      U(lathe([[.2, 1.47], [.215, 1.57], [.225, 1.62]], cl, .8, PI * 1.3, PI), chain([-.28, 1.45, .175], [.21, 1.0, .2], 13, steel, .016, .04), belt(leaD), M(B(.06, .05, .02), brass, 0, .98, .185),
        ell(.05, .1, .05, lea, .3, .86, .12), M(B(.035, .07, .03), m.wood, .3, .97, .12, 0, 0, .2), M(C(.022, .026, .36, 6), m.wood, -.31, .84, .1, 0, 0, .12), tor(.03, .006, steel, -.31, .97, .1, PI / 2), plate('No7', .07, .035, -.13, 1.32, .207));
      aL.sh.add(ell(.13, .085, .14, steel, 0, .02, 0, 0, 0, .25), ell(.11, .06, .12, steel, -.02, -.05, 0, 0, 0, .45), ...[-.05, 0, .05].map(z => sph(.012, brass, -.05, .085, z)));
      aR.hand.add(...[-.027, -.009, .009, .027].map(x => tor(.014, .005, brass, x, -.06, .006, PI / 2)), M(B(.075, .012, .012), brass, 0, -.045, .024));
      if (st) { aL.be = -.1; aR.be = -.1; }
    }
    if (role === 'medic') {      // the plague nurse: wimple, smoked goggles, gauze mask, stained apron, vials, rubber gloves
      const lens = new T.MeshPhongMaterial({ color: 0x1e2a1a, shininess: 120, specular: 0xb0c0a0, emissive: 0x0c1408 });
      const syr = () => this.G(M(C(.009, .009, .08, 6), m.gPale, 0, 0, 0), M(C(.005, .005, .03, 6), m.red, 0, -.01, 0), M(C(.002, .002, .045, 4), m.silver, 0, -.062, 0), M(C(.014, .014, .006, 6), m.metal, 0, .043, 0), M(C(.003, .003, .03, 4), m.metal, 0, .06, 0));
      const ear = syr(); ear.position.set(.155, 1.8, -.03); ear.rotation.set(0, 0, -1.25);
      Hd(faceParts({ noMouth: true, noNose: true }), ell(.17, .13, .172, cloth, 0, 1.8, -.005), lathe([[.165, 1.82], [.185, 1.7], [.205, 1.56], [.23, 1.48]], cloth, 1, PI * 1.35, PI), M(B(.012, .042, .006), m.red, 0, 1.845, .163), M(B(.04, .012, .006), m.red, 0, 1.845, .163),
        [-.06, .06].flatMap(x => [M(C(.036, .036, .03, 10), brass, x, 1.755, .152, PI / 2, 0, 0), M(C(.03, .03, .006, 10), lens, x, 1.755, .168, PI / 2, 0, 0), sph(.006, glow(0xd8e8c0), x + .012, 1.766, .173)]), tor(.162, .006, leaD, 0, 1.755, 0, PI / 2, 0, 0),
        ell(.12, .07, .085, bone, 0, 1.66, .075), [1.64, 1.67].map(y => M(B(.09, .004, .004), F(0x8a7a60), 0, y, .158)), ear);
      U(lathe([[.24, .82], [.285, 1.0], [.3, 1.2], [.27, 1.3], [.2, 1.36]], cloth, .68, 1.3, 0), [-1, 1].map(s => M(B(.02, .2, .006), cloth, s * .1, 1.45, .19, 0, 0, s * .25)), [[-.08, 1.12], [.1, .97], [.03, 1.31], [-.12, .9]].map(([x, y]) => ell(.042, .03, .01, F(0x4a1a12), x, y, .208)),
        M(B(.045, .55, .02), lea, 0, 1.1, .215, 0, 0, -.7), [[-.13, 1.25, m.gPale], [-.06, 1.17, m.gAmb], [.01, 1.09, m.gGreen], [.08, 1.01, m.gPale], [.15, .93, m.gAmb]].map(([x, y, mt]) => M(C(.02, .02, .07, 6), mt, x, y, .235)),
        M(B(.14, .11, .06), lea, .27, .9, .13, 0, -.4, 0), M(B(.012, .05, .004), m.red, .285, .91, .163, 0, -.4, 0), M(B(.05, .012, .004), m.red, .285, .91, .163, 0, -.4, 0), belt(leaD));
      [aL, aR].forEach(a => a.el.add(cap(.066, .12, F(0xc8c0a8), 0, -.3, 0)));
      aL.el.add(...[-.12, -.17, -.22].map(y => tor(.062, .01, bone, 0, y, 0, PI / 2)));
      if (st) { aR.bx = -.35; aR.be = -1.7; const v = syr(); v.scale.setScalar(1.5); v.rotation.x = 2.05; v.position.set(0, -.05, .07); aR.hand.add(v); }
    }
    if (role === 'smuggler') {   // the ferryman: deep hood, wrapped scarf, coin string, rope, a lantern at the hip
      const hm = F(0x2f2620, true), sc = F(0x4a1c16);
      Hd(faceParts({ noMouth: true, noNose: true }), M(new T.SphereGeometry(.21, 12, 9, PI / 2 + .85, PI * 2 - 1.7), hm, 0, 1.75, -.02), M(new T.ConeGeometry(.09, .22, 7), hm, 0, 1.95, -.11, -.6, 0, 0),
        ell(.135, .072, .125, sc, 0, 1.655, .04), tor(.13, .03, sc, 0, 1.6, 0, PI / 2), [-1, 1].map(s => M(B(.03, .004, .004), F(0x2a0e0a), s * .04, 1.68, .162)));
      U(lathe([[.2, 1.58], [.3, 1.5], [.36, 1.3], [.38, 1.0], [.4, .78]], F(0x3a2e24, true), .7, 2.4, -1.9), M(B(.06, .24, .02), sc, .1, 1.42, .2, 0, 0, .15),
        M(B(.06, .55, .02), lea, 0, 1.12, .205, 0, 0, .7), belt(leaD), [-.15, .13].map(x => ell(.05, .06, .035, lea, x, .97, .19)),
        Array.from({ length: 7 }, (_, i) => M(C(.014, .014, .004, 8), brass, -.12 + i * .04, 1.47 - Math.sin(i / 6 * PI) * .08, .2, PI / 2, 0, 0)),
        [0, 1, 2].map(i => tor(.09 - i * .006, .014, F(0x6a5a3a), .31, .98 - i * .015, .05, 0, PI / 2 - .3, 0)));
      const lan = this.G(M(B(.07, .012, .07), dark, 0, -.03, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => M(B(.006, .1, .006), dark, a * .03, -.08, b * .03)), M(B(.07, .012, .07), dark, 0, -.13, 0), sph(.024, glow(0xffb050), 0, -.08, 0, 6), tor(.015, .004, dark, 0, -.008, 0));
      lan.position.set(-.33, .22, .1); up.add(lan); P.lantern = lan;
    }
    if (role === 'locksmith') {  // the tinker: leather skullcap, swing-down loupe with a magnified eye, padlock on a chain, key ring
      Hd(faceParts({}), ell(.168, .085, .17, lea, 0, 1.865, -.005), tor(.156, .008, brass, 0, 1.79, 0, PI / 2 - .1, 0, 0), M(C(.02, .02, .03, 8), brass, .15, 1.8, .05, 0, 0, PI / 2));
      const loupe = new T.Group(); loupe.position.set(.13, .2, .08); head.add(loupe);
      loupe.add(M(B(.01, .012, .09), brass, -.01, -.02, .02, .5, 0, 0), M(C(.036, .03, .05, 10), brass, -.072, -.008, .085, PI / 2, 0, 0), M(C(.03, .03, .004, 10), glow(0x3a2a14), -.072, -.008, .111, PI / 2, 0, 0), sph(.014, eyeGlow, -.072, -.008, .113, 6), M(C(.022, .02, .03, 8), brass, -.035, .03, .07, PI / 2, 0, 0));
      P.loupe = loupe;
      U(lathe([[.24, .82], [.285, 1.0], [.305, 1.22], [.31, 1.3]], lea, .66, 1.7, 0), M(B(.34, .09, .02), F(0x2c1a10), 0, 1.12, .215),
        [-.12, -.06, -.01, .05, .1].map((x, i) => M(C(.006, .006, .15, 4), i % 2 ? steel : brass, x, 1.18, .22, 0, 0, (i - 2) * .06)),
        chain([-.1, 1.52, .17], [0, 1.33, .215], 6, brass, .009), chain([.1, 1.52, .17], [0, 1.33, .215], 6, brass, .009), M(B(.055, .048, .022), brass, 0, 1.29, .22), tor(.017, .005, steel, 0, 1.32, .22, 0, 0, 0, PI), M(B(.008, .014, .004), dark, 0, 1.285, .232), belt(leaD));
      [aL, aR].forEach(a => a.sh.add(tor(.072, .012, red, 0, -.17, 0, PI / 2)));
      const ring = this.G(tor(.06, .008, brass, 0, 0, 0), ...[-.045, -.022, 0, .022, .045].map((x, i) => this.G(M(B(.012, .07 + (i % 2) * .02, .005), i === 2 ? steel : brass, x, -.08, 0), M(C(.012, .012, .005, 8), brass, x, -.04, 0, PI / 2, 0, 0))));
      ring.position.set(-.26, .14, .19); up.add(ring); P.ring = ring;
      if (st) { P.ux = .08; aR.bx = -.5; aR.be = -1.6; const k = this.defs.key.b(); k.scale.setScalar(1.6); k.rotation.x = 2.1 + PI / 2; k.position.set(0, -.05, .06); aR.hand.add(k); }
    }
    if (role === 'broker') {     // the ledger-keeper: porcelain mask with a painted smile, top hat, monocle, watch chain, dead rose
      const por = new T.MeshPhongMaterial({ color: 0xe6e1d6, shininess: 80, specular: 0x9a958c, flatShading: true }), hat = F(0x121214);
      Hd(faceParts({ noMouth: true, noNose: true, noBrow: true, noEyes: true }), ell(.15, .1, .1, F(0x1a1614), 0, 1.72, -.08), ell(.142, .165, .07, por, 0, 1.72, .1),
        [-.055, .055].flatMap(x => [ell(.03, .018, .01, dark, x, 1.752, .163), sph(.008, eyeGlow, x, 1.752, .168)]),
        Array.from({ length: 9 }, (_, i) => { const a = -.9 + i * .225; return M(B(.017, .005, .004), red, Math.sin(a) * .066, 1.66 + (1 - Math.cos(a)) * .05, .166, 0, 0, a * .7); }),
        [-1, 1].map(s => ell(.02, .012, .004, F(0xa04a40), s * .08, 1.69, .159)), M(B(.006, .018, .004), dark, -.055, 1.722, .168),
        tor(.034, .004, brass, .055, 1.752, .172), chain([.088, 1.75, .17], [.13, 1.6, .1], 6, brass, .006),
        M(C(.13, .14, .2, 14), hat, 0, 1.97, -.01), M(C(.22, .22, .012, 16), hat, 0, 1.87, -.01), M(C(.142, .142, .035, 14), red, 0, 1.89, -.01));
      U(lathe([[.26, .9], [.27, 1.05], [.3, 1.28], [.315, 1.4]], F(0x6e6656), .66, 1.1, 0), [1.25, 1.12, .99].map(y => sph(.013, brass, 0, y, .208)), M(B(.05, .22, .02), red, 0, 1.38, .215), M(C(.15, .16, .08, 10), bone, 0, 1.52, 0),
        chain([-.1, 1.12, .205], [.12, 1.1, .205], 9, brass, .006, .05), ell(.026, .026, .016, F(0x4a1010), -.17, 1.38, .2), ell(.025, .008, .012, F(0x2a3020), -.15, 1.35, .205, 0, 0, -.6));
      const watch = this.G(M(C(.006, .006, .05, 4), brass, 0, -.025, 0), M(C(.03, .03, .01, 12), brass, 0, -.06, 0, PI / 2, 0, 0), M(C(.024, .024, .003, 12), bone, 0, -.06, .006, PI / 2, 0, 0));
      watch.position.set(.13, .34, .2); up.add(watch); P.watch = watch;
      const led = this.G(M(B(.2, .28, .05), red, 0, 0, 0), M(B(.05, .03, .052), brass, 0, -.14, 0), M(B(.19, .27, .004), bone, 0, 0, .027));
      if (st) { aR.bx = -.25; aR.be = -1.3; aL.bx = -.2; aL.be = -1.0; led.position.set(-.06, -.1, .04); aR.hand.add(led); }
      else { led.rotation.x = -PI / 2; led.position.set(0, .995, .66); g.add(led); }
    }
    if (role === 'scavenger') {  // the rag picker: gas mask with green lenses and side canisters, corrugated hose, junk on a pack frame
      const mk = F(0x2b2826), rag = F(0x4a3a2a);
      Hd(faceParts({ noMouth: true, noNose: true, noEyes: true, noBrow: true }), ell(.13, .12, .09, mk, 0, 1.7, .08),
        [-.06, .06].flatMap(x => [M(C(.04, .04, .03, 10), m.dark, x, 1.75, .152, PI / 2, 0, 0), M(C(.032, .032, .006, 10), glow(0x3e6a22), x, 1.75, .17, PI / 2, 0, 0), sph(.006, glow(0xc8f0a0), x + .012, 1.762, .175)]),
        M(C(.032, .045, .06, 8), mk, 0, 1.64, .17, PI / 2 - .4, 0, 0), [-1, 1].flatMap(s => [M(C(.036, .036, .08, 8), rust, s * .1, 1.63, .13, 0, 0, s * 1.15), tor(.036, .006, F(0x5a6a3a), s * .135, 1.615, .13, 0, PI / 2, s * 1.15)]),
        ell(.178, .135, .178, rag, 0, 1.8, -.012), lathe([[.17, 1.78], [.2, 1.62], [.23, 1.5]], rag, 1, PI * 1.5, PI), tor(.16, .02, F(0x3a2a1c), 0, 1.79, 0, PI / 2));
      U(Array.from({ length: 8 }, (_, i) => { const u = i / 7; return tor(.022, .008, m.dark, u * .12, 1.6 - u * .26, .19 + u * .02, PI / 2, 0, 0); }),
        M(B(.13, .11, .02), F(0x5a4030), -.13, 1.25, .2), M(B(.1, .13, .02), F(0x3a4a5a), .14, 1.05, .19), M(B(.11, .08, .02), F(0x6a5a3a), .05, 1.38, .205), M(B(.09, .09, .02), F(0x4a2a2a), -.1, .98, .185),
        [[-.13, 1.25], [.14, 1.05]].flatMap(([x, y]) => [0, 1, 2].map(i => M(B(.016, .004, .004), bone, x - .05 + i * .05, y + .056, .212))),
        belt(leaD), [-.2, -.05, .1].map(x => tor(.022, .005, steel, x, .93, .19, 0, 0, 0, PI * 1.4)), this.G(M(C(.035, .03, .05, 8), steel, .3, .86, .14), tor(.015, .004, steel, .34, .87, .14, 0, PI / 2, 0)),
        M(C(.02, .02, .9, 4), rust, -.24, 1.5, -.22), M(C(.02, .02, .9, 4), rust, .24, 1.5, -.22), M(C(.02, .02, .5, 4), rust, 0, 1.85, -.22, 0, 0, PI / 2), M(C(.02, .02, .5, 4), rust, 0, 1.3, -.22, 0, 0, PI / 2),
        M(C(.09, .09, .015, 10), m.dark, .02, 1.62, -.31, PI / 2, 0, 0), M(B(.022, .16, .012), m.dark, .02, 1.8, -.31), M(C(.026, .03, .13, 6), m.gGreen, -.17, 1.74, -.28), tor(.1, .025, F(0x7a6a4a), .3, 1.92, -.22), M(B(.22, .14, .2), F(0x4a3e2c), 0, 1.45, -.33));
      if (st) { P.ux = .12; aL.be = -.3; aR.be = -.3; }
    }
    if (role === 'tallyman') {   // the shopkeeper: green visor, spectacles, a too-wide grin, measuring tape, ink-black fingertips
      const vis = new T.MeshPhongMaterial({ color: 0x3a8a4a, transparent: true, opacity: .7, side: T.DoubleSide, emissive: 0x0a2010 }), lensM = new T.MeshPhongMaterial({ color: 0xd8e0d0, transparent: true, opacity: .35, shininess: 120, specular: 0xffffff });
      const tape = M(new T.PlaneGeometry(.03, .5), new T.MeshLambertMaterial({ map: this.tex(8, 64, (c, w, h) => { c.fillStyle = '#c8b060'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2010'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, y % 16 ? 3 : 6, 1); }), side: T.DoubleSide }), 0, 0, 0);
      Hd(faceParts({ grin: true }), M(C(.165, .17, .05, 12), F(0x2a2018), 0, 1.85, 0), M(new T.CylinderGeometry(.24, .24, .01, 14, 1, false, -1.1, 2.2), vis, 0, 1.83, .04),
        [-.06, .06].flatMap(x => [tor(.03, .004, brass, x, 1.752, .158), M(C(.026, .026, .003, 10), lensM, x, 1.752, .16, PI / 2, 0, 0)]), M(B(.04, .004, .004), brass, 0, 1.755, .158),
        [-1, 1].map(s => ell(.035, .008, .012, F(0x2a2018), s * .03, 1.676, .15, 0, 0, -s * .25)), Array.from({ length: 7 }, (_, i) => M(B(.009, .011, .004), bone, -.039 + i * .013, 1.645, .141)),
        M(C(.005, .005, .12, 6), F(0xc8a050), .16, 1.79, .02, 0, 0, 1.2));
      const t1 = tape.clone(), t2 = tape; t1.position.set(-.1, 1.28, .208); t1.rotation.z = .05; t2.position.set(.1, 1.28, .208); t2.rotation.z = -.05;
      U(lathe([[.2, 1.0], [.26, 1.2], [.29, 1.4]], bone, .67, .7, 0), [-1, 1].map(s => lathe([[.27, .95], [.275, 1.05], [.3, 1.28], [.32, 1.4]], F(0x4a3c2c), .66, .7, s * .6)), t1, t2,
        lathe([[.25, .7], [.28, .85], [.29, 1.0]], cloth, .7, 1.8, 0), M(B(.12, .07, .01), F(0x9a907a), .08, .9, .205), sph(.016, brass, .07, .93, .21), [1.2, 1.1, 1.0].map(y => sph(.01, brass, 0, y, .2)));
      [aL, aR].forEach(a => a.sh.add(tor(.072, .013, red, 0, -.16, 0, PI / 2)));
      aR.hand.add(M(C(.005, .005, .12, 6), F(0xc8a050), 0, -.06, .03, PI / 2, 0, 0));
      g.scale.set(.94, 1.06, .94); aL.bx = aR.bx = -.6; aL.be = aR.be = -.55;
    }
    if (role === 'fence') {      // the fence: a hood with nothing in it but two embers and a gold tooth; the coat is lined with stolen things
      const hm = F(0x1e1816, true), vel = F(0x4a1210, true), eyeM = glow(0xe0a040);
      Hd(faceParts({ noNose: true, noBrow: true, noMouth: true, noEars: true, noEyes: true }), M(new T.SphereGeometry(.225, 12, 9, PI / 2 + .75, PI * 2 - 1.5), hm, 0, 1.76, -.01), M(new T.ConeGeometry(.1, .28, 7), hm, 0, 1.99, -.12, -.55, 0, 0),
        ell(.14, .16, .04, F(0x050404), 0, 1.71, .12), [-1, 1].map(s => ell(.014, .007, .006, eyeM, s * .05, 1.75, .162, 0, 0, s * .3)), M(B(.06, .004, .003), F(0x3a3020), 0, 1.645, .155), sph(.006, glow(0xffd070), .018, 1.645, .158));
      P.eyeMat = eyeM;
      U(lathe([[.3, .3], [.34, .6], [.3, .9], [.31, 1.28], [.34, 1.42]], F(0x1e1816, true), .72, PI * 2 - .9, PI), ell(.32, .12, .22, F(0x2a2220), 0, 1.5, 0), M(B(.05, .3, .02), F(0x5a1a14), .1, 1.25, .21),
        [-1, 1].map(s => M(B(.13, .7, .01), vel, s * .17, 1.05, .19, 0, -s * .35, 0)));
      P.trinkets = [];
      [-1, 1].forEach(s => [[.95, 0], [1.08, 1], [1.21, 2], [1.34, 3]].forEach(([y, i]) => { const tr = i % 2 ? this.G(M(C(.002, .002, .05, 3), brass, 0, -.02, 0), M(C(.022, .022, .008, 10), brass, 0, -.05, 0, PI / 2, 0, 0)) : this.G(M(C(.002, .002, .04, 3), steel, 0, -.015, 0), M(B(.012, .05, .004), i ? steel : brass, 0, -.05, 0), tor(.01, .003, brass, 0, -.022, 0));
        tr.position.set(s * (.13 + (i % 2) * .05), y - .76, .2 + (i % 2) * .01); up.add(tr); P.trinkets.push(tr); }));
      P.ux = .28; aL.bx = aR.bx = -.8; aL.be = aR.be = -.5;
    }
    g.userData.label = name; return g;
  }
  outline(obj, on = true, color = 0xe0a040, sc = 1.06) {
    const T = this.T;
    if (!obj.userData.hull) {
      const hull = new T.Group(), mat = new T.MeshBasicMaterial({ color, side: T.BackSide, transparent: true, opacity: .9 });
      obj.updateMatrixWorld(true); const inv = new T.Matrix4().copy(obj.matrixWorld).invert();
      obj.traverse(o => { if (o.isMesh && !o.userData.noHull) { const h = new T.Mesh(o.geometry, mat); h.userData.noHull = true; h.matrixAutoUpdate = false; h.matrix.copy(inv).multiply(o.matrixWorld).multiply(new T.Matrix4().makeScale(sc, sc, sc)); hull.add(h); } });
      obj.add(hull); obj.userData.hull = hull;
    }
    obj.userData.hull.children.forEach(h => h.material.color.setHex(color)); obj.userData.hull.visible = on;
  }
  downPose(g, f, t = 0) {
    const P = g.userData.P; if (!P || f <= 0) return; const L = (a, b) => a + (b - a) * f; P.y0 = P.y0 ?? P.up.position.y;
    P.up.rotation.x = L(P.up.rotation.x, .6 + Math.sin(t * 1.1) * .012); P.up.rotation.z = L(P.up.rotation.z, .05); P.up.position.y = P.y0 - .05 * f; P.up.scale.y = L(P.up.scale.y, .975);
    P.head.rotation.x = L(P.head.rotation.x, .62); P.head.rotation.y = L(P.head.rotation.y, .14); P.head.rotation.z = L(P.head.rotation.z, .1);
    [P.aL, P.aR].forEach((a, i) => { a.sh.rotation.x = L(a.sh.rotation.x, -.78); a.el.rotation.x = L(a.el.rotation.x, -.62); a.sh.rotation.z = L(a.sh.rotation.z, (i ? -1 : 1) * .05); });
  }
  downedAt(g, u, t = 0) {
    const P = g.userData.P; if (!P) return 0; const cl = x => Math.max(0, Math.min(1, x));
    const s = cl((u - .2) / 1.0), f = 1 - Math.pow(1 - s, 3); this.downPose(g, f, t);
    const jolt = u < .25 ? Math.sin(u / .25 * Math.PI) : 0; P.up.rotation.x -= .16 * jolt; P.head.rotation.x -= .3 * jolt;
    if (u > 1.2 && u < 1.5) P.up.rotation.x += Math.sin((u - 1.2) / .3 * Math.PI) * .035;
    return f;
  }
  playerChair() {
    const T = this.T, m = this.m, M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, s = 6) => new T.CylinderGeometry(a, b, h, s), g = new T.Group();
    g.add(M(B(.54, .05, .5), m.wood, 0, .66, 0), M(B(.5, .012, .46), m.dark, 0, .692, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(M(C(.024, .019, .66), m.wood, a * .23, .33, b * .21)));
    [-1, 1].forEach(a => g.add(M(C(.024, .024, .66), m.wood, a * .24, .99, .23), M(B(.46, .02, .02), m.wood, 0, .2, a * .21)));
    g.add(M(B(.58, .075, .05), m.wood, 0, 1.3, .23), M(B(.5, .04, .04), m.wood, 0, .86, .23));
    [-.15, -.05, .05, .15].forEach(x => g.add(M(C(.011, .011, .42, 5), m.wood, x, 1.08, .23)));
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.userData.label = 'YOUR CHAIR'; return g;
  }
  fpLegs() {
    const T = this.T, F = this.F.bind(this), M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), tr = F(0x2a241e), bt = F(0x17120e), g = new T.Group();
    [-1, 1].forEach(s => g.add(M(B(.15, .14, .46), tr, s * .13, .76, -.2), M(B(.13, .5, .14), tr, s * .14, .45, -.42), M(B(.14, .1, .24), bt, s * .145, .05, -.48)));
    return g;
  }
  fpHands() {
    const T = this.T, F = this.F.bind(this), M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), gl = F(0x3a2c20), sl = F(0x2a241e), g = new T.Group();
    [-1, 1].forEach(s => { const h = new T.Group(); h.add(M(B(.085, .05, .11), gl, 0, 0, 0), M(B(.085, .035, .05), gl, 0, -.03, -.07), M(B(.1, .1, .18), sl, 0, .03, .14)); h.position.set(s * .2, 0, 0); h.rotation.z = -s * .2; g.add(h); });
    return g;
  }
  idle(g, t, ph, st) {
    const P = g.userData.P; if (!P) return; const r = P.role, s = Math.sin;
    P.up.scale.y = 1 + s(t * 1.6 + ph) * .012;
    P.head.rotation.set(s(t * .9 + ph) * .04, s(t * .5 + ph) * (st ? .25 : .18), 0);
    P.up.rotation.set(P.ux || 0, 0, s(t * .7 + ph) * .02);
    const sw = st ? s(t * 1.6 + ph) * .04 : 0;
    P.aL.sh.rotation.x = P.aL.bx + sw; P.aR.sh.rotation.x = P.aR.bx - sw; P.aL.el.rotation.x = P.aL.be; P.aR.el.rotation.x = P.aR.be;
    // accessories move whether seated or standing
    if (P.lantern) { P.lantern.rotation.z = s(t * 1.7 + ph) * .14; P.lantern.rotation.x = s(t * 1.3 + ph) * .08; }
    if (P.watch) P.watch.rotation.z = s(t * 2.2 + ph) * .25;
    if (P.trinkets) P.trinkets.forEach((o, i) => { o.rotation.z = s(t * 1.9 + i * 1.3) * .12; });
    if (P.loupe) { const k = (t * .12 + ph * .1) % 1, e = x => x * x * (3 - 2 * x), q = k < .45 ? 0 : k < .5 ? e((k - .45) / .05) : k < .9 ? 1 : 1 - e((k - .9) / .1); P.loupe.rotation.x = -q * .95; }
    if (P.eyeMat) { const f = Math.max(.15, .78 + .22 * s(t * 3.1 + ph) - (Math.floor(t * 7) % 23 === 0 ? .7 : 0)); P.eyeMat.color.setRGB(.88 * f, .63 * f, .25 * f); }
    if (r === 'dealer') { P.head.rotation.y = s(t * .21 + ph) * .1; P.head.rotation.x = .07 + s(t * .13) * .02; P.up.rotation.z = s(t * .17 + ph) * .008; }
    if (r === 'scavenger') P.head.rotation.z = [0, .22, 0, -.14][Math.floor(t * .7 + ph) % 4];
    if (P.threat) { P.aR.sh.rotation.x = -1.4 + s(t * 2 + ph) * .03; P.aR.sh.rotation.z = .12; P.aR.el.rotation.x = -.08 + s(t * 3) * .02; P.head.rotation.x = .12; P.up.rotation.x = (P.ux || 0) + .08; }
    if (!st) return;
    if (r === 'enforcer') { P.head.rotation.z = Math.pow(Math.max(0, s(t * .8 + ph)), 8) * .35; P.up.rotation.x = Math.pow(Math.max(0, s(t * .8 + ph + 2)), 6) * .06; P.aR.hand.rotation.x = Math.max(0, s(t * 1.1 + ph)) * .35; }
    if (r === 'medic') { P.aR.hand.rotation.z = s(t * 9) * .35 * (s(t * .7 + ph) > .3 ? 1 : 0); P.head.rotation.x = -.05; }
    if (r === 'smuggler') { g.position.x = P.gx + s(t * .6 + ph) * .04; P.up.rotation.z = s(t * .6 + ph) * .05; P.head.rotation.y = s(t * .4 + ph) * .7; }
    if (r === 'locksmith') { P.ring.rotation.z = s(t * 3 + ph) * .4; P.head.rotation.x = .18 + s(t * .6) * .04; P.aR.hand.rotation.y = s(t * 1.3) * .6; }
    if (r === 'broker') { P.aR.el.rotation.x = P.aR.be + s(t * .8 + ph) * .08; P.head.rotation.x = .2; P.head.rotation.z = s(t * .35 + ph) * .1; P.aL.el.rotation.x = P.aL.be + Math.max(0, s(t * 2.4)) * .2; }
    if (r === 'tallyman') { P.aR.hand.rotation.x = Math.max(0, s(t * 9)) * .4 * (s(t * .5 + ph) > .2 ? 1 : 0); P.head.rotation.y = s(t * .4 + ph) * .3; P.head.rotation.x = .08; P.head.rotation.z = s(t * .27) * .12; }
    if (r === 'fence') { P.head.rotation.y = s(t * .3 + ph) * .2; P.head.rotation.z = s(t * .5) * .06; P.up.rotation.x = (P.ux || 0) + s(t * .8) * .02; }
    if (r === 'scavenger') { P.head.rotation.y = s(t * .5 + ph) * .55 + s(t * 2.3) * .05; P.head.rotation.x = .05; }
  }
  display(hp, coins, col) {
    const T = this.T, t = this.tex(64, 20, (g, w, h) => { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = col; for (let i = 0; i < 5; i++) { g.globalAlpha = i < hp ? 1 : .18; g.fillRect(3 + i * 7, 4, 5, 12); } g.globalAlpha = 1; g.font = 'bold 14px monospace'; g.fillText('¢' + coins, 39, 15); });
    const scr = new T.Mesh(new T.PlaneGeometry(.3, .094), new T.MeshBasicMaterial({ map: t }));
    scr.rotation.x = -Math.PI / 2 + .45; scr.position.set(0, .068, .01);
    const g = this.G(this.M(new T.BoxGeometry(.36, .12, .16), this.m.dark, 0, .06, 0), scr); return g;
  }
  chest(black, state = 'closed') {
    const T = this.T, m = this.m, M = this.M.bind(this), G = this.G.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), PI = Math.PI, lid = new T.Group(); lid.name = 'lid';
    let g;
    if (!black) {
      g = G(M(B(.5, .26, .32), m.wood, 0, .13, 0), M(B(.04, .27, .33), m.brass, -.17, .135, 0), M(B(.04, .27, .33), m.brass, .17, .135, 0), M(B(.07, .08, .02), m.brass, 0, .2, .165), M(B(.012, .03, .006), m.black, 0, .195, .177));
      lid.position.set(0, .26, -.16);
      lid.add(M(new T.CylinderGeometry(.16, .16, .5, 8, 1, false, 0, PI), m.wood, 0, 0, .16, 0, 0, PI / 2), M(new T.CylinderGeometry(.165, .165, .04, 8, 1, false, 0, PI), m.brass, -.17, 0, .16, 0, 0, PI / 2), M(new T.CylinderGeometry(.165, .165, .04, 8, 1, false, 0, PI), m.brass, .17, 0, .16, 0, 0, PI / 2));
      if (state === 'open') { lid.rotation.x = -1.95; g.add(M(B(.44, .01, .26), m.black, 0, .245, 0)); }
      if (state === 'used') g.add(M(B(.54, .02, .02), m.metal, 0, .2, .178), M(new T.CylinderGeometry(.035, .035, .012, 10), m.red, 0, .2, .19, PI / 2, 0, 0), M(B(.05, .006, .006), m.bone, 0, .2, .198, 0, 0, .7), M(B(.05, .006, .006), m.bone, 0, .2, .198, 0, 0, -.7));
    } else {
      g = G(M(B(.56, .3, .36), m.black, 0, .15, 0), M(B(.035, .31, .37), m.dark, -.2, .155, 0), M(B(.035, .31, .37), m.dark, .2, .155, 0), M(B(.11, .13, .03), m.brass, 0, .2, .19), M(new T.OctahedronGeometry(.028, 0), m.redGlow, 0, .2, .21));
      lid.position.set(0, .3, -.18);
      lid.add(M(B(.6, .08, .4), m.dark, 0, .04, .18), M(new T.CylinderGeometry(.08, .34, .1, 4), m.black, 0, .13, .18, 0, PI / 4, 0), M(new T.CylinderGeometry(.04, .04, .006, 6), m.brass, 0, .045, .381, PI / 2, 0, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => lid.add(M(new T.ConeGeometry(.025, .08, 4), m.brass, a * .28, .12, .18 + b * .18)));
      const l = new T.PointLight(0xff3020, .5, 1, 2); l.position.set(0, .25, .35); g.add(l);
      if (state === 'open') { lid.rotation.x = -1.9; g.add(M(B(.5, .01, .3), m.black, 0, .29, 0)); const tok = this.defs.passage.b(); tok.rotation.x = -1.1; tok.position.set(0, .34, 0); tok.scale.setScalar(1.3); g.add(tok); const gl = new T.PointLight(0xffc060, 1.6, .8, 2); gl.position.set(0, .45, .08); g.add(gl); }
    }
    g.add(lid); return g;
  }
  buildTable() {
    const T = this.T;
    this.pick = []; this.inv = []; this.seatObjs = [[], [], []]; this.stock = [];
    const m = this.m, M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), PI = Math.PI;
    const scene = new T.Scene(); scene.background = new T.Color(0x020202); scene.fog = new T.Fog(0x030303, 4.5, 11); this.scene = scene;
    const cam = new T.PerspectiveCamera(58, 16 / 9, .05, 40); this.cam = cam;

    const wallT = this.tex(64, 64, (g, w, h) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); this.noise(g, w, h, 900, ['rgba(0,0,0,.35)', 'rgba(90,80,70,.2)', 'rgba(40,30,20,.3)']); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 31, w, 2); g.fillRect(31, 0, 2, 31); }, [8, 3]);
    const floorT = this.tex(64, 64, (g, w, h) => { g.fillStyle = '#1e1813'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 1, h); } this.noise(g, w, h, 700, ['rgba(0,0,0,.4)', 'rgba(70,55,40,.25)']); }, [10, 10]);
    const wallM = new T.MeshLambertMaterial({ map: wallT }), floorM = new T.MeshLambertMaterial({ map: floorT });
    const plane = (w, h, mat, x, y, z, rx, ry) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.receiveShadow = true; scene.add(o); return o; };
    plane(30, 30, floorM, 0, 0, 0, -PI / 2, 0);
    plane(14, 5, wallM, 0, 2.5, -6, 0, 0); plane(14, 5, wallM, -6, 2.5, 0, 0, PI / 2); plane(14, 5, wallM, 6, 2.5, 0, 0, -PI / 2);
    plane(14, 14, new T.MeshLambertMaterial({ color: 0x0c0a09 }), 0, 4.8, 0, PI / 2, 0);
    [3.7, 3.95].forEach((y, i) => scene.add(M(new T.CylinderGeometry(.07 - i * .02, .07 - i * .02, 12, 6), m.rust, 0, y, -5.85, 0, 0, PI / 2)));
    scene.add(M(new T.CylinderGeometry(.06, .06, 5, 6), m.rust, -5.85, 2.5, -3.5));

    // table
    scene.add(M(B(4.3, .12, 3.3), m.wood, 0, .9, 0));
    [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]].forEach(([x, z]) => scene.add(M(B(.14, .84, .14), m.wood, x, .42, z)));
    [[0, -1.6, 4.3, .1], [0, 1.6, 4.3, .1]].forEach(([x, z, w, d]) => scene.add(M(B(w, .07, d), m.wood, x, .995, z)));
    [[-2.1, 0], [2.1, 0]].forEach(([x, z]) => scene.add(M(B(.1, .07, 3.3), m.wood, x, .995, z)));
    const feltT = this.tex(256, 192, (g, w, h) => {
      g.fillStyle = '#2a3024'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { const x = Math.random() * w, y = Math.random() * h, rr = 10 + Math.random() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, i % 2 ? 'rgba(60,40,24,.35)' : 'rgba(70,82,52,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
      this.noise(g, w, h, 9000, ['rgba(0,0,0,.25)', 'rgba(90,100,70,.18)', 'rgba(20,16,12,.3)']);
      g.strokeStyle = 'rgba(214,200,168,.72)'; g.lineWidth = 1;
      const Ln = (a, b, c2, d) => { g.beginPath(); g.moveTo(a + .5, b + .5); g.lineTo(c2 + .5, d + .5); g.stroke(); };
      g.strokeRect(6.5, 6.5, w - 13, h - 13);
      const slot = (x, z) => { const px = Math.round((x / 4.1 + .5) * w - 8), py = Math.round((z / 3.1 + .5) * h - 8); g.fillStyle = 'rgba(10,12,8,.45)'; g.fillRect(px, py, 16, 16); g.strokeRect(px + .5, py + .5, 15, 15); };
      for (let i = 0; i < 6; i++) { const o = -.75 + i * .3; slot(o, 1.12); slot(o, -1.15); slot(-1.72, o); slot(1.72, o); }
      [34, 26].forEach(rr => { g.beginPath(); g.arc(w / 2, h / 2, rr, 0, 7); g.stroke(); });
      for (let a = 0; a < 12; a++) { const an = a * PI / 6; Ln(w / 2 + Math.cos(an) * 26, h / 2 + Math.sin(an) * 26, w / 2 + Math.cos(an) * 34, h / 2 + Math.sin(an) * 34); }

      Ln(7, 7, w / 2 - 24, h / 2 - 24); Ln(w - 7, 7, w / 2 + 24, h / 2 - 24); Ln(7, h - 7, w / 2 - 24, h / 2 + 24); Ln(w - 7, h - 7, w / 2 + 24, h / 2 + 24);
      g.fillStyle = 'rgba(214,200,168,.62)'; g.font = '7px monospace'; g.fillText('HOUSE KEEPS THE TENTH', w / 2 - 42, h / 2 + 46);
      g.fillText('I', 42, 172); g.fillText('II', 22, 30); g.fillText('III', 120, 46); g.fillText('IV', w - 30, 30);
      for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(42,48,36,.6)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
    });
    plane(4.1, 3.1, new T.MeshLambertMaterial({ map: feltT }), 0, .961, 0, -PI / 2, 0);
    scene.add(M(new T.TorusGeometry(.53, .012, 4, 32), m.brass, 0, .963, 0, PI / 2, 0, 0));

    // lamp
    const lamp = new T.Group(); lamp.position.set(0, 4.8, 0); scene.add(lamp); this.lamp = lamp;
    lamp.add(M(new T.CylinderGeometry(.01, .01, 1.85, 4), m.dark, 0, -.92, 0), M(new T.CylinderGeometry(.08, .12, .1, 8), m.dark, 0, -1.88, 0));
    const shade = M(new T.ConeGeometry(.5, .38, 10, 1, true), new T.MeshPhongMaterial({ color: 0x2c2a26, side: T.DoubleSide, shininess: 30 }), 0, -2.05, 0); shade.castShadow = false; lamp.add(shade);
    lamp.add(M(new T.SphereGeometry(.09, 8, 6), m.bulb, 0, -2.15, 0));
    const spot = new T.SpotLight(0xffd9a0, 20, 0, .82, .5, 2); spot.position.set(0, -2.12, 0); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.002;
    const tgt = new T.Object3D(); tgt.position.set(0, .9, 0); scene.add(tgt); spot.target = tgt; lamp.add(spot); this.spot = spot;
    scene.add(new T.AmbientLight(0x2a221c, .95));
    const fill = new T.PointLight(0x4a5a6a, .8, 6, 2); fill.position.set(0, 2, 3.5); scene.add(fill);

    // exit door
    const door = this.G(M(B(.12, 2.4, .2), m.dark, -.56, 1.2, 0), M(B(.12, 2.4, .2), m.dark, .56, 1.2, 0), M(B(1.24, .14, .2), m.dark, 0, 2.43, 0), M(B(.32, .1, .08), m.greenGlow, 0, 2.62, .05));
    const glow = new T.Mesh(new T.PlaneGeometry(1, 2.3), new T.MeshBasicMaterial({ color: 0x2c4229 })); glow.position.set(0, 1.15, -.05); door.add(glow);
    const hinge = new T.Group(); hinge.position.set(-.5, 0, .02); hinge.rotation.y = .35; hinge.add(M(B(1, 2.3, .06), m.dark, .5, 1.15, 0)); door.add(hinge);
    const dl = new T.PointLight(0x7fbf80, 2.2, 5, 2); dl.position.set(0, 1.4, .6); door.add(dl);
    door.position.set(2.4, 0, -5.9); this.door = door; this.doorLight = dl; door.userData.label = 'EXIT · LOCKED UNTIL ELIGIBLE'; scene.add(door); this.pick.push(door);

    // shop cabinet
    const shop = this.G(M(B(1.5, 2.1, .05), m.wood, 0, 1.05, -.25), M(B(.05, 2.1, .5), m.wood, -.75, 1.05, 0), M(B(.05, 2.1, .5), m.wood, .75, 1.05, 0), M(B(1.55, .05, .55), m.wood, 0, 2.1, 0), M(B(1.5, .04, .5), m.wood, 0, .7, 0), M(B(1.5, .04, .5), m.wood, 0, 1.3, 0));
    const sign = new T.Mesh(new T.PlaneGeometry(1.2, .22), new T.MeshLambertMaterial({ map: this.tex(128, 24, (g, w, h) => { g.fillStyle = '#2c1a10'; g.fillRect(0, 0, w, h); this.noise(g, w, h, 300, ['rgba(0,0,0,.4)']); g.fillStyle = '#d6c9ab'; g.font = 'bold 15px monospace'; g.fillText('TALLYMAN', 26, 17); }) }));
    sign.position.set(0, 2.32, .26); shop.add(sign);
    [['pistol', '6¢'], ['medicine', '2¢'], ['armor', '4¢'], ['antidote', 'SOLD']].forEach(([id, pr], i) => {
      const d = this.defs[id], o = d.b(), fl = d.flat || [0, 0, 0, 0]; o.rotation.set(fl[0], fl[1], fl[2]); const p = this.G(o); o.position.y = fl[3];
      p.scale.setScalar(1.6); p.position.set(-.54 + i * .36, 1.32, 0); p.rotation.y = .3; if (pr === 'SOLD') p.visible = false; shop.add(p);
      const tag = new T.Mesh(new T.PlaneGeometry(.2, .09), new T.MeshBasicMaterial({ map: this.tex(32, 14, (g, w, h) => { g.fillStyle = pr === 'SOLD' ? '#3a0e0a' : '#bfb294'; g.fillRect(0, 0, w, h); g.fillStyle = pr === 'SOLD' ? '#e05040' : '#1a1410'; g.font = 'bold 11px monospace'; g.fillText(pr, 3, 11); }) }));
      tag.position.set(-.54 + i * .36, 1.26, .255); shop.add(tag); this.stock.push([p, tag]);
    });
    shop.add(M(new T.SphereGeometry(.04, 6, 4), m.bulb, 0, 2.02, .1));
    const sl = new T.PointLight(0xffc070, 1.6, 2.8, 2); sl.position.set(0, 1.95, .3); shop.add(sl);
    shop.position.set(-3.5, 0, -2.6); shop.rotation.y = .75; shop.userData.label = "TALLYMAN'S SHELF · PUBLIC SHOP"; scene.add(shop); this.pick.push(shop);

    // opponents
    const so = this.seatObjs;
    const seats = [['broker', 0x6a8ab8, 'OREN · BROKER', -2.55, 0, PI / 2], ['smuggler', 0x7aa08a, 'ILKA · SMUGGLER', 0, -2.08, 0], ['medic', 0xb84030, 'VESNA · MEDIC', 2.55, 0, -PI / 2]]; this.figs = [];
    seats.forEach(([mk, col, nm, x, z, ry], i) => { const f = this.character(mk, col, nm); this.figs.push(f); so[i].push(f); f.position.set(x, 0, z); f.rotation.y = ry; scene.add(f); this.pick.push(f);
      const face = new T.PointLight(0xffc890, 1.4, 1.6, 2); face.position.set(0, 1.55, .9); f.add(face);
      const rim = new T.PointLight(col, 2.2, 1.8, 2); rim.position.set(0, 2.0, -.7); f.add(rim); });
    scene.add(M(B(.62, 1.1, .06), m.wood, 0, 1.05, 2.75));
    [[3, 12, '#e0a040', 1.25, .98, 0, -1], [4, 9, '#7d9ccc', -1.75, -1.2, -PI / 2, 0], [2, 15, '#8fc0a8', 1.15, -1.3, PI, 1], [5, 4, '#e06050', 1.75, -1.2, PI / 2, 2]].forEach(([hp, co, col, x, z, ry, si]) => { const d = this.display(hp, co, col); d.position.set(x, .962, z); d.rotation.y = ry; d.userData.label = 'HP ' + hp + ' · ¢' + co; scene.add(d); this.pick.push(d); if (si >= 0) so[si].push(d); });

    // chests
    const sc = this.chest(false, 'closed'); sc.position.set(-1.15, .962, -.6); sc.rotation.y = .3; sc.scale.setScalar(1.1); sc.userData.label = 'STANDARD CHEST · KEY REQUIRED'; this.chestStd = sc; scene.add(sc); this.pick.push(sc);
    const bc = this.chest(true, 'closed'); bc.position.set(1.2, .962, -.6); bc.rotation.y = -.3; bc.scale.setScalar(1.1); bc.userData.label = 'BLACK CHEST · BLACK KEY ONLY'; this.chestBlack = bc; scene.add(bc); this.pick.push(bc);

    const seatFill = new T.PointLight(0xffd0a0, 2.6, 2.4, 2); seatFill.position.set(0, 1.55, 1.55); scene.add(seatFill);
    this.selLight = new T.PointLight(0xffe0b0, 0, 1.2, 2); scene.add(this.selLight);
    // center
    this.place(scene, 'pistol', .08, .08, .7, 1.7, 'PISTOL · CENTER');
    const die = M(B(.09, .09, .09), new T.MeshLambertMaterial({ map: this.tex(9, 9, (g) => { g.fillStyle = '#d6c9ab'; g.fillRect(0, 0, 9, 9); g.fillStyle = '#1a1410'; [[2, 2], [6, 6], [4, 4]].forEach(([a, b]) => g.fillRect(a, b, 1, 1)); }) }), -.32, 1.007, .3, 0, .5, 0); die.userData.label = 'ORDER DIE'; scene.add(die); this.pick.push(die);
    const coin = M(new T.CylinderGeometry(.07, .07, .012, 12), m.brass, .36, .968, .32); coin.userData.label = 'DIRECTION COIN'; scene.add(coin); this.pick.push(coin);
    // your seat
    ['knife', 'medicine', 'key', 'ammo', 'cloth', 'armor'].forEach((id, i) => { if (id === 'ammo') { this.ammoSlot(scene, -.75 + i * .3, 1.12, 2); return; } const it = ITEMS.find(x => x.id === id); const p = this.place(scene, id, -.75 + i * .3, 1.12, i * .4 - .3, 1.15, 'YOUR ' + it.name.toUpperCase() + ' · CLICK TO LIFT'); p.userData.id = id; p.userData.base = { p: p.position.clone(), ry: p.rotation.y }; this.inv.push(p); });
    const sf = this.defs.safe.b(); sf.scale.setScalar(.9); sf.position.set(1.15, .962, 1.34); sf.rotation.y = -.15; sf.add(M(new T.CylinderGeometry(.003, .003, .06, 4), m.dark, .07, .19, 0), M(B(.03, .02, .004), m.brass, .085, .21, 0)); sf.userData.label = 'POCKET 1 · OCCUPIED · LOCKED IN A SAFE'; scene.add(sf); this.pick.push(sf);
    const pt2 = this.pocketTin(true); pt2.position.set(1.42, .962, 1.37); pt2.rotation.y = -.1; pt2.userData.label = 'POCKET 2 (EXTRA) · EMPTY'; scene.add(pt2); this.pick.push(pt2);
    for (let i = 0; i < 5; i++) scene.add(M(new T.CylinderGeometry(.06, .06, .018, 10), m.brass, -1.15, .972 + i * .019, 1.15, 0, i, 0));
    // black market folio (private)
    const bm = this.G(M(B(.58, .012, .4), m.leather, 0, .006, 0), M(B(.55, .004, .37), new T.MeshLambertMaterial({ color: 0x4a1210 }), 0, .014, 0), M(B(.014, .02, .4), m.spine, 0, .012, 0));
    ['pickpocket', 'safe', 'handcuffs', 'counterfeit'].forEach((id, i) => { const d = this.defs[id], o = d.b(), fl = d.flat || [0, 0, 0, 0]; o.rotation.set(fl[0], fl[1], fl[2]); o.position.y = fl[3] + .016; const q = this.G(o); q.scale.setScalar(.7); q.position.set(-.21 + i * .14, 0, -.05); q.rotation.y = .4; bm.add(q);
      const it = ITEMS.find(x => x.id === id), tg = new T.Mesh(new T.PlaneGeometry(.11, .05), new T.MeshBasicMaterial({ map: this.tex(32, 14, (g, w, h) => { g.fillStyle = i === 3 ? '#8fb0a0' : '#bfb294'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1410'; g.font = 'bold 11px monospace'; g.fillText((it.price + 1) + '¢', 4, 11); }) })); tg.rotation.x = -PI / 2; tg.position.set(-.21 + i * .14, .018, .12); bm.add(tg); });
    bm.position.set(-1.2, .962, .66); bm.rotation.y = .22; bm.userData.label = 'BLACK MARKET · PRIVATE · +1¢ · 4TH SLOT: SMUGGLER'; scene.add(bm); this.pick.push(bm);
    // sell-back counter by the shop
    const sell = this.G(M(new T.CylinderGeometry(.05, .09, .9, 8), m.dark, 0, .45, 0), M(new T.CylinderGeometry(.26, .22, .04, 12), m.brass, 0, .92, 0), M(new T.CylinderGeometry(.22, .22, .02, 12), m.dark, 0, .945, 0));
    for (let i = 0; i < 4; i++) sell.add(M(new T.CylinderGeometry(.05, .05, .014, 10), m.brass, -.08 + (i % 2) * .05, .96 + (i >> 1) * .015, .05));
    const sk = this.defs.knife.b(); sk.scale.setScalar(1.5); sk.position.set(.05, .96, -.05); sk.rotation.y = .8; sell.add(sk);
    const ssign = new T.Mesh(new T.PlaneGeometry(.5, .12), new T.MeshLambertMaterial({ map: this.tex(64, 16, (g, w, h) => { g.fillStyle = '#2c1a10'; g.fillRect(0, 0, w, h); g.fillStyle = '#d6c9ab'; g.font = 'bold 11px monospace'; g.fillText('SELL-BACK', 4, 12); }) })); ssign.position.set(0, 1.25, 0); sell.add(ssign, M(new T.CylinderGeometry(.006, .006, .3, 4), m.dark, 0, 1.1, -.01));
    sell.position.set(-2.45, 0, -1.9); sell.rotation.y = .6; sell.userData.label = 'SELL-BACK · OWNER PAYS RESALE'; scene.add(sell); this.pick.push(sell);
    // opponents' visible items
    so[1].push(this.place(scene, 'knife', -.45, -1.15, 2.6, 1.15, "ILKA'S KNIFE"), this.place(scene, 'cloth', -.15, -1.15, 0, 1.15, 'ILKA · COVERED ITEM'), this.place(scene, 'handcuffs', .15, -1.15, .3, 1.0, "ILKA'S HANDCUFFS"), this.place(scene, 'key', .45, -1.15, .4, 1.15, "ILKA'S KEY"));
    const oseal = this.G(M(new T.CylinderGeometry(.045, .05, .014, 10), m.red, 0, .007, 0), M(new T.BoxGeometry(.03, .004, .012), m.bone, 0, .016, 0, 0, .6, 0)); oseal.position.set(.8, .962, -1.3); oseal.userData.label = 'ILKA · OBJECTIVE COMPLETE · DETAILS HIDDEN'; scene.add(oseal); this.pick.push(oseal); so[1].push(oseal);
    so[0].push(this.place(scene, 'poison', -1.72, .45, 0, 1.15, "OREN'S POISON"), this.place(scene, 'redledger', -1.72, .15, 1.57, 1.0, "OREN'S RED LEDGER"), this.place(scene, 'spyglass', -1.72, -.15, 1.2, 1.15, "OREN'S SPYGLASS"), this.place(scene, 'counterfeit', -1.72, -.45, 0, 1.15, "OREN'S COIN?"));
    so[2].push(this.place(scene, 'medicine', 1.72, .45, 0, 1.15, "VESNA'S MEDICINE"), this.place(scene, 'armor_broken', 1.72, .15, -1.57, 1.0, "VESNA'S ARMOR · SPENT"), this.place(scene, 'crowbar', 1.72, -.15, .8, .85, "VESNA'S CROWBAR"), this.place(scene, 'pocket', 1.72, -.45, 0, 1.0, "VESNA'S EXTRA POCKET"));

  }
  buildShop(aspect = 16 / 9) {
    const T = this.T, m = this.m, M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, n = 8) => new T.CylinderGeometry(a, b, h, n), PI = Math.PI;
    const s = new T.Scene(); s.background = new T.Color(0x030303); s.fog = new T.Fog(0x030303, 3.5, 8);
    const wallT = this.tex(64, 64, (g, w, h) => { g.fillStyle = '#2e2620'; g.fillRect(0, 0, w, h); this.noise(g, w, h, 900, ['rgba(0,0,0,.35)', 'rgba(90,80,70,.2)']); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, 0, 1, h); } }, [6, 3]);
    const wall = new T.Mesh(new T.PlaneGeometry(8, 4), new T.MeshLambertMaterial({ map: wallT })); wall.position.set(0, 2, -1.7); wall.receiveShadow = true; s.add(wall);
    const fl = new T.Mesh(new T.PlaneGeometry(8, 6), new T.MeshLambertMaterial({ color: 0x1a1410 })); fl.rotation.x = -PI / 2; fl.receiveShadow = true; s.add(fl);
    [1.25, 1.75, 2.25].forEach((y, r) => { s.add(M(B(2.8, .04, .3), m.wood, 0, y, -1.5)); for (let i = 0; i < 9; i++) { const x = -1.25 + i * .31 + r * .07, kind = (i + r) % 4, mat = [m.gAmb, m.gPale, m.gGreen, m.leather][kind]; s.add(kind === 3 ? M(B(.12, .18, .14), mat, x, y + .11, -1.5, 0, i * .3, 0) : M(C(.045, .05, .16 + (i % 3) * .05, 7), mat, x, y + .1 + (i % 3) * .025, -1.5)); } });
    s.add(M(B(3.0, .9, .7), m.wood, 0, .45, 0), M(B(3.1, .05, .8), m.wood, 0, .925, 0), M(B(2.3, .006, .5), new T.MeshLambertMaterial({ color: 0x4a1210 }), -.25, .953, .08));
    const csign = new T.Mesh(new T.PlaneGeometry(1.2, .22), new T.MeshLambertMaterial({ map: this.tex(128, 24, (g, w, h) => { g.fillStyle = '#2c1a10'; g.fillRect(0, 0, w, h); this.noise(g, w, h, 300, ['rgba(0,0,0,.4)']); g.fillStyle = '#d6c9ab'; g.font = 'bold 15px monospace'; g.fillText('THE TALLYMAN', 10, 17); }) })); csign.position.set(-.2, .62, .352); s.add(csign);
    const keeper = this.character('tallyman', 0xa47a38, 'TALLYMAN', 'standing'); keeper.position.set(0, 0, -.75); s.add(keeper);
    const anchors = {};
    [['pistol', '6¢'], ['medicine', '2¢'], ['armor', '4¢'], ['antidote', 'SOLD']].forEach(([id, pr], i) => {
      const x = -1.05 + i * .55, d = this.defs[id], o = d.b(), f2 = d.flat || [0, 0, 0, 0]; o.rotation.set(f2[0], f2[1], f2[2]); o.position.y = f2[3];
      s.add(M(C(.11, .13, .05, 10), m.dark, x, .98, .1));
      const p = this.G(o); p.scale.setScalar(1.25); p.position.set(x, 1.005, .1); p.rotation.y = .5; p.visible = pr !== 'SOLD'; s.add(p);
      const tag = new T.Mesh(new T.PlaneGeometry(.2, .09), new T.MeshBasicMaterial({ map: this.tex(32, 14, (g, w, h) => { g.fillStyle = pr === 'SOLD' ? '#3a0e0a' : '#bfb294'; g.fillRect(0, 0, w, h); g.fillStyle = pr === 'SOLD' ? '#e05040' : '#1a1410'; g.font = 'bold 11px monospace'; g.fillText(pr, 3, 11); }) }));
      tag.position.set(x, 1.0, .33); tag.rotation.x = -.5; s.add(tag); anchors['s' + i] = new T.Vector3(x, 1.0, .36);
    });
    const tray = this.G(M(C(.2, .17, .03, 12), m.brass, 0, .015, 0), M(C(.17, .17, .01, 12), m.dark, 0, .03, 0)); tray.position.set(1.18, .95, .12); s.add(tray);
    const kn = this.defs.knife.b(); kn.scale.setScalar(1.8); kn.position.set(1.12, .99, .1); kn.rotation.y = .6; s.add(kn);
    for (let i = 0; i < 4; i++) s.add(M(C(.05, .05, .014, 10), m.brass, 1.32 + (i % 2) * .03, .962 + i * .015, .22));
    const ss = new T.Mesh(new T.PlaneGeometry(.36, .1), new T.MeshLambertMaterial({ map: this.tex(48, 14, (g, w, h) => { g.fillStyle = '#2c1a10'; g.fillRect(0, 0, w, h); g.fillStyle = '#d6c9ab'; g.font = 'bold 10px monospace'; g.fillText('SELL-BACK', 2, 11); }) })); ss.position.set(1.18, 1.22, -.05); s.add(ss, M(C(.006, .006, .25, 4), m.dark, 1.18, 1.08, -.06));
    anchors.tray = new T.Vector3(1.18, 1.0, .25);
    s.add(M(C(.05, .06, .05, 10), m.brass, -1.35, .975, .2), M(new T.SphereGeometry(.035, 8, 5, 0, PI * 2, 0, PI / 2), m.brass, -1.35, 1.0, .2));
    const led = this.defs.redledger.b(); led.scale.setScalar(1.8); led.position.set(.4, .955, -.22); led.rotation.y = -.3; s.add(led);
    const lampG = this.G(M(C(.006, .006, .8, 4), m.dark, 0, .4, 0), M(new T.ConeGeometry(.22, .18, 10, 1, true), new T.MeshPhongMaterial({ color: 0x2c2a26, side: T.DoubleSide }), 0, 0, 0), M(new T.SphereGeometry(.05, 6, 4), m.bulb, 0, -.06, 0)); lampG.position.set(0, 2.35, -.1); s.add(lampG);
    const sp = new T.SpotLight(0xffd9a0, 34, 0, 1.0, .45, 2); sp.position.set(0, 2.28, -.1); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); const tg = new T.Object3D(); tg.position.set(0, .9, 0); s.add(tg); sp.target = tg; s.add(sp);
    const rim = new T.PointLight(0x6a8aa0, 2, 3, 2); rim.position.set(.8, 2, -1.3); s.add(rim);
    const face = new T.PointLight(0xffc890, 2.6, 2.4, 2); face.position.set(0, 1.8, .2); s.add(face);
    const fill = new T.PointLight(0xffe0b8, 3, 4, 2); fill.position.set(0, 1.6, 1.6); s.add(fill);
    const shelfL = new T.PointLight(0xffc070, 1.8, 2.6, 2); shelfL.position.set(-.9, 2.5, -1.1); s.add(shelfL);
    s.add(new T.AmbientLight(0x3a3028, 1.5));
    const cam = new T.PerspectiveCamera(48, aspect, .05, 30); cam.position.set(0, 1.55, 2.0); cam.lookAt(0, 1.15, -.3);
    return { scene: s, cam, keeper, anchors };
  }
  buildMarket(aspect = 16 / 9) {
    const T = this.T, m = this.m, M = this.M.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, n = 8) => new T.CylinderGeometry(a, b, h, n), PI = Math.PI;
    const s = new T.Scene(); s.background = new T.Color(0x020101); s.fog = new T.Fog(0x020101, 2.5, 6);
    const cur = new T.Mesh(new T.PlaneGeometry(6, 4), new T.MeshLambertMaterial({ map: this.tex(64, 32, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 30 + Math.sin(x * .8) * 14 + Math.random() * 6; g.fillStyle = 'rgb(' + (v + 14 | 0) + ',' + (v * .3 | 0) + ',' + (v * .25 | 0) + ')'; g.fillRect(x, 0, 1, h); } }) })); cur.position.set(0, 2, -1.4); cur.receiveShadow = true; s.add(cur);
    const fl = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshLambertMaterial({ color: 0x120c0a })); fl.rotation.x = -PI / 2; fl.receiveShadow = true; s.add(fl);
    s.add(M(C(.78, .78, .05, 18), m.wood, 0, .78, 0), M(C(.08, .14, .76, 8), m.wood, 0, .38, 0));
    const vel = new T.MeshLambertMaterial({ color: 0x4a1210 });
    s.add(M(B(1.32, .012, .6), m.leather, 0, .811, .08), M(B(1.26, .004, .54), vel, 0, .819, .08), M(B(.03, .02, .6), m.spine, 0, .815, .08));
    const keeper = this.character('fence', 0x8a2a20, 'FENCE', 'standing'); keeper.position.set(0, 0, -.72); s.add(keeper);
    const anchors = {};
    ['pickpocket', 'safe', 'handcuffs', 'counterfeit'].forEach((id, i) => { const x = -.46 + i * .307; s.add(M(B(.24, .003, .3), i === 3 ? this.F(0x8fb0a0) : m.bone, x, .823, .06, 0, (i - 1.5) * .05, 0));
      const d = this.defs[id], o = d.b(), f2 = d.flat || [0, 0, 0, 0]; o.rotation.set(f2[0], f2[1], f2[2]); o.position.y = f2[3]; const p = this.G(o); p.scale.setScalar(.95); p.position.set(x, .826, .01); p.rotation.y = .3; s.add(p);
      const it = ITEMS.find(q => q.id === id), tg = new T.Mesh(new T.PlaneGeometry(.12, .05), new T.MeshBasicMaterial({ map: this.tex(32, 14, (g, w, h) => { g.fillStyle = i === 3 ? '#8fb0a0' : '#d6c9ab'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1410'; g.font = 'bold 11px monospace'; g.fillText((it.price + 1) + '¢', 5, 11); }) })); tg.rotation.x = -PI / 2; tg.position.set(x, .827, .17); s.add(tg);
      anchors['s' + i] = new T.Vector3(x, .83, .24); });
    const lan = this.G(M(B(.12, .02, .12), m.dark, 0, .01, 0), M(B(.12, .02, .12), m.dark, 0, .22, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => M(B(.012, .2, .012), m.dark, a * .05, .115, b * .05)), M(new T.SphereGeometry(.035, 6, 4), new T.MeshBasicMaterial({ color: 0xffb050 }), 0, .1, 0), M(new T.TorusGeometry(.03, .006, 3, 8), m.dark, 0, .26, 0));
    lan.position.set(.55, .805, -.22); s.add(lan);
    const lamp = new T.PointLight(0xffa040, 3.2, 2.8, 2); lamp.position.set(.55, 1.0, -.15); lamp.castShadow = true; s.add(lamp);
    const rim = new T.PointLight(0xb02a20, 1.6, 2.5, 2); rim.position.set(-.6, 1.8, -1.1); s.add(rim);
    const top = new T.SpotLight(0xffd9a0, 6, 0, .5, .6, 2); top.position.set(0, 2.6, .4); const tt = new T.Object3D(); tt.position.set(0, .8, .05); s.add(tt); top.target = tt; top.castShadow = true; s.add(top);
    s.add(new T.AmbientLight(0x1a1010, .7));
    const cam = new T.PerspectiveCamera(50, aspect, .05, 20); cam.position.set(0, 1.5, 1.6); cam.lookAt(0, 1.25, -.3);
    return { scene: s, cam, keeper, anchors, lamp };
  }
  ammoSlot(scene, x, z, n) {
    const T = this.T, PI = Math.PI, out = [];
    if (n > 0) { const tex = this.tex(32, 32, (g) => { g.clearRect(0, 0, 32, 32); g.strokeStyle = 'rgba(255,255,255,.88)'; g.lineWidth = 1; [7, 16, 25].forEach(cx => { g.beginPath(); g.moveTo(cx - 2.5, 27.5); g.lineTo(cx - 2.5, 12); g.quadraticCurveTo(cx, 4, cx + 2.5, 12); g.lineTo(cx + 2.5, 27.5); g.closePath(); g.stroke(); }); });
      const pl = new T.Mesh(new T.PlaneGeometry(.2, .2), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); pl.rotation.x = -PI / 2; pl.position.set(x, .9628, z); pl.userData.id = 'ammo-chalk'; scene.add(pl); out.push(pl); }
    for (let i = 0; i < n; i++) { const b = this.place(scene, 'bullet', x - .056 + i * .056, z + .035, 0, 1.15, 'YOUR AMMO · ' + n + ' OF 3 · TAKES 1 SLOT'); b.children[0].rotation.x = -PI / 2; b.children[0].position.y = .013; out.push(b); }
    return out;
  }
  setThreat(g, kind) {
    const P = g.userData.P; if (!P) return; if (P.held) { P.held.parent.remove(P.held); P.held = null; } P.threat = kind || null; if (!kind) return;
    const gun = this.defs.pistol.b(); gun.rotation.z = -Math.PI / 2; let o = gun;
    if (kind === 'cloth') { const c = this.defs.cloth.b(); c.scale.set(2.2, 1.9, 2.2); c.position.set(0, -.12, 0); o = this.G(gun, c); }
    o.scale.multiplyScalar(1.3); o.position.set(0, -.05, .04); P.aR.hand.add(o); P.held = o;
  }
  pocketTin(open = false) {
    const T = this.T, m = this.m, M = this.M.bind(this), G = this.G.bind(this), B = (w, h, d) => new T.BoxGeometry(w, h, d), PI = Math.PI;
    const lid = new T.Group(); lid.name = 'lid'; lid.position.set(0, .04, -.05);
    lid.add(M(B(.144, .014, .104), m.tin, 0, .007, .052), M(B(.03, .022, .004), m.brass, 0, -.002, .105), M(B(.1, .002, .07), m.brass, 0, .0145, .052));
    if (open) lid.rotation.x = -1.9;
    return G(M(B(.14, .04, .1), m.tin, 0, .02, 0), M(B(.126, .004, .086), m.velvet, 0, .037, 0), M(B(.146, .006, .106), m.brass, 0, .003, 0), M(new T.CylinderGeometry(.006, .006, .12, 6), m.brass, 0, .04, -.05, 0, 0, PI / 2), lid);
  }
  animMedicine(o, t, drop = 0) {
    const PI = Math.PI, cap = o.getObjectByName('cap'), seal = o.getObjectByName('seal'); if (!cap) return;
    const cl = x => Math.min(1, Math.max(0, x)), eio = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2, eo = x => 1 - Math.pow(1 - x, 3);
    const tw = eio(cl((t - .5) / 1.2)), pp = cl((t - 1.7) / .55);
    cap.rotation.set(0, -tw * PI * 3, 0); cap.position.set(0, .145 + tw * .012, 0);
    if (pp > 0) { const y0 = .157, y1 = -drop + .038; cap.position.set(pp * .12, y0 + (y1 - y0) * pp * pp + Math.sin(pp * PI) * .05, pp * .03); cap.rotation.z = -pp * PI * 2.5; }
    seal.rotation.x = -eo(cl((t - 2.0) / .6)) * 2.3;
  }
}

// ---- item-use animation clips (local item units; E.floor = table height in piv-parent space)
const PI = Math.PI, cl = x => Math.min(1, Math.max(0, x)), eio = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2, eo = x => 1 - Math.pow(1 - x, 3), ei = x => x * x;
const sg = (t, a, b, f = eio) => f(cl((t - a) / (b - a))), lerp = (a, b, q) => a + (b - a) * q, bump = (t, a, b) => (t > a && t < b) ? Math.sin((t - a) / (b - a) * PI) : 0;
const lift = (t, D) => sg(t, 0, .4) * (1 - sg(t, D - .5, D));
function pool(host, key, n, make) { if (!host.userData[key]) host.userData[key] = Array.from({ length: n }, (_, i) => { const q = make(i); q.visible = false; host.add(q); return q; }); return host.userData[key]; }
const basic = (T, c, op) => new T.MeshBasicMaterial({ color: c, transparent: op != null, opacity: op ?? 1, depthWrite: op == null });
function pocketProp(k, x, z, open) { const g = k.pocketTin(open); g.position.set(x, 0, z); return g; }
function chestProp(k) { const c = k.chest(false, 'closed'); c.position.set(0, 0, -.34); const w = k.G(c); w.userData = { lid: c.getObjectByName('lid'), hole: new k.T.Vector3(0, .195, -.163) }; return w; }
export const CLIPS = {
  knife: { D: 2.6, ph: [['LIFT', 0], ['AIM', .4], ['THRUST', 1], ['SNAP', 1.5], ['SET DOWN', 2.1]],
    run(k, piv, o, t, E) { const b = o.getObjectByName('blade'), aim = sg(t, .4, .9) * (1 - sg(t, 2.1, 2.6));
      piv.position.y = lift(t, 2.6) * E.L + aim * .04; piv.rotation.y = aim * PI / 2; piv.rotation.z = aim * .12 + Math.sin(t * 70) * .05 * bump(t, 1.5, 1.7);
      piv.position.z = -sg(t, 1, 1.12, eo) * .14 + sg(t, 1.12, 1.45) * .14;
      const q = cl((t - 1.5) / .55); b.position.set(q * .05, lerp(0, E.floor - piv.position.y - .01, q * q), 0); b.rotation.set(0, q * .8, -q * 1.5); } },
  pistol: { D: 2.8, ph: [['LIFT', 0], ['RAISE', .4], ['COCK', 1], ['FIRE', 1.5], ['LOWER', 2.2]],
    run(k, piv, o, t, E) { const { T } = k, aim = sg(t, .4, .9) * (1 - sg(t, 2.2, 2.8)), kick = sg(t, 1.5, 1.56, eo) * (1 - sg(t, 1.56, 2));
      o.rotation.x = E.fl[0] * (1 - aim); o.position.y = E.fl[3] * (1 - aim);
      piv.position.y = lift(t, 2.8) * E.L + aim * .06; piv.rotation.y = aim * PI / 2; piv.rotation.z = kick * .5; piv.position.z = kick * .05;
      o.getObjectByName('hammer').rotation.z = sg(t, 1, 1.2) * .6 * (1 - sg(t, 1.5, 1.52));
      o.getObjectByName('cyl').rotation.x = sg(t, 1, 1.3) * PI / 3;
      const [f] = pool(o, 'flash', 1, () => new T.Mesh(new T.OctahedronGeometry(1, 0), basic(T, 0xffd070)));
      f.position.set(.27, .1, 0); f.visible = t > 1.5 && t < 1.62; f.scale.set(.05, .025, .025).multiplyScalar(1 + (t - 1.5) * 8); } },
  bullet: { D: 2.6, ph: [['LIFT', 0], ['ROLL', .4], ['ALIGN', 1.1], ['LOAD', 1.75], ['CLICK', 2]],
    props(k) { const p = k.defs.pistol.b(); p.rotation.x = -PI / 2; p.position.set(-.34, .03, -.05); const g = k.G(p); g.userData = { cyl: p.getObjectByName('cyl'), tgt: new k.T.Vector3(-.47, .055, -.14) }; return g; },
    run(k, piv, o, t, E) { const tg = E.props ? E.props.userData.tgt : new k.T.Vector3(-.2, E.floor + .2, -.1), mv = sg(t, 1.1, 1.75), ins = sg(t, 1.75, 2);
      piv.rotation.y = sg(t, .4, 1.1) * PI * 2; o.rotation.z = -sg(t, 1, 1.3) * PI / 2;
      piv.position.set(lerp(0, tg.x, mv) + ins * .1, lerp(lift(t, 9) * E.L, tg.y, mv), lerp(0, tg.z, mv));
      o.visible = t < 2; if (E.props) E.props.userData.cyl.rotation.x = sg(t, 2, 2.3) * PI / 3; } },
  poison: { D: 3.2, ph: [['LIFT', 0], ['UNCORK', .5], ['POUR', 1.1], ['DRIP', 1.4], ['SET DOWN', 2.6]],
    props(k) { const { T, m, M, G } = k, liq = M(new T.CylinderGeometry(.046, .046, .006, 10), basic(T, 0x5f9a2a)); liq.position.y = .07; const g = G(M(new T.CylinderGeometry(.055, .045, .09, 10, 1, true), m.metalD, 0, .045, 0), M(new T.CylinderGeometry(.045, .045, .006, 10), m.dark, 0, .003, 0), M(new T.TorusGeometry(.055, .006, 4, 12), m.metal, 0, .09, 0, PI / 2, 0, 0), liq); g.position.set(.24, 0, 0); const w = G(g); w.userData = { tgt: new T.Vector3(.24, .07, 0), liq }; return w; },
    run(k, piv, o, t, E) { const { T } = k, ck = o.getObjectByName('cork'), tilt = sg(t, 1.1, 1.5) * (1 - sg(t, 2.2, 2.6)), tg = E.props ? E.props.userData.tgt : new T.Vector3(.2, E.floor + .005, 0);
      ck.position.set(.05 * (sg(t, .8, 1) - sg(t, 2.4, 2.6)), .27 + .06 * (sg(t, .5, .8, eo) - sg(t, 2.5, 2.8)), 0);
      piv.rotation.z = -tilt * 1.9; piv.position.set(tilt * (tg.x - .24), lift(t, 3.2) * E.L + tilt * .14, 0);
      const drops = pool(E.space, 'drops', 8, () => new T.Mesh(new T.BoxGeometry(.012, .018, .012), basic(T, 0x8fe040)));
      drops.forEach((d, i) => { const s0 = 1.45 + i * .09, q = cl((t - s0) / .28); d.visible = q > 0 && q < 1 && s0 < 2.2; d.position.set(tg.x, lerp(piv.position.y - .06, tg.y, q * q), tg.z); });
      if (E.props) { const L = E.props.userData.liq, f = sg(t, 1.5, 2.3); L.visible = f > 0; L.position.y = .01 + f * .06; } } },
  medicine: { D: 3.5, ph: [['LIFT', 0], ['UNSCREW', .5], ['POP CAP', 1.7], ['PEEL SEAL', 2], ['SET DOWN', 3]],
    run(k, piv, o, t, E) { const up = lift(t, 3.5); piv.position.y = up * E.L; piv.rotation.x = up * .16; piv.rotation.z = -up * .05 + (t > .5 && t < 1.7 ? Math.sin(t * 22) * .012 : 0); k.animMedicine(o, t, piv.position.y - E.floor); } },
  antidote: { D: 3.0, ph: [['LIFT', 0], ['FLIP', .4], ['FLICK', 1], ['INJECT', 1.4], ['SET DOWN', 2.4]],
    run(k, piv, o, t, E) { const f = sg(t, .4, .9) * (1 - sg(t, 2.4, 2.9)), inj = sg(t, 1.6, 2.1), d = o.getObjectByName('dose');
      o.rotation.z = E.fl[2] * (1 - f); o.rotation.x = Math.sin(t * 40) * .07 * bump(t, 1, 1.3);
      piv.position.y = lift(t, 3) * E.L + f * .1 - sg(t, 1.4, 1.6, eo) * .05 * (1 - sg(t, 2.1, 2.4));
      o.getObjectByName('plunger').position.y = -inj * .06; d.scale.y = 1 - .85 * inj; d.position.y = .05 + .08 * d.scale.y; } },
  armor: { D: 2.6, ph: [['LIFT', 0], ['BRACE', .4], ['IMPACT', 1], ['BREAK', 1.1], ['FALL', 1.3]],
    run(k, piv, o, t, E) { const { T } = k; let br = piv.userData.broken; if (!br) { br = piv.userData.broken = k.defs.armor_broken.b(); piv.add(br); br.userData.r1 = br.children[1].rotation.clone(); br.userData.p1 = br.children[1].position.clone(); }
      const hit = t >= 1.1; piv.position.y = lift(t, 9) * E.L + sg(t, .4, .8) * .04; piv.rotation.y = Math.sin(t * 1.2) * .2 * (1 - sg(t, 1, 1.1));
      piv.position.x = Math.sin(t * 70) * .015 * bump(t, 1, 1.35); o.visible = !hit; br.visible = hit;
      const q = cl((t - 1.1) / .6), c1 = br.children[1]; br.position.y = lerp(0, E.floor - piv.position.y, sg(t, 1.25, 1.7, ei)); br.rotation.x = sg(t, 1.25, 1.8) * -.5;
      c1.position.set(br.userData.p1.x + q * .04, br.userData.p1.y, br.userData.p1.z + q * .03); c1.rotation.set(br.userData.r1.x, br.userData.r1.y, br.userData.r1.z - q * .8);
      const [s] = pool(piv, 'spark', 1, () => new T.Mesh(new T.OctahedronGeometry(1, 0), basic(T, 0xfff0c0))); s.position.set(0, .09, .14); s.visible = t > 1 && t < 1.12; s.scale.setScalar(.03 + Math.max(0, t - 1) * .3); } },
  cloth: { D: 2.6, ph: [['LIFT', 0], ['UNFURL', .4], ['CARRY', .9], ['DRAPE', 1.5], ['SETTLE', 2]],
    props(k) { const p = k.defs.pistol.b(); p.rotation.x = -PI / 2; p.position.set(-.3, .03, 0); const g = k.G(p); g.userData = { gun: p, tgt: new k.T.Vector3(-.26, 0, 0) }; return g; },
    run(k, piv, o, t, E) { const tg = E.props ? E.props.userData.tgt : new k.T.Vector3(0, E.floor, 0), u = sg(t, .4, .9), cover = sg(t, 1.5, 2.1), mv = sg(t, .9, 1.5), fs = E.props ? 1.7 : 1.4;
      o.scale.set(lerp(1, fs, u), lerp(lerp(1, .4, u), fs * .85, cover), lerp(1, fs, u));
      piv.position.set(lerp(0, tg.x, mv), lerp(lift(t, 9) * E.L + bump(t, .9, 1.6) * .1, tg.y, sg(t, 1.6, 2.1)), lerp(0, tg.z, mv)); piv.rotation.y = u * .6;
      if (E.props) E.props.userData.gun.visible = t < 1.85; } },
  pocket: { D: 2.6, ph: [['LIFT', 0], ['OPEN', .4], ['PLACE', 1], ['NEW POCKET', 1.7]],
    props(k) { const { T, G, M } = k, have = pocketProp(k, .44, 0, false), ring = M(new T.TorusGeometry(.1, .008, 4, 16), basic(T, 0xe0a040, .9), .22, .02, 0, PI / 2, 0, 0); const w = G(have, ring); w.userData = { ring, tgt: new T.Vector3(.22, 0, 0) }; return w; },
    run(k, piv, o, t, E) { const tg = E.props ? E.props.userData.tgt : new k.T.Vector3(0, E.floor, 0), mv = sg(t, 1, 1.7);
      o.getObjectByName('lid').rotation.x = -sg(t, .4, .8) * 1.9;
      piv.position.set(lerp(0, tg.x, mv), lerp(lift(t, 9) * E.L, tg.y, mv) + bump(t, 1, 1.7) * .1, lerp(0, tg.z, mv));
      if (E.props) { const r = E.props.userData.ring, q = cl((t - 1.7) / .7); r.visible = q > 0 && q < 1; r.scale.setScalar(1 + q * .5); r.material.opacity = (1 - q) * .9; } } },
  safe: { D: 3.2, ph: [['OPEN DOOR', 0], ['STOW POCKET', .9], ['SHUT', 1.8], ['SPIN DIAL', 2.2], ['LOCKED', 2.75]],
    props(k) { const tin = pocketProp(k, .34, .08, false); const w = k.G(tin); w.userData = { tin }; return w; },
    run(k, piv, o, t, E) { const op = sg(t, .2, .7) * (1 - sg(t, 1.8, 2.2));
      o.getObjectByName('door').rotation.y = -op * 1.75;
      o.getObjectByName('dial').rotation.z = -sg(t, 2.2, 2.45) * 2.4 + sg(t, 2.45, 2.6) * 1.4 - sg(t, 2.6, 2.75) * .8;
      o.getObjectByName('handle').rotation.z = -sg(t, 2.75, 2.9) * PI / 2;
      piv.position.y = -Math.abs(Math.sin(t * 30)) * .004 * bump(t, 2.15, 2.3);
      if (E.props) { const tin = E.props.userData.tin, mv = sg(t, .9, 1.6); tin.position.set(lerp(.34, 0, mv), lerp(0, .016, mv) + bump(t, .9, 1.6) * .14, lerp(.08, -.005, mv)); } } },
  spyglass: { D: 3.0, ph: [['LIFT', 0], ['EXTEND', .4], ['AIM', .9], ['SEE UNDER', 1.4], ['COLLAPSE', 2.3]],
    props(k) { const { G } = k, key = k.defs.blackkey.b(), c2 = k.defs.cloth.b(); c2.scale.set(1.6, 1.4, 1.6); const mats = []; c2.traverse(c => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; mats.push(c.material); } }); const g = G(key, c2); g.position.set(0, 0, -.34); const w = G(g); w.userData.mats = mats; return w; },
    run(k, piv, o, t, E) { const ex = sg(t, .4, .9) * (1 - sg(t, 2.3, 2.7)), aim = sg(t, .9, 1.3) * (1 - sg(t, 2.2, 2.6));
      o.getObjectByName('tube2').position.x = .04 + ex * .04; o.getObjectByName('tube3').position.x = .11 + ex * .06;
      piv.position.y = lift(t, 3) * E.L + aim * .1; piv.rotation.y = -aim * PI / 2; piv.rotation.z = aim * .25;
      if (E.props) { const a = 1 - .8 * sg(t, 1.4, 1.9) * (1 - sg(t, 2.2, 2.6)); E.props.userData.mats.forEach(mt => { mt.opacity = a; }); } } },
  pickpocket: { D: 2.9, ph: [['LIFT', 0], ['REACH', .4], ['HOOK', 1], ['PULL', 1.6], ['TOOL GONE', 2], ['TO YOU', 2.1]],
    props(k) { const { T, G } = k, pk = pocketProp(k, 0, -.3, false), loot = k.defs.key.b(); loot.visible = false; const w = G(pk, loot); w.userData = { lid: pk.getObjectByName('lid'), loot, tgt: new T.Vector3(0, .05, -.3) }; return w; },
    run(k, piv, o, t, E) { const tg = E.props ? E.props.userData.tgt : new k.T.Vector3(0, E.floor + .03, -.25), r = sg(t, .4, .8), reach = sg(t, .5, 1) * (1 - sg(t, 1.6, 2)), gone = sg(t, 2, 2.2);
      piv.rotation.y = r * PI / 2; piv.position.set(0, lerp(lift(t, 9) * E.L + r * .08, tg.y + .03, reach), lerp(0, tg.z + .16, reach)); piv.rotation.x = Math.sin(t * 25) * .12 * bump(t, 1, 1.6);
      piv.scale.setScalar(1 - gone * .99); o.visible = t < 2.2;
      if (E.props) { const u = E.props.userData, q = sg(t, 1.6, 2), f = sg(t, 2.1, 2.8, ei); u.lid.rotation.x = -sg(t, .9, 1.1) * 1.9 * (1 - sg(t, 2.3, 2.6)); u.loot.visible = t > 1.6 && t < 2.8; u.loot.position.set(0, lerp(.03, piv.position.y - .02, q) + f * .35, lerp(tg.z, tg.z + .16 - .165, q) + f * 1.5); u.loot.rotation.y = q * 2 + f * 4; u.loot.scale.setScalar(1 + f * .8); } } },
  key: { D: 3.0, ph: [['LIFT', 0], ['ALIGN', .4], ['INSERT', 1], ['TURN', 1.5], ['OPEN', 2]],
    props: k => chestProp(k),
    run(k, piv, o, t, E) { const h = E.props ? E.props.userData.hole : new k.T.Vector3(0, E.floor + .25, -.2), a = sg(t, .4, 1), ins = sg(t, 1, 1.4);
      piv.rotation.y = a * PI / 2; o.rotation.x = a * PI / 2 + sg(t, 1.5, 1.9) * PI / 2;
      piv.position.set(0, lerp(lift(t, 9) * E.L, h.y - .01, a), lerp(0, h.z + .155, a) - ins * .07);
      if (E.props) E.props.userData.lid.rotation.x = -sg(t, 2, 2.6, eo) * 1.95; } },
  lockpick: { D: 3.2, ph: [['LIFT', 0], ['PRESENT', .4], ['PICK', 1.1], ['RAKE', 1.4], ['OPEN', 2.2]],
    props: k => chestProp(k),
    run(k, piv, o, t, E) { const h = E.props ? E.props.userData.hole : new k.T.Vector3(0, E.floor + .2, -.2), a = sg(t, .4, 1) * (1 - sg(t, 2.6, 3.1)), ins = sg(t, 1.1, 1.4) * (1 - sg(t, 2.3, 2.6)), jg = bump(t, 1.4, 2.2);
      piv.position.set(lerp(0, .04, a), lerp(lift(t, 3.2) * E.L, h.y - .017, a), lerp(0, h.z + .135, a));
      const p0 = o.getObjectByName('pick0'), p1 = o.getObjectByName('pick1');
      p0.position.set(-.04, .017, .04 - ins * .06); p0.rotation.set(0, Math.sin(t * 28) * .1 * jg, 0);
      p1.position.set(lerp(-.01, -.04, ins), .017 - .008 * ins, .04 - ins * .06); p1.rotation.set(Math.sin(t * 19) * .05 * jg, .12 * (1 - ins), 0);
      if (E.props) E.props.userData.lid.rotation.x = -sg(t, 2.2, 2.7, eo) * 1.95; } },
  crowbar: { D: 2.8, ph: [['LIFT', 0], ['WEDGE', .4], ['PRY', 1.3], ['BURST', 1.7], ['SET DOWN', 2.3]],
    props: k => chestProp(k),
    run(k, piv, o, t, E) { const { T } = k, s = E.props ? new T.Vector3(0, .25, -.18) : new T.Vector3(0, E.floor + .2, -.15), a = sg(t, .4, 1) * (1 - sg(t, 2.3, 2.8)), w = sg(t, 1, 1.25, eo) * (1 - sg(t, 2.3, 2.8)), pry = sg(t, 1.3, 1.75) * (1 - sg(t, 2.1, 2.5));
      piv.rotation.y = a * PI / 2; piv.rotation.x = pry * .45;
      piv.position.set(0, lerp(lift(t, 2.8) * E.L, s.y, a), lerp(0, s.z + .26, a) - w * .05);
      if (E.props) E.props.userData.lid.rotation.x = -sg(t, 1.7, 1.95, eo) * 1.95;
      const sp = pool(E.space, 'splint', 7, () => new T.Mesh(new T.BoxGeometry(.012, .008, .03), k.m.wood));
      sp.forEach((p, i) => { const q = cl((t - 1.7) / .7); p.visible = !!E.props && q > 0 && q < 1; const a2 = i * .9; p.position.set(Math.cos(a2) * q * .25, s.y + q * .18 - q * q * .35, s.z + Math.sin(a2) * .05 + q * .15); p.rotation.set(q * 6 + i, q * 4, 0); }); } },
  blackkey: { D: 3.4, ph: [['LIFT', 0], ['ALIGN', .4], ['INSERT', 1], ['TURN', 1.5], ['OPEN', 2.1], ['REVEAL', 2.5]],
    props(k) { const { T } = k, c = k.chest(true, 'closed'); c.position.set(0, 0, -.38); const tok = k.defs.passage.b(); tok.rotation.x = -1.1; tok.position.set(0, .26, -.38); tok.visible = false; const gl = new T.PointLight(0xffc060, 0, .9, 2); gl.position.set(0, .5, -.3); const w = k.G(c, tok, gl); w.userData = { lid: c.getObjectByName('lid'), tok, gl, hole: new T.Vector3(0, .2, -.17) }; return w; },
    run(k, piv, o, t, E) { const h = E.props ? E.props.userData.hole : new k.T.Vector3(0, E.floor + .25, -.2), a = sg(t, .4, 1), ins = sg(t, 1, 1.4);
      piv.rotation.y = a * PI / 2; o.rotation.x = sg(t, 1.5, 2) * PI / 2;
      piv.position.set(0, lerp(lift(t, 9) * E.L, h.y - .03, a), lerp(0, h.z + .2, a) - ins * .07);
      o.getObjectByName('gem').scale.setScalar(1 + Math.max(0, Math.sin(t * 9)) * .6 * sg(t, .4, 1));
      if (E.props) { const u = E.props.userData, op = sg(t, 2.1, 2.7, eo); u.lid.rotation.x = -op * 1.9; u.tok.visible = op > .05; u.tok.position.y = .26 + sg(t, 2.5, 3.1) * .14; u.tok.rotation.y = sg(t, 2.5, 3.4) * PI; u.gl.intensity = op * 2.2; } } },
  handcuffs: { D: 2.6, ph: [['LIFT', 0], ['OPEN', .4], ['SNAP ON', 1.2], ['LOCKED', 1.5]],
    props(k) { const { T, G, M, m } = k, g = G(M(new T.CylinderGeometry(.03, .034, .3, 8), m.wood, 0, .15, 0), M(new T.SphereGeometry(.045, 8, 6), m.wood, 0, .31, 0), M(new T.CylinderGeometry(.07, .08, .02, 10), m.wood, 0, .01, 0)); g.position.set(-.07, 0, -.26); const w = G(g); w.userData.post = new T.Vector3(-.07, 0, -.26); return w; },
    run(k, piv, o, t, E) { const p = E.props ? E.props.userData.post : new k.T.Vector3(-.07, E.floor, -.2), mv = sg(t, .6, 1.2), dn = sg(t, 1, 1.25, ei), op = sg(t, .4, .7) * (1 - sg(t, 1.25, 1.32)), L = o.getObjectByName('cuffL'), R = o.getObjectByName('cuffR');
      L.rotation.z = op * .9; R.rotation.x = t > 1.3 ? .5 + Math.sin(t * 7) * .25 * Math.exp(-(t - 1.3) * 2) : op * .3;
      piv.position.set(lerp(0, p.x + .07, mv), lerp(lift(t, 9) * E.L, .45, mv) - dn * (.45 - p.y - .12) + Math.sin(t * 40) * .01 * bump(t, 1.25, 1.45), lerp(0, p.z, mv)); } },
  counterfeit: { D: 2.8, ph: [['LIFT', 0], ['TOSS', .4], ['LAND', 1.2], ['THE TELL', 1.6]],
    props(k) { const g = k.G(); for (let i = 0; i < 4; i++) { const c = k.defs.coin.b(); c.position.set(.24, i * .014, 0); c.rotation.y = i; g.add(c); } g.userData.tgt = new k.T.Vector3(.24, .056, 0); return g; },
    run(k, piv, o, t, E) { const tg = E.props ? E.props.userData.tgt : new k.T.Vector3(0, E.floor, 0), tos = sg(t, .4, 1.2, x => x), tell = sg(t, 1.6, 1.9) * (1 - sg(t, 2.3, 2.6));
      piv.position.set(lerp(0, tg.x, tos), lerp(lift(t, 9) * E.L, tg.y, tos) + Math.sin(tos * PI) * .3 + tell * .1, lerp(0, tg.z, tos) + tell * .08); o.rotation.x = tos * PI * 4 + tell * PI / 2; o.rotation.z = tell * .15; } },
  passage: { D: 2.8, ph: [['LIFT', 0], ['PRESENT', .4], ['GLOW', 1], ['DEPART', 1.7]],
    run(k, piv, o, t, E) { const { T } = k, pr = sg(t, .4, .9), dep = sg(t, 1.7, 2.7, ei), g = sg(t, 1, 1.4);
      o.rotation.x = pr * PI / 2; piv.position.set(0, lift(t, 9) * E.L + pr * .12 + dep * .35, -dep * .9); piv.rotation.z = Math.sin(t * 2) * .05; piv.scale.setScalar(1 - dep * .6); o.visible = t < 2.7;
      const [h] = pool(piv, 'halo', 1, () => new T.Mesh(new T.TorusGeometry(.09, .012, 4, 20), basic(T, 0x9fe08a, .8))); h.visible = g > 0 && t < 2.7; h.position.set(0, 0, -.01); h.scale.setScalar(1 + Math.sin(t * 6) * .06 + g * .2); h.material.opacity = g * .8;
      if (!piv.userData.glow) { piv.userData.glow = new T.PointLight(0x9fe08a, 0, .8, 2); piv.add(piv.userData.glow); } piv.userData.glow.intensity = t < 2.7 ? g * 1.8 : 0; } }
};
export const NO_CLIP = ['brassidol', 'glasseye', 'redledger'];
export function clipProps(k, id) { const c = CLIPS[id]; return c && c.props ? c.props(k) : null; }
export function runClip(k, id, piv, o, t, E) {
  const c = CLIPS[id]; if (!c) return;
  piv.position.set(0, 0, 0); piv.rotation.set(0, 0, 0); piv.scale.set(1, 1, 1);
  o.rotation.set(E.fl[0], E.fl[1], E.fl[2]); o.position.set(0, E.fl[3], 0); o.scale.set(1, 1, 1); o.visible = true;
  c.run(k, piv, o, Math.max(0, t), E);
}

export function makeStill(T, w, h) {
  const r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h, false); r.shadowMap.enabled = true; r.shadowMap.type = T.BasicShadowMap;
  const rt = new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const post = makePost(T, rt.texture, {}); post.uniforms.uRes.value.set(w, h);
  const ps = new T.Scene(), pq = new T.Mesh(new T.PlaneGeometry(2, 2), post); pq.frustumCulled = false; ps.add(pq); const pc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { r, post,
    resize(width, height) { r.setSize(width, height, false); rt.setSize(width, height); post.uniforms.uRes.value.set(width, height); },
    render(scene, cam, o = {}) { post.uniforms.uTint.value.set(...(o.grade || GRADES.Sodium)); post.uniforms.uS.value = o.sat ?? .72; post.uniforms.uT.value = o.t ?? 0; r.setRenderTarget(rt); r.render(scene, cam); r.setRenderTarget(null); r.render(ps, pc); },
    url() { return r.domElement.toDataURL(); },
    dispose() { pq.geometry.dispose(); post.dispose(); rt.dispose(); r.dispose(); r.forceContextLoss(); }
  };
}
export const VIEWS = { seat: [[0, 1.58, 2.4], [0, .74, -.6]], left: [[-.1, 1.58, 2.4], [-1.9, 1.0, -.3]], door: [[.12, 1.6, 2.4], [1.7, 2.15, -3.6]], down: [[0, 1.5, 2.25], [0, .7, .5]], spect: [[0, 4.1, 3.1], [0, .85, -.15], { grade: GRADES.Spectator, sat: .3 }], downed: [[.35, 1.05, 2.3], [-.1, .95, -1], { roll: .28 }] };
export const ANCHORS = { chestStd: [-1.15, 1.32, -.6], chestBlack: [1.2, 1.42, -.6], door: [2.4, 2.8, -5.9], oren: [-2.55, 2.12, 0], ilka: [0, 2.12, -2.08], vesna: [2.55, 2.12, 0] };
export function projectAll(T, cam, anchors) { cam.updateMatrixWorld(); const v = new T.Vector3(), a = {}; Object.entries(anchors).forEach(([key, q]) => { if (Array.isArray(q)) v.set(...q); else v.copy(q); v.project(cam); a[key] = { x: ((v.x + 1) / 2 * 100).toFixed(1) + '%', y: ((1 - v.y) / 2 * 100).toFixed(1) + '%', on: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 }; }); return a; }
export function renderTableViews(T, names, w, h) {
  const k = install({}, T); k.buildTable(); const st = makeStill(T, w, h), out = {}, cam = new T.PerspectiveCamera(58, w / h, .05, 40);
  k.figs.forEach((f, i) => k.idle(f, 0, i * 1.7, false));
  names.forEach(n => { const [p, l, o = {}] = VIEWS[n]; cam.position.set(...p); cam.lookAt(...l); if (o.roll) cam.rotateZ(o.roll); cam.updateMatrixWorld(); st.render(k.scene, cam, o); out[n] = { url: st.url(), a: projectAll(T, cam, ANCHORS) }; });
  st.dispose(); return out;
}
export function renderStill(T, kind, w, h, o = {}) {
  const k = install({}, T), st = makeStill(T, w, h), sc = kind === 'shop' ? k.buildShop(w / h) : k.buildMarket(w / h);
  if (o.cam) { sc.cam.fov = o.cam.fov ?? sc.cam.fov; sc.cam.position.set(...o.cam.pos); sc.cam.lookAt(...o.cam.look); sc.cam.updateProjectionMatrix(); }
  k.idle(sc.keeper, 0, 0, true); st.render(sc.scene, sc.cam);
  const res = { url: st.url(), a: projectAll(T, sc.cam, sc.anchors) }; st.dispose(); return res;
}

export const VHS_FS = 'uniform sampler2D tP; uniform float uT; uniform vec2 uRes; varying vec2 vUv;\n' +
  'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\n' +
  'void main(){ vec2 uv=vUv; float t=uT;\n' +
  ' float bp=fract(t*.045); float band=1.-smoothstep(0.,.045,abs((1.-uv.y)-bp));\n' +
  ' float line=floor(uv.y*uRes.y*.5);\n' +
  ' uv.x+=(h(vec2(line,floor(t*24.)))-.5)*.0025+band*(h(vec2(floor(uv.y*180.),t))-.5)*.035+sin(uv.y*4.+t*1.1)*.0012;\n' +
  ' float hs=step(vUv.y,.04); uv.x+=hs*(.025+h(vec2(line,t))*.02);\n' +
  ' float ca=.003+band*.005;\n' +
  ' vec3 c=vec3(texture2D(tP,uv+vec2(ca,0.)).r,texture2D(tP,uv).g,texture2D(tP,uv-vec2(ca,0.)).b);\n' +
  ' vec3 bl=(texture2D(tP,uv+vec2(.007,0.)).rgb+texture2D(tP,uv-vec2(.007,0.)).rgb+c)/3.;\n' +
  ' float l=dot(c,vec3(.299,.587,.114)); c=vec3(l)+(bl-dot(bl,vec3(.299,.587,.114)))*1.1;\n' +
  ' c*=.84+.16*sin(vUv.y*uRes.y*1.5708);\n' +
  ' c+=(h(vUv*uRes+fract(t)*91.)-.5)*.09; c+=band*step(.82,h(vec2(floor(vUv.x*uRes.x*.25),floor(t*30.)+line)))*.35;\n' +
  ' c=mix(c,vec3(h(vec2(vUv.x*300.,t))*.25)+c*.4,hs*.8);\n' +
  ' c=c*vec3(1.03,.97,1.07)+vec3(.012,.01,.022); vec2 d=vUv-.5; c*=1.-dot(d,d)*1.25; c*=.96+.04*sin(t*9.);\n' +
  ' gl_FragColor=vec4(clamp(c,0.,1.),1.);}';
export function makeVHS(T, w, h, lw, lh) {
  const r = new T.WebGLRenderer({ antialias: false }); r.setPixelRatio(1); r.setSize(w, h, false); r.shadowMap.enabled = true; r.shadowMap.type = T.BasicShadowMap;
  const rt = new T.WebGLRenderTarget(lw, lh, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const rp = new T.WebGLRenderTarget(lw, lh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  const post = makePost(T, rt.texture, {}); post.uniforms.uRes.value.set(lw, lh); if (post.uniforms.uE) post.uniforms.uE.value = 2.3;
  const vhs = new T.ShaderMaterial({ uniforms: { tP: { value: rp.texture }, uT: { value: 0 }, uRes: { value: new T.Vector2(w, h) } }, vertexShader: POST_VS, fragmentShader: VHS_FS });
  const quad = mat => { const s = new T.Scene(), q = new T.Mesh(new T.PlaneGeometry(2, 2), mat); q.frustumCulled = false; s.add(q); return s; };
  const ps = quad(post), vs = quad(vhs), pc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    r,
    resize(width, height) { r.setSize(width, height, false); vhs.uniforms.uRes.value.set(width, height); },
    render(scene, cam, t) { post.uniforms.uT.value = t; vhs.uniforms.uT.value = t; r.setRenderTarget(rt); r.render(scene, cam); r.setRenderTarget(rp); r.render(ps, pc); r.setRenderTarget(null); r.render(vs, pc); },
    dispose() {
      ps.children[0].geometry.dispose(); vs.children[0].geometry.dispose();
      post.dispose(); vhs.dispose(); rt.dispose(); rp.dispose(); r.dispose(); r.forceContextLoss();
    },
  };
}
/** The empty table for the title screen: room, lamp, chests, door, felt, no players and no items. */
export function buildTitleScene(T) {
  const k = install({}, T); k.buildTable();
  const keep = new Set([k.chestStd, k.chestBlack, k.door]);
  (k.figs || []).forEach(f => { f.visible = false; });
  (k.pick || []).forEach(o => { if (!keep.has(o)) o.visible = false; });
  k.scene.traverse(o => { if (o.userData && o.userData.id && !keep.has(o)) o.visible = false; });
  k.dispose = () => {
    const geometries = new Set(), materials = new Set([...Object.values(k.m), ...Object.values(k._fc || {})]), textures = new Set();
    k.scene.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) for (const material of Array.isArray(o.material) ? o.material : [o.material]) materials.add(material);
      if (o.shadow) o.shadow.dispose();
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
  };
  return k;
}

// Wildcard artwork supplied in Art Style Samples (7). Rules/ability text live in @the-table/content.
// Retain source art IDs and ordering: they seed paper wear and select the Roman numeral.
export const WILDCARDS = [
  { id: 'seize', name: 'SEIZE' },
  { id: 'destroy', name: 'DESTROY' },
  { id: 'supply', name: 'SUPPLY DROP' },
  { id: 'shatter', name: 'SHATTER' },
  { id: 'exchange', name: 'FORCED EXCHANGE' },
  { id: 'warrant', name: 'SEARCH WARRANT' },
  { id: 'windfall', name: 'WINDFALL' },
  { id: 'redistribution', name: 'REDISTRIBUTION' },
  { id: 'scramble', name: 'SCRAMBLE' },
  { id: 'second', name: 'SECOND CHANCE' },
];
const WILDCARD_ART_ALIASES = { 'supply-drop': 'supply', 'forced-exchange': 'exchange', 'search-warrant': 'warrant', 'second-chance': 'second' };
function wildcardArtId(id) {
  const artId = WILDCARD_ART_ALIASES[id] || id;
  if (artId !== 'back' && !WILDCARDS.some(card => card.id === artId)) throw new Error('Unknown Wildcard artwork: ' + id);
  return artId;
}
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export function drawWildcard(g, id, canvasFactory) { drawWildcardHi(g, wildcardArtId(id)); pixelateCard(g, canvasFactory); }
// Match the table's post-FX: 1/2 resolution, Bayer-dithered 6-level posterize, nearest upscale.
export function pixelateCard(g, canvasFactory) {
  const W = g.canvas.width, H = g.canvas.height, w = W / 2, h = H / 2, t = canvasFactory ? canvasFactory(w, h) : document.createElement('canvas'); t.width = w; t.height = h;
  const tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.drawImage(g.canvas, 0, 0, w, h);
  const d = tg.getImageData(0, 0, w, h), px = d.data, B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], L = 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, b = (B[(y & 3) * 4 + (x & 3)] / 16 - .5) / L * .6; for (let c = 0; c < 3; c++) { const lv = 9, v = px[i + c] / 255 + b * (L - 1) / (lv - 1); px[i + c] = Math.round(Math.max(0, Math.min(1, v)) * (lv - 1)) / (lv - 1) * 255; } }
  tg.putImageData(d, 0, 0); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H); g.drawImage(t, 0, 0, W, H); g.restore();
}
export function drawWildcardHi(g, id) {
  id = wildcardArtId(id);
  const W = 96, H = 144, back = id === 'back', r = seeded(back ? 91 : id.length * 131 + id.charCodeAt(0));
  // aged ochre paper (darker for the back), fibres, stains, faded patches
  g.fillStyle = back ? '#8a5a28' : '#c49a3e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v < .5 ? 'rgba(48,26,6,' + (r() * .22) + ')' : 'rgba(236,196,110,' + (r() * .1) + ')'; g.fillRect(r() * W | 0, r() * H | 0, 1 + (r() < .2), 1); }
  for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H, rr = 6 + r() * 18, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(70,38,8,' + (.16 + r() * .16) + ')'); gr.addColorStop(.7, 'rgba(60,36,10,.05)'); gr.addColorStop(1, 'rgba(60,36,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  for (let i = 0; i < 3; i++) { const x = r() * W, y = r() * H, rr = 10 + r() * 16, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(236,196,110,.18)'); gr.addColorStop(1, 'rgba(236,196,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  // worn dark-brown border + simple inner rule
  g.fillStyle = '#3a2414'; g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H);
  g.fillRect(9, 9, W - 18, 1); g.fillRect(9, H - 10, W - 18, 1); g.fillRect(9, 9, 1, H - 18); g.fillRect(W - 10, 9, 1, H - 18);
  g.fillStyle = 'rgba(214,164,90,.5)'; for (let i = 0; i < 26; i++) { const e = r() < .5, x = e ? r() * W : (r() < .5 ? r() * 5 : W - r() * 5), y = e ? (r() < .5 ? r() * 5 : H - r() * 5) : r() * H; g.fillRect(x | 0, y | 0, 1, 1); }
  [[0, 0], [W - 4, 0], [0, H - 4], [W - 4, H - 4]].forEach(([x, y]) => { g.fillStyle = 'rgba(176,128,60,.75)'; g.fillRect(x + (x ? 2 : 0), y + (y ? 2 : 0), 2, 2); });
  const ink = '#22150b', P = back ? '#8a5a28' : '#c49a3e', cx = W / 2, cy = 84;
  const path = (pts, close) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); };
  const paint = (fill, lw = 1.6) => { if (fill) { g.fillStyle = fill === true ? ink : fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); } };
  const poly = (pts, fill, lw) => { path(pts, true); paint(fill, lw); };
  const line = (pts, lw = 1.6, col = ink) => { path(pts, false); g.lineWidth = lw; g.strokeStyle = col; g.stroke(); };
  const circ = (x, y, r, fill, lw, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(x, y, r, a0, a1); paint(fill, lw); };
  const ell = (x, y, rx, ry, rot, fill, lw) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); paint(fill, lw); };
  const rect = (x, y, w, h, fill, lw) => { g.beginPath(); g.rect(x, y, w, h); paint(fill, lw); };
  const hatch = (clip, step = 2.6) => { g.save(); clip(); g.clip(); g.lineWidth = .8; g.strokeStyle = ink; for (let i = -160; i < 160; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 150, 150); g.stroke(); } g.restore(); };
  const head = (x, y, ang, s = 5.5) => poly([[x, y], [x - Math.cos(ang - .5) * s, y - Math.sin(ang - .5) * s], [x - Math.cos(ang + .5) * s, y - Math.sin(ang + .5) * s]], true, 0);
  const arc = (x, y, r, a0, a1, lw = 2.2, tip = true) => { g.beginPath(); g.arc(x, y, r, a0, a1); g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); if (tip) head(x + Math.cos(a1) * r, y + Math.sin(a1) * r, a1 + Math.PI / 2 * Math.sign(a1 - a0), 6); };
  const coin = (x, y, r, tilt = 1, rot = 0) => { ell(x, y + 1.4, r, r * tilt, rot, true, 0); ell(x, y, r, r * tilt, rot, P, 1.3); ell(x, y, r * .62, r * .62 * tilt, rot, 0, .9); if (tilt > .6) { g.fillStyle = ink; g.fillRect(x - .6, y - r * .45 * tilt, 1.2, r * .9 * tilt); } };
  const streaks = (x, y, n = 3, len = 7) => { for (let i = 0; i < n; i++) line([[x - 3 + i * 3, y - len - i % 2 * 2], [x - 3 + i * 3, y - 2]], .9); };
  const key = (x, y, s = 1) => { circ(x, y, 5 * s, true, 0); circ(x, y, 2 * s, P, 0); rect(x + 4 * s, y - 1.2 * s, 13 * s, 2.4 * s, true, 0); rect(x + 13 * s, y + 1, 2 * s, 3.5 * s, true, 0); rect(x + 16 * s, y + 1, 1.8 * s, 2.5 * s, true, 0); };
  const vial = (x, y) => { rect(x - 1.8, y - 9, 3.6, 5, P, 1.1); circ(x, y + 1, 5.5, true, 0); line([[x - 4, y + 1], [x + 4, y + 1]], 1, P); circ(x - 2, y - 1, .9, P, 0); };
  const diamond = (x, y, r, fill) => poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], fill === undefined ? true : fill, fill === undefined ? 0 : 1);
  // corner ornaments on the inner rule
  [[9.5, 9.5], [W - 9.5, 9.5], [9.5, H - 9.5], [W - 9.5, H - 9.5]].forEach(([x, y]) => { diamond(x, y, 3, P); diamond(x, y, 1.2); });
  if (back) {
    for (let y = 16; y < H - 14; y += 6) { circ(14, y, .7, true, 0); circ(W - 14, y, .7, true, 0); }
    for (let x = 18; x < W - 16; x += 6) { circ(x, 14, .7, true, 0); circ(x, H - 14, .7, true, 0); }
    for (let i = 0; i < 24; i++) { const an = i / 24 * Math.PI * 2, r0 = i % 2 ? 30 : 27; line([[cx + Math.cos(an) * r0, H / 2 + Math.sin(an) * r0], [cx + Math.cos(an) * 36, H / 2 + Math.sin(an) * 36]], 1); }
    poly([[cx, 24], [W - 18, H / 2], [cx, H - 24], [18, H / 2]], 0, 1.8); poly([[cx, 32], [W - 26, H / 2], [cx, H - 32], [26, H / 2]], 0, .9);
    poly([[cx, 44], [W - 36, H / 2], [cx, H - 44], [36, H / 2]], true, 0);
    g.beginPath(); g.moveTo(cx - 13, H / 2); g.quadraticCurveTo(cx, H / 2 - 11, cx + 13, H / 2); g.quadraticCurveTo(cx, H / 2 + 11, cx - 13, H / 2); g.closePath(); paint(P, 0);
    circ(cx, H / 2, 4.6, true, 0); circ(cx, H / 2, 1.8, P, 0);
    [[cx, 18], [cx, H - 18], [15, H / 2], [W - 15, H / 2]].forEach(([x, y]) => { diamond(x, y, 3.2, P); diamond(x, y, 1.4); });
    return;
  }
  const c = WILDCARDS.find(x => x.id === id) || { name: id.toUpperCase() }, num = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][WILDCARDS.indexOf(c)] || '';
  const words = c.name.split(' '), lines = words.length > 1 && c.name.length > 8 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [c.name];
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink;
  const maxW = W - 24;
  lines.forEach((ln, i) => { let fs = 20; g.font = fs + 'px VT323, "Courier New", monospace'; while (g.measureText(ln).width > maxW && fs > 14) { fs--; g.font = fs + 'px VT323, "Courier New", monospace'; }
    const mw = g.measureText(ln).width, sx = Math.min(1, maxW / mw), y = (lines.length > 1 ? 20 : 27) + i * 14;
    g.save(); g.translate(cx, y); g.scale(sx, 1); g.fillText(ln, 0, 0); g.restore(); });
  const ry = lines.length > 1 ? 45 : 40; rect(22, ry, W - 44, 1.6, true, 0); diamond(cx, ry + .8, 2.6, P); diamond(cx, ry + .8, 1);
  // medallion: shaded disc, tick ring, rays
  circ(cx, cy, 31, 'rgba(70,38,8,.2)', 1.4); circ(cx, cy, 27.5, 0, .7);
  for (let i = 0; i < 36; i++) { const an = i / 36 * Math.PI * 2; line([[cx + Math.cos(an) * 27.5, cy + Math.sin(an) * 27.5], [cx + Math.cos(an) * (i % 3 ? 29.5 : 31), cy + Math.sin(an) * (i % 3 ? 29.5 : 31)]], .8); }
  // numeral
  g.font = '12px VT323, "Courier New", monospace'; g.fillStyle = ink; g.fillText(num, cx, 126); diamond(cx - 12, 126, 1.8); diamond(cx + 12, 126, 1.8); rect(cx - 30, 125.4, 14, 1.2, true, 0); rect(cx + 16, 125.4, 14, 1.2, true, 0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (id === 'seize') {
    poly([[34, 80], [40, 74], [58, 74], [52, 80]], P, 1.4); rect(34, 80, 18, 18, P, 1.4);
    poly([[52, 80], [58, 74], [58, 92], [52, 98]], P, 1.4); hatch(() => path([[52, 80], [58, 74], [58, 92], [52, 98]], true));
    rect(38, 84, 10, 1, true, 0); rect(38, 88, 7, 1, true, 0);
    rect(66, 80, 9, 16, true, 0); line([[66, 82], [75, 82]], .8, P); line([[66, 94], [75, 94]], .8, P);
    g.beginPath(); g.moveTo(66, 80); g.quadraticCurveTo(58, 79, 56, 86); g.lineTo(56, 94); g.quadraticCurveTo(60, 98, 66, 96); g.closePath(); paint(true, 0);
    [80, 84.5, 89, 93.5].forEach((y, i) => { g.beginPath(); g.moveTo(58, y); g.lineTo(48 + (i === 3 ? 2 : 0), y); g.arc(48 + (i === 3 ? 2 : 0), y + 1.8, 1.8, -Math.PI / 2, Math.PI / 2, true); g.lineTo(58, y + 3.6); paint(true, 0); line([[56, y + 3.8], [52, y + 3.8]], .6, P); });
    g.beginPath(); g.moveTo(62, 80); g.quadraticCurveTo(56, 72, 47, 76); g.lineTo(46, 79); g.quadraticCurveTo(54, 77, 58, 82); paint(true, 0);
    [82, 89, 96].forEach((y, i) => line([[16 + i * 2, y], [29, y]], 1.2)); head(14, 89, Math.PI, 6);
  }
  if (id === 'destroy') {
    poly([[28, 106], [32, 90], [41, 84], [56, 84], [64, 90], [68, 106]], P, 1.5); hatch(() => path([[56, 84], [64, 90], [68, 106], [60, 106], [58, 92]], true), 2.2);
    line([[48, 84], [45, 90], [50, 95], [46, 100], [49, 106]], 1.6); line([[45, 90], [38, 93]], 1.1); line([[50, 95], [57, 97]], 1.1);
    [[24, 84, .4], [70, 80, -.6], [30, 74, 1.1], [66, 70, .2]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r); poly([[0, -3.5], [3.5, 2.5], [-3, 2]], true, 0); g.restore(); });
    for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + (i - 3.5) * .32; line([[48 + Math.cos(an) * 4, 82 + Math.sin(an) * 4], [48 + Math.cos(an) * 9, 82 + Math.sin(an) * 9]], 1); }
    g.save(); g.translate(58, 68); g.rotate(-.75);
    rect(-2.2, 2, 4.4, 30, P, 1.2); line([[-.6, 6], [-.6, 14]], .7); line([[.8, 18], [.8, 28]], .7); rect(-3, 26, 6, 6, true, 0);
    rect(-12, -6, 24, 10, true, 0); rect(-14, -5, 2.5, 8, true, 0); rect(11.5, -5, 2.5, 8, true, 0); line([[-10, -3.5], [9, -3.5]], .9, P); rect(-2.5, 4, 5, 2, true, 0);
    g.restore();
  }
  if (id === 'supply') {
    circ(cx, 70, 19, P, 1.5, Math.PI, 0); hatch(() => { g.beginPath(); g.arc(cx, 70, 19, Math.PI, Math.PI * 1.33); g.lineTo(cx, 70); g.closePath(); });
    [-19, -9.5, 0, 9.5].forEach(dx => circ(cx + dx + 4.75, 70, 4.75, P, 1.3, 0, Math.PI));
    [-9.5, 0, 9.5].forEach(dx => line([[cx + dx, 70], [cx + dx * .55, 52]], .8));
    line([[cx - 19, 70], [39, 86]], .8); line([[cx - 9.5, 72], [42, 86]], .7); line([[cx + 9.5, 72], [54, 86]], .7); line([[cx + 19, 70], [57, 86]], .8);
    rect(38, 86, 20, 18, P, 1.5); line([[38, 92], [58, 92]], .9); line([[38, 98], [58, 98]], .9); line([[39, 87], [57, 103]], 1.4); line([[57, 87], [39, 103]], 1.4);
    [[40, 88], [56, 88], [40, 102], [56, 102]].forEach(([x, y]) => circ(x, y, .8, true, 0));
    streaks(26, 100, 3, 9); streaks(70, 96, 3, 9);
  }
  if (id === 'shatter') {
    rect(29, 65, 38, 38, 0, 1.6); rect(31.5, 67.5, 33, 33, 0, .7);
    const ox = 49, oy = 83, rays = [[-.2, 18], [.7, 17], [1.6, 16], [2.4, 18], [3.2, 17], [4.1, 16], [5.0, 17]];
    rays.forEach(([an, r]) => line([[ox, oy], [ox + Math.cos(an) * r * .45 + 1.5, oy + Math.sin(an) * r * .45 - 1], [ox + Math.cos(an) * r, oy + Math.sin(an) * r]], 1.2));
    path(rays.map(([an]) => [ox + Math.cos(an) * 7, oy + Math.sin(an) * 7]), true); paint(0, .9); circ(ox, oy, 1.6, true, 0);
    [[20, 62, -2.3], [76, 60, -.8], [22, 106, 2.4], [76, 106, .8]].forEach(([x, y, an]) => { poly([[x, y - 4], [x + 4, y + 3], [x - 3.5, y + 2.5]], true, 0); line([[x - Math.cos(an) * 5, y - Math.sin(an) * 5], [x - Math.cos(an) * 9, y - Math.sin(an) * 9]], .8); });
  }
  if (id === 'exchange') {
    key(22, 84, 1); coin(70, 84, 8);
    arc(cx, 84, 17, Math.PI * 1.12, Math.PI * 1.86); arc(cx, 84, 17, Math.PI * .12, Math.PI * .86);
    [[cx - 8, 66], [cx + 8, 102]].forEach(([x, y], i) => { line([[x - 2, y - (i ? -2 : 2)], [x + 2, y - (i ? -2 : 2)]], .8); });
  }
  if (id === 'warrant') {
    g.beginPath(); g.moveTo(26, 70); g.quadraticCurveTo(cx, 52, 70, 70); g.quadraticCurveTo(cx, 86, 26, 70); g.closePath(); paint(P, 1.6);
    circ(cx, 70, 7.5, true, 0); circ(cx, 70, 3.6, P, 0); circ(cx, 70, 1.8, true, 0); circ(cx + 2.6, 67.4, 1.1, P, 0);
    for (let i = 0; i < 7; i++) { const t = .15 + i * .7 / 6, x = 26 + 44 * t, y = 70 - 18 * 4 * t * (1 - t) * .5; line([[x, y - 1], [x + (t - .5) * 4, y - 5]], 1); }
    [-6, 0, 6].forEach(dx => { g.setLineDash([1.6, 2]); line([[cx + dx * .6, 80], [cx + dx, 89]], .8); g.setLineDash([]); });
    circ(cx, 94, 6.5, 0, 2.6, Math.PI, 0); line([[cx - 6.5, 94], [cx - 6.5, 96]], 2.6); line([[cx + 6.5, 94], [cx + 6.5, 96]], 2.6);
    rect(38, 96, 20, 15, true, 0); line([[38.5, 98.5], [57.5, 98.5]], .7, P); circ(cx, 102, 2.2, P, 0); poly([[cx - 1.2, 102.5], [cx + 1.2, 102.5], [cx + 1.6, 107], [cx - 1.6, 107]], P, 0);
    [[40.5, 109], [55.5, 109]].forEach(([x, y]) => circ(x, y, .8, P, 0));
  }
  if (id === 'windfall') {
    g.beginPath(); [[34, 60, 6], [42, 56, 8], [52, 57, 7], [60, 61, 6]].forEach(([x, y, r]) => g.arc(x, y, r, Math.PI, 0)); g.lineTo(66, 64); g.lineTo(28, 64); g.closePath(); paint(P, 1.3); hatch(() => { g.beginPath(); g.rect(28, 61, 38, 3); }, 2);
    [[34, 76, .9, .2], [56, 74, .45, -.5], [44, 88, 1, 0], [64, 92, .7, .4], [30, 98, .55, -.3], [50, 104, .85, .2]].forEach(([x, y, t, r], i) => { streaks(x, y - 8, 3, 6); coin(x, y, 6 + (i % 2), t, r); });
    [[24, 82], [70, 80], [40, 110]].forEach(([x, y]) => { line([[x - 2.5, y], [x + 2.5, y]], .9); line([[x, y - 2.5], [x, y + 2.5]], .9); });
  }
  if (id === 'redistribution') {
    [30, 48, 66].forEach((x, i) => { const y = i === 1 ? 62 : 66; coin(x, y, 5.5, .8); g.setLineDash([2, 2]); line([[x, y + 7], [cx + (x - cx) * .25, 88]], 1); g.setLineDash([]); head(cx + (x - cx) * .25, 89, Math.atan2(89 - y - 7, cx + (x - cx) * .25 - x), 5); });
    g.beginPath(); g.moveTo(30, 96); g.quadraticCurveTo(32, 108, cx, 110); g.quadraticCurveTo(64, 108, 66, 96); g.lineTo(60, 97); g.quadraticCurveTo(cx, 103, 36, 97); g.closePath(); paint(true, 0);
    [36, 42, 48, 54].forEach(x => { g.beginPath(); g.arc(x + 3, 96.5, 3, Math.PI, 0); paint(true, 0); });
    rect(42, 108, 12, 6, true, 0); line([[42, 110.5], [54, 110.5]], .7, P);
    ell(cx, 94, 7, 2.2, 0, true, 0); ell(cx, 92.2, 7, 2.2, 0, P, 1.1); ell(cx, 90, 6, 1.9, 0, P, 1.1);
  }
  if (id === 'scramble') {
    arc(cx, 84, 18, -2.7, -.3); arc(cx, 84, 18, .45, 2.85);
    key(26, 64, .75); coin(70, 88, 6.5); vial(32, 104);
    circ(cx, 84, 3, true, 0); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + .785; line([[cx + Math.cos(an) * 5, 84 + Math.sin(an) * 5], [cx + Math.cos(an) * 8, 84 + Math.sin(an) * 8]], 1); }
  }
  if (id === 'second') {
    for (let i = 0; i < 9; i++) { const an = -Math.PI * .9 + i * Math.PI * .8 / 8; line([[cx + Math.cos(an) * 22, 84 + Math.sin(an) * 22], [cx + Math.cos(an) * 26, 84 + Math.sin(an) * 26]], 1); }
    g.beginPath(); g.moveTo(cx, 106); g.bezierCurveTo(cx - 30, 88, cx - 22, 64, cx, 76); g.bezierCurveTo(cx + 22, 64, cx + 30, 88, cx, 106); paint(true, 0);
    g.beginPath(); g.moveTo(cx - 14, 76); g.quadraticCurveTo(cx - 12, 71, cx - 7, 72); g.lineWidth = 1.4; g.strokeStyle = P; g.stroke();
    line([[cx + 1, 76], [cx - 3, 83], [cx + 2.5, 89], [cx - 1.5, 96], [cx, 103]], 1.6, P);
    [[80, 1], [87, -1], [94, 1]].forEach(([y, s]) => { line([[cx - 4, y - 2], [cx + 4, y + 2]], 1, P); line([[cx - 4, y + 2], [cx + 4, y - 2]], 1, P); });
    rect(64, 62, 8, 2.4, true, 0); rect(66.8, 59.2, 2.4, 8, true, 0);
  }
}

export function jobIconURL(id, color = '#2a1a0e', out = 32) {
  const S = 64, a = document.createElement('canvas'); a.width = a.height = S; const g = a.getContext('2d'), r = seeded(id.length * 977 + id.charCodeAt(0) * 13);
  g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'square'; g.lineJoin = 'miter';
  const P = (pts, fill, close = true) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); if (close) g.closePath(); fill ? g.fill() : g.stroke(); };
  const Ci = (x, y, rr, fill, a0 = 0, a1 = 7) => { g.beginPath(); g.arc(x, y, rr, a0, a1); fill ? g.fill() : g.stroke(); };
  const head = (x, y, an, s = 11) => P([[x, y], [x - Math.cos(an - .55) * s, y - Math.sin(an - .55) * s], [x - Math.cos(an + .55) * s, y - Math.sin(an + .55) * s]], true);
  const arrow = (x1, y1, x2, y2) => { P([[x1, y1], [x2, y2]], false, false); head(x2, y2, Math.atan2(y2 - y1, x2 - x1)); };
  const coin = (x, y, rr) => { Ci(x, y, rr, false); g.fillRect(x - 2, y - rr * .5, 4, rr); };
  const hand = (x, y, s = 1) => { g.save(); g.translate(x, y); g.scale(s, s); g.fillRect(-12, -2, 24, 16); for (let i = 0; i < 4; i++) g.fillRect(-12 + i * 6.4, -16 + (i % 3 ? 0 : 4), 4.6, 15); g.fillRect(12, 2, 9, 5); g.restore(); };
  const eye = (x, y, w, h) => { g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - h * 2, x + w, y); g.quadraticCurveTo(x, y + h * 2, x - w, y); g.stroke(); Ci(x, y, h * .62, true); };
  if (id === 'deal') { arrow(10, 22, 52, 22); arrow(54, 42, 12, 42); }
  if (id === 'blood') { g.save(); g.translate(30, 30); g.rotate(-.78); P([[-4, -24], [4, -24], [4, 10], [0, 16], [-4, 10]], true); g.fillRect(-10, 12, 20, 5); g.fillRect(-3, 17, 6, 12); g.restore(); g.beginPath(); g.moveTo(50, 34); g.quadraticCurveTo(58, 48, 50, 54); g.quadraticCurveTo(42, 48, 50, 34); g.fill(); }
  if (id === 'debt') { coin(26, 34, 16); g.fillRect(50, 10, 6, 28); g.fillRect(50, 44, 6, 6); }
  if (id === 'patch') { g.save(); g.translate(32, 32); g.rotate(-.7); g.strokeRect(-24, -9, 48, 18); g.fillRect(-7, -9, 14, 18); g.restore(); g.fillRect(44, 6, 5, 15); g.fillRect(39, 11, 15, 5); }
  if (id === 'revive') { g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(4, 38, 10, 14, 32, 26); g.bezierCurveTo(54, 14, 60, 38, 32, 56); g.fill(); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; P([[32, 28], [32, 48]], false, false); head(32, 28, -Math.PI / 2, 10); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; }
  if (id === 'fallen') { hand(30, 18, 1); P([[12, 44], [52, 44]], false, false); g.fillRect(36, 48, 12, 10); g.save(); g.translate(20, 52); g.rotate(.5); g.fillRect(-6, -5, 12, 9); g.restore(); }
  if (id === 'crack') { g.strokeRect(8, 26, 36, 28); P([[8, 26], [14, 14], [38, 14], [44, 26]], false); g.fillRect(22, 34, 8, 9); Ci(52, 18, 6, false); P([[52, 24], [52, 44]], false, false); g.fillRect(52, 36, 7, 4); }
  if (id === 'look') eye(32, 32, 26, 10);
  if (id === 'sticky') { g.beginPath(); g.moveTo(10, 30); g.lineTo(10, 54); g.lineTo(54, 54); g.lineTo(54, 30); g.stroke(); P([[10, 36], [54, 36]], false, false); hand(32, 22, .9); }
  if (id === 'guard') { g.beginPath(); g.moveTo(32, 6); g.lineTo(54, 14); g.quadraticCurveTo(54, 44, 32, 58); g.quadraticCurveTo(10, 44, 10, 14); g.closePath(); g.stroke(); g.lineWidth = 4; P([[34, 8], [26, 24], [36, 34], [28, 56]], false, false); }
  if (id === 'callbluff') { eye(24, 36, 18, 7); g.lineWidth = 6; g.beginPath(); g.arc(48, 16, 8, Math.PI * 1.05, Math.PI * .45); g.stroke(); g.fillRect(45, 26, 6, 8); g.fillRect(45, 38, 6, 5); }
  if (id === 'sellbluff') { g.save(); g.translate(42, 30); g.rotate(.25); g.strokeRect(-9, -14, 18, 28); g.restore(); g.beginPath(); g.moveTo(6, 56); g.quadraticCurveTo(10, 30, 24, 16); g.quadraticCurveTo(38, 30, 44, 56); g.closePath(); g.fill(); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; g.fillRect(16, 38, 3, 16); g.fillRect(28, 36, 3, 18); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; }
  if (id === 'table') { P([[32, 4], [58, 32], [32, 60], [6, 32]], false); P([[32, 18], [44, 32], [32, 46], [20, 32]], true); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; Ci(32, 32, 5, true); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; Ci(32, 32, 2.2, true); }
  if (id === 'pay') { coin(16, 44, 9); coin(34, 50, 9); arrow(22, 22, 52, 10); }
  // distress: chew pixels out, heavier near edges of strokes
  const d = g.getImageData(0, 0, S, S), px = d.data; for (let i = 0; i < S * S; i++) if (px[i * 4 + 3] && r() < .05) px[i * 4 + 3] = 0; g.putImageData(d, 0, 0);
  const b = document.createElement('canvas'); b.width = b.height = out; const h = b.getContext('2d'); h.imageSmoothingEnabled = true; h.drawImage(a, 0, 0, out, out);
  const e = h.getImageData(0, 0, out, out), q = e.data; for (let i = 0; i < out * out; i++) q[i * 4 + 3] = q[i * 4 + 3] > 110 && r() > .015 ? 255 : 0; h.putImageData(e, 0, 0);
  h.globalCompositeOperation = 'source-in'; h.fillStyle = color; h.fillRect(0, 0, out, out);
  return b.toDataURL();
}

// Hammered medieval coin: irregular edge, beaded rim, inscription band, beaded inner ring, cross pattée with quarter motifs. Embossed face texture (colour + bump), worn tarnish in recesses.
Kit.prototype.coinMesh = function () {
  const T = this.T, PI = Math.PI;
  const canvas = (w, h) => { const c = this.canvasFactory ? this.canvasFactory(w, h) : document.createElement('canvas'); c.width = w; c.height = h; return c; };
  if (!this._coinMat) {
    const S = 128, c = canvas(S, S); const g0 = c.getContext('2d'); const lo = canvas(40, 40); const g = { createImageData: (w, h) => g0.createImageData(w, h), putImageData: (d) => { g0.putImageData(d, 0, 0); const lg = lo.getContext('2d'); lg.imageSmoothingEnabled = true; lg.drawImage(c, 0, 0, 40, 40); g0.imageSmoothingEnabled = false; g0.clearRect(0, 0, S, S); g0.drawImage(lo, 0, 0, S, S); } };
    const b = canvas(S, S); const h = b.getContext('2d');
    const cx = S / 2, R = S / 2 - 1;
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // relief drawn as height (white = raised) then shaded into colour
    h.fillStyle = '#000'; h.fillRect(0, 0, S, S); h.fillStyle = '#5a5a5a'; h.beginPath(); h.arc(cx, cx, R, 0, 7); h.fill();
    const ring = (r, n, sz, col) => { h.fillStyle = col; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; h.beginPath(); h.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, sz, 0, 7); h.fill(); } };
    ring(R - 3, 64, 2.1, '#fff');
    h.strokeStyle = '#d0d0d0'; h.lineWidth = 1.6; h.beginPath(); h.arc(cx, cx, R - 6.5, 0, 7); h.stroke();
    // inscription: blocky pseudo-gothic glyphs around the band
    h.save(); h.translate(cx, cx); const glyphs = 17;
    for (let i = 0; i < glyphs; i++) { h.save(); h.rotate(i / glyphs * PI * 2 - PI / 2); h.translate(0, -(R - 14)); h.fillStyle = '#fff';
      if (i % 6 === 5) { h.beginPath(); h.arc(0, 0, 1.6, 0, 7); h.fill(); h.beginPath(); h.arc(0, 4, 1.6, 0, 7); h.fill(); }
      else { const k = (rnd() * 6) | 0; h.fillRect(-3.4, -4.5, 1.9, 9); if (k & 1) h.fillRect(1.5, -4.5, 1.9, 9); if (k & 2) h.fillRect(-3.4, -4.5, 6.8, 1.9); if (k & 4) h.fillRect(-3.4, 2.6, 6.8, 1.9); if (k === 0 || k === 3) h.fillRect(-1, -1, 3, 1.8); }
      h.restore(); }
    h.restore();
    h.strokeStyle = '#d0d0d0'; h.lineWidth = 1.6; h.beginPath(); h.arc(cx, cx, R - 21.5, 0, 7); h.stroke(); ring(R - 24, 44, 1.3, '#e8e8e8');
    // cross pattée
    h.fillStyle = '#fff'; const L = R - 27, w0 = 4.5, w1 = 9;
    [0, 1, 2, 3].forEach(q => { h.save(); h.translate(cx, cx); h.rotate(q * PI / 2); h.beginPath(); h.moveTo(-w0, 0); h.lineTo(-w0, -L + 7); h.lineTo(-w1, -L); h.lineTo(w1, -L); h.lineTo(w0, -L + 7); h.lineTo(w0, 0); h.fill(); h.restore(); });
    h.fillRect(cx - w0, cx - w0, w0 * 2, w0 * 2);
    // quarter motifs: lis, crown, leaf, three pellets
    const Q = R - 27 - 16, qd = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    qd.forEach(([sx, sy], i) => { const x = cx + sx * Q * .55, y = cx + sy * Q * .55; h.fillStyle = '#c8c8c8';
      if (i === 0) { h.fillRect(x - 6, y - 1, 12, 5); for (let j = -1; j <= 1; j++) { h.beginPath(); h.moveTo(x + j * 4.5 - 2, y - 1); h.lineTo(x + j * 4.5, y - 7); h.lineTo(x + j * 4.5 + 2, y - 1); h.fill(); } }
      if (i === 1) { h.beginPath(); h.ellipse(x, y - 2, 2, 5, 0, 0, 7); h.fill(); h.beginPath(); h.ellipse(x - 4, y, 2, 4, -.7, 0, 7); h.fill(); h.beginPath(); h.ellipse(x + 4, y, 2, 4, .7, 0, 7); h.fill(); h.fillRect(x - 5, y + 2, 10, 2); h.fillRect(x - 1, y + 4, 2, 4); }
      if (i === 2) { h.beginPath(); h.ellipse(x, y, 3.2, 6.5, .6, 0, 7); h.fill(); h.fillStyle = '#5a5a5a'; h.fillRect(x - .6, y - 5, 1.2, 10); }
      if (i === 3) [[0, -4], [-4, 2.5], [4, 2.5]].forEach(([ox, oy]) => { h.beginPath(); h.arc(x + ox, y + oy, 2.8, 0, 7); h.fill(); }); });
    // casting grain + wear
    const hd = h.getImageData(0, 0, S, S), hp = hd.data;
    for (let i = 0; i < S * S; i++) { const n = (rnd() - .5) * 8; hp[i * 4] = hp[i * 4 + 1] = hp[i * 4 + 2] = Math.max(0, Math.min(255, hp[i * 4] + n)); }
    h.putImageData(hd, 0, 0);
    // shade: emboss from height (light from top-left), gold ramp, dark tarnish in recesses
    const H = h.getImageData(0, 0, S, S).data, out = g.createImageData(S, S), o = out.data, hv = (x, y) => H[((Math.max(0, Math.min(S - 1, y)) * S) + Math.max(0, Math.min(S - 1, x))) * 4];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, v = hv(x, y) / 255, sh = (hv(x - 1, y - 1) - hv(x + 1, y + 1)) / 255;
      const l = Math.max(0, Math.min(1.25, .5 + v * .45 + sh * .9)), t = 1 - v;
      o[i] = Math.min(255, (176 * l + 20) * (1 - t * .38)); o[i + 1] = Math.min(255, (134 * l + 12) * (1 - t * .44)); o[i + 2] = Math.min(255, (64 * l + 6) * (1 - t * .5)); o[i + 3] = 255; }
    g.putImageData(out, 0, 0);
    const tx = new T.CanvasTexture(c), bx = new T.CanvasTexture(b); [tx, bx].forEach(t => { t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; });
    if ('colorSpace' in tx) tx.colorSpace = T.SRGBColorSpace;
    this._coinFace = new T.MeshPhongMaterial({ map: tx, bumpMap: bx, bumpScale: .9, emissive: 0x3a2a0c, emissiveMap: tx, emissiveIntensity: .35, shininess: 55, specular: 0x8a7444, flatShading: true });
    this._coinMat = new T.MeshPhongMaterial({ color: 0x9a7634, emissive: 0x1e1406, shininess: 40, specular: 0x8a7040, flatShading: true });
  }
  const g = new T.Group(), R = .07, Hh = .012, N = 20, sh = new T.Shape();
  let sd = Math.random() * 1e5 | 0; const rnd = () => (sd = (sd * 16807 + 1) % 2147483647) / 2147483647;
  for (let i = 0; i <= N; i++) { const a = i / N * PI * 2, r = R * (1 + (i % N ? (rnd() - .5) * .05 : 0)); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(r, 0); }
  const body = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: Hh, bevelEnabled: true, bevelSize: .0025, bevelThickness: .0018, bevelSegments: 1, curveSegments: 1 }), this._coinMat); body.rotation.x = -PI / 2; body.castShadow = true; g.add(body);
  [1, -1].forEach(s => { const f = new T.Mesh(new T.CircleGeometry(R * .97, 20), this._coinFace); f.rotation.x = -PI / 2 * s; f.rotation.z = rnd() * PI * 2; f.position.y = s > 0 ? Hh + .0019 : -.0019; g.add(f); });
  g.rotation.z = (rnd() - .5) * .08; g.rotation.x = (rnd() - .5) * .06;
  return g;
};

// 1-px dark outline + top-left rim highlight around a transparent icon (keeps tiny 3D icons legible on any ground).
export function outlineIconURL(url, col = '#140c04') { return new Promise(res => { const im = new Image(); im.onload = () => {
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const src = g.getImageData(0, 0, w, h), s = src.data, o = g.createImageData(w, h), d = o.data, A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] > 40;
  const [cr, cg, cb] = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4;
    if (A(x, y)) { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = 255; if (!A(x - 1, y) || !A(x, y - 1)) { d[i] = Math.min(255, s[i] * 1.25 + 30); d[i + 1] = Math.min(255, s[i + 1] * 1.2 + 22); d[i + 2] = Math.min(255, s[i + 2] * 1.1 + 8); } }
    else if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255; } }
  g.putImageData(o, 0, 0); res(c.toDataURL()); }; im.onerror = () => res(url); im.src = url; }); }

// Coin icon (visual-audit patch §17): 16-pixel tarnished brass rim, ring, diamond sigil, scratches and edge thickness.
export function coinIconCanvas(OUT = 32, S = 16) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), p = im.data;
  const P = { out: [28, 18, 8], edge: [74, 52, 22], rimD: [112, 82, 36], rim: [154, 116, 52], rimH: [198, 160, 88], ring: [86, 62, 26], fld: [128, 96, 42], fldL: [146, 110, 50], mk: [204, 168, 96], mkD: [92, 66, 28], scr: [176, 142, 80] };
  const cx = 7.5, cy = 7.1, R = 7.1, set = (x, y, col) => { const i = (y * S + x) * 4; p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = 255; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + .5 - (cx + .5), dy = y + .5 - (cy + .5), d = Math.hypot(dx, dy), dt = Math.hypot(dx, dy - .9), lit = (-dx - dy) / R;
    if (d > R) { if (dt <= R) set(x, y, dt > R - .9 ? P.out : P.edge); continue; }
    let col;
    if (d > R - .95) col = P.out;
    else if (d > R - 2.3) col = lit > .3 ? P.rimH : lit < -.3 ? P.rimD : P.rim;
    else if (d > R - 3.1) col = P.ring;
    else { col = lit > .2 ? P.fldL : P.fld; const md = Math.abs(dx) + Math.abs(dy); if (md < 2.6) col = (dx + dy) > .6 ? P.mkD : P.mk; else if (md < 3.3 && dx + dy > 0) col = P.mkD; }
    set(x, y, col);
  }
  [[4, 9], [5, 10], [11, 5]].forEach(([x, y]) => set(x, y, P.scr));
  g.putImageData(im, 0, 0);
  const o = document.createElement('canvas'); o.width = o.height = OUT; const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, OUT, OUT); return o;
}
export function coinIconURL(out = 32, grid = 16) { return coinIconCanvas(out, grid).toDataURL(); }
export async function stimIconURL(src, size = 48) {
  const im = new Image(); await Promise.race([new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = src; }), new Promise(r => setTimeout(r, 1500))]); const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, size, size);
  const u = size / 16, px = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x * u), Math.round(y * u), Math.ceil(u), Math.ceil(u)); };
  [[12, 1], [12, 2], [12, 3], [11, 2], [13, 2]].forEach(([x, y]) => px(x, y, '#d8ccb0')); [[11, 6], [12, 5], [13, 6]].forEach(([x, y]) => px(x, y, '#e0a040'));
  return c.toDataURL();
}
