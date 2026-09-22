#!/usr/bin/env node
// Rasterize the existing code-defined buddy art, without fonts or image dependencies.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { renderBuddy } = require('./lib/buddy');

const WIDTH = 1536;
const HEIGHT = 1872;
const TRACKS = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, checksum]);
}

function buildPet() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const now = Date.parse('2026-01-01T00:00:00Z');
  const recent = new Date(now).toISOString();
  function rect(x, y, width, height, color) {
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        const offset = (py * WIDTH + px) * 4;
        pixels.set(color, offset);
      }
    }
  }
  for (let row = 0; row < TRACKS.length; row++) {
    for (let col = 0; col < 8; col++) {
      const buddy = { frame: col };
      if ([1, 2, 7, 8].includes(row)) buddy.lastToolAt = recent;
      if ([3, 6].includes(row)) {
        buddy.lastPromptAt = recent;
        buddy.promptClass = 'question';
      }
      if (row === 4) buddy.milestoneAt = recent;
      if (row === 5) buddy.lastErrorAt = recent;
      const { rows } = renderBuddy(buddy, now);
      const bounce = row === 4 ? [0, 8, 16, 8, 0, 8, 16, 8][col] : (col % 2) * 2;
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
          const glyph = rows[y][x];
          if (glyph === ' ') continue;
          const mirroredX = row === 2 ? 8 - x : x;
          const px = col * 192 + 15 + mirroredX * 18;
          const py = row * 208 + 76 + y * 30 - bounce;
          const size = glyph === '◼' ? 20 : 12;
          // Dark outline and warm stone fill remain readable on light/dark terminals.
          rect(px, py, size, size, [49, 42, 38, 255]);
          rect(px + 2, py + 2, size - 4, size - 4, [205, 158, 105, 255]);
          rect(px + 2, py + 2, size - 4, 3, [242, 202, 148, 255]);
        }
      }
    }
  }
  const scanlines = Buffer.alloc(HEIGHT * (WIDTH * 4 + 1));
  for (let y = 0; y < HEIGHT; y++)
    pixels.copy(scanlines, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const manifest = {
    id: 'eridian-rocky',
    displayName: 'Eridian Rocky',
    description: 'Eridian’s eyeless, block-art engineer companion.',
    spritesheetPath: 'spritesheet.png',
    frame: { width: 192, height: 208, columns: 8, rows: 9 },
    animations: Object.fromEntries(
      TRACKS.map((name, row) => [
        name,
        {
          frames: Array.from({ length: 8 }, (_, col) => row * 8 + col),
          fps: row === 0 ? 2 : 6,
          loop: true,
          fallback: 'idle',
        },
      ])
    ),
  };
  return { png, manifest };
}

if (require.main === module) {
  const destination = path.join(__dirname, '..', 'assets', 'codex-pet');
  const { png, manifest } = buildPet();
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'spritesheet.png'), png);
  fs.writeFileSync(path.join(destination, 'pet.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built Eridian Rocky pet: ${destination}`);
}

module.exports = { buildPet };
