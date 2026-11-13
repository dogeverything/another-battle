import Phaser from 'phaser';
import { COMMANDER_LIST } from '../shared/constants.js';
import { SoundFX, COMMANDER_VOICE_SLUGS } from '../utils/SoundSynthesizer.js';

const UNIT_SPRITE_ASSETS = [
  { rawKey: 'unit_carrier_raw', targetKey: 'unit_carrier', path: '/assets/units/carrier.jpg' },
  { rawKey: 'unit_battleship_raw', targetKey: 'unit_battleship', path: '/assets/units/battleship.jpg' },
  { rawKey: 'unit_cruiser_raw', targetKey: 'unit_cruiser', path: '/assets/units/cruiser.jpg' },
  { rawKey: 'unit_scout_raw', targetKey: 'unit_scout', path: '/assets/units/scout.jpg' },
  { rawKey: 'unit_command_base_raw', targetKey: 'unit_command_base', path: '/assets/units/command_base.jpg' },
  { rawKey: 'unit_phantom_raw', targetKey: 'unit_phantom', path: '/assets/units/phantom.jpg' }
];

/**
 * Flood-fills pure/near-black exterior background pixels to transparent alpha=0
 * and tightly crops the sprite to its non-transparent bounding box.
 */
function processUnitSpriteTexture(scene, rawKey, targetKey) {
  if (!scene.textures.exists(rawKey)) return;

  const srcImg = scene.textures.get(rawKey).getSourceImage();
  const w = srcImg.width;
  const h = srcImg.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tctx.drawImage(srcImg, 0, 0);

  const imgData = tctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const isBgColor = (idx) => {
    const o = idx * 4;
    return data[o] + data[o + 1] + data[o + 2] < 54;
  };

  const enqueue = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    if (isBgColor(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  // Seed BFS from all 4 outer edges
  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0; // Make transparent

    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) enqueue(x - 1, y);
    if (x < w - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < h - 1) enqueue(x, y + 1);
  }

  // Find tight bounding box of opaque pixels
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return;

  tctx.putImageData(imgData, 0, 0);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const finalTex = scene.textures.createCanvas(targetKey, cropW, cropH);
  const fctx = finalTex.getContext();
  fctx.drawImage(tempCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  finalTex.refresh();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x050e1a);

    this.add.text(width / 2, height / 2 - 20, 'KHỞI ĐỘNG HỆ THỐNG RADAR & MÔ HÌNH HẠM ĐỘI...', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '18px',
      fontStyle: '700',
      color: '#00F5D4'
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(width / 2, height / 2 + 20, 360, 10, 0x0b213d);
    barBg.setStrokeStyle(1, 0x00f5d4, 0.6);
    const barFill = this.add.rectangle(width / 2 - 178, height / 2 + 20, 0, 6, 0x00f5d4).setOrigin(0, 0.5);

    this.load.on('progress', (val) => {
      barFill.width = 356 * val;
    });

    // Load 5 Commander Portraits
    for (const cmd of COMMANDER_LIST) {
      this.load.image(cmd.portraitKey, cmd.portraitAsset);
    }

    // Load 6 Naval Unit 2D Models
    for (const asset of UNIT_SPRITE_ASSETS) {
      this.load.image(asset.rawKey, asset.path);
    }

    // Load Sound Effects & 15 Commander Voice Lines
    this.load.audio('bgm_main', '/assets/sound/background.mp3');
    this.load.audio('sfx_cannon_shot', '/assets/sound/cannon_shot.mp3');
    this.load.audio('sfx_victory', '/assets/sound/victory.mp3');
    this.load.audio('sfx_ship_sunk', '/assets/sound/ship_sunk.mp3');
    this.load.audio('sfx_smoke_bomb', '/assets/sound/smoke_bomb.mp3');
    this.load.audio('sfx_water_splash', '/assets/sound/water_splash.mp3');
    for (const cmd of COMMANDER_LIST) {
      const slug = COMMANDER_VOICE_SLUGS[cmd.id] || cmd.id;
      for (const suffix of ['select', 'win', 'lose']) {
        this.load.audio(`voice_${cmd.id}_${suffix}`, `/assets/sound/voices/${slug}_${suffix}.wav?v=3`);
      }
    }
  }

  create() {
    for (const asset of UNIT_SPRITE_ASSETS) {
      processUnitSpriteTexture(this, asset.rawKey, asset.targetKey);
    }
    SoundFX.setSoundManager(this.sound);
    SoundFX.preloadSamples();
    SoundFX.playBGM();
    this.scene.start('MenuScene');
  }
}
