/* Voxel Drive engine — 体素小车在无限公路上行驶。
 * 从 voxel-orb/src/home/main.ts 移植，封装为引擎类。
 * 组件传入 canvas，调 init()/start()/dispose()。 */
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

/* ── 共享常量 ─────────────────────────────────────────── */
const GROUND_Y = -1.2;
const ROAD_HALF = 2.0;
const OBJ_X = 3.3;
const OBJ_TILE = 5.5;
const ROAD_LEN = 48;

const HEADLIGHT = {
  pos: new THREE.Vector3(0, 0.6, 1.0),
  dir: new THREE.Vector3(0, -0.3, 1.0),
  color: new THREE.Color(0xfff4d0),
  cone: Math.cos(Math.PI / 6.5),
  range: 16.0,
  intensity: 0.0,
};

const COL = {
  body:     { lin: [0.62, 0.10, 0.10], hex: 0xd12d2d },
  bodyDark: { lin: [0.42, 0.07, 0.07], hex: 0x8e1f1f },
  glass:    { lin: [0.16, 0.24, 0.32], hex: 0x3a5670 },
  glassDark:{ lin: [0.06, 0.10, 0.14], hex: 0x16242f },
  chrome:   { lin: [0.55, 0.55, 0.58], hex: 0x9aa0a8 },
  wheel:    { lin: [0.05, 0.05, 0.055], hex: 0x101013 },
  hub:      { lin: [0.40, 0.40, 0.43], hex: 0xc4c8d0 },
  head:     { lin: [0.95, 0.85, 0.55], hex: 0xfff0a0, emi: 0xffd060 },
  tail:     { lin: [0.80, 0.14, 0.10], hex: 0xff3320, emi: 0xff2010 },
  plate:    { lin: [0.85, 0.85, 0.85], hex: 0xdddddd },
  bumper:   { lin: [0.25, 0.23, 0.21], hex: 0x756a5a },
  asphalt:  { lin: [0.34, 0.34, 0.37], hex: 0x4a4a52 },
  dirt:     { lin: [0.42, 0.30, 0.16], hex: 0x614a28 },
  trunk:    { lin: [0.18, 0.12, 0.07], hex: 0x4a3520 },
  canopy:   { lin: [0.12, 0.34, 0.16], hex: 0x2e6e2a },
  rock:     { lin: [0.4, 0.38, 0.36], hex: 0x6a655f },
  curb:     { lin: [0.42, 0.40, 0.36], hex: 0x7a7468 },
  sign:     { lin: [0.82, 0.78, 0.2], hex: 0xd6cf34 },
  post:     { lin: [0.5, 0.5, 0.52], hex: 0x85888c },
  line:     { lin: [0.9, 0.9, 0.9], hex: 0xeaeaee },
};

const hexToLin: Record<number, [number, number, number]> = {};
for (const k of Object.keys(COL)) hexToLin[COL[k].hex] = COL[k].lin as [number, number, number];

const FBX_CAR_COLORS: Record<number, [number, number, number]> = {
  0x5982cc: [0.50, 0.62, 0.85],
  0x090909: [0.05, 0.05, 0.055],
  0x030303: [0.03, 0.03, 0.03],
  0x333333: [0.22, 0.22, 0.22],
  0xcc6020: [0.70, 0.38, 0.12],
  0xcc1813: [0.72, 0.10, 0.08],
  0xffffff: [0.85, 0.85, 0.85],
  0x92afcc: [0.48, 0.58, 0.70],
  0xcc551b: [0.72, 0.30, 0.10],
  0xb24a18: [0.62, 0.26, 0.08],
  0xcc9a2c: [0.72, 0.55, 0.12],
};
for (const hex of Object.keys(FBX_CAR_COLORS)) hexToLin[parseInt(hex)] = FBX_CAR_COLORS[parseInt(hex)];

const hash11 = (a: number, b: number) => {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

function box(w: number, h: number, d: number, x: number, y: number, z: number, c: number, emi?: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  if (emi) {
    (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(emi);
    (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1;
  }
  m.position.set(x, y, z);
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), mat);
}

const matStd = (hex: number, rough = 0.7, metal = 0) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });

const TRI_F = 16;

export interface VoxelDriveCallbacks {
  onFps?: (fps: number) => void;
  onSpeed?: (speed: number) => void;
}

export class VoxelDriveEngine {
  private canvas: HTMLCanvasElement;
  private cb: VoxelDriveCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private meshScene!: THREE.Scene;
  private mat!: THREE.ShaderMaterial;
  private geo!: THREE.BufferGeometry;
  private points!: THREE.Points;

  private vPositions!: Float32Array;
  private vColors!: Float32Array;
  private vNormals!: Float32Array;
  private baseColors!: Float32Array;
  private baseNormals!: Float32Array;
  private baseDirty = true;

  private VOX = 0.14;
  private RES = { x: 120, y: 70, z: 120 };
  private VOL = { x: 19.2, y: 11.2, z: 19.2 };
  private actualVox = 0.14;
  private readonly GRID_EXT = { x: 19.2, y: 11.2, z: 19.2 };

  private R = 8.5;
  private SOFT = 2.0;
  private R2 = 8.5 * 8.5;
  private flickerAmt = 0.3;

  private triData: Float32Array = new Float32Array(8192 * TRI_F);
  private triCount = 0;
  private staticTriData: Float32Array = new Float32Array(0);
  private staticTriCount = 0;

  private carModel: THREE.Group | null = null;
  private signModel: THREE.Group | null = null;
  private wheelRadius = 0.25;
  private meshCar: THREE.Group | null = null;

  private meshMode = false;
  private speed = 3.0;
  private carZ = 0;

  private camTarget = new THREE.Vector3(-7.4, 5.0, -9.4);
  private lookTarget = new THREE.Vector3(0.0, -0.3, 1.6);
  private camPos = this.camTarget.clone();
  private lookAt = this.lookTarget.clone();

  private mx = 0; private my = 0; private mxs = 0; private mys = 0;

  private hlLight!: THREE.SpotLight;
  private clock = new THREE.Clock();
  private rafId = 0;
  private disposed = false;

  private fpsAcc = 0; private fpsFrames = 0; private fpsSmooth = 0;

  private resizeHandler!: () => void;
  private mouseHandler!: (e: MouseEvent) => void;

  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _v3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, cb: VoxelDriveCallbacks = {}) {
    this.canvas = canvas;
    this.cb = cb;
  }

  /* ── Grid ── */
  private buildGridArrays() {
    this.RES = {
      x: Math.round(this.GRID_EXT.x / this.VOX),
      y: Math.round(this.GRID_EXT.y / this.VOX),
      z: Math.round(this.GRID_EXT.z / this.VOX),
    };
    this.VOL = { x: this.GRID_EXT.x, y: this.GRID_EXT.y, z: this.GRID_EXT.z };
    const total = this.RES.x * this.RES.y * this.RES.z;
    if (total > 3000000) {
      const s = Math.sqrt(3000000 / total);
      this.RES = {
        x: Math.max(10, Math.round(this.RES.x * s)),
        y: Math.max(10, Math.round(this.RES.y * s)),
        z: Math.max(10, Math.round(this.RES.z * s)),
      };
    }
    this.actualVox = this.VOL.x / this.RES.x;
    const np = this.RES.x * this.RES.y * this.RES.z;
    this.vPositions = new Float32Array(np * 3);
    this.vColors = new Float32Array(np * 3);
    this.vNormals = new Float32Array(np * 3);
    this.baseColors = new Float32Array(np * 3);
    this.baseNormals = new Float32Array(np * 3);
    this.baseDirty = true;
    let p = 0;
    for (let iz = 0; iz < this.RES.z; iz++)
      for (let iy = 0; iy < this.RES.y; iy++)
        for (let ix = 0; ix < this.RES.x; ix++) {
          this.vPositions[p] = (ix + 0.5) / this.RES.x * this.VOL.x - this.VOL.x / 2;
          this.vPositions[p + 1] = (iy + 0.5) / this.RES.y * this.VOL.y - this.VOL.y / 2;
          this.vPositions[p + 2] = (iz + 0.5) / this.RES.z * this.VOL.z - this.VOL.z / 2;
          this.vColors[p] = 0; this.vColors[p + 1] = 0; this.vColors[p + 2] = 0;
          this.vNormals[p] = 0; this.vNormals[p + 1] = 1; this.vNormals[p + 2] = 0;
          p += 3;
        }
  }

  private rebuildGrid() {
    this.buildGridArrays();
    this.mat.uniforms.uVox.value = this.actualVox;
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(this.vPositions, 3));
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(this.vColors.slice(), 3));
    this.geo.setAttribute("voxNormal", new THREE.Float32BufferAttribute(this.vNormals.slice(), 3));
  }

  /* ── World builders ── */
  private buildCarGroup(): THREE.Group {
    const g = new THREE.Group();
    if (this.carModel) {
      const clone = this.carModel.clone(true);
      clone.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh && /wheel/i.test(mesh.name)) mesh.userData.isWheel = true;
      });
      g.add(clone);
    } else {
      g.visible = false;
    }
    return g;
  }

  private buildSign(L: number, y: number, wz: number, _signMat: THREE.MeshStandardMaterial, postMat: THREE.MeshStandardMaterial): THREE.Group {
    const g = new THREE.Group();
    if (this.signModel) {
      const clone = this.signModel.clone(true);
      clone.position.set(L, y, wz);
      g.add(clone);
    } else {
      const post = cyl(0.05, 0.05, 1.5, postMat);
      post.position.set(L, y + 0.75, wz);
      g.add(post);
    }
    return g;
  }

  private buildEnvWorld(carZ: number): THREE.Group {
    const world = new THREE.Group();
    const road = box(ROAD_HALF * 2, 0.40, ROAD_LEN, 0, GROUND_Y - 0.07, 0, COL.asphalt.hex);
    (road.material as THREE.MeshStandardMaterial).roughness = 0.95;
    world.add(road);
    const lineMat = matStd(COL.line.hex, 0.5);
    const visHalf = ROAD_LEN / 2;
    for (let worldZ = Math.ceil((carZ - visHalf) / 2) * 2; worldZ <= carZ + visHalf; worldZ += 2) {
      const wz = worldZ - carZ;
      const dash = box(0.30, 0.02, 1.0, 0, GROUND_Y + 0.135, wz, COL.line.hex);
      dash.material = lineMat; world.add(dash);
    }
    for (const lx of [-ROAD_HALF + 0.20, ROAD_HALF - 0.20]) {
      const line = box(0.26, 0.02, ROAD_LEN, lx, GROUND_Y + 0.135, 0, COL.line.hex);
      line.material = lineMat; world.add(line);
    }
    for (const lx of [-ROAD_HALF, ROAD_HALF]) {
      world.add(box(0.24, 0.34, ROAD_LEN, lx, GROUND_Y + 0.02, 0, COL.curb.hex));
    }
    const dirtMat = matStd(COL.dirt.hex, 1);
    for (const sx of [-1, 1]) {
      const dirt = box(6, 0.42, ROAD_LEN, sx * (ROAD_HALF + 3), GROUND_Y - 0.09, 0, COL.dirt.hex);
      dirt.material = dirtMat; world.add(dirt);
    }
    const zMin = carZ - 12, zMax = carZ + 12;
    const trunkMat = matStd(COL.trunk.hex, 0.9), canopyMat = matStd(COL.canopy.hex, 0.8);
    const rockMat = matStd(COL.rock.hex, 0.9), postMat = matStd(COL.post.hex, 0.6, 0.4);
    const signMat = new THREE.MeshStandardMaterial({ color: COL.sign.hex, emissive: 0x4a4608, emissiveIntensity: 0.3 });
    for (const L of [-OBJ_X, OBJ_X]) {
      for (let tz = Math.floor(zMin / OBJ_TILE) * OBJ_TILE; tz <= zMax; tz += OBJ_TILE) {
        const h = hash11(L * 3.7 + 1.3, tz * 0.91 + 0.7);
        if (h > 0.18) continue;
        const kind = Math.floor(hash11(tz * 2.13, L * 1.7 + 9.1) * 7.0) % 3;
        const zJit = (hash11(tz * 1.31, L * 5.5 + 2.2) - 0.5) * 2.0;
        const xJit = (hash11(tz * 0.77, L * 3.3 + 1.1) - 0.5) * 1.0;
        const wz = tz + zJit - carZ;
        const px = L + xJit;
        if (kind === 0) {
          const trunk = cyl(0.09, 0.09, 0.85, trunkMat);
          trunk.position.set(px, GROUND_Y + 0.425, wz); world.add(trunk);
          const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), canopyMat);
          canopy.position.set(px, GROUND_Y + 1.25, wz); world.add(canopy);
          canopy.userData.solid = true;
        } else if (kind === 1) {
          const rock = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), rockMat);
          rock.position.set(px, GROUND_Y + 0.32, wz); world.add(rock);
          rock.userData.solid = true;
        } else {
          world.add(this.buildSign(px, GROUND_Y, wz, signMat, postMat));
        }
      }
    }
    return world;
  }

  /* ── Triangle extraction ── */
  private triRGBForMesh(mesh: THREE.Mesh): Float32Array {
    const geo = mesh.geometry as THREE.BufferGeometry;
    let index = geo.getIndex();
    const posAttr = geo.getAttribute("position");
    if (!index) {
      const arr = new Uint32Array(posAttr.count);
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      index = new THREE.BufferAttribute(arr, 1);
    }
    const triIdxCount = index.count;
    const triTotal = triIdxCount / 3;
    const triRGB = new Float32Array(triTotal * 3);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = geo.groups;
    if (groups && groups.length > 0) {
      for (const grp of groups) {
        const mat = mats[grp.materialIndex ?? 0] ?? mats[0];
        const hex = (mat as THREE.MeshStandardMaterial).color?.getHex() ?? 0x888888;
        const tunG = hexToLin[hex];
        const gr = tunG ? tunG[0] : ((hex >> 16 & 0xff) / 255);
        const gg = tunG ? tunG[1] : ((hex >> 8 & 0xff) / 255);
        const gb = tunG ? tunG[2] : ((hex & 0xff) / 255);
        const start = grp.start / 3;
        const cnt = grp.count / 3;
        for (let t = start; t < start + cnt && t < triTotal; t++) {
          triRGB[t * 3] = gr; triRGB[t * 3 + 1] = gg; triRGB[t * 3 + 2] = gb;
        }
      }
    } else {
      const hex = ((mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0x888888)).getHex();
      const tunG = hexToLin[hex];
      const gr = tunG ? tunG[0] : ((hex >> 16 & 0xff) / 255);
      const gg = tunG ? tunG[1] : ((hex >> 8 & 0xff) / 255);
      const gb = tunG ? tunG[2] : ((hex & 0xff) / 255);
      for (let t = 0; t < triTotal; t++) {
        triRGB[t * 3] = gr; triRGB[t * 3 + 1] = gg; triRGB[t * 3 + 2] = gb;
      }
    }
    return triRGB;
  }

  private extractTriangles(root: THREE.Object3D) {
    this.extractTrianglesFiltered(root, false);
  }

  private extractTrianglesFiltered(root: THREE.Object3D, skipWheels: boolean) {
    this.triCount = 0;
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (skipWheels && mesh.userData.isWheel) return;
      this.pushMeshTris(mesh, mesh.userData.solid === true, mesh.userData.billboard === true);
    });
  }

  private appendWheelTriangles(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry || !mesh.userData.isWheel) return;
      this.pushMeshTris(mesh, true, false);
    });
  }

  private pushMeshTris(mesh: THREE.Mesh, solid: boolean, billboard: boolean) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute("position");
    if (!posAttr) return;
    let index = geo.getIndex();
    if (!index) {
      const arr = new Uint32Array(posAttr.count);
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      index = new THREE.BufferAttribute(arr, 1);
    }
    const triRGB = this.triRGBForMesh(mesh);
    const m = mesh.matrixWorld;
    const triIdxCount = index.count;
    for (let i = 0, tri = 0; i < triIdxCount; i += 3, tri++) {
      this._v1.fromBufferAttribute(posAttr, index.getX(i)).applyMatrix4(m);
      this._v2.fromBufferAttribute(posAttr, index.getX(i + 1)).applyMatrix4(m);
      this._v3.fromBufferAttribute(posAttr, index.getX(i + 2)).applyMatrix4(m);
      let _nx = (this._v2.y - this._v1.y) * (this._v3.z - this._v1.z) - (this._v2.z - this._v1.z) * (this._v3.y - this._v1.y);
      let _ny = (this._v2.z - this._v1.z) * (this._v3.x - this._v1.x) - (this._v2.x - this._v1.x) * (this._v3.z - this._v1.z);
      let _nz = (this._v2.x - this._v1.x) * (this._v3.y - this._v1.y) - (this._v2.y - this._v1.y) * (this._v3.x - this._v1.x);
      const _nl = Math.sqrt(_nx * _nx + _ny * _ny + _nz * _nz) || 1;
      _nx /= _nl; _ny /= _nl; _nz /= _nl;
      if (billboard) { _nx = 0; _ny = 0; _nz = 1; }
      if (this.triCount * TRI_F + TRI_F > this.triData.length) {
        const nd = new Float32Array(this.triData.length * 2);
        nd.set(this.triData); this.triData = nd;
      }
      const o = this.triCount * TRI_F;
      this.triData[o] = this._v1.x; this.triData[o + 1] = this._v1.y; this.triData[o + 2] = this._v1.z;
      this.triData[o + 3] = this._v2.x; this.triData[o + 4] = this._v2.y; this.triData[o + 5] = this._v2.z;
      this.triData[o + 6] = this._v3.x; this.triData[o + 7] = this._v3.y; this.triData[o + 8] = this._v3.z;
      this.triData[o + 9] = triRGB[tri * 3]; this.triData[o + 10] = triRGB[tri * 3 + 1]; this.triData[o + 11] = triRGB[tri * 3 + 2];
      this.triData[o + 12] = _nx; this.triData[o + 13] = _ny; this.triData[o + 14] = _nz;
      this.triData[o + 15] = solid ? 1 : 0;
      this.triCount++;
    }
  }

  private spinWheels(root: THREE.Object3D, angle: number) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.isWheel) return;
      mesh.rotation.x = (mesh.userData.wheelBaseRot ?? mesh.rotation.x) - angle;
    });
  }

  /* ── Voxel sampling ── */
  private sampleTrisInto(colors: Float32Array, normals: Float32Array, tris: Float32Array, count: number) {
    const vh = this.VOL.x / 2, vhY = this.VOL.y / 2, vhZ = this.VOL.z / 2;
    const tol = this.actualVox * 1.05;
    const RmSOFT = this.R - this.SOFT, invSOFT = this.SOFT > 0 ? 1 / this.SOFT : 0;
    const RmSOFT2 = RmSOFT * RmSOFT;
    const resXm1 = this.RES.x - 1, resYm1 = this.RES.y - 1, resZm1 = this.RES.z - 1;
    const posArr = this.vPositions;
    for (let ti = 0; ti < count; ti++) {
      const o = ti * TRI_F;
      const ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
      const bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5];
      const cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
      const tr = tris[o + 9], tg = tris[o + 10], tb = tris[o + 11];
      const tnx = tris[o + 12], tny = tris[o + 13], tnz = tris[o + 14];
      const ex = bx - ax, ey = by - ay, ez = bz - az;
      const fx = cx - ax, fy = cy - ay, fz = cz - az;
      const dot00 = ex * ex + ey * ey + ez * ez;
      const dot01 = ex * fx + ey * fy + ez * fz;
      const dot11 = fx * fx + fy * fy + fz * fz;
      const denom = dot00 * dot11 - dot01 * dot01;
      if (Math.abs(denom) < 1e-9) continue;
      const invDen = 1 / denom;
      let minX = ax, maxX = ax; if (bx < minX) minX = bx; if (bx > maxX) maxX = bx; if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      let minY = ay, maxY = ay; if (by < minY) minY = by; if (by > maxY) maxY = by; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      let minZ = az, maxZ = az; if (bz < minZ) minZ = bz; if (bz > maxZ) maxZ = bz; if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;
      let ix0 = Math.floor((minX - tol + vh) / this.actualVox), ix1 = Math.ceil((maxX + tol + vh) / this.actualVox);
      let iy0 = Math.floor((minY - tol + vhY) / this.actualVox), iy1 = Math.ceil((maxY + tol + vhY) / this.actualVox);
      let iz0 = Math.floor((minZ - tol + vhZ) / this.actualVox), iz1 = Math.ceil((maxZ + tol + vhZ) / this.actualVox);
      if (ix0 < 0) ix0 = 0; if (iy0 < 0) iy0 = 0; if (iz0 < 0) iz0 = 0;
      if (ix1 > resXm1) ix1 = resXm1; if (iy1 > resYm1) iy1 = resYm1; if (iz1 > resZm1) iz1 = resZm1;
      for (let iz = iz0; iz <= iz1; iz++)
        for (let iy = iy0; iy <= iy1; iy++) {
          const rowBase = (iz * this.RES.y + iy) * this.RES.x;
          for (let ix = ix0; ix <= ix1; ix++) {
            const b = (rowBase + ix) * 3;
            const px = posArr[b], py = posArr[b + 1], pz = posArr[b + 2];
            const cyc = py + 0.35;
            const d2 = px * px + cyc * cyc + pz * pz;
            if (d2 > this.R2) continue;
            const dx = px - ax, dy = py - ay, dz = pz - az;
            const pd = dx * tnx + dy * tny + dz * tnz;
            if (pd > tol || pd < -tol) continue;
            const dot02 = ex * dx + ey * dy + ez * dz;
            const dot12 = fx * dx + fy * dy + fz * dz;
            const u = (dot11 * dot02 - dot01 * dot12) * invDen;
            const v = (dot00 * dot12 - dot01 * dot02) * invDen;
            if (u < -0.05 || v < -0.05 || u + v > 1.05) continue;
            const f = d2 < RmSOFT2 ? 1 : (this.R - Math.sqrt(d2)) * invSOFT;
            colors[b] = tr * f; colors[b + 1] = tg * f; colors[b + 2] = tb * f;
            normals[b] = tnx; normals[b + 1] = tny; normals[b + 2] = tnz;
          }
        }
    }
  }

  private rebuildBaseLayer() {
    this.baseColors.fill(0);
    this.baseNormals.fill(0);
    this.sampleTrisInto(this.baseColors, this.baseNormals, this.staticTriData, this.staticTriCount);
    this.baseDirty = false;
  }

  private sampleToVoxels(t: number) {
    this.vColors.set(this.baseColors);
    this.vNormals.set(this.baseNormals);
    this.sampleTrisInto(this.vColors, this.vNormals, this.triData, this.triCount);
    const n = this.vPositions.length / 3;
    const flB = Math.floor(t * 14.0), dimB = Math.floor(t * 3.0), flickDrop = 1.0 - 0.30 * this.flickerAmt;
    for (let i = 0; i < n; i++) {
      const b = i * 3;
      if (this.vColors[b] === 0 && this.vColors[b + 1] === 0 && this.vColors[b + 2] === 0) continue;
      const ih = Math.imul(i, 73856093);
      const fl = (Math.imul(ih ^ (flB * 40503), 2246822519) >>> 0) / 4294967296;
      const dim = (Math.imul(Math.imul(ih, 19349663) ^ (dimB * 99083), 2246822519) >>> 0) / 4294967296;
      let m2 = 0.88 + 0.12 * fl;
      if (dim > 0.93) m2 *= flickDrop;
      this.vColors[b] *= m2; this.vColors[b + 1] *= m2; this.vColors[b + 2] *= m2;
    }
  }

  /* ── Sprite texture ── */
  private makeSprite(): THREE.Texture {
    const s = 32, cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const x = cv.getContext("2d")!;
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.7)");
    g.addColorStop(0.7, "rgba(255,255,255,0.15)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }

  private readonly VERT = [
    "uniform float uScale; uniform float uTime;",
    "uniform float uJit; uniform float uSizeMult; uniform float uPointMax; uniform float uVox;",
    "uniform float uFlicker;",
    "attribute vec3 color; attribute vec3 voxNormal;",
    "varying vec3 vColor; varying float vBright; varying vec3 vNormal; varying float vDepth;",
    "varying float vShimmer;",
    "varying vec3 vWorld;",
    "float h21(float n){ return fract(sin(n*127.1+34.3)*43758.5453); }",
    "void main() {",
    "  vColor = color;",
    "  vBright = max(max(color.r, color.g), color.b);",
    "  vNormal = voxNormal;",
    "  float seed = position.x*12.1 + position.y*78.2 + position.z*37.7;",
    "  float jt = uTime * 9.0;",
    "  vec3 jit = vec3(h21(seed + floor(jt)) - 0.5, h21(seed + floor(jt) + 11.0) - 0.5, h21(seed + floor(jt) + 23.0) - 0.5) * uJit;",
    "  vShimmer = 1.0;",
    "  vec4 mv = modelViewMatrix * vec4(position + jit, 1.0);",
    "  vDepth = -mv.z;",
    "  vWorld = position + jit;",
    "  gl_Position = projectionMatrix * mv;",
    "  gl_PointSize = clamp(uScale * uSizeMult * (uVox / 0.145) * (1.0 / -mv.z), 1.0, uPointMax);",
    "}",
  ].join("\n");

  private readonly FRAG = [
    "uniform sampler2D uTex; uniform float uBoost; uniform float uGlow;",
    "uniform float uShape;",
    "uniform vec3 uHlPos; uniform vec3 uHlDir; uniform float uHlCone; uniform float uHlRange; uniform float uHlInt;",
    "uniform vec3 uHlColor;",
    "varying vec3 vColor; varying float vBright; varying vec3 vNormal; varying float vDepth;",
    "varying float vShimmer; varying vec3 vWorld;",
    "void main() {",
    "  if (vBright < 0.004) discard;",
    "  vec2 uv = gl_PointCoord - 0.5;",
    "  float d = length(uv);",
    "  float alpha = 1.0;",
    "  vec3 col = vColor * uBoost * vShimmer;",
    "  vec3 N = normalize(vNormal);",
    "  vec3 L = normalize(vec3(-9.0, 14.0, 7.0));",
    "  float lit = 0.35 + 0.95 * max(dot(N, L), 0.0);",
    "  col = col * lit;",
    "  if (uHlInt > 0.001) {",
    "    vec3 toP = vWorld - uHlPos;",
    "    float dist = length(toP);",
    "    vec3 D = normalize(toP);",
    "    float ang = dot(D, normalize(uHlDir));",
    "    float spot = smoothstep(uHlCone - 0.06, uHlCone + 0.02, ang);",
    "    float att = clamp(1.0 - dist / uHlRange, 0.0, 1.0);",
    "    att *= att;",
    "    float hl = spot * att * uHlInt;",
    "    col += uHlColor * hl;",
    "  }",
    "  if (uShape < 0.5) {",
    "    /* square */",
    "    alpha = step(max(abs(uv.x), abs(uv.y)), 0.5);",
    "    col += vColor * uGlow * smoothstep(0.12, 0.9, vBright) * 0.15;",
    "  } else if (uShape < 1.5) {",
    "    /* round — original texture sprite */",
    "    vec4 t = texture2D(uTex, gl_PointCoord);",
    "    if (t.a < 0.01) discard;",
    "    float halo = pow(t.a, 1.5);",
    "    col += vColor * halo * uGlow * smoothstep(0.12, 0.9, vBright);",
    "    alpha = 1.0;",
    "  } else if (uShape < 2.5) {",
    "    /* soft gaussian */",
    "    float g = exp(-d * d * 8.0);",
    "    if (g < 0.01) discard;",
    "    col += vColor * uGlow * smoothstep(0.12, 0.9, vBright) * g;",
    "    alpha = 1.0;",
    "  } else {",
    "    /* LED — vertical streak like a POV display */",
    "    vec2 rect = abs(uv) / vec2(0.06, 0.49);",
    "    float led = 1.0 - smoothstep(0.85, 1.0, max(rect.x, rect.y));",
    "    if (led < 0.01) discard;",
    "    col += vColor * uGlow * smoothstep(0.12, 0.9, vBright) * 0.3;",
    "    alpha = 1.0;",
    "  }",
    "  gl_FragColor = vec4(col, alpha);",
    "}",
  ].join("\n");

  /* ── Init ── */
  init() {
    this.buildGridArrays();

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.makeSprite() }, uScale: { value: 1 }, uTime: { value: 0 },
        uBoost: { value: 1.5 }, uGlow: { value: 1.2 }, uJit: { value: 0.03 },
        uSizeMult: { value: 2.0 }, uPointMax: { value: 11.0 }, uVox: { value: 0.145 },
        uFlicker: { value: this.flickerAmt },
        uShape: { value: 3 }, // 0=square, 1=round, 2=soft, 3=led
        uHlPos: { value: HEADLIGHT.pos }, uHlDir: { value: HEADLIGHT.dir },
        uHlCone: { value: HEADLIGHT.cone }, uHlRange: { value: HEADLIGHT.range },
        uHlInt: { value: 0 }, uHlColor: { value: HEADLIGHT.color },
      },
      vertexShader: this.VERT, fragmentShader: this.FRAG,
      transparent: false, blending: THREE.NormalBlending, depthWrite: true,
    });

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(this.vPositions, 3));
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(this.vColors.slice(), 3));
    this.geo.setAttribute("voxNormal", new THREE.Float32BufferAttribute(this.vNormals.slice(), 3));
    this.points = new THREE.Points(this.geo, this.mat);

    /* ── mesh scene ── */
    this.meshScene = new THREE.Scene();
    this.meshScene.background = new THREE.Color(0x0a0c12);
    this.meshScene.fog = new THREE.Fog(0x0a0c12, 22, 46);
    this.meshScene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.3);
    sun.position.set(-9, 14, 7);
    this.meshScene.add(sun);
    const sky = new THREE.DirectionalLight(0x88aaff, 0.4);
    sky.position.set(8, 6, -7);
    this.meshScene.add(sky);
    this.meshScene.add(new THREE.HemisphereLight(0x445566, 0x0a0608, 0.5));
    this.hlLight = new THREE.SpotLight(HEADLIGHT.color.getHex(), 0, HEADLIGHT.range, Math.PI / 6.5, 0.4, 1.5);
    this.hlLight.position.copy(HEADLIGHT.pos);
    const hlTarget = new THREE.Object3D();
    hlTarget.position.copy(HEADLIGHT.pos).add(HEADLIGHT.dir.clone().multiplyScalar(5));
    this.meshScene.add(this.hlLight);
    this.meshScene.add(hlTarget);
    this.hlLight.target = hlTarget;

    /* ── voxel scene ── */
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.add(this.points);

    /* ── camera + renderer ── */
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.resizeHandler = () => this.resize();
    this.mouseHandler = (e: MouseEvent) => {
      this.mx = (e.clientX / window.innerWidth) * 2 - 1;
      this.my = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("mousemove", this.mouseHandler);
    this.resize();

    /* ── Load FBX models ── */
    const signLoader = new FBXLoader();
    signLoader.load("/models/Sign_Triangle.fbx", (obj) => {
      const b3 = new THREE.Box3().setFromObject(obj);
      const sz = new THREE.Vector3(); b3.getSize(sz);
      const targetH = 2.4;
      const scale = targetH / Math.max(sz.y, 0.001);
      obj.scale.setScalar(scale);
      obj.rotation.y = Math.PI / 2;
      obj.position.set(0, -b3.min.y * scale, 0);
      this.signModel = obj;
    });

    const carLoader = new FBXLoader();
    carLoader.load("/models/SportsCar.fbx", (obj) => {
      obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).userData.solid = true; });
      const b3 = new THREE.Box3().setFromObject(obj);
      const sz = new THREE.Vector3(); b3.getSize(sz);
      const targetLen = 3.0;
      const scale = targetLen / Math.max(sz.y, 0.001);
      obj.scale.setScalar(scale);
      obj.rotateX(Math.PI / 2);
      obj.rotateY(Math.PI);
      obj.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(obj);
      const roadTop = GROUND_Y + 0.13;
      obj.position.y += roadTop - b2.min.y;
      obj.updateMatrixWorld(true);
      this.carModel = obj;
      obj.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh && /wheel/i.test(mesh.name)) {
          const wb = new THREE.Box3().setFromObject(mesh);
          const wsz = new THREE.Vector3(); wb.getSize(wsz);
          this.wheelRadius = Math.max(this.wheelRadius, Math.min(wsz.y, wsz.z) / 2);
          mesh.userData.isWheel = true;
          mesh.userData.wheelBaseRot = mesh.rotation.x;
        }
      });
      this.extractTrianglesFiltered(this.buildCarGroup(), true);
      this.staticTriData = new Float32Array(this.triCount * TRI_F);
      this.staticTriData.set(this.triData.subarray(0, this.triCount * TRI_F));
      this.staticTriCount = this.triCount;
      this.markBaseDirty();
    });

    /* ── Static car triangle cache ── */
    this.extractTrianglesFiltered(this.buildCarGroup(), true);
    this.staticTriData = new Float32Array(this.triCount * TRI_F);
    this.staticTriData.set(this.triData.subarray(0, this.triCount * TRI_F));
    this.staticTriCount = this.triCount;
  }

  private markBaseDirty() { this.baseDirty = true; }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.mat.uniforms.uScale.value =
      h * Math.min(window.devicePixelRatio, 2) / (2 * Math.tan((this.camera.fov * Math.PI / 180) / 2));
  }

  /* ── Public controls ── */
  setSpeed(v: number) { this.speed = v; }
  setMeshMode(on: boolean) { this.meshMode = on; }
  isMeshMode() { return this.meshMode; }
  setHeadlight(v: number) {
    HEADLIGHT.intensity = v;
    this.mat.uniforms.uHlInt.value = v;
    this.hlLight.intensity = v * 8;
  }
  setVox(v: number) { this.VOX = v; this.rebuildGrid(); }
  setRadius(v: number) { this.R = v; this.R2 = v * v; this.markBaseDirty(); }
  setSoft(v: number) { this.SOFT = v; this.markBaseDirty(); }
  setBoost(v: number) { this.mat.uniforms.uBoost.value = v; }
  setGlow(v: number) { this.mat.uniforms.uGlow.value = v; }
  setPointSize(v: number) {
    this.mat.uniforms.uSizeMult.value = v;
    this.mat.uniforms.uPointMax.value = 5.5 * Math.max(v, 0.2);
  }
  setJitter(v: number) { this.mat.uniforms.uJit.value = v; }
  setFlicker(v: number) { this.flickerAmt = v; this.mat.uniforms.uFlicker.value = v; }
  setShape(v: number) { this.mat.uniforms.uShape.value = v; }

  /* ── Animation loop ── */
  start() {
    const animate = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      this.carZ += this.speed * dt;
      const wheelAngle = this.carZ / this.wheelRadius;

      if (this.meshMode) {
        const world = this.buildEnvWorld(this.carZ);
        world.add(this.buildCarGroup());
        if (this.meshCar) this.meshScene.remove(this.meshCar);
        this.meshCar = world;
        this.spinWheels(this.meshCar, wheelAngle);
        this.meshScene.add(this.meshCar);
      } else {
        const world = this.buildEnvWorld(this.carZ);
        this.extractTriangles(world);
        if (this.carModel) {
          const wc = this.buildCarGroup();
          this.spinWheels(wc, wheelAngle);
          this.appendWheelTriangles(wc);
        }
        if (this.baseDirty) this.rebuildBaseLayer();
        this.sampleToVoxels(t);
        const ca = this.geo.getAttribute("color") as THREE.BufferAttribute;
        (ca.array as Float32Array).set(this.vColors);
        ca.needsUpdate = true;
        const na = this.geo.getAttribute("voxNormal") as THREE.BufferAttribute;
        (na.array as Float32Array).set(this.vNormals);
        na.needsUpdate = true;
      }

      this.mxs += (this.mx - this.mxs) * 0.04;
      this.mys += (this.my - this.mys) * 0.04;
      const bob = Math.sin(t * 8.6) * 0.02 + Math.sin(t * 5.3) * 0.014;
      const roll = Math.sin(t * 6.1) * 0.012;
      this.camTarget.set(-7.4 + this.mxs * 0.6 + roll, 5.0 + bob + this.mys * 0.3, -9.4);
      this.lookTarget.set(this.mxs * 0.3, -0.3 + bob * 0.4, 1.6);
      this.camPos.lerp(this.camTarget, 0.1);
      this.lookAt.lerp(this.lookTarget, 0.1);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.lookAt);

      this.mat.uniforms.uTime.value = t;

      this.cb.onSpeed?.(Math.round(this.speed * 26));

      this.fpsAcc += dt; this.fpsFrames++;
      if (this.fpsAcc >= 0.25) {
        const inst = this.fpsFrames / this.fpsAcc;
        this.fpsSmooth = this.fpsSmooth ? this.fpsSmooth * 0.5 + inst * 0.5 : inst;
        this.cb.onFps?.(Math.round(this.fpsSmooth));
        this.fpsAcc = 0; this.fpsFrames = 0;
      }

      this.renderer.render(this.meshMode ? this.meshScene : this.scene, this.camera);
    };
    animate();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("mousemove", this.mouseHandler);
    this.renderer.dispose();
    this.geo.dispose();
    this.mat.dispose();
  }
}
