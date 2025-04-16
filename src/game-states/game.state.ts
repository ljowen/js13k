import { State } from "@/core/state";
import { drawEngine } from "@/core/draw-engine";
import { controls } from "@/core/controls";
import { gameStateMachine } from "@/game-state-machine";
import { menuState } from "@/game-states/menu.state";
import { renderWebGl } from "@/web-gl/renderer";
import { clamp } from "@/helpers";

class GameState implements State {
  icosahedronRadius = 180;
  rotation = 0;
  detail = 3;
  faceColors: string[] = [];
  lastFaceCount = 0;
  rotationSpeed = 0.001;
  landCenters: number[][] = [];
  numLandCenters = 7;
  vertices: number[][] = [];
  faces: number[][] = [];
  showWireframe = false;

  onEnter() {
    this.rotation = 0;
    this.setupMesh();
  }

  // Helper: normalize and scale a vector
  normalize([x, y, z]: number[], r: number) {
    const len = Math.sqrt(x * x + y * y + z * z);
    return [(x / len) * r, (y / len) * r, (z / len) * r];
  }

  // Helper: midpoint of two vertices, normalized to sphere
  midpoint(a: number[], b: number[], r: number) {
    return this.normalize(
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      r
    );
  }

  // Subdivide faces for more detail
  subdivide(
    vertices: number[][],
    faces: number[][],
    detail: number,
    r: number
  ) {
    for (let d = 0; d < detail; d++) {
      const newFaces: number[][] = [];
      const midCache = new Map<string, number>();
      function key(a: number, b: number) {
        return a < b ? `${a}_${b}` : `${b}_${a}`;
      }
      function getMid(a: number, b: number) {
        const k = key(a, b);
        if (!midCache.has(k)) {
          const mid = this.midpoint(vertices[a], vertices[b], r);
          vertices.push(mid);
          midCache.set(k, vertices.length - 1);
        }
        return midCache.get(k)!;
      }
      for (const [a, b, c] of faces) {
        const ab = getMid.call(this, a, b);
        const bc = getMid.call(this, b, c);
        const ca = getMid.call(this, c, a);
        newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = newFaces;
    }
    return { vertices, faces };
  }

  setupMesh() {
    const r = this.icosahedronRadius;
    // Golden ratio
    const t = (1 + Math.sqrt(5)) / 2;
    // Base icosahedron
    let vertices = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map((v) => this.normalize(v, r));
    let faces = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
    // Subdivide
    if (this.detail > 0) {
      const result = this.subdivide(vertices, faces, this.detail, r);
      vertices = result.vertices;
      faces = result.faces;
    }
    this.vertices = vertices;
    this.faces = faces;
    this.assignLandSeaColors();
  }

  assignLandSeaColors() {
    const r = this.icosahedronRadius;
    // Generate land centers
    this.landCenters = [];
    for (let i = 0; i < this.numLandCenters; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);
      this.landCenters.push([x, y, z]);
    }
    const landRadius = r * 0.55;
    this.faceColors = this.faces.map(([a, b, c]) => {
      const [x, y, z] = [
        (this.vertices[a][0] + this.vertices[b][0] + this.vertices[c][0]) / 3,
        (this.vertices[a][1] + this.vertices[b][1] + this.vertices[c][1]) / 3,
        (this.vertices[a][2] + this.vertices[b][2] + this.vertices[c][2]) / 3,
      ];
      for (const [lx, ly, lz] of this.landCenters) {
        const dist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2 + (z - lz) ** 2);
        if (dist < landRadius) return "#27ae60";
      }
      return "#3498db";
    });
  }

  onUpdate(delta: number) {
    this.rotation += this.rotationSpeed * delta;

    const ctx = drawEngine.context;
    const cx = drawEngine.canvasWidth / 2;
    const cy = drawEngine.canvasHeight / 2;
    const fov = 400;

    // Rotate vertices for this frame
    const rot = this.rotation;
    const rotatedVerts = this.vertices.map(([x, y, z]) => {
      const x2 = x * Math.cos(rot) - z * Math.sin(rot);
      const z2 = x * Math.sin(rot) + z * Math.cos(rot);
      return [x2, y, z2];
    });

    // Sort faces by average z (back-to-front)
    const faceDepths = this.faces.map(([a, b, c], i) => {
      const za = rotatedVerts[a][2];
      const zb = rotatedVerts[b][2];
      const zc = rotatedVerts[c][2];
      return { index: i, z: (za + zb + zc) / 3 };
    });
    faceDepths.sort((f1, f2) => f2.z - f1.z);

    // Draw faces in sorted order
    ctx.save();
    for (const { index: i } of faceDepths) {
      const [a, b, c] = this.faces[i];
      const verts2d = [a, b, c].map((idx) => {
        const [x, y, z] = rotatedVerts[idx];
        const s = fov / (fov + z);
        return [cx + x * s, cy + y * s];
      });
      ctx.beginPath();
      ctx.moveTo(verts2d[0][0], verts2d[0][1]);
      ctx.lineTo(verts2d[1][0], verts2d[1][1]);
      ctx.lineTo(verts2d[2][0], verts2d[2][1]);
      ctx.closePath();
      ctx.fillStyle = this.faceColors[i];
      ctx.fill();
    }

    // Conditionally draw wireframe
    if (this.showWireframe) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      const drawn = new Set<string>();
      ctx.beginPath();
      for (const [a, b, c] of this.faces) {
        for (const [i, j] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const edgeKey = i < j ? `${i}_${j}` : `${j}_${i}`;
          if (drawn.has(edgeKey)) continue;
          drawn.add(edgeKey);
          const [x1, y1, z1] = rotatedVerts[i];
          const [x2, y2, z2] = rotatedVerts[j];
          const s1 = fov / (fov + z1);
          const s2 = fov / (fov + z2);
          ctx.moveTo(cx + x1 * s1, cy + y1 * s1);
          ctx.lineTo(cx + x2 * s2, cy + y2 * s2);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    if (controls.isEscape) {
      gameStateMachine.setState(menuState);
    }
  }
}

export const gameState = new GameState();
