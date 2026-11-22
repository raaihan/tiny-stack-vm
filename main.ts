import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Tiny stack VM for make.fun's stack ISA: 32-bit wrapping ints, a 256-value stack,
// a 64-deep call stack, 256 words of memory, input and output, and ten traps.
// Traps (exit codes): 2 stack underflow, 3 stack overflow, 4 divide by zero,
// 5 unknown opcode, 6 bad memory address, 7 call overflow, 8 return underflow,
// 9 bad pc / truncated immediate, 10 step limit (1,000,000), 11 output full (65,536).
// One run answers a whole set of programs.
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// opcode -> [immediate bytes, pops, pushes]
const T: { [k: number]: number[] } = { 0: [0,0,0], 1: [1,0,1], 2: [4,0,1], 3: [0,1,0], 4: [0,1,2], 5: [0,2,2], 6: [0,2,3], 7: [0,3,3], 16: [0,2,1], 17: [0,2,1], 18: [0,2,1], 19: [0,2,1], 20: [0,2,1], 21: [0,2,1], 22: [0,2,1], 23: [0,1,1], 24: [0,2,1], 25: [0,2,1], 26: [0,2,1], 27: [0,1,1], 28: [0,2,1], 29: [0,2,1], 30: [0,2,1], 32: [0,2,1], 33: [0,2,1], 34: [0,2,1], 48: [2,0,0], 49: [2,1,0], 50: [2,1,0], 51: [2,0,0], 52: [0,0,0], 64: [0,1,1], 65: [0,2,0], 80: [0,1,0], 81: [0,1,0], 82: [0,0,1], 83: [0,1,0] };

function run(p: Uint8Array, inp: Uint8Array): { o: Uint8Array; c: number } {
  const n = p.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cs = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, st = 0;
  const e = new TextEncoder();
  const done = (c: number) => ({ o: out.slice(0, ol), c });
  for (;;) {
    if (st === 1e6) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc];
    const t = T[op];
    if (!t) return done(5);
    const im = t[0], po = t[1], pu = t[2];
    if (pc + im >= n) return done(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < po) return done(2);
    if (sp - po + pu > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0: return done(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const x = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = x; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = (-D[sp - 1]) | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (cs === 64) return done(7);
        C[cs++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52:
        if (cs === 0) return done(8);
        pc = C[--cs]; break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a >= 256) return done(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a >= 256) return done(6); sp -= 2; M[a] = v; break; }
      case 80: { const b = e.encode(String(D[sp - 1])); if (ol + b.length > 65536) return done(11); sp--; out.set(b, ol); ol += b.length; break; }
      case 81: if (ol + 1 > 65536) return done(11); out[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return done(D[--sp] & 255);
      default: {
        const b = D[sp - 1], a = D[sp - 2];
        let r = 0;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return done(4); r = (a / b) | 0; }
        else if (op === 20) { if (!b) return done(4); r = (a % b) | 0; }
        else if (op === 21) { if (!b) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else if (op === 34) r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r;
      }
    }
  }
}

// Driver: each instance dir holds program.bin + input.bin; its answers go to
// stdout.bin (the bytes written) and exit.txt (the exit code, decimal + newline).
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.o);
  writeFileSync(join(O, id, 'exit.txt'), `${r.c}\n`);
}
