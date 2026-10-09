import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

// Helper to calculate CRC32 for PNG chunks
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createMedicalIconPNG(size) {
  // Raw uncompressed RGBA pixel data with 1 filter byte (0) per scanline
  const scanlineLength = 1 + size * 4;
  const rawData = Buffer.alloc(scanlineLength * size);

  // Teal background #0f766e (15, 118, 110), White cross #ffffff (255, 255, 255), Green dot #34d399 (52, 211, 153)
  const bgR = 15, bgG = 118, bgB = 110;
  const radius = size * 0.22; // rounded corner radius
  const cx = size / 2;
  const cy = size / 2;

  // Cross dimensions
  const crossW = size * 0.12;
  const crossLen = size * 0.40;

  // Green status dot
  const dotX = size * 0.72;
  const dotY = size * 0.28;
  const dotR = size * 0.08;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Rounded rectangle test
      const dx = Math.abs(x - cx) - (size / 2 - radius);
      const dy = Math.abs(y - cy) - (size / 2 - radius);
      const cornerDist = Math.hypot(Math.max(0, dx), Math.max(0, dy));
      const inIcon = (dx <= 0 || dy <= 0 || cornerDist <= radius);

      if (!inIcon) {
        // Transparent outside rounded box
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Check Green Status Dot
      const inDot = Math.hypot(x - dotX, y - dotY) <= dotR;
      if (inDot) {
        rawData[pxOffset] = 52;
        rawData[pxOffset + 1] = 211;
        rawData[pxOffset + 2] = 153;
        rawData[pxOffset + 3] = 255;
        continue;
      }

      // Check Cross (vertical and horizontal bar)
      const inVerticalBar = Math.abs(x - cx) <= crossW / 2 && Math.abs(y - cy) <= crossLen / 2;
      const inHorizontalBar = Math.abs(y - cy) <= crossW / 2 && Math.abs(x - cx) <= crossLen / 2;

      if (inVerticalBar || inHorizontalBar) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
        continue;
      }

      // Background
      rawData[pxOffset] = bgR;
      rawData[pxOffset + 1] = bgG;
      rawData[pxOffset + 2] = bgB;
      rawData[pxOffset + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const icon192 = createMedicalIconPNG(192);
const icon512 = createMedicalIconPNG(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), icon192);

console.log('PNG Icons successfully created in public directory!');
