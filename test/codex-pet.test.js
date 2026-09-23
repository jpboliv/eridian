const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { buildPet, writePet } = require('../scripts/build-codex-pet');
const { installPet } = require('../scripts/codex/pet');

test('shipped native pet is reproducible, transparent, and covers every Codex animation track', () => {
  const { png, manifest } = buildPet();
  const assets = path.join(__dirname, '../assets/codex-pet');
  assert.deepEqual(png, fs.readFileSync(path.join(assets, 'spritesheet.png')));
  assert.deepEqual(manifest, JSON.parse(fs.readFileSync(path.join(assets, 'pet.json'))));
  assert.equal(png.readUInt32BE(16), 1536);
  assert.equal(png.readUInt32BE(20), 1872);
  assert.equal(png[25], 6);
  const idat = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const pixels = zlib.inflateSync(Buffer.concat(idat));
  assert.equal(pixels.length, 1872 * (1536 * 4 + 1));
  assert.equal(pixels[4], 0);
  const frameBytes = (index) => {
    const out = [];
    for (let y = 0; y < 208; y++) {
      const offset = (Math.floor(index / 8) * 208 + y) * (1536 * 4 + 1) + 1 + (index % 8) * 192 * 4;
      out.push(pixels.subarray(offset, offset + 192 * 4));
    }
    return Buffer.concat(out);
  };
  assert.equal(Object.keys(manifest.animations).length, 9);
  for (const animation of Object.values(manifest.animations)) {
    assert.ok(animation.fps > 0 && animation.fps <= 60);
    assert.ok(manifest.animations[animation.fallback]);
    assert.notDeepEqual(frameBytes(animation.frames[0]), frameBytes(animation.frames[1]));
    for (const index of animation.frames) {
      assert.ok(index >= 0 && index < 72);
      assert.ok(frameBytes(index).some((byte) => byte !== 0));
    }
  }
});

test('pet generation reproduces both shipped files byte for byte, including formatting', async (t) => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-pet-build-'));
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  await writePet(destination);
  for (const name of ['pet.json', 'spritesheet.png'])
    assert.ok(
      fs
        .readFileSync(path.join(destination, name))
        .equals(fs.readFileSync(path.join(__dirname, '../assets/codex-pet', name))),
      name
    );
});

test('pet install is idempotent, preserves config, and refuses modified files and symlinks', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-pet-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.writeFileSync(path.join(home, 'config.toml'), 'model = "example"\n');
  const destination = installPet(home);
  assert.equal(installPet(home), destination);
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), 'model = "example"\n');
  fs.writeFileSync(path.join(destination, 'pet.json'), 'user content');
  assert.throws(() => installPet(home), /different contents/);
  assert.equal(fs.readFileSync(path.join(destination, 'pet.json'), 'utf8'), 'user content');
  fs.renameSync(destination, `${destination}-saved`);
  fs.symlinkSync(`${destination}-saved`, destination);
  assert.throws(() => installPet(home), /regular directory/);
});
