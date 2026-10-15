// Canonical consolidated Art Style Samples (12) models, re-exported by the web kit.
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
  const T = this.T, m = this.m, PI = Math.PI, st = pose === 'standing', F = c => this.F(c);
  const M = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; };
  const B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, s = 10, open) => new T.CylinderGeometry(a, b, h, s, 1, !!open);
  const cap = (r, l, mat, x, y, z, rx, ry, rz) => M(new T.CapsuleGeometry(r, l, 3, 8), mat, x, y, z, rx, ry, rz);
  const ell = (sx, sy, sz, mat, x, y, z, rx, ry, rz) => { const o = M(new T.SphereGeometry(1, 14, 10), mat, x, y, z, rx, ry, rz); o.scale.set(sx, sy, sz); return o; };
  const sph = (r, mat, x, y, z) => M(new T.SphereGeometry(r, 8, 6), mat, x, y, z);
  const tor = (r, t, mat, x, y, z, rx, ry, rz, arc = PI * 2) => M(new T.TorusGeometry(r, t, 5, 14, arc), mat, x, y, z, rx, ry, rz);
  const lathe = (pts, mat, sz = .66, a = PI * 2, at = 0, seg = 22) => { const o = M(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg, at - a / 2, a), mat); o.scale.z = sz; return o; };
  const G = (...k) => { const o = new T.Group(); k.flat().forEach(c => o.add(c)); return o; };
  const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); return o; };
  const glow = c => new T.MeshBasicMaterial({ color: c });
  const tex = (w, h, fn) => { const t = this.tex(w, h, fn); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; return t; };
  let sd = role.length * 131 + role.charCodeAt(0) * 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const cloth = (base, o = {}) => { const t = tex(64, 64, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h);
      if (o.stripe) { c.fillStyle = o.stripe; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h); }
      for (let i = 0; i < 800; i++) { c.fillStyle = rnd() < .62 ? 'rgba(0,0,0,' + rnd() * .28 + ')' : 'rgba(255,240,210,' + rnd() * .08 + ')'; c.fillRect(rnd() * w | 0, rnd() * h | 0, 1, 1); }
      for (let i = 0; i < (o.blood || 0); i++) { c.fillStyle = 'rgba(106,16,10,' + (.45 + rnd() * .4) + ')'; const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 5; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); for (let j = 0; j < 5; j++) c.fillRect(x + (rnd() - .5) * r * 3, y + (rnd() - .5) * r * 3, 1, 1 + (rnd() * 3 | 0)); }
      for (let i = 0; i < (o.ink || 0); i++) { c.fillStyle = 'rgba(14,10,8,.88)'; const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 4; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillRect(x, y, 1, 4 + rnd() * 6); }
      if (o.tally) { c.strokeStyle = 'rgba(20,14,10,.9)'; c.lineWidth = 1; for (let k = 0; k < o.tally; k++) { const x = 4 + rnd() * (w - 16), y = 4 + rnd() * (h - 14); for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x + j * 2.5, y); c.lineTo(x + j * 2.5, y + 8); c.stroke(); } c.beginPath(); c.moveTo(x - 1, y + 7); c.lineTo(x + 10, y + 1); c.stroke(); } }
      if (o.cracks) { c.strokeStyle = 'rgba(30,20,16,.85)'; c.lineWidth = 1; for (let k = 0; k < o.cracks; k++) { let x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rnd() - .5) * 14; y += (rnd() - .5) * 14; c.lineTo(x, y); } c.stroke(); } }
      if (o.ledger) { c.fillStyle = 'rgba(40,30,20,.6)'; for (let y = 2; y < h; y += 4) for (let x = 3; x < w - 3; x += 6) if (rnd() < .7) c.fillRect(x, y, 3 + (rnd() * 2 | 0), 1); }
    }); t.wrapS = t.wrapT = T.RepeatWrapping; return new T.MeshPhongMaterial({ map: t, flatShading: true, shininess: o.shine || 6, specular: o.shine ? 0x666666 : 0x111111, side: T.DoubleSide, transparent: false, opacity: 1 }); };
  const steel = m.metal, brass = m.brass, rust = m.rust, dark = F(0x070505), red = F(0x6a1410), copper = F(0xa8582a);
  const band = new T.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: .25 });
  const eyeW = F(0xd8ccb0), pupil = F(0x0a0606);
  const slim = { enforcer: .9, tallyman: .82, fence: 1.08, dealer: .9, medic: .86, locksmith: .76, scavenger: .84, broker: .92, smuggler: .95 }[role] || 1;
  const g = new T.Group(), up = new T.Group(), head = new T.Group();
  up.position.y = st ? .98 : .76; g.add(up); head.position.y = .8; up.add(head);
  const U = (...k) => k.flat().forEach(o => { o.position.y -= .76; up.add(o); });
  const Hd = (...k) => k.flat().forEach(o => { o.position.y -= 1.56; head.add(o); });
  let FZ = .2, WZ = .17;
  const torso = (mat, o = {}) => { const w = slim, ch = o.chest || 1, d = o.d || .62; FZ = .3 * w * ch * d + .008; WZ = .25 * w * (o.waist || 1) * d + .008;
    U(lathe([[0, .78], [.22 * w, .8], [.26 * w, .9], [.25 * w * (o.waist || 1), 1.05], [.28 * w * ch, 1.28], [.3 * w * ch, 1.4], [.26 * w, 1.5], [.11, 1.56], [0, 1.57]], mat, d),
      [-1, 1].map(s => ell(.1 * w, .08, .11, mat, s * .29 * w, 1.45, 0, 0, 0, -s * .25)), M(C(.05, .06, o.neck || .1, 8), o.skin || mat, 0, 1.56 + ((o.neck || .1) - .1) / 2, 0)); };
  const skirt = (mat, lo, flare = 1, open) => { if (st) U(lathe([[.26 * slim, .92], [.3 * slim * flare, .62], [.36 * slim * flare, lo + .08], [.37 * slim * flare, lo]], mat, .72, open ? PI * 2 - .7 : PI * 2, open ? PI : 0));
    else U(lathe([[.26 * slim, .92], [.31 * slim, .78], [.32 * slim, .72]], mat, .72)); };
  const mkHand = (mat, o = {}) => { const h = new T.Group(), fl = o.long ? .09 : .045; h.add(ell(.046, .054, .03, mat, 0, -.005, 0));
    [-.026, -.009, .009, .026].forEach((x, i) => h.add(cap(.0105, fl - (i % 3 ? 0 : .01), o.fingers || mat, x, -.06 - fl / 2, .004, .25))); h.add(cap(.012, .03, o.fingers || mat, .044, -.025, .015, 0, 0, .7)); return h; };
  const armGeo = (k, y1, sc = 1) => { const prof = [[0, .075], [.045, .068], [.066, .04], [.074, 0], [.07, -.08], [.066, -.19], [.058, -.32], [.05, -.42], [.055, -.5], [.057, -.58], [.048, -.7], [.037, -.79], [.036, -.81], [0, -.82]].filter(p => p[1] >= y1 - .001);
      if (prof[prof.length - 1][0] > 0) prof.push([prof[prof.length - 1][0] * .7, prof[prof.length - 1][1] - .02], [0, prof[prof.length - 1][1] - .03]);
      const geo = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r * k * sc, y)), 10); const pos = geo.attributes.position, n = pos.count, si = new T.Uint16BufferAttribute(n * 4, 4), sw = new T.Float32BufferAttribute(n * 4, 4);
      for (let i = 0; i < n; i++) { const y = pos.getY(i), w = Math.min(1, Math.max(0, (-.36 - y) / .12)); pos.setZ(i, pos.getZ(i) * .9); si.setXYZW(i, 0, 1, 0, 0); sw.setXYZW(i, 1 - w, w, 0, 0); }
      geo.setAttribute('skinIndex', si); geo.setAttribute('skinWeight', sw); geo.computeVertexNormals(); return geo; };
  const arm = (side, sleeve, fore, handMat, ho) => { const k = Math.max(1, slim), sh = new T.Bone(); sh.position.set(side * .35 * slim, .68, 0); up.add(sh);
    const el = new T.Bone(); el.position.y = -.42; sh.add(el); el.add(new T.Object3D()); const hand = new T.Group(); hand.position.y = -.39; el.add(hand); if (handMat) hand.add(mkHand(handMat, ho || {}));
    const skel = new T.Skeleton([sh, el]); g.updateMatrixWorld(true);
    const skin1 = (geo, mat) => { const sm = new T.SkinnedMesh(geo, mat); sm.position.copy(sh.position); sm.castShadow = sm.receiveShadow = true; sm.frustumCulled = false; up.add(sm); sm.updateMatrixWorld(true); sm.bind(skel); return sm; };
    if (fore === null) skin1(armGeo(k, -.47), sleeve);
    else if (fore === sleeve) skin1(armGeo(k, -.82), sleeve);
    else { skin1(armGeo(k, -.82), fore); skin1(armGeo(k, -.47, 1.12), sleeve); }
    const cuffY = fore === sleeve ? -.36 : -.04; if (fore !== null) { el.add(tor(.056 * k * (fore === sleeve ? 1 : 1.1), .007, sleeve, 0, cuffY, 0, PI / 2)); }
    [-.05, -.09].forEach((y, i) => el.add(tor((.052 + i * .004) * k * (fore === sleeve || fore === null ? 1 : 1.12), .005, sleeve, 0, y + .06, 0, PI / 2 + (i ? .25 : -.2))));
    sh.add(M(B(.004, .2, .004), dark, side * .0, -.12, .068 * k));
    if (st) { sh.rotation.z = side * .1; return { sh, el, hand, bx: 0, be: -.15 }; } sh.rotation.z = -side * .12; return { sh, el, hand, bx: -.4, be: -1.1 }; };
  const legs = (pant, boot, o = {}) => { if (st) [-1, 1].forEach(s => g.add(cap(.1, .3, pant, s * .1, .7, 0, 0, 0, s * .03), cap(.082, .28, pant, s * .11, .32, 0, 0, 0, s * .02), M(C(.088, .096, .14, 10), boot, s * .115, .12, 0), ell(.09, .062, .16, boot, s * .115, .05, .05), M(B(.17, .025, .21), F(0x0e0b09), s * .115, .012, .03)));
    else { const w = m.wood; g.add(M(B(.62, .06, .58), w, 0, .5, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => M(C(.025, .022, .5, 6), w, a * .27, .25, b * .25)), ...[-.24, -.08, .08, .24].map(x => M(C(.018, .018, 1.05, 6), w, x, 1.06, -.32)), M(B(.66, .06, .07), w, 0, 1.62, -.32), M(B(.62, .05, .05), w, 0, .7, -.32),
      cap(.09, .3, pant, -.12, .58, .18, PI / 2), cap(.09, .3, pant, .12, .58, .18, PI / 2), cap(.075, .34, pant, -.12, .3, .35), cap(.075, .34, pant, .12, .3, .35), ell(.07, .05, .13, boot, -.12, .04, .4), ell(.07, .05, .13, boot, .12, .04, .4)); } };
  const chain = (p, q, n, mat = steel, s = .012, sag = 0) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return tor(s, s * .3, mat, p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - Math.sin(u * PI) * sag, p[2] + (q[2] - p[2]) * u, i % 2 ? PI / 2 : 0, 0, Math.atan2(q[1] - p[1], q[0] - p[0])); });
  const key = (mat = brass, s = 1) => G(M(new T.TorusGeometry(.016 * s, .005 * s, 4, 10), mat, 0, .03 * s, 0), M(C(.004 * s, .004 * s, .06 * s, 5), mat, 0, -.005 * s, 0), M(B(.014 * s, .006 * s, .004 * s), mat, .007 * s, -.03 * s, 0), M(B(.01 * s, .005 * s, .004 * s), mat, .005 * s, -.018 * s, 0));
  const cuffOpen = (s = 1) => G(tor(.026 * s, .0065 * s, steel, 0, 0, 0), tor(.026 * s, .0065 * s, steel, .05 * s, -.012 * s, 0, 0, .5, 0, PI * 1.5), M(B(.014 * s, .02 * s, .012 * s), steel, .025 * s, -.006 * s, 0));
  const ring = (r, mat = steel, t = .013) => tor(r, t, mat, 0, 0, 0, PI / 2);
  const eyes = (x, y, z, r = .022) => [-1, 1].flatMap(s => [ell(r, r * .8, r * .5, eyeW, s * x, y, z), sph(r * .42, pupil, s * x, y, z + r * .4)]);
  const stitches = (x0, x1, y, z, n) => Array.from({ length: n }, (_, i) => M(B(.003, .022, .004), dark, x0 + (x1 - x0) * i / (n - 1), y, z));
  const card = new T.MeshLambertMaterial({ side: T.DoubleSide, map: tex(16, 24, (c, w, h) => { c.fillStyle = '#d8ccb0'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a4a38'; c.fillRect(0, 0, w, 1); c.fillRect(0, h - 1, w, 1); c.fillStyle = '#8a1a14'; c.beginPath(); c.moveTo(8, 7); c.lineTo(12, 12); c.lineTo(8, 17); c.lineTo(4, 12); c.fill(); c.fillStyle = '#1a1410'; c.fillRect(2, 2, 2, 3); c.fillRect(12, 19, 2, 3); }) });
  const P = { up, head, role, gx: 0 }; let aL, aR;

  if (role === 'enforcer') {   // black leather trenchcoat, peaked military cap, revolver face, bullet teeth, wearing handcuffs: wrists, collar, ankles, dangling from the belt
    const skin = cloth('#8a7c74'), coat = cloth('#141212', { shine: 40 }), pant = cloth('#1a1818'), boot = new T.MeshPhongMaterial({ color: 0x0c0a0a, shininess: 70, specular: 0x555050, flatShading: true }), glove = new T.MeshPhongMaterial({ color: 0x100e0e, shininess: 50, specular: 0x444040, flatShading: true });
    const cuffC = (r, t = .008) => G(tor(r, t, steel, 0, 0, 0, PI / 2), M(B(.022, .018, .02), steel, r, 0, 0));
    torso(coat, { chest: 1.02, skin });
    if (st) U(lathe([[.25 * slim, 1.02], [.29 * slim, .6], [.34 * slim, .05], [.35 * slim, -.02]], coat, .72, PI * 2 - .55, PI));
    { const w = slim * 1.02, cIn = F(0x242020);
      U(lathe([[.075, 1.5], [.09, 1.56], [.11, 1.64], [.135, 1.7], [.14, 1.71]], coat, .95, PI * 2 - .55, PI, 22), lathe([[.072, 1.5], [.086, 1.56], [.106, 1.64], [.13, 1.7]], cIn, .93, PI * 2 - .55, PI, 22), lathe([[.14, 1.71], [.16, 1.66], [.17, 1.6], [.175, 1.57]], coat, .95, PI * 2 - .8, PI, 22));
      [-1, 1].forEach(s => U(lathe([[.262 * w, 1.52], [.31 * w, 1.41], [.296 * w, 1.29], [.282 * w, 1.18]], coat, .64, .42, s * .28, 4), lathe([[.258 * w, 1.52], [.305 * w, 1.41]], cIn, .645, .12, s * .45, 2))); }
    U(...[1.36, 1.26, 1.16].flatMap(y => [-1, 1].map(s => sph(.011, steel, s * .07, y, FZ + .012))));
    { const b = M(C(.25 * slim, .25 * slim, .05, 16), coat, 0, 1.0, 0); b.scale.z = .66; U(b, M(B(.06, .05, .02), steel, 0, 1.0, WZ + .012)); }
    U(at(cuffC(.064, .008), 0, 1.565, .005), ...chain([.064, 1.56, .02], [.05, 1.46, FZ - .005], 4, steel, .009));
    [-1, 1].forEach(s => U(...chain([s * .14, .99, WZ], [s * .17, .82, WZ + .01], 6, steel, .011), at(cuffOpen(1.1), s * .17, .77, WZ + .015, 0, 0, s * .4)));
    aL = arm(-1, coat, coat, glove); aR = arm(1, coat, coat, glove);
    [aL, aR].forEach((a, i) => { a.sh.add(M(B(.1, .025, .08), coat, 0, .02, 0)); a.el.add(at(cuffC(.064), 0, -.34, 0), ...chain([0, -.35, .06], [0, -.5, .07], 5, steel, .01), at(cuffOpen(), 0, -.55, .07)); });
    Hd(ell(.15, .17, .155, skin, 0, 1.73, 0), ell(.13, .085, .12, skin, 0, 1.64, .02), stitches(-.11, -.05, 1.79, .15, 3));
    Hd(M(C(.15, .15, .055, 14), coat, 0, 1.865, 0), at(M(new T.CylinderGeometry(.2, .155, .06, 16), coat), 0, 1.92, -.015, -.12), M(C(.152, .152, .018, 14), F(0x2a2626), 0, 1.86, 0), ell(.14, .012, .1, boot, 0, 1.838, .12, .2), M(B(.035, .035, .008), steel, 0, 1.9, .168, -.12), M(B(.21, .006, .006), steel, 0, 1.825, .14));
    const gun = new T.Group(); gun.position.set(0, .19, .12); head.add(gun);
    gun.add(M(B(.075, .085, .1), steel, 0, 0, -.01), M(C(.062, .062, .09, 6), steel, 0, 0, .05, PI / 2), M(C(.025, .025, .23, 8), steel, 0, .03, .2, PI / 2), M(C(.016, .016, .012, 8), dark, 0, .03, .316, PI / 2), M(B(.008, .022, .02), steel, 0, .06, .3), M(B(.022, .055, .03), steel, 0, .075, -.04, -.45), M(B(.03, .02, .2), steel, 0, -.012, .17));
    for (let i = 0; i < 6; i++) gun.add(M(C(.011, .011, .01, 6), dark, Math.cos(i * PI / 3) * .036, Math.sin(i * PI / 3) * .036, .096, PI / 2));
    Hd(ell(.075, .038, .04, F(0x0a0404), 0, 1.636, .132), ell(.08, .012, .035, F(0x4a1410), 0, 1.668, .136), ell(.08, .012, .035, F(0x4a1410), 0, 1.604, .136));
    const tb = new T.MeshPhongMaterial({ color: 0xc8a050, shininess: 90, specular: 0xffe0a0 }), tc = new T.MeshPhongMaterial({ color: 0xc87a3a, shininess: 90, specular: 0xffc080 });
    for (let i = -2; i <= 2; i++) { const z = .166 - Math.abs(i) * .008, x = i * .026, t1 = G(M(C(.011, .011, .026, 8), tb, 0, 0, 0), M(C(.0008, .011, .022, 8), tc, 0, .024, 0)); Hd(at(t1, x, 1.652, z, PI, 0, 0)); Hd(at(t1.clone(), x, 1.62, z, 0, 0, 0)); }
    legs(pant, boot);
    if (st) { [-1, 1].forEach(s => g.add(M(C(.092, .1, .3, 16), boot, s * .115, .22, 0), at(cuffC(.105), s * .115, .26, 0))); g.add(...chain([-.1, .26, .06], [.1, .26, .06], 8, steel, .011, .05)); }
  }
  if (role === 'locksmith') {  // THE KEEPER: very tall, veiled in a fringed ash shawl, porcelain mask with a keyhole brow, wreath of keys, netted clockwork arms with gears turning at every joint
    const robe = cloth('#5e5a54'), robeD = cloth('#3e3b37'), shawl = cloth('#8e887e'), shawlD = cloth('#6a655c'), net = cloth('#2a2724', { stripe: '#58524a' }), skin = cloth('#b8aca0'), skinR = cloth('#a89488', { blood: 40 });
    const por = cloth('#e2dace', { shine: 50, cracks: 4 }), ink = F(0x14100e), boot = F(0x2a2622), cav = F(0x080605), red = F(0x8a1a14), redD = F(0x5a0e0a);
    const gm = new T.MeshPhongMaterial({ color: 0xa8843c, shininess: 70, specular: 0xffe0a0, flatShading: true }), gd = new T.MeshPhongMaterial({ color: 0x6a5a40, shininess: 50, specular: 0x8a7a60, flatShading: true });
    let sd2 = 917; const rr = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
    // body + floor-length robe with a ragged over-layer
    torso(robe, { chest: .92, waist: .8, skin, neck: .14 });
    if (st) { U(lathe([[.2 * slim, .94], [.26 * slim, .7], [.32 * slim, .3], [.36 * slim, -.1], [.37 * slim, -.2]], robe, .72));
      for (let i = 0; i < 22; i++) { const a = i / 22 * PI * 2, L = .55 + rr() * .5, r0 = .27 * slim; U(M(B(.07, L, .008), i % 3 ? robeD : shawlD, Math.sin(a) * (r0 + .04 + L * .06), .9 - L / 2, Math.cos(a) * (r0 + .04 + L * .06) * .72, -Math.cos(a) * .12, a, Math.sin(a) * .12)); } }
    else skirt(robe, 0);
    { const b = M(C(.25 * slim, .25 * slim, .05, 14), robeD, 0, .96, 0); b.scale.z = .66; U(b); }
    U(...[-1, 1].map(s => M(B(.024, .24, .006), robeD, s * .05, .82, WZ + .01, 0, 0, s * .1)));
    // shawl: hood open at the face, mantle over the shoulders, long fringe strips down both sides
    Hd(lathe([[.0, 1.94], [.09, 1.925], [.148, 1.87], [.166, 1.77], [.162, 1.67], [.15, 1.6], [.17, 1.55]], shawl, 1.0, PI * 2 - 1.75, PI), ...[-1, 1].map(s => M(B(.012, .26, .1), shawlD, s * .158, 1.7, .07, 0, s * .35, s * .04)));
    U(lathe([[.1, 1.6], [.2 * slim + .04, 1.53], [.3 * slim + .03, 1.44], [.33 * slim + .03, 1.36]], shawl, .78, PI * 2 - .7, PI));
    const fr = st ? 1 : .55;
    [-1, 1].forEach(s => { for (let i = 0; i < 5; i++) { const L = (.5 + rr() * .6) * fr, x = s * (.07 + i * .026), z = FZ + .02 - i * .006; U(M(B(.024, L, .006), i % 2 ? shawl : shawlD, x, 1.42 - L / 2, z, 0, 0, s * (rr() - .5) * .06)); } });
    for (let i = 0; i < 9; i++) { const L = (.8 + rr() * .6) * fr; U(M(B(.04, L, .006), i % 2 ? shawl : shawlD, -.15 + i * .037, 1.4 - L / 2, -FZ - .03, 0, 0, (rr() - .5) * .06)); }
    // pearl collar, long chain, keyhole medallion (swings)
    U(...Array.from({ length: 16 }, (_, i) => { const a = (i / 15 - .5) * 2.4; return sph(.011, F(0xd8d0c0), Math.sin(a) * .085, 1.58 - Math.cos(a) * .02, Math.cos(a) * .075 + .005); }));
    { const md = new T.Group(); md.add(...chain([0, 0, 0], [0, -.4, 0], 14, gm, .007), M(C(.05, .05, .012, 14), gm, 0, -.44, 0, PI / 2), tor(.05, .005, gd, 0, -.44, .007),
        M(C(.012, .012, .016, 8), ink, 0, -.432, .004, PI / 2), M(B(.012, .026, .016), ink, 0, -.452, .004), ...[0, 1, 2, 3, 4, 5].map(i => sph(.005, gd, Math.cos(i) * .036, -.44 + Math.sin(i) * .036, .008)));
      md.position.set(0, 1.56 - .76, FZ - .02); up.add(md); P.ring = md; }
    // arms: grey sleeves to the elbow, netted forearms, long pale hands; gears at shoulder, elbow and wrist
    aL = arm(-1, robe, net, null); aR = arm(1, robe, net, null);
    aL.hand.add(mkHand(skinR, { long: true })); aR.hand.add(mkHand(skin, { long: true }));
    const gear = (r, n, mat, th = .012) => { const o = new T.Group(); o.add(M(C(r * .82, r * .82, th, 14), mat, 0, 0, 0, PI / 2), M(C(r * .22, r * .22, th + .004, 8), ink, 0, 0, 0, PI / 2));
      for (let i = 0; i < n; i++) { const a = i / n * PI * 2; o.add(M(B(r * .26, r * .26, th), mat, Math.cos(a) * r * .9, Math.sin(a) * r * .9, 0, 0, 0, a)); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + .4; o.add(M(B(r * .1, r * .55, th * .8), cav, Math.cos(a) * r * .5, Math.sin(a) * r * .5, .002, 0, 0, a - PI / 2)); } return o; };
    P.gears = [];
    const joint = (bone, side, r, n, mat, y, sp, out = .07) => { const w = new T.Group(); w.position.set(side * out, y, 0); w.rotation.y = side * PI / 2; const gg = gear(r, n, mat); w.add(gg, M(C(r * .5, r * .5, .02, 10), gd, 0, 0, -.01, PI / 2)); bone.add(w); P.gears.push([gg, sp]); return gg; };
    [[aL, -1], [aR, 1]].forEach(([a, s]) => {
      joint(a.sh, s, .075, 12, gm, -.02, s * .9, .09); joint(a.sh, s, .034, 8, gd, -.09, -s * 1.7, .082);
      joint(a.el, s, .044, 9, gm, 0, -s * 1.3, .066); joint(a.el, -s, .03, 7, gd, .01, s * 2.1, .06);
      joint(a.hand, s, .022, 6, gm, .02, s * 2.6, .045);
      a.el.add(tor(.06, .006, gm, 0, .045, 0, PI / 2), tor(.058, .005, gd, 0, -.04, 0, PI / 2)); a.hand.add(tor(.044, .006, gm, 0, .03, 0, PI / 2));
      a.el.add(...[-.12, -.2, -.28].map(y => tor(.05, .003, F(0x58524a), 0, y, 0, PI / 2 + .3 * s))); });
    // left hand: a long curved hook pick like a sickle; right hand: tension bar and a string of black beads
    { const pk = new T.Group(), Rk = .15; for (let i = 0; i < 16; i++) { const a = i / 15 * 1.8; pk.add(M(B(.007, .022, .014 - i * .0007), F(0xb8b4ac), -Rk * (1 - Math.cos(a)), -.04 - Rk * Math.sin(a), 0, 0, 0, -a)); }
      pk.add(M(C(.012, .014, .07, 8), gd, 0, 0, 0), tor(.014, .004, gm, 0, .04, 0, PI / 2)); pk.position.set(0, -.11, .03); pk.rotation.x = .3; aL.hand.add(pk); }
    aR.hand.add(M(B(.004, .09, .01), steel, .02, -.13, .03, 0, 0, .2), ...chain([-.01, -.08, .03], [.02, -.32, .02], 16, F(0x14100e), .008, .02), sph(.012, gm, .02, -.33, .02));
    // head: dark void under the hood, porcelain mask with closed slit eyes, long nose ridge, keyhole brow, painted tear marks
    Hd(ell(.13, .158, .14, cav, 0, 1.75, -.01));
    { const mk = new T.Group(), y0 = 1.745 - 1.56;
      mk.add(ell(.112, .148, .05, por, 0, 0, 0), ell(.03, .07, .03, por, 0, -.005, .04), M(new T.ConeGeometry(.018, .06, 4), por, 0, -.01, .055, -.15, PI / 4));
      [-1, 1].forEach(s => { mk.add(tor(.03, .004, ink, s * .045, .022, .042, 0, 0, PI * 1.1, PI * .8), M(B(.003, .03, .002), red, s * .045, -.022, .046, 0, 0, s * .05), M(B(.003, .018, .002), redD, s * .045, -.048, .045)); });
      mk.add(M(B(.034, .004, .004), ink, 0, -.078, .044), M(B(.004, .012, .003), ink, 0, -.09, .043));
      mk.add(M(C(.011, .011, .006, 10), ink, 0, .085, .036, PI / 2 - .4), M(B(.01, .02, .006), ink, 0, .07, .04, -.4), ...[-1, 1].flatMap(s => [1, 2, 3].map(i => sph(.006, gm, s * (.018 + i * .016), .082 - i * .004, .036 - i * .004))));
      mk.position.set(0, y0, .135); mk.rotation.x = -.06; head.add(mk); }
    // wreath: rusted wire ring of upright keys with knots of dried red flowers
    { const wr = new T.Group(); wr.add(tor(.15, .009, rust, 0, 0, 0, PI / 2), tor(.152, .004, F(0x3a2a1e), 0, .006, 0, PI / 2 + .1));
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, ky = key(i % 3 ? rust : gm, 1.3); ky.position.set(Math.sin(a) * .15, .04, Math.cos(a) * .15); ky.rotation.set(0, a, (rr() - .5) * .4); wr.add(ky); }
      for (let i = 0; i < 7; i++) { const a = (i / 7 - .5) * 2.6; wr.add(...[0, 1, 2].map(j => sph(.012 - j * .002, j ? redD : red, Math.sin(a) * .155 + (j - 1) * .01, .01 + j * .006, Math.cos(a) * .155))); }
      for (let i = 0; i < 9; i++) { const a = rr() * PI * 2; wr.add(M(B(.003, .09 + rr() * .07, .003), F(0x2a2018), Math.sin(a) * .14, .06, Math.cos(a) * .14, (rr() - .5) * .6, 0, (rr() - .5) * .6)); }
      wr.position.set(0, 1.9 - 1.56, .0); wr.rotation.x = -.18; head.add(wr); }
    // loupe hinged on the mask over the right eye (drops and lifts in idle)
    { const glassM = new T.MeshPhongMaterial({ color: 0x8aa8a0, shininess: 90, specular: 0xffffff });
      const lp = G(M(B(.012, .05, .008), gm, 0, -.025, 0), M(C(.026, .032, .05, 10), gm, 0, -.055, .025, PI / 2), M(C(.022, .022, .005, 10), glassM, 0, -.055, .051, PI / 2), tor(.028, .004, gd, 0, -.055, .05));
      lp.position.set(.045, 1.83 - 1.56, .18); head.add(lp); P.loupe = lp; }
    // feet: wrapped, dark-toed, just showing under the hem
    legs(robeD, boot);
  }
  if (role === 'fence') {      // ragged hood with ember eyes and a gold tooth, red-lined coat of stopped watches, four arms holding loot
    const coat = cloth('#2a221c', { blood: 3, ds: true }), lining = cloth('#5a1616', { ds: true, blood: 4 }), skin = cloth('#7a6a5e', { blood: 2 }), boot = F(0x161210), void0 = F(0x030202);
    torso(coat, { chest: 1.12 });
    if (st) U(lathe([[.28 * slim, 1.4], [.33 * slim, .95], [.42 * slim, .1], [.46 * slim, -.14]], lining, .74), lathe([[.3 * slim, 1.42], [.35 * slim, .95], [.45 * slim, .1], [.5 * slim, -.16]], coat, .76, PI * 2 - .9, PI));
    else U(lathe([[.3 * slim, 1.42], [.35 * slim, .95], [.36 * slim, .74]], coat, .76, PI * 2 - .9, PI));
    U(chain([-.15, 1.48, FZ], [.15, 1.48, FZ], 9, brass, .01, .08), at(key(brass, 1.4), 0, 1.0, WZ + .03));
    if (st) [-1, 1].forEach(s => [.95, .72, .5, .28, .08].forEach((y, i) => { const z = .3 + (1 - y) * .06, x = s * (.17 + (1 - y) * .07); U(G(M(C(.034, .034, .012, 12), brass, 0, 0, 0, PI / 2), M(C(.028, .028, .004, 12), F(0xd8ccb0), 0, 0, .007, PI / 2), M(B(.002, .02, .002), dark, 0, .006, .01)).translateX(x).translateY(y - .2 * i * 0).translateZ(z)); }));
    U(lathe([[.0, 1.99], [.12, 1.98], [.2, 1.86], [.215, 1.7], [.2, 1.6], [.24, 1.5]], coat, .95, PI * 2 - 1.1, PI), lathe([[.0, 1.96], [.11, 1.95], [.18, 1.85], [.195, 1.7], [.18, 1.6]], lining, .9, PI * 2 - 1.1, PI));
    Hd(ell(.14, .16, .12, void0, 0, 1.74, .03));
    [[-.05, 1.8], [.05, 1.8], [-.02, 1.77], [.03, 1.765], [-.07, 1.745], [.07, 1.74], [0, 1.72], [-.035, 1.705], [.04, 1.71]].forEach(([x, y]) => Hd(sph(.0075, glow(0xffa040), x, y, .14)));
    Hd(M(B(.012, .016, .01), F(0xe0b040), .012, 1.655, .14), M(B(.012, .014, .01), F(0xa89a80), -.008, 1.656, .14));
    aL = arm(-1, coat, coat, skin, { long: true }); aR = arm(1, coat, coat, skin, { long: true });
    [aL, aR].forEach(a => a.el.add(M(C(.075, .1, .16, 10, true), coat, 0, -.32, 0)));
    aL.hand.add(at(key(brass, 2.4), 0, -.1, .03)); const wt = G(...chain([0, 0, 0], [0, -.08, 0], 5, brass, .006), M(C(.035, .035, .012, 12), brass, 0, -.12, 0, PI / 2), M(C(.029, .029, .004, 12), F(0xd8ccb0), 0, -.12, .007, PI / 2)); wt.position.set(0, -.06, .03); aR.hand.add(wt); P.watch = wt;
    if (st) { aL.bx = -.35; aL.be = -1.5; aR.bx = -.35; aR.be = -1.5; aL.sh.rotation.z = -.35; aR.sh.rotation.z = .35; }
    const extra = (s, item) => { const e = new T.Group(); e.position.set(s * .2, .4, .1); e.rotation.set(-.9, 0, s * .35); up.add(e); e.add(cap(.045, .26, skin, 0, -.16, 0)); const h = mkHand(skin, { long: true }); h.position.y = -.34; e.add(h); h.add(item); return e; };
    P.extra = [extra(-1, G(M(C(.028, .03, .08, 8), F(0x5a2a14), 0, -.1, .02), M(C(.012, .012, .02, 6), F(0x2a1a10), 0, -.05, .02), M(B(.04, .035, .002), F(0xc8bb9c), 0, -.1, .05))), extra(1, G(M(B(.016, .07, .022), F(0x3a2416), 0, -.06, .02), M(B(.006, .14, .03), steel, 0, -.16, .02), M(B(.004, .05, .028), red, 0, -.2, .023)))];
    legs(coat, boot);
    if (st) [-1, 1].forEach(s => g.add(at(ring(.1, F(0x2a1a10), .02), s * .115, .16, 0)));
  }
  if (role === 'tallyman') {   // the counting-house clerk: a towering stack of ledgers for a hat, sleeve garters, round blue-tinted pince-nez on a wide pale face, bristling moustache, high starched collar, an oversized brass adding-machine slung like a satchel, coin-sorter fingers
    const coat = cloth('#3a2a3a'), vest = cloth('#7a5a20'), shirt = F(0xd8d0bc), skin = cloth('#c4a890'), boot = F(0x1a1210), brassD = new T.MeshPhongMaterial({ color: 0xa88a40, shininess: 60, specular: 0xffe0a0, flatShading: true }), ink = F(0x1a1410), books = [0x5a1a14, 0x1e3a26, 0x2a2a4a, 0x6a4a1a, 0x3a1a2a];
    torso(coat, { chest: .95, neck: .2, skin, waist: .78 });
    if (st) U(lathe([[.24 * slim, 1.0], [.3 * slim, .62], [.36 * slim, .14], [.38 * slim, .1]], coat, .72, PI * 2 - .7, PI));
    U(M(B(.2, .32, .02), vest, 0, 1.26, FZ + .002), ...[1.36, 1.29, 1.22, 1.15].map(y => M(C(.01, .01, .006, 6), brassD, 0, y, FZ + .014, PI / 2)), ...[-1, 1].map(s => M(B(.09, .34, .016), coat, s * .11, 1.34, FZ + .012, 0, 0, s * .22)), lathe([[.07, 1.55], [.08, 1.66]], shirt, .95, PI * 2, 0, 14), M(new T.ConeGeometry(.03, .04, 3), F(0x2a1a3a), 0, 1.53, FZ + .01, PI / 2, 0, 0));
    { const am = G(M(B(.17, .13, .1), brassD, 0, 0, 0), M(B(.15, .02, .08), F(0x2a2014), 0, .07, .005, -.4), ...Array.from({ length: 12 }, (_, i) => M(C(.007, .007, .02, 6), shirt, -.05 + (i % 4) * .033, .03 + Math.floor(i / 4) * .0, .03 + Math.floor(i / 4) * .025, -PI / 2 - .4)), M(C(.006, .006, .08, 5), brassD, .1, .02, 0, 0, 0, -.6), sph(.014, F(0x8a1a14), .13, .05, 0), M(B(.05, .06, .002), F(0xe8e0c8), -.02, .1, -.03, -.2));
      am.position.set(.2, .98 - .76, .12); am.rotation.y = -.4; up.add(am); U(...chain([-.24, 1.5, FZ - .02], [.18, 1.06, WZ + .06], 10, F(0x2a1a10), .012)); }
    aL = arm(-1, coat, shirt, skin, { long: true }); aR = arm(1, coat, shirt, skin, { long: true });
    [aL, aR].forEach(a => { a.el.add(tor(.062, .01, F(0x8a1a14), 0, -.1, 0, PI / 2)); a.hand.add(tor(.044, .01, shirt, 0, .03, 0, PI / 2)); });
    aR.hand.add(...[0, 1, 2].map(i => M(C(.016, .016, .006, 10), brassD, .01, -.12 - i * .007, .03, PI / 2)));
    Hd(ell(.14, .15, .14, skin, 0, 1.74, 0), ell(.03, .04, .022, skin, -.135, 1.74, 0), ell(.03, .04, .022, skin, .135, 1.74, 0), ell(.1, .055, .1, skin, 0, 1.64, .02), ell(.022, .016, .02, F(0xb08070), 0, 1.72, .15));
    Hd(...[-1, 1].flatMap(s => [ell(.02, .02, .01, eyeW, s * .05, 1.78, .126), sph(.009, F(0x2a3a5a), s * .05, 1.78, .134), at(ring(.034, brassD, .005), s * .05, 1.78, .14, 0), ell(.03, .03, .003, new T.MeshPhongMaterial({ color: 0x6a8ab0, transparent: true, opacity: .35, shininess: 100 }), s * .05, 1.78, .141), M(B(.04, .008, .006), F(0x3a2a1a), s * .05, 1.818, .13, 0, 0, s * -.2)]), M(B(.03, .006, .004), brassD, 0, 1.78, .144), M(C(.0015, .0015, .14, 3), brassD, .075, 1.72, .13, 0, 0, .15));
    Hd(...[-1, 1].map(s => ell(.06, .018, .02, F(0x4a3a2a), s * .045, 1.69, .14, 0, 0, s * -.25)), M(B(.05, .006, .005), F(0x3a1a14), 0, 1.66, .135));
    { const stk = new T.Group(); let y = 1.86; for (let i = 0; i < 5; i++) { const w = .26 - i * .012, h = .045 + (i % 2) * .01; stk.add(M(B(w, h, .19 - i * .008), F(books[i]), (i % 2 ? .012 : -.01), y + h / 2, 0, 0, (i - 2) * .12, 0), M(B(w - .01, h - .012, .004), shirt, (i % 2 ? .012 : -.01), y + h / 2, .095 - i * .004, 0, (i - 2) * .12, 0)); y += h; }
      stk.add(M(C(.003, .003, .1, 3), F(0xd8ccb0), .04, y + .05, 0, 0, 0, -.3), M(B(.02, .06, .002), F(0xd8ccb0), .06, y + .1, 0, 0, 0, -.3)); stk.position.y -= 1.56; head.add(stk); P.books = stk; }
    P.pans = [];
    legs(coat, boot);
    if (st) [-1, 1].forEach(s => g.add(M(B(.13, .03, .2), F(0xd8ccb0), s * .115, .09, .03)));
  }
  if (role === 'smuggler') {   // THE DIVER: full old standard-dress diving suit, dark brown and waterlogged, overgrown with coral and barnacle sores; copper helmet with grilled ports, bolted corselet, lead weight belt, air hose, contraband in a net on the hip
    const suit = cloth('#3a281c', { cracks: 3 }), suitD = cloth('#2a1c14'), patch = cloth('#33241a'), rub = F(0x1e1814), cu = cloth('#6a4026', { shine: 55, cracks: 4 }), cuD = new T.MeshPhongMaterial({ color: 0x4a2a18, shininess: 40, specular: 0x7a5a3a, flatShading: true });
    const brz = new T.MeshPhongMaterial({ color: 0x7a5a30, shininess: 60, specular: 0xa08050, flatShading: true }), lead = F(0x3a3a38), glassD = new T.MeshPhongMaterial({ color: 0x0a100e, shininess: 30, specular: 0x1a2a26, transparent: true, opacity: .55 }), glowE = new T.MeshBasicMaterial({ color: 0xc8a050 });
    const corA = new T.MeshPhongMaterial({ color: 0xb0502a, shininess: 20, flatShading: true }), corB = new T.MeshPhongMaterial({ color: 0xc8907a, shininess: 20, flatShading: true }), corC = new T.MeshPhongMaterial({ color: 0x7a2418, shininess: 20, flatShading: true });
    const barnM = new T.MeshPhongMaterial({ color: 0xb8a890, shininess: 10, flatShading: true }), sore = new T.MeshPhongMaterial({ color: 0x9a6a58, shininess: 50, specular: 0x6a4a40, flatShading: true });
    let sd3 = 4242; const rr = () => (sd3 = (sd3 * 16807) % 2147483647) / 2147483647;
    // growths: barnacle (ring + dark hole), Dung-Eater-style sore (swollen disc, pale rim), branching coral
    const barn = (r) => G(M(C(r * .7, r, r * .8, 7), barnM, 0, r * .4, 0), M(C(r * .4, r * .5, r * .3, 6), F(0x1a120c), 0, r * .82, 0));
    const soreG = (r) => G(M(C(r, r * 1.1, r * .5, 9), sore, 0, r * .2, 0), tor(r * .82, r * .16, barnM, 0, r * .46, 0, PI / 2), M(C(r * .45, r * .45, r * .2, 7), F(0x5a2a20), 0, r * .5, 0));
    const coral = (r, mat) => { const o = new T.Group(); const br = (x, y, z, rx, rz, l, w, d) => { const c = M(C(w * .6, w, l, 5), mat, x, y + l / 2, z, rx, 0, rz); o.add(c); if (d > 0) { const tx = x - Math.sin(rz) * l, ty = y + Math.cos(rz) * Math.cos(rx) * l, tz = z + Math.sin(rx) * l; br(tx, ty - .002, tz, rx + (rr() - .5) * .9, rz - .5, l * .7, w * .7, d - 1); br(tx, ty - .002, tz, rx + (rr() - .5) * .9, rz + .5, l * .7, w * .7, d - 1); } else o.add(sph(w * 1.1, mat, x - Math.sin(rz) * l, y + l, z)); };
      br(0, 0, 0, (rr() - .5) * .4, (rr() - .5) * .4, r, r * .22, 2); return o; };
    const onBody = (obj, a, y, R, d = .7, tilt = 0) => { const rho = R / Math.sqrt(Math.sin(a) ** 2 + (Math.cos(a) / d) ** 2), w = new T.Group(); w.position.set(0, y - .76, 0); w.rotation.y = a; obj.position.set(0, 0, rho); obj.rotation.x = PI / 2 + tilt; w.add(obj); up.add(w); };
    // body: bulky waterlogged suit with puckered folds and patches
    torso(suit, { chest: 1.22, waist: 1.18, d: .7, neck: .06 });
    if (st) U(lathe([[.3 * slim * 1.18, .94], [.33 * slim * 1.18, .78], [.31 * slim * 1.18, .66]], suit, .74)); else skirt(suit, 0);
    U(...[1.12, 1.0, .88].map(y => tor(.33 * slim * 1.12, .012, suitD, 0, y, 0, PI / 2)), M(B(.12, .1, .01), patch, -.14, 1.06, WZ + .045, 0, 0, .15), M(B(.09, .08, .01), patch, .16, .9, WZ + .05, 0, 0, -.1));
    // corselet: bronze breastplate bolted to the suit's rubber collar
    U(lathe([[.1, 1.6], [.2, 1.56], [.33 * slim * 1.15, 1.44], [.36 * slim * 1.15, 1.36]], brz, .82), lathe([[.36 * slim * 1.15, 1.36], [.365 * slim * 1.15, 1.34]], rub, .82));
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, R0 = .335 * slim * 1.15; U(G(M(C(.014, .014, .02, 6), brz, 0, 0, 0, PI / 2), M(B(.03, .008, .006), brz, 0, 0, .012)).translateX(Math.sin(a) * R0).translateY(1.375).translateZ(Math.cos(a) * R0 * .82)); }
    U(tor(.19, .02, cuD, 0, 1.585, 0, PI / 2), ...[-1, 1].map(s => M(B(.1, .05, .02), cuD, s * .14, 1.42, FZ + .055, -.5, 0, s * -.2)));
    // weight belt with lead blocks, crotch strap, knife sheath, contraband net
    U(G(M(C(.335 * slim * 1.18, .335 * slim * 1.18, .07, 16), F(0x2a1e14), 0, 0, 0)).translateY(.96));
    for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * 2.6; U(G(M(B(.07, .08, .03), lead, 0, 0, 0)).translateX(Math.sin(a) * .33 * slim * 1.2).translateY(.96).translateZ(Math.cos(a) * .33 * slim * 1.2 * .74 + .02).rotateY(a)); }
    U(M(B(.05, .05, .02), brz, 0, .96, WZ + .07), M(B(.05, .24, .02), F(0x2a1e14), 0, .82, WZ + .05));
    U(G(M(B(.04, .2, .02), F(0x1a1410), 0, 0, 0), M(B(.03, .06, .025), brz, 0, .12, 0), M(C(.012, .012, .06, 6), F(0x3a2a1e), 0, .17, 0)).translateX(.2).translateY(.84).translateZ(WZ + .02).rotateZ(.1));
    { const nb = new T.Group(); nb.add(ell(.07, .09, .05, new T.MeshPhongMaterial({ color: 0x2a2018, wireframe: true }), 0, 0, 0), ...[[-.02, 0, F(0x2a4a3a)], [.025, .01, F(0x6a2a1a)], [0, -.03, F(0x8a7a50)]].map(([x, y, mt]) => M(C(.016, .016, .07, 6), mt, x, y, 0, 0, 0, x * 4)), M(C(.004, .004, .1, 4), F(0x6a5a40), 0, .1, 0));
      nb.position.set(-.27, .85 - .76, .05); up.add(nb); }
    // air hose: from the helmet's back, over the shoulder, down the front to the belt and trailing
    { const pts = [[.05, 1.66, -.18], [.18, 1.62, -.2], [.27, 1.5, -.06], [.24, 1.36, .14], [.13, 1.2, .22], [.08, 1.0, .25], [.12, .84, .23], [.2, .7, .18]];
      for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), seg = M(C(.022, .022, L + .01, 7), rub, 0, 0, 0); seg.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - .76, (a[2] + b[2]) / 2); seg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); up.add(seg);
        if (i % 2) U(tor(.025, .006, brz, a[0], a[1], a[2], PI / 2)); } }
    // arms: puffy sleeves with fold rings and rubber cuffs, heavy gloves
    aL = arm(-1, suit, suit, rub); aR = arm(1, suit, suit, rub);
    [aL, aR].forEach((a, i) => { const s = i ? 1 : -1; a.el.add(...[-.12, -.22, -.3].map(y => tor(.062, .01, suitD, 0, y, 0, PI / 2)), tor(.058, .016, rub, 0, -.37, 0, PI / 2), M(B(.06, .05, .01), patch, s * .05, .1, .03, 0, s * PI / 2, 0));
      a.sh.add(...[-.1, -.2].map(y => tor(.078, .01, suitD, 0, y, 0, PI / 2)), sph(.09, suit, 0, 0, 0)); });
    // helmet: copper sphere, grilled faceport with something looking out, side and top ports, bonnet bolts, valves
    { const hb = 1.76;
      Hd(ell(.2, .21, .2, cu, 0, hb, 0), M(C(.1, .11, .06, 10), cuD, 0, 1.58, 0), tor(.11, .014, brz, 0, 1.61, 0, PI / 2));
      const port = (r, x, y, z, rx, ry) => { const p = G(M(C(r + .018, r + .022, .05, 14, true), brz, 0, 0, 0, PI / 2), M(C(r + .006, r + .006, .05, 14, true), cuD, 0, 0, 0, PI / 2), M(C(r, r, .006, 14), F(0x040303), 0, 0, .006, PI / 2), M(C(r, r, .02, 14), glassD, 0, 0, .018, PI / 2), tor(r + .01, .007, cuD, 0, 0, .026), M(B(r * 2.1, .01, .01), brz, 0, 0, .03, 0, 0, PI / 4), M(B(r * 2.1, .01, .01), brz, 0, 0, .03, 0, 0, -PI / 4), M(B(r * 2.1, .008, .008), brz, 0, 0, .032), ...[0, 1, 2, 3, 4, 5].map(j => sph(.007, brz, Math.cos(j) * (r + .016), Math.sin(j) * (r + .016), .028)));
        p.position.set(x, y - 1.56, z); p.rotation.set(rx, ry, 0); head.add(p); return p; };
      port(.085, 0, hb - .01, .185, 0, 0).add(...[-1, 1].map(s => sph(.014, glowE, s * .034, .01, .015)), ell(.03, .016, .004, F(0x2a1a14), 0, -.035, .011)); port(.055, -.175, hb, .02, 0, -PI / 2); port(.055, .175, hb, .02, 0, PI / 2); port(.045, 0, hb + .16, .1, -.95, 0);

      Hd(...[[-.09, 1.62, .13], [.09, 1.62, .13], [-.15, 1.64, -.04], [.15, 1.64, -.04], [0, 1.63, -.15]].map(([x, y, z]) => G(M(C(.014, .014, .03, 6), brz, x, y, z), M(B(.04, .008, .008), brz, x, y + .02, z))));
      Hd(M(C(.02, .022, .06, 8), brz, .05, 1.74, -.19, PI / 2 - .3), M(C(.03, .03, .012, 10), brz, .05, 1.745, -.22, PI / 2 - .3), M(C(.016, .016, .05, 8), brz, -.14, 1.7, .13, 0, 0, .9)); }
    // growth pass: coral and barnacles across helmet, corselet, chest, back, arms
    const hG = (o, x, y, z, rx, rz) => { o.position.set(x, y - 1.56, z); o.rotation.set(rx, 0, rz); head.add(o); };
    hG(coral(.11, corA), .08, 1.93, -.02, -.2, -.3); hG(coral(.08, corB), -.1, 1.9, -.08, .3, .5); hG(coral(.07, corC), .14, 1.8, .08, -.3, -1.1); hG(barn(.022), -.12, 1.86, .12, -.6, .6); hG(barn(.018), .15, 1.82, -.1, .2, -1.1); hG(soreG(.03), -.05, 1.84, -.17, -2.3, .2); hG(barn(.016), .02, 1.93, .1, -.5, 0);
    [[.4, 1.48, .022, 'b'], [-.9, 1.45, .03, 's'], [2.6, 1.46, .026, 's'], [.2, 1.25, .035, 's'], [-.5, 1.18, .025, 'b'], [1.1, 1.3, .03, 's'], [-1.6, 1.08, .028, 's'], [3.2, 1.2, .04, 's'], [2.2, 1.0, .03, 'b'], [-2.6, 1.3, .03, 's'], [.7, 1.05, .02, 'b'], [-.15, .9, .022, 'b']].forEach(([a, y, r, t]) => onBody(t === 's' ? soreG(r) : barn(r), a, y, y > 1.36 ? .345 * slim * 1.15 : .32 * slim * 1.2, y > 1.36 ? .82 : .72));
    [[-.8, 1.5, corA, .11], [2.9, 1.42, corC, .13], [1.4, 1.2, corB, .09], [-2.2, 1.0, corA, .09], [.9, 1.48, corC, .08], [-1.3, 1.25, corB, .08], [3.5, 1.1, corA, .1]].forEach(([a, y, mt, r]) => onBody(coral(r, mt), a, y, .33 * slim * 1.18, .74, -.6));
    [[aL, -1], [aR, 1]].forEach(([a, s]) => { const add2 = (bone, o, y, z) => { o.position.set(s * .07, y, z); o.rotation.z = -s * PI / 2; bone.add(o); };
      add2(a.sh, soreG(.028), -.05, .02); add2(a.sh, barn(.02), -.2, -.03); add2(a.el, barn(.018), -.15, .02); if (s > 0) add2(a.sh, coral(.1, corA), 0, 0); else add2(a.el, soreG(.024), -.08, -.02); });
    // legs + heavy diving boots (lead soles, brass toe caps, laced canvas uppers)
    legs(suit, rub);
    if (st) [-1, 1].forEach(s => g.add(cap(.135, .26, suit, s * .115, .7, 0, 0, 0, s * .03), cap(.12, .26, suit, s * .12, .36, 0, 0, 0, s * .02), tor(.13, .014, suitD, s * .118, .52, 0, PI / 2), tor(.124, .012, suitD, s * .12, .42, 0, PI / 2), M(B(.08, .07, .01), patch, s * .2, .62, .06, 0, s * .5, 0)));
    if (st) [-1, 1].forEach(s => { g.add(M(C(.125, .13, .2, 10), suitD, s * .115, .16, 0), M(B(.2, .05, .3), lead, s * .115, .025, .04), ell(.09, .06, .08, brz, s * .115, .08, .14), ...[.1, .16, .22].map(y => M(B(.1, .006, .006), F(0x8a7a5a), s * .115, y, .1)), tor(.1, .014, rub, s * .115, .27, 0, PI / 2));
      const bo = soreG(.03); bo.position.set(s * .235, .58, .04); bo.rotation.z = -s * PI / 2; g.add(bo); const cb = barn(.02); cb.position.set(s * .11, .42, .1); cb.rotation.x = PI / 2; g.add(cb); });
  }
  if (role === 'dealer') {     // THE DEALER (original): dark worn suit, frayed shirt, waistcoat, sleeve garters, a low fedora that keeps the face in shadow; two faint lamp-points for eyes
    const suit = cloth('#17130f', { cracks: 2 }), shirt = cloth('#9a907a', { ink: 4 }), tie = F(0x3a1610), vest = cloth('#231c16'), hat = cloth('#0e0c0a'), band = F(0x2a1810), skin = cloth('#a89888'), gar = new T.MeshPhongMaterial({ color: 0x8a6a30, shininess: 50, specular: 0x6a5a40, flatShading: true }), boot = F(0x0c0a08), eg = glow(0xffc070);
    torso(suit, { neck: .12, skin });
    U(M(B(.13, .3, .02), shirt, 0, 1.38, FZ - .004), ...[-1, 1].map(s => M(B(.07, .05, .012), shirt, s * .055, 1.5, FZ + .006, -.3, 0, s * .45)), M(B(.038, .24, .012), tie, 0, 1.34, FZ + .01), M(B(.05, .04, .016), tie, 0, 1.47, FZ + .008));
    U(...[-1, 1].map(s => M(B(.13, .34, .02), vest, s * .1, 1.26, FZ + .012, 0, s * -.32, s * .1)), ...[1.36, 1.28, 1.2, 1.12].map(y => sph(.009, brass, -.03, y, FZ + .024)), ...chain([-.06, 1.2, FZ + .02], [-.18, 1.23, FZ + .005], 6, brass, .007, .02), M(B(.07, .006, .03), shirt, -.16, 1.42, FZ + .01, 0, 0, .1));
    U(...[-1, 1].map(s => M(B(.08, .34, .014), suit, s * .12, 1.36, FZ + .02, 0, 0, s * .25)), ...Array.from({ length: 6 }, (_, i) => M(B(.003, .006, .003), F(0x6a6050), (rnd() - .5) * .1, 1.5, FZ + .002)));
    if (st) U(lathe([[.27 * slim, 1.0], [.3 * slim, .66], [.3 * slim, .52]], suit, .7, PI * 1.4, PI));
    aL = arm(-1, suit, shirt, skin, { long: true }); aR = arm(1, suit, shirt, skin, { long: true });
    [aL, aR].forEach(a => { a.el.add(tor(.064, .012, gar, 0, -.12, 0, PI / 2)); a.hand.add(tor(.045, .012, shirt, 0, .03, 0, PI / 2)); });
    if (st) { const cd = M(B(.06, .085, .003), card, 0, -.1, .05, .2); aR.hand.add(cd); aR.bx = -.25; aR.be = -1.1; }
    Hd(ell(.122, .156, .132, skin, 0, 1.745, 0), ell(.028, .04, .022, skin, -.12, 1.74, 0), ell(.028, .04, .022, skin, .12, 1.74, 0), ell(.088, .05, .094, skin, 0, 1.63, .015), ell(.13, .05, .07, F(0x070505), 0, 1.775, .09));
    Hd(...[-1, 1].map(s => sph(.007, eg, s * .044, 1.77, .13)), M(B(.055, .004, .004), F(0x3a1a14), 0, 1.655, .13), M(B(.006, .03, .012), skin, 0, 1.72, .134), ...[-1, 1].map(s => M(B(.002, .05, .002), F(0x6a5a50), s * .065, 1.68, .115)));
    { const brim = M(C(.24, .25, .012, 18), hat, 0, 1.855, .015, .12, 0, 0); brim.scale.z = .95; const crown = lathe([[0, 2.0], [.06, 1.995], [.11, 1.975], [.135, 1.93], [.142, 1.87]], hat, .9, PI * 2, 0, 14);
      const hp = [brim, crown, M(C(.143, .143, .028, 14), band, 0, 1.885, 0), ell(.03, .02, .06, F(0x050404), 0, 1.99, -.01), ...[-1, 1].map(s => ell(.02, .015, .05, F(0x070606), s * .05, 1.975, .07, .4, 0, 0)), M(B(.025, .03, .006), F(0x6a5a40), .14, 1.89, .02, 0, PI / 2 - .2, 0)];
      hp.forEach(o => { o.position.y -= .075; o.position.z += .012; }); brim.rotation.x = .2; brim.scale.set(1.04, 1, 1.02); Hd(...hp); }
    P.lampMat = eg;
    legs(suit, boot);
  }
  if (role === 'scavenger') {  // green rubber gas-mask hood with two mismatched lenses (one cracked, one glowing), twin filter canisters, hose into a chest tank, junk hump, grabber arm, Mister the doll
    const rags = cloth('#4e4a36', { blood: 4, ds: true }), skin = cloth('#7a6a5a', { blood: 3 }), rubber = new T.MeshPhongMaterial({ color: 0x2e3a26, shininess: 45, specular: 0x4a5a40, flatShading: true }), boot = F(0x1a1410), wrap = F(0x5a5a3e), tin = new T.MeshPhongMaterial({ color: 0x5e6a52, shininess: 30, flatShading: true });
    torso(rags, { chest: .95, skin, waist: .86 }); P.ux = .14;
    if (st) for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, l = .2 + rnd() * .28; U(M(B(.075, l, .006), rags, Math.sin(a) * .25, .92 - l / 2, Math.cos(a) * .18, Math.cos(a) * .1, a, 0)); }
    U(M(C(.06, .06, .18, 10), tin, .08, 1.3, FZ + .05), M(C(.04, .04, .02, 10), F(0x2a2a20), .08, 1.4, FZ + .05), ...[-1, 1].map(s => M(B(.035, .3, .012), F(0x2a1c12), s * .12, 1.3, FZ + .01, 0, 0, s * .2)));
    { const b = M(C(.23, .23, .05, 12), F(0x2a1c12), 0, .97, 0); b.scale.z = .7; U(b, [-.15, .14].map(x => M(C(.028, .028, .07, 8), steel, x, .9, WZ + .02))); }
    const doll = G(ell(.035, .05, .025, F(0xb8a888), 0, -.06, 0), sph(.03, F(0xc8b898), 0, 0, 0), [-1, 1].map(s => M(B(.008, .008, .004), dark, s * .012, .005, .028)), M(B(.02, .003, .003), red, 0, -.012, .028), [-1, 1].map(s => cap(.01, .03, F(0xb8a888), s * .03, -.07, 0, 0, 0, s * .4)));
    doll.position.set(-.12, .9 - .76 - .06, WZ + .04); up.add(doll); P.doll = doll;
    const junk = G(M(C(.05, .05, .1, 10), steel, -.08, .1, 0), M(C(.04, .04, .09, 10), rust, .1, .05, .03), M(C(.03, .04, .14, 8), new T.MeshPhongMaterial({ color: 0x2a4a24, shininess: 80, specular: 0x88aa88 }), .02, .2, -.02), ell(.16, .13, .1, rags, 0, 0, -.02), M(B(.08, .08, .06), F(0x4a3a24), .12, -.06, .02), M(C(.008, .008, .3, 5), rust, -.1, .14, 0, 0, 0, .4));
    junk.position.set(0, .64, -.2); up.add(junk);
    const sackG = () => { const gg = new T.SphereGeometry(1, 14, 10), p = gg.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const sag = y < 0 ? 1 - y * .42 : 1 - y * y * .3, n = 1 + Math.sin(x * 5 + y * 3) * .09 + Math.sin(z * 7 - y * 4) * .07 + (rnd() - .5) * .05; x *= sag * n; z *= (y < 0 ? 1 - y * .12 : 1) * n; y = y < -.3 ? y * .78 - .07 : y; if (y > .7) { x *= .45; z *= .45; } if (z < -.2) z *= .6; p.setXYZ(i, x * .27, y * .34, z * .19); } gg.computeVertexNormals(); return gg; };
    const patches = [cloth('#6a5a3a'), cloth('#3a4a34'), cloth('#5a3a2a'), cloth('#7a6a4a')];
    const canvas = cloth('#5e5844'), sm = M(sackG(), canvas, 0, 0, 0); sm.updateMatrixWorld(true); const rc = new T.Raycaster(), onSack = (a, y, obj) => { rc.set(new T.Vector3(Math.sin(a) * .6, y, Math.cos(a) * .6), new T.Vector3(-Math.sin(a), 0, -Math.cos(a))); const h = rc.intersectObject(sm)[0]; if (!h) return obj; const n = h.face.normal.clone(); obj.position.copy(h.point).addScaledVector(n, .004); obj.lookAt(h.point.clone().add(n)); return obj; };
    const pack = G(sm, M(C(.05, .1, .1, 8), canvas, 0, .34, 0), tor(.06, .012, F(0x2a1c12), 0, .3, 0, PI / 2), ...[[-.6, .1], [.5, -.12], [-.2, -.2], [.9, .14], [2.6, .05], [-2.4, -.1], [1.6, -.05], [-1.5, .08]].map(([a, y], i) => { const pt = onSack(a, y, new T.Mesh(new T.PlaneGeometry(.09 + (i % 2) * .03, .08), patches[i % 4])); pt.rotateZ((i - 2) * .15); pt.add(...[-1, 1].flatMap(s => [-.03, 0, .03].map(d => M(B(.004, .012, .003), F(0xd8ccb0), s * (.045 + (i % 2) * .015), d, .002)))); return pt; }), ...[-.15, .15].map(x => M(B(.04, .5, .012), F(0x2a1c12), x, .02, .16, .1)),  M(C(.08, .08, .5, 10), F(0x4a4a30), 0, .4, .02, 0, 0, PI / 2), ...[-1, 1].map(s => tor(.082, .01, F(0x2a1c12), s * .16, .4, .02, 0, PI / 2, 0)), M(C(.05, .06, .07, 10), steel, .26, -.06, .06), M(C(.04, .045, .1, 8), rust, -.25, .08, .05, 0, 0, .3), M(B(.16, .12, .04), F(0x4a3a24), 0, -.12, .2), ...chain([-.24, .3, .12], [.24, .3, .12], 9, F(0x2a1c12), .012, .12), M(C(.012, .012, .5, 5), rust, -.14, .38, -.08, 0, 0, -.25), M(C(.03, .03, .1, 8), new T.MeshPhongMaterial({ color: 0x2a4a24, shininess: 80 }), .14, .4, -.06)); pack.position.set(0, .68, -.34); up.add(pack);
    { const steelG = new T.MeshPhongMaterial({ color: 0x3e4630, shininess: 20, specular: 0x3a3a30, flatShading: true }), net = F(0x2a2a1a);
      Hd(ell(.15, .17, .155, rubber, 0, 1.73, 0), ell(.16, .1, .16, rubber, 0, 1.62, -.01), lathe([[0, 1.99], [.08, 1.985], [.14, 1.95], [.172, 1.88], [.182, 1.82], [.19, 1.8]], steelG, 1, PI * 2, 0, 14), tor(.188, .008, steelG, 0, 1.8, 0, PI / 2), ...[-1, 1].map(s => M(B(.008, .14, .006), F(0x3a2a18), s * .15, 1.72, .04, 0, 0, s * .05)), M(B(.12, .008, .006), F(0x3a2a18), 0, 1.6, .14));
      for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; Hd(M(B(.004, .004, .2), net, Math.sin(a) * .1, 1.93, Math.cos(a) * .1, 0, a, .5), M(B(.03, .008, .002), F(0x4a5a30), Math.sin(a) * .16, 1.87, Math.cos(a) * .16, 0, a, 0)); }
      Hd(M(B(.06, .03, .003), F(0x8a8a6a), -.1, 1.9, .14, -.6, -.4, .1)); }
    Hd(at(ring(.046, steel, .012), -.055, 1.765, .135, 0), ell(.042, .042, .016, glow(0x9fd860), -.055, 1.765, .138), ell(.016, .012, .005, F(0xe0ffc0), -.068, 1.778, .152));
    Hd(at(ring(.036, brass, .01), .06, 1.755, .14, 0), ell(.032, .032, .012, F(0x1a2a16), .06, 1.755, .142), M(B(.002, .05, .002), F(0xb8c8b0), .06, 1.755, .152, 0, 0, .7), M(B(.002, .035, .002), F(0xb8c8b0), .065, 1.75, .152, 0, 0, -.5));
    Hd(M(C(.03, .04, .05, 8), rubber, 0, 1.655, .15, PI / 2), ...[-1, 1].map(s => G(M(C(.035, .035, .07, 10), tin, 0, 0, 0, 0, 0, PI / 2), M(C(.03, .03, .01, 10), F(0x1a1a14), s * .036, 0, 0, 0, 0, PI / 2)).translateX(s * .085).translateY(1.62).translateZ(.11).rotateY(s * .6)));
    U(...Array.from({ length: 10 }, (_, i) => { const u = i / 9; return tor(.016, .007, rubber, .08 * u, 1.62 - u * .2, FZ + .1 - u * .05, PI / 2 - .3, 0, 0); }));
    aL = arm(-1, rags, skin, F(0x2a221c)); aR = arm(1, rags, null, null);
    aL.el.add(...[0, 1, 2].map(i => at(ring(.06, wrap, .012), 0, -.26 + i * .05, 0)));
    aR.el.children[0].visible = false; aR.el.add(M(C(.012, .012, .5, 6), tin, 0, -.25, 0), M(B(.04, .06, .03), F(0x2a2a26), 0, -.02, 0));
    const claw = new T.Group(); claw.position.y = -.5; aR.el.add(claw); [-1, 1].forEach(s => claw.add(M(B(.012, .07, .02), tin, s * .022, -.03, 0, 0, 0, s * .35), M(B(.01, .03, .02), tin, s * .03, -.07, 0, 0, 0, -s * .5))); P.claw = claw;
    legs(rags, boot);
    if (st) [-1, 1].forEach(s => g.add(...[0, 1, 2].map(i => at(ring(.09, wrap, .014), s * .113, .2 + i * .06, 0))));
  }
  if (role === 'broker') {     // cracked porcelain mask, red monocle eye, coin-slot mouth printing a ledger to the floor, second face, pen fingers, cash drawer
    const suit = cloth('#1c1816'), shirt = F(0xc8c0b0), por = cloth('#e4ded2', { cracks: 10, shine: 60 }), tie = F(0x5a1418), hat = F(0x0e0c0c), boot = F(0x0c0a08), tape = cloth('#d8d0bc', { ledger: true, blood: 8, ds: true });
    torso(suit, { neck: .14 });
    U(M(B(.12, .28, .02), shirt, 0, 1.4, FZ - .004), M(B(.034, .22, .012), tie, 0, 1.36, FZ + .008), [-1, 1].map(s => M(B(.06, .32, .012), suit, s * .08, 1.38, FZ + .012, 0, 0, s * .22)), sph(.022, F(0x6a1418), -.13, 1.44, FZ + .015), M(B(.04, .03, .005), F(0x6a1418), .13, 1.42, FZ + .006));
    U(M(C(.072, .078, .06, 12), brass, 0, 1.6, 0), ...[0, 1, 2, 3, 4, 5].map(i => sph(.007, F(0x5a4418), Math.sin(i) * .075, 1.6, Math.cos(i) * .075)));
    const wt = G(...chain([0, 0, 0], [0, -.06, 0], 4, brass, .005), M(C(.022, .022, .01, 10), brass, 0, -.08, 0, PI / 2)); wt.position.set(.06, 1.2 - .76, FZ + .01); up.add(wt); P.watch = wt; U(chain([-.06, 1.2, FZ + .01], [.06, 1.2, FZ + .01], 7, brass, .005, .04));
    U(M(B(.17, .07, .03), brass, 0, 1.05, WZ + .005), M(B(.16, .055, .12), brass, 0, 1.03, WZ + .06), M(B(.15, .045, .1), F(0x2a1a0a), 0, 1.04, WZ + .06), ...[-.05, -.015, .02, .055].map((x, i) => M(C(.014, .014, .02 + i % 2 * .01, 8), F(0xc89a40), x, 1.055, WZ + .06)), sph(.008, brass, 0, 1.03, WZ + .122));
    if (st) U(lathe([[.27 * slim, 1.0], [.31 * slim, .6], [.33 * slim, .18]], suit, .7, PI * 2 - .7, PI));
    aL = arm(-1, suit, suit, shirt, {}); aR = arm(1, suit, suit, null);
    const ph = new T.Group(); aR.hand.add(ph); ph.add(M(C(.05, .055, .07, 10), brass, 0, .0, 0), ell(.045, .03, .03, shirt, 0, -.04, 0));
    for (let i = 0; i < 5; i++) { const x = -.03 + i * .015; ph.add(M(C(.007, .007, .11, 6), F(0x0a0a0c), x, -.11, .01), M(C(.0005, .007, .025, 4), brass, x, -.18, .01, PI)); }
    if (st) { aR.bx = -.55; aR.be = -1.75; aR.sh.rotation.z = -.15; aL.bx = .35; aL.be = -.5; }
    Hd(ell(.13, .165, .14, F(0x2a201a), 0, 1.74, -.02), ell(.125, .165, .12, por, 0, 1.74, .03), ell(.02, .007, .01, dark, -.045, 1.77, .145), tor(.025, .006, brass, .045, 1.77, .145), sph(.016, glow(0xff3020), .045, 1.77, .145), M(C(.002, .002, .1, 3), brass, .07, 1.72, .12, 0, 0, .1));
    Hd(M(B(.06, .02, .012), brass, 0, 1.655, .145), M(B(.05, .006, .014), dark, 0, 1.655, .148));
    const bf = G(ell(.06, .08, .03, por, 0, 0, 0), ell(.01, .004, .005, dark, -.02, .015, .028), ell(.01, .004, .005, dark, .02, .015, .028), M(B(.02, .003, .004), dark, 0, -.03, .028)); bf.position.set(.11, .2, -.08); bf.rotation.y = 2.2; head.add(bf);
    Hd(M(C(.12, .125, .2, 14), hat, 0, 1.99, 0), M(C(.19, .19, .012, 18), hat, 0, 1.89, 0), M(C(.126, .126, .03, 14), F(0x4a1014), 0, 1.91, 0));
    const pts = [[0, 1.65, .15], [.0, 1.4, FZ + .1], [.02, 1.1, WZ + .14], [.05, .7, WZ + .1], [.09, .25, WZ + .06], [.14, -.05, .2], [.24, -.2, .3], [.42, -.215, .38]];
    legs(suit, boot);
  }
  if (role === 'medic') {      // bloodied nurse: wimple crowned with syringes, green goggles, stitched mouth, IV pole on the back feeding her neck, a syringe for a forearm
    const dress = cloth('#b8ae98', { blood: 22, tally: 9 }), white = cloth('#d8d0bc', { blood: 6, ds: true }), skin = cloth('#a89484', { blood: 3 }), lea = F(0x4a3420), glove = F(0x5a6a48), boot = F(0x1a1410);
    const glass = new T.MeshPhongMaterial({ color: 0xc8d8d0, transparent: true, opacity: .45, shininess: 100, specular: 0xffffff }), blood = F(0x6a0e0a);
    torso(dress, { chest: .95, neck: .16, skin, waist: .86 }); skirt(dress, -.16, 1.25);
    U([-1, 1].map(s => M(B(.035, .36, .012), lea, s * .09, 1.34, FZ + .006, 0, 0, s * .1)), M(B(.2, .03, .014), lea, 0, 1.4, FZ + .01), tor(.02, .005, steel, .03, 1.36, FZ + .02));
    { const b = M(C(.23 * slim, .23 * slim, .05, 14), lea, 0, 1.02, 0); b.scale.z = .7; U(b, M(B(.04, .035, .02), steel, 0, 1.02, WZ + .01)); }
    aL = arm(-1, dress, glove, glove, { long: true }); aR = arm(1, dress, null, null);
    [aL, aR].forEach(a => a.sh.add(ell(.085, .07, .085, dress, 0, -.06, 0)));
    aR.el.children[0].visible = false; aR.el.add(at(ring(.06, steel, .012), 0, -.02, 0), M(C(.012, .012, .06, 6), steel, 0, -.03, 0), M(C(.055, .055, .32, 12), glass, 0, -.22, 0), M(C(.046, .046, .17, 12), blood, 0, -.28, 0), ...[-.07, -.37].map(y => at(ring(.058, brass, .009), 0, y, 0)), M(C(.02, .012, .05, 8), steel, 0, -.41, 0), M(C(.0015, .005, .26, 5), steel, 0, -.56, 0));
    Hd(ell(.13, .16, .14, skin, 0, 1.72, 0), lathe([[.0, 1.93], [.11, 1.92], [.17, 1.82], [.175, 1.66], [.19, 1.5], [.22, 1.44]], white, .95, PI * 2 - 1.3, PI), M(B(.27, .045, .03), white, 0, 1.84, .12));
    for (let i = 0; i < 7; i++) { const a = -1.1 + i * 2.2 / 6, sy = G(M(C(.011, .011, .07, 6), glass, 0, 0, 0), M(C(.008, .008, .04, 6), blood, 0, -.012, 0), M(C(.003, .003, .03, 4), steel, 0, .05, 0), M(B(.022, .004, .004), steel, 0, .065, 0), M(C(.0008, .002, .03, 4), steel, 0, -.05, 0)); Hd(at(sy, Math.sin(a) * .1, 1.92, Math.cos(a) * .08 + .01, Math.cos(a) * -.25, 0, -Math.sin(a) * .35)); }
    Hd([-1, 1].flatMap(s => [at(ring(.03, brass, .006), s * .045, 1.765, .135, 0), ell(.028, .028, .008, F(0x2a3a2a), s * .045, 1.765, .137)]), M(B(.12, .006, .006), lea, 0, 1.765, .12));
    Hd(ell(.022, .022, .006, eyeW, -.045, 1.765, .142), sph(.0035, pupil, -.045, 1.765, .148), ...[0, 1, 2].map(i => M(B(.002, .02, .002), F(0x8a9a90), -.045 + (i - 1) * .012, 1.77, .146, 0, 0, (i - 1) * .9)));
    { const mk = cloth('#c8c8b4', { blood: 5 }), ml = lathe([[.0, 1.6], [.06, 1.605], [.1, 1.64], [.108, 1.67], [.1, 1.7], [.06, 1.715], [0, 1.715]], mk, .45, PI * 1.1, 0, 12); ml.position.z = .1; Hd(ml, ...[1.62, 1.66, 1.7].map(y => M(B(.12, .003, .003), F(0x9a9a88), 0, y, .158)), ...[-1, 1].flatMap(s => [M(B(.006, .006, .14), F(0xd8d8c8), s * .1, 1.7, .06, 0, s * .2, 0), M(B(.006, .006, .14), F(0xd8d8c8), s * .1, 1.63, .06, 0, s * .2, 0)])); }
    if (false) Hd(ell(.09, .026, .025, F(0x0a0404), 0, 1.655, .12), ...Array.from({ length: 12 }, (_, i) => M(B(.009, .014, .006), F(0xe0d4b8), -.06 + i * .011, 1.666, .152 - Math.abs(i - 5.5) * .005)), ...Array.from({ length: 12 }, (_, i) => M(B(.009, .013, .006), F(0xd0c4a8), -.06 + i * .011, 1.644, .152 - Math.abs(i - 5.5) * .005)), ...[-1, 1].flatMap(s => [M(B(.03, .003, .003), F(0x6a0e0a), s * .095, 1.672, .11, 0, s * .6, s * .5), tor(.008, .002, steel, s * .088, 1.66, .118, 0, 0, s > 0 ? 0 : PI, PI), M(C(.0012, .0012, .16, 3), steel, s * .11, 1.73, .1, 0, 0, s * -.35)]), stitches(-.05, .05, 1.655, .145, 6));
    const pole = G(M(C(.012, .012, 1.5, 6), steel, 0, 0, 0), M(B(.2, .01, .01), steel, .02, .74, 0), ...[-.08, .1].map(x => tor(.012, .003, steel, x, .72, 0))); pole.position.set(.06, .9, -.2); up.add(pole);
    const bag = G(ell(.05, .09, .03, new T.MeshPhongMaterial({ color: 0x8a1a14, transparent: true, opacity: .85, shininess: 80, specular: 0xffaaaa }), 0, 0, 0), M(C(.006, .006, .1, 5), F(0x8a1a14), 0, -.13, 0)); bag.position.set(.17, 1.5, -.2); up.add(bag); P.bag = bag;
    { const a = new T.Vector3(.17, 1.45 - .76 + .76 - .2, -.2), pts = [[.17, 1.25, -.2], [.16, 1.0, -.1], [.1, .86, -.02], [.06, .82, .03]]; let p = new T.Vector3(...pts[0]); for (let i = 1; i < pts.length; i++) { const b = new T.Vector3(...pts[i]), d = b.clone().sub(p), s = M(C(.007, .007, d.length() + .01, 5), F(0x8a1a14)); s.position.copy(p.clone().add(b).multiplyScalar(.5)); s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); up.add(s); p = b; } }
    legs(dress, boot);
  }
  Object.assign(P, { aL, aR }); g.userData.P = P;
  aL.sh.add(at(ring(.072, band, .008), 0, -.05, 0));
  if (st) g.scale.setScalar({ tallyman: 1.1, dealer: 1.06, enforcer: 1.05, fence: 1.04, scavenger: .95, locksmith: 1.0, medic: 1.0 }[role] || 1);
  if (st && role === 'locksmith') g.scale.set(.9, 1.14, .9);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
    if (P.gears) P.gears.forEach(([o, sp]) => { o.rotation.z = t * sp; });
    if (P.pendulum) P.pendulum.rotation.z = Math.sin(t * 3.2) * .35;
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
    const door = this.G(M(B(.12, 2.4, .2), m.dark, -.56, 1.2, 0), M(B(.12, 2.4, .2), m.dark, .56, 1.2, 0), M(B(1.24, .14, .2), m.dark, 0, 2.43, 0), M(B(.32, .1, .08), m.bulb, 0, 2.62, .05));
    const glow = new T.Mesh(new T.PlaneGeometry(1, 2.3), new T.MeshBasicMaterial({ color: 0x29261f })); glow.position.set(0, 1.15, -.05); door.add(glow);
    const hinge = new T.Group(); hinge.position.set(-.5, 0, .02); hinge.rotation.y = .35; hinge.add(M(B(1, 2.3, .06), m.dark, .5, 1.15, 0)); door.add(hinge);
    const dl = new T.PointLight(0xd8ccb4, 2.2, 5, 2); dl.position.set(0, 1.4, .6); door.add(dl);
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

// Final character accessory idles from consolidated Art Style Samples (11).
{ const oi3 = Kit.prototype.idle; Kit.prototype.idle = function (g, t, ph, st) { oi3.call(this, g, t, ph, st); const P = g.userData.P; if (!P) return; const s = Math.sin;
  if (P.windKey) P.windKey.rotation.z = t * 1.2;
  if (P.pans) P.pans.forEach((p, i) => { p.rotation.z = s(t * 1.4 + i * 2) * .06; });
  if (P.doll) P.doll.rotation.z = s(t * 1.7) * .25;
  if (P.bag) P.bag.rotation.z = s(t * .9 + ph) * .05;
  if (P.extra) P.extra.forEach((e, i) => { e.rotation.x = -.9 + s(t * 1.1 + i * 1.7) * .08; });
  if (P.dial) P.dial.rotation.z = Math.round(t * .6) * .6; if (P.claw) P.claw.children.forEach((c, i) => { c.rotation.z = (i < 2 ? 1 : -1) * Math.max(0, s(t * .8)) * .25; }); if (P.box) P.box.rotation.y = s(t * .7) * .1;
  if (P.books) P.books.rotation.z = s(t * .9 + ph) * .025;
  if (P.lampMat) { const f = .8 + .2 * s(t * 2.3 + ph); P.lampMat.color.setRGB(1 * f, .75 * f, .44 * f); } }; }

// The Table's seal: circular ink emblem. Ring text "THE TABLE" (top) + status (bottom), beaded ring, top-down table with six seats and the lamp. Pixel-eroded for a worn rubber-stamp look.
export function tableSealURL(status = 'IN SESSION', ink = '#7c1f19', S = 96) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), cx = S / 2, PI = Math.PI;
  let sd = status.length * 131 + 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.strokeStyle = g.fillStyle = '#000'; g.lineCap = 'butt';
  const ring = (rr, w) => { g.lineWidth = w; g.beginPath(); g.arc(cx, cx, rr, 0, PI * 2); g.stroke(); };
  ring(S * .47, 3.2); ring(S * .405, 1.2); ring(S * .3, 1.6);
  const arcText = (txt, rr, mid, dir) => { g.font = 'bold ' + Math.round(S * .105) + 'px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const step = .205; const n = txt.length; for (let i = 0; i < n; i++) { const a = mid + (i - (n - 1) / 2) * step * dir; g.save(); g.translate(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); g.rotate(a + (dir > 0 ? PI / 2 : -PI / 2)); g.fillText(txt[i], 0, 0); g.restore(); } };
  arcText('THE TABLE', S * .353, -PI / 2, 1);
  arcText(status, S * .353, PI / 2, -1);
  [PI, 0].forEach(a => { const x = cx + Math.cos(a) * S * .353, y = cx + Math.sin(a) * S * .353; g.save(); g.translate(x, y); g.rotate(PI / 4); g.fillRect(-2.6, -2.6, 5.2, 5.2); g.restore(); });
  // emblem: round table, six seats, lamp
  ring(S * .17, 2.2);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 - PI / 2; g.save(); g.translate(cx + Math.cos(a) * S * .235, cx + Math.sin(a) * S * .235); g.rotate(a); g.fillRect(-2.4, -3.4, 4.8, 6.8); g.restore(); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, l = i % 2 ? S * .07 : S * .115; g.lineWidth = i % 2 ? 1.2 : 1.8; g.beginPath(); g.moveTo(cx + Math.cos(a) * S * .03, cx + Math.sin(a) * S * .03); g.lineTo(cx + Math.cos(a) * l, cx + Math.sin(a) * l); g.stroke(); }
  g.beginPath(); g.arc(cx, cx, S * .03, 0, PI * 2); g.fill();
  // wear: uneven ink + chipped edge, then tint
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; if (!p[i + 3]) continue;
    const dd = Math.hypot(x - cx, y - cx) / (S / 2), bias = .07 + (x / S) * .1 + (dd > .9 ? .12 : 0);
    p[i + 3] = p[i + 3] < 110 || r() < bias ? 0 : 255; }
  for (let k = 0; k < 6; k++) { const a = r() * PI * 2, rr = S * (.3 + r() * .17), x = cx + Math.cos(a) * rr | 0, y = cx + Math.sin(a) * rr | 0; for (let j = 0; j < 10; j++) { const xx = x + (r() * 5 | 0) - 2, yy = y + (r() * 5 | 0) - 2; if (xx >= 0 && yy >= 0 && xx < S && yy < S) p[(yy * S + xx) * 4 + 3] = 0; } }
  g.putImageData(d, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = ink; g.fillRect(0, 0, S, S);
  return c.toDataURL();
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
