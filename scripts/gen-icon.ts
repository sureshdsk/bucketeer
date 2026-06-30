/**
 * Generates a 1024x1024 source PNG (Material-3 branded) with no native deps.
 * Feed the output to `bun run tauri icon` to produce every icon size.
 *
 *   bun run scripts/gen-icon.ts
 *   bun run tauri icon scripts/source-icon.png
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// Material-3 primary (#adc6ff) tile on the surface (#131314) background.
const TILE: [number, number, number] = [173, 198, 255];
const BG: [number, number, number] = [19, 19, 20];

const cx = W / 2;
const cy = H / 2;
const half = 300;
const radius = 280;

function inTile(x: number, y: number): boolean {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > half || dy > half) return false;
  const cornerDx = dx - (half - radius);
  const cornerDy = dy - (half - radius);
  if (cornerDx > 0 && cornerDy > 0) {
    return cornerDx * cornerDx + cornerDy * cornerDy <= radius * radius;
  }
  return true;
}

const stride = W * 3;
const raw = Buffer.alloc((stride + 1) * H);
for (let y = 0; y < H; y++) {
  const rowStart = y * (stride + 1);
  raw[rowStart] = 0; // PNG filter: none
  for (let x = 0; x < W; x++) {
    const o = rowStart + 1 + x * 3;
    const [r, g, b] = inTile(x, y) ? TILE : BG;
    raw[o] = r;
    raw[o + 1] = g;
    raw[o + 2] = b;
  }
}

// CRC-32 (PNG chunks).
const crcTable: number[] = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync("scripts", { recursive: true });
writeFileSync("scripts/source-icon.png", png);
console.log(`wrote scripts/source-icon.png (${png.length} bytes)`);
