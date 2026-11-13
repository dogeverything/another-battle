import { GRID_SIZE, COL_LABELS, ROW_LABELS } from '../shared/constants.js';
import { SoundFX } from './SoundSynthesizer.js';

/**
 * Draws the ambient tactical radar background with concentric rings, grid, and HUD top bar
 */
export function createRadarBackground(scene) {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();

  // Deep naval background
  g.fillStyle(0x040b14, 1);
  g.fillRect(0, 0, width, height);

  // Subtle radial ocean glow in center
  g.fillStyle(0x071a30, 0.45);
  g.fillCircle(width / 2, height / 2, 460);
  g.fillStyle(0x09223d, 0.35);
  g.fillCircle(width / 2, height / 2, 280);

  // Subtle coordinate grid lines
  g.lineStyle(1, 0x00f5d4, 0.045);
  for (let x = 0; x < width; x += 40) {
    g.lineBetween(x, 0, x, height);
  }
  for (let y = 0; y < height; y += 40) {
    g.lineBetween(0, y, width, y);
  }

  // Concentric radar rings at center
  g.lineStyle(1, 0x00f5d4, 0.08);
  [140, 260, 380, 500].forEach((r) => {
    g.strokeCircle(width / 2, height / 2, r);
  });

  // Crosshair axis lines
  g.lineStyle(1, 0x00bbf9, 0.06);
  g.lineBetween(width / 2, 54, width / 2, height);
  g.lineBetween(0, height / 2, width, height / 2);

  // Top HUD Framing Bar
  g.fillStyle(0x071528, 0.96);
  g.fillRect(0, 0, width, 54);
  g.lineStyle(1.5, 0x00f5d4, 0.45);
  g.lineBetween(0, 54, width, 54);

  return g;
}

/**
 * Creates a stylized tactical button with chamfered corners, top highlight, and hover/click animations
 */
export function createTacticalButton(scene, x, y, w, h, label, onClick, options = {}) {
  const {
    primaryColor = 0x00f5d4,
    fillColor = 0x0b213d,
    textColor = '#E2F1FF',
    fontSize = '15px',
    subLabel = null,
    disabled = false
  } = options;

  const container = scene.add.container(x, y);

  const bg = scene.add.rectangle(0, 0, w, h, fillColor, 0.94);
  bg.setStrokeStyle(1.5, disabled ? 0x334155 : primaryColor, disabled ? 0.35 : 0.75);

  const cornerG = scene.add.graphics();
  const drawCorners = (col, isHover = false) => {
    cornerG.clear();
    const hw = w / 2;
    const hh = h / 2;
    const cl = 10;

    // Subtle top inner bevel highlight
    cornerG.lineStyle(1, col, isHover ? 0.55 : 0.25);
    cornerG.lineBetween(-hw + 4, -hh + 2, hw - 4, -hh + 2);

    // Bright L-shaped corner brackets
    cornerG.lineStyle(2.5, col, isHover ? 1 : 0.9);
    // Top-left
    cornerG.lineBetween(-hw, -hh + cl, -hw, -hh);
    cornerG.lineBetween(-hw, -hh, -hw + cl, -hh);
    // Top-right
    cornerG.lineBetween(hw - cl, -hh, hw, -hh);
    cornerG.lineBetween(hw, -hh, hw, -hh + cl);
    // Bottom-left
    cornerG.lineBetween(-hw, hh - cl, -hw, hh);
    cornerG.lineBetween(-hw, hh, -hw + cl, hh);
    // Bottom-right
    cornerG.lineBetween(hw - cl, hh, hw, hh);
    cornerG.lineBetween(hw, hh, hw, hh - cl);
  };
  drawCorners(disabled ? 0x475569 : primaryColor, false);

  const mainText = scene.add.text(0, subLabel ? -7 : 0, label, {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize,
    fontStyle: '700',
    color: disabled ? '#64748B' : textColor
  }).setOrigin(0.5);

  container.add([bg, cornerG, mainText]);

  let subTextObj = null;
  if (subLabel) {
    subTextObj = scene.add.text(0, 11, subLabel, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: disabled ? '#475569' : '#94A3B8'
    }).setOrigin(0.5);
    container.add(subTextObj);
  }

  container.isDisabled = disabled;

  if (!disabled) {
    bg.setInteractive({ useHandCursor: true });
  }

  bg.on('pointerover', () => {
    if (container.isDisabled) return;
    bg.setFillStyle(0x153b68, 1);
    bg.setStrokeStyle(2, 0xffffff, 0.9);
    drawCorners(0xffffff, true);
    container.setScale(1.02);
    SoundFX.playClick(540);
  });

  bg.on('pointerout', () => {
    if (container.isDisabled) return;
    bg.setFillStyle(fillColor, 0.94);
    bg.setStrokeStyle(1.5, primaryColor, 0.75);
    drawCorners(primaryColor, false);
    container.setScale(1);
  });

  bg.on('pointerdown', () => {
    if (container.isDisabled) return;
    SoundFX.playClick(780);
    container.setScale(0.97);
    scene.time.delayedCall(70, () => {
      if (container.scene) container.setScale(1);
      if (onClick) onClick();
    });
  });

  container.setDisabled = (flag) => {
    container.isDisabled = flag;
    if (flag) {
      bg.disableInteractive();
      bg.setFillStyle(0x091324, 0.72);
      bg.setStrokeStyle(1.5, 0x334155, 0.45);
      mainText.setColor('#64748B');
      drawCorners(0x334155, false);
    } else {
      bg.setInteractive({ useHandCursor: true });
      bg.setFillStyle(fillColor, 0.94);
      bg.setStrokeStyle(1.5, primaryColor, 0.75);
      mainText.setColor(textColor);
      drawCorners(primaryColor, false);
    }
  };

  container.setLabel = (newLabel, newSubLabel) => {
    mainText.setText(newLabel);
    if (subTextObj && newSubLabel !== undefined) {
      subTextObj.setText(newSubLabel);
    }
  };

  return container;
}

/**
 * Draws the 10x10 coordinate labels (A-J, 1-10), ocean checkerboard tint, and tactical grid lines
 */
export function drawBoardGridBase(scene, originX, originY, cellSize, title, accentColor = 0x00f5d4) {
  const boardPx = GRID_SIZE * cellSize;
  const g = scene.add.graphics();

  // Outer frame
  g.fillStyle(0x061529, 0.95);
  g.fillRect(originX - 28, originY - 46, boardPx + 38, boardPx + 56);
  g.lineStyle(2, accentColor, 0.7);
  g.strokeRect(originX - 28, originY - 46, boardPx + 38, boardPx + 56);

  // Corner brackets on outer frame
  g.lineStyle(3, accentColor, 1);
  const fx1 = originX - 28;
  const fy1 = originY - 46;
  const fx2 = fx1 + boardPx + 38;
  const fy2 = fy1 + boardPx + 56;
  const bl = 14;
  g.lineBetween(fx1, fy1 + bl, fx1, fy1);
  g.lineBetween(fx1, fy1, fx1 + bl, fy1);
  g.lineBetween(fx2 - bl, fy1, fx2, fy1);
  g.lineBetween(fx2, fy1, fx2, fy1 + bl);
  g.lineBetween(fx1, fy2 - bl, fx1, fy2);
  g.lineBetween(fx1, fy2, fx1 + bl, fy2);
  g.lineBetween(fx2 - bl, fy2, fx2, fy2);
  g.lineBetween(fx2, fy2, fx2, fy2 - bl);

  // Title banner
  scene.add.text(originX + boardPx / 2, originY - 31, title, {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '14px',
    fontStyle: '700',
    color: '#E2F1FF'
  }).setOrigin(0.5);

  // Ocean Grid cells with subtle bathymetric checkerboard
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const shade = (x + y) % 2 === 0 ? 0x071b34 : 0x08203d;
      g.fillStyle(shade, 1);
      g.fillRect(originX + x * cellSize, originY + y * cellSize, cellSize, cellSize);
    }
  }

  // Grid lines
  g.lineStyle(1, accentColor, 0.22);
  for (let i = 0; i <= GRID_SIZE; i++) {
    const px = originX + i * cellSize;
    const py = originY + i * cellSize;
    g.lineBetween(px, originY, px, originY + boardPx);
    g.lineBetween(originX, py, originX + boardPx, py);
  }

  // Column labels A..J
  for (let x = 0; x < GRID_SIZE; x++) {
    scene.add.text(originX + x * cellSize + cellSize / 2, originY - 12, COL_LABELS[x], {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      fontStyle: '700',
      color: '#7DD3FC'
    }).setOrigin(0.5);
  }

  // Row labels 1..10
  for (let y = 0; y < GRID_SIZE; y++) {
    scene.add.text(originX - 14, originY + y * cellSize + cellSize / 2, ROW_LABELS[y], {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      fontStyle: '700',
      color: '#7DD3FC'
    }).setOrigin(0.5);
  }

  return g;
}

/**
 * Draws a placed Naval Unit with detailed warship silhouette, turrets, flight deck, or citadel styling
 */
export function drawUnitOnGrid(graphics, unit, originX, originY, cellSize, options = {}) {
  if (!unit.placed || !unit.cells || unit.cells.length === 0) return;

  const { alpha = 1.0, forceColor = null } = options;
  const isDecoy = Boolean(unit.isDecoy);
  const baseColor = forceColor || (isDecoy ? 0xc77dff : unit.color || 0x00bbf9);
  const hullFill = unit.isSunk ? 0x3b121e : isDecoy ? 0x24103a : 0x103254;
  const innerDeck = unit.isSunk ? 0x521828 : isDecoy ? 0x3b185e : 0x184874;
  const strokeCol = unit.isSunk ? 0xff2a54 : baseColor;

  // Special Command Base (+) Fortress Citadel
  if (unit.id === 'command_base') {
    for (const pt of unit.cells) {
      const cx = originX + pt.x * cellSize;
      const cy = originY + pt.y * cellSize;
      const pad = 5;
      graphics.fillStyle(hullFill, 0.94 * alpha);
      graphics.fillRoundedRect(cx + pad, cy + pad, cellSize - pad * 2, cellSize - pad * 2, 6);
      graphics.lineStyle(2, strokeCol, 0.95 * alpha);
      graphics.strokeRoundedRect(cx + pad, cy + pad, cellSize - pad * 2, cellSize - pad * 2, 6);

      // Bastion gun mount on outer arms
      graphics.fillStyle(innerDeck, 0.9 * alpha);
      graphics.fillCircle(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.2);
    }

    // Central Citadel Reactor Core
    const center = unit.cells[0];
    const ccx = originX + center.x * cellSize + cellSize / 2;
    const ccy = originY + center.y * cellSize + cellSize / 2;

    graphics.fillStyle(0x0b213d, alpha);
    graphics.fillCircle(ccx, ccy, cellSize * 0.38);
    graphics.lineStyle(2.5, 0xffe66d, alpha);
    graphics.strokeCircle(ccx, ccy, cellSize * 0.34);
    graphics.fillStyle(unit.isSunk ? 0xff2a54 : 0xffe66d, 0.85 * alpha);
    graphics.fillCircle(ccx, ccy, cellSize * 0.14);
    graphics.lineStyle(1.5, 0xffe66d, 0.8 * alpha);
    graphics.lineBetween(ccx - 10, ccy, ccx + 10, ccy);
    graphics.lineBetween(ccx, ccy - 10, ccx, ccy + 10);
    return;
  }

  // Linear Ships (Carrier, Battleship, Cruiser, Scout, Phantom, Split parts)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of unit.cells) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  const isHorizontal = maxX - minX >= maxY - minY;
  const pad = Math.max(4, Math.floor(cellSize * 0.11));
  const rx = originX + minX * cellSize + pad;
  const ry = originY + minY * cellSize + pad;
  const rw = (maxX - minX + 1) * cellSize - pad * 2;
  const rh = (maxY - minY + 1) * cellSize - pad * 2;

  // 1. Main Connected Armored Hull
  const cornerRadius = Math.min(rw, rh) * 0.38;
  graphics.fillStyle(hullFill, (isDecoy ? 0.72 : 0.94) * alpha);
  graphics.fillRoundedRect(rx, ry, rw, rh, cornerRadius);

  // Inner deck plating
  const innerPad = 4;
  graphics.fillStyle(innerDeck, (isDecoy ? 0.65 : 0.85) * alpha);
  graphics.fillRoundedRect(
    rx + innerPad,
    ry + innerPad,
    Math.max(4, rw - innerPad * 2),
    Math.max(4, rh - innerPad * 2),
    Math.max(3, cornerRadius - 3)
  );

  // Outer Glowing Hull Outline
  graphics.lineStyle(2, strokeCol, 0.95 * alpha);
  graphics.strokeRoundedRect(rx, ry, rw, rh, cornerRadius);

  // 2. Ship-Specific Deck Details (Carrier Runway vs Turrets vs Bridge)
  const isCarrier = unit.id.startsWith('carrier');
  const isBattleship = unit.id.startsWith('battleship');

  if (isCarrier) {
    graphics.lineStyle(1.5, 0xffe66d, 0.7 * alpha);
    if (isHorizontal) {
      const midY = ry + rh / 2;
      for (let dx = rx + 12; dx < rx + rw - 14; dx += 14) {
        graphics.lineBetween(dx, midY, dx + 7, midY);
      }
      graphics.fillStyle(strokeCol, 0.7 * alpha);
      graphics.fillRect(rx + rw * 0.55, ry + 3, 14, 7);
    } else {
      const midX = rx + rw / 2;
      for (let dy = ry + 12; dy < ry + rh - 14; dy += 14) {
        graphics.lineBetween(midX, dy, midX, dy + 7);
      }
      graphics.fillStyle(strokeCol, 0.7 * alpha);
      graphics.fillRect(rx + rw - 10, ry + rh * 0.55, 7, 14);
    }
  } else {
    const count = unit.cells.length;
    unit.cells.forEach((pt, idx) => {
      const cx = originX + pt.x * cellSize + cellSize / 2;
      const cy = originY + pt.y * cellSize + cellSize / 2;

      if (count >= 3 && idx === Math.floor(count / 2)) {
        // Central Bridge / Radar Superstructure
        graphics.fillStyle(0x0b213d, alpha);
        graphics.fillRoundedRect(cx - 8, cy - 8, 16, 16, 3);
        graphics.lineStyle(1.5, strokeCol, 0.9 * alpha);
        graphics.strokeRoundedRect(cx - 8, cy - 8, 16, 16, 3);
        graphics.fillStyle(strokeCol, 0.75 * alpha);
        graphics.fillCircle(cx, cy, 3);
      } else {
        // Gun Turret with Barrel
        graphics.fillStyle(0x091a30, alpha);
        graphics.fillCircle(cx, cy, Math.max(4, cellSize * 0.14));
        graphics.lineStyle(1.5, strokeCol, 0.9 * alpha);
        graphics.strokeCircle(cx, cy, Math.max(4, cellSize * 0.14));

        const dir = idx === 0 ? -1 : 1;
        graphics.lineStyle(isBattleship ? 2.2 : 1.6, 0xe2f1ff, 0.85 * alpha);
        if (isHorizontal) {
          graphics.lineBetween(cx, cy, cx + dir * (cellSize * 0.28), cy);
        } else {
          graphics.lineBetween(cx, cy, cx, cy + dir * (cellSize * 0.28));
        }
      }
    });
  }
}

/**
 * Maps a naval unit to its processed 2D sprite texture key
 */
export function getUnitTextureKey(unit) {
  if (!unit) return null;
  if (unit.isDecoy || unit.id === 'phantom_ship') return 'unit_phantom';
  if (unit.id === 'command_base') return 'unit_command_base';
  if (unit.id.startsWith('carrier')) return 'unit_carrier';
  if (unit.id.startsWith('battleship')) return 'unit_battleship';
  if (unit.id.startsWith('cruiser')) return 'unit_cruiser';
  if (unit.id.startsWith('scout')) return 'unit_scout';
  if (unit.size >= 4) return 'unit_battleship';
  if (unit.size === 3) return 'unit_cruiser';
  return 'unit_scout';
}

/**
 * Renders 2D top-down ship & command base model sprites into a Phaser Container
 */
export function renderUnitSprites(scene, container, units, originX, originY, cellSize, options = {}) {
  if (!container) return;
  container.removeAll(true);

  const {
    onlySunk = false,
    selectedUnitId = null,
    fallbackGraphics = null
  } = options;

  for (const unit of units) {
    if (!unit.placed || !unit.cells || unit.cells.length === 0) continue;
    if (onlySunk && !unit.isSunk) continue;

    const texKey = getUnitTextureKey(unit);
    if (!texKey || !scene.textures.exists(texKey)) {
      if (fallbackGraphics) {
        drawUnitOnGrid(fallbackGraphics, unit, originX, originY, cellSize, {
          forceColor: unit.id === selectedUnitId ? 0xffe66d : null
        });
      }
      continue;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of unit.cells) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }

    const spanW = maxX - minX + 1;
    const spanH = maxY - minY + 1;
    const cx = originX + (minX + spanW / 2) * cellSize;
    const cy = originY + (minY + spanH / 2) * cellSize;

    const sprite = scene.add.image(cx, cy, texKey);
    const pad = 4;

    if (unit.id === 'command_base') {
      sprite.setDisplaySize(3 * cellSize - pad, 3 * cellSize - pad);
    } else {
      const isVertical = unit.orientation === 'V' || spanH > spanW;
      sprite.setDisplaySize(unit.size * cellSize - pad, cellSize - pad);
      if (isVertical) {
        sprite.setAngle(90);
      }
    }

    if (unit.isSunk) {
      sprite.setTint(unit.isDecoy ? 0xc77dff : 0xff4d6d);
      sprite.setAlpha(0.75);
    } else if (unit.id === selectedUnitId) {
      sprite.setTint(0xfff3b0);
    } else if (unit.isDecoy) {
      sprite.setAlpha(0.86);
    }

    container.add(sprite);
  }
}

/**
 * 2.5D Projection: Grid (gx, gy) -> Screen (x, y)
 * Supports both 'ISOMETRIC' diamond and 'DUEL_FIELD' (Yu-Gi-Oh perspective trapezoid).
 */
export function gridToIso(gx, gy, spec) {
  if (spec.style === 'DUEL_FIELD') {
    const k = spec.topWidth / spec.bottomWidth;
    const t = gy / GRID_SIZE;
    const denom = 1 - (1 - k) * t;
    const v = denom !== 0 ? (k * t) / denom : t;
    const rowWidth = spec.topWidth + v * (spec.bottomWidth - spec.topWidth);
    return {
      x: spec.centerX + (gx / GRID_SIZE - 0.5) * rowWidth,
      y: spec.topY + v * (spec.bottomY - spec.topY)
    };
  }
  const halfW = spec.tileW / 2;
  const halfH = spec.tileH / 2;
  return {
    x: spec.centerX + (gx - gy) * halfW,
    y: spec.topY + (gx + gy) * halfH
  };
}

/**
 * 2.5D Inverse Projection: Screen (px, py) -> Grid integer { x, y }
 */
export function screenToGrid(px, py, spec) {
  if (spec.style === 'DUEL_FIELD') {
    const h = spec.bottomY - spec.topY;
    const v = (py - spec.topY) / h;
    if (v < 0 || v >= 1) return { x: -1, y: -1 };
    const k = spec.topWidth / spec.bottomWidth;
    const rowWidth = spec.topWidth + v * (spec.bottomWidth - spec.topWidth);
    const gx = Math.floor(((px - spec.centerX) / rowWidth + 0.5) * GRID_SIZE);
    const s = k + (1 - k) * v;
    const t = s !== 0 ? v / s : v;
    const gy = Math.floor(t * GRID_SIZE);
    return { x: gx, y: gy };
  }
  const halfW = spec.tileW / 2;
  const halfH = spec.tileH / 2;
  const dx = px - spec.centerX;
  const dy = py - spec.topY;
  const gxMinusGy = dx / halfW;
  const gxPlusGy = dy / halfH;
  return {
    x: Math.floor((gxPlusGy + gxMinusGy) / 2),
    y: Math.floor((gxPlusGy - gxMinusGy) / 2)
  };
}

/**
 * Draws a filled/stroked 2.5D isometric diamond for a single cell (gx, gy)
 */
export function drawIsoCellDiamond(
  graphics,
  gx,
  gy,
  spec,
  fillColor = null,
  fillAlpha = 0,
  strokeColor = null,
  strokeAlpha = 0,
  strokeWidth = 1.5,
  inset = 0
) {
  const pTop = gridToIso(gx + inset, gy + inset, spec);
  const pRight = gridToIso(gx + 1 - inset, gy + inset, spec);
  const pBottom = gridToIso(gx + 1 - inset, gy + 1 - inset, spec);
  const pLeft = gridToIso(gx + inset, gy + 1 - inset, spec);
  const pts = [pTop, pRight, pBottom, pLeft];

  if (fillColor !== null && fillAlpha > 0) {
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(pts, true);
  }
  if (strokeColor !== null && strokeAlpha > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    graphics.strokePoints(pts, true);
  }
}

/**
 * Draws a high-contrast Sunk Zone highlight (crimson/purple fill, subtle X hatch, and glowing outer contour)
 */
export function drawSunkUnitZone(graphics, unit, spec) {
  if (!unit || !unit.isSunk || !unit.cells || unit.cells.length === 0) return;
  const zoneCol = unit.isDecoy ? 0xc77dff : 0xff2a54;
  const borderCol = unit.isDecoy ? 0xf0abfc : 0xffbe0b;
  const cellSet = new Set(unit.cells.map((c) => `${c.x},${c.y}`));

  for (const pt of unit.cells) {
    // 1. Dark crimson/purple fill + inner cell border
    drawIsoCellDiamond(graphics, pt.x, pt.y, spec, zoneCol, 0.34, borderCol, 0.35, 1.0, 0.03);

    // 2. Subtle X hatch across the sunk cell
    const tl = gridToIso(pt.x + 0.18, pt.y + 0.18, spec);
    const tr = gridToIso(pt.x + 0.82, pt.y + 0.18, spec);
    const br = gridToIso(pt.x + 0.82, pt.y + 0.82, spec);
    const bl = gridToIso(pt.x + 0.18, pt.y + 0.82, spec);
    graphics.lineStyle(1.5, zoneCol, 0.55);
    graphics.lineBetween(tl.x, tl.y, br.x, br.y);
    graphics.lineBetween(tr.x, tr.y, bl.x, bl.y);

    // 3. Thick high-contrast glowing outer perimeter (Amber Gold / Neon Lavender)
    graphics.lineStyle(3, borderCol, 0.98);
    if (!cellSet.has(`${pt.x},${pt.y - 1}`)) {
      const a = gridToIso(pt.x, pt.y, spec);
      const b = gridToIso(pt.x + 1, pt.y, spec);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    if (!cellSet.has(`${pt.x + 1},${pt.y}`)) {
      const a = gridToIso(pt.x + 1, pt.y, spec);
      const b = gridToIso(pt.x + 1, pt.y + 1, spec);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    if (!cellSet.has(`${pt.x},${pt.y + 1}`)) {
      const a = gridToIso(pt.x, pt.y + 1, spec);
      const b = gridToIso(pt.x + 1, pt.y + 1, spec);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    if (!cellSet.has(`${pt.x - 1},${pt.y}`)) {
      const a = gridToIso(pt.x, pt.y, spec);
      const b = gridToIso(pt.x, pt.y + 1, spec);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
  }
}

/**
 * Draws a 2.5D Extruded Tactical Ocean Slab & 10x10 Isometric Grid
 */
export function drawIsoBoardBase(graphics, spec, accentColor = 0x00f5d4) {
  const depth = spec.slabDepth ?? 22;

  if (spec.style === 'DUEL_FIELD') {
    const farLeft = gridToIso(0, 0, spec);
    const farRight = gridToIso(GRID_SIZE, 0, spec);
    const nearRight = gridToIso(GRID_SIZE, GRID_SIZE, spec);
    const nearLeft = gridToIso(0, GRID_SIZE, spec);

    // 1. Deep Arena Drop Shadow
    graphics.fillStyle(0x01060f, 0.7);
    graphics.fillPoints(
      [
        { x: farLeft.x - 16, y: farLeft.y + 8 },
        { x: farRight.x + 16, y: farRight.y + 8 },
        { x: nearRight.x + 20, y: nearRight.y + depth + 14 },
        { x: nearLeft.x - 20, y: nearLeft.y + depth + 14 }
      ],
      true
    );

    // 2. Angled Side Energy Rails (Yu-Gi-Oh Duel Disk Wings)
    graphics.fillStyle(0x091d38, 0.96);
    graphics.fillPoints(
      [
        { x: farLeft.x - 12, y: farLeft.y - 4 },
        farLeft,
        nearLeft,
        { x: nearLeft.x - 16, y: nearLeft.y + 6 }
      ],
      true
    );
    graphics.fillPoints(
      [
        farRight,
        { x: farRight.x + 12, y: farRight.y - 4 },
        { x: nearRight.x + 16, y: nearRight.y + 6 },
        nearRight
      ],
      true
    );
    graphics.lineStyle(2, accentColor, 0.7);
    graphics.lineBetween(farLeft.x - 12, farLeft.y - 4, nearLeft.x - 16, nearLeft.y + 6);
    graphics.lineBetween(farRight.x + 12, farRight.y - 4, nearRight.x + 16, nearRight.y + 6);

    // 3. Front 3D Duel Disk Bevel Facing Camera
    graphics.fillStyle(0x06162c, 0.98);
    graphics.fillPoints(
      [
        nearLeft,
        nearRight,
        { x: nearRight.x - 8, y: nearRight.y + depth },
        { x: nearLeft.x + 8, y: nearLeft.y + depth }
      ],
      true
    );

    // Glowing vertical energy vents on front bevel
    graphics.lineStyle(1.5, accentColor, 0.35);
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = gridToIso(i, GRID_SIZE, spec);
      graphics.lineBetween(p.x, p.y + 2, p.x, p.y + depth - 2);
    }
    graphics.lineStyle(2.5, accentColor, 0.8);
    graphics.lineBetween(
      nearLeft.x + 8,
      nearLeft.y + depth,
      nearRight.x - 8,
      nearRight.y + depth
    );

    // 4. Perspective 10x10 Holographic Ocean Tiles
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const shade = (x + y) % 2 === 0 ? 0x071d38 : 0x092547;
        drawIsoCellDiamond(graphics, x, y, spec, shade, 1);
      }
    }

    // 5. Perspective Grid Lines
    graphics.lineStyle(1, accentColor, 0.28);
    for (let i = 0; i <= GRID_SIZE; i++) {
      const a1 = gridToIso(i, 0, spec);
      const a2 = gridToIso(i, GRID_SIZE, spec);
      graphics.lineBetween(a1.x, a1.y, a2.x, a2.y);

      const b1 = gridToIso(0, i, spec);
      const b2 = gridToIso(GRID_SIZE, i, spec);
      graphics.lineBetween(b1.x, b1.y, b2.x, b2.y);
    }

    // 6. Mid-field Duel Horizon Divider Line (y = 5)
    const midL = gridToIso(0, 5, spec);
    const midR = gridToIso(GRID_SIZE, 5, spec);
    graphics.lineStyle(1.5, accentColor, 0.45);
    graphics.lineBetween(midL.x, midL.y, midR.x, midR.y);

    // 7. Glowing Duel Field Perimeter
    graphics.lineStyle(2.5, accentColor, 0.9);
    graphics.strokePoints([farLeft, farRight, nearRight, nearLeft], true);
    return;
  }

  const topCorner = gridToIso(0, 0, spec);
  const rightCorner = gridToIso(GRID_SIZE, 0, spec);
  const bottomCorner = gridToIso(GRID_SIZE, GRID_SIZE, spec);
  const leftCorner = gridToIso(0, GRID_SIZE, spec);

  // Soft underwater drop shadow beneath the 3D slab
  graphics.fillStyle(0x01060f, 0.65);
  graphics.fillPoints(
    [
      { x: leftCorner.x - 10, y: leftCorner.y + depth + 10 },
      { x: bottomCorner.x, y: bottomCorner.y + depth + 16 },
      { x: rightCorner.x + 10, y: rightCorner.y + depth + 10 },
      { x: topCorner.x, y: topCorner.y + depth + 6 }
    ],
    true
  );

  // Left-Front 3D Extruded Wall ((0, 10) -> (10, 10))
  graphics.fillStyle(0x051428, 0.98);
  graphics.fillPoints(
    [
      leftCorner,
      bottomCorner,
      { x: bottomCorner.x, y: bottomCorner.y + depth },
      { x: leftCorner.x, y: leftCorner.y + depth }
    ],
    true
  );

  // Right-Front 3D Extruded Wall ((10, 0) -> (10, 10))
  graphics.fillStyle(0x081e3b, 0.98);
  graphics.fillPoints(
    [
      bottomCorner,
      rightCorner,
      { x: rightCorner.x, y: rightCorner.y + depth },
      { x: bottomCorner.x, y: bottomCorner.y + depth }
    ],
    true
  );

  // Vertical structural ribs on the 3D front walls
  graphics.lineStyle(1, accentColor, 0.22);
  for (let i = 0; i <= GRID_SIZE; i++) {
    const lp = gridToIso(i, GRID_SIZE, spec);
    graphics.lineBetween(lp.x, lp.y, lp.x, lp.y + depth);
    const rp = gridToIso(GRID_SIZE, i, spec);
    graphics.lineBetween(rp.x, rp.y, rp.x, rp.y + depth);
  }

  // Bottom glowing neon trim of the 3D slab
  graphics.lineStyle(2, accentColor, 0.65);
  graphics.lineBetween(leftCorner.x, leftCorner.y + depth, bottomCorner.x, bottomCorner.y + depth);
  graphics.lineBetween(bottomCorner.x, bottomCorner.y + depth, rightCorner.x, rightCorner.y + depth);

  // Top 10x10 Bathymetric Ocean Diamond Tiles
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const shade = (x + y) % 2 === 0 ? 0x071d38 : 0x092445;
      drawIsoCellDiamond(graphics, x, y, spec, shade, 1);
    }
  }

  // Crisp Isometric Grid Lines
  graphics.lineStyle(1, accentColor, 0.26);
  for (let i = 0; i <= GRID_SIZE; i++) {
    const a1 = gridToIso(i, 0, spec);
    const a2 = gridToIso(i, GRID_SIZE, spec);
    graphics.lineBetween(a1.x, a1.y, a2.x, a2.y);

    const b1 = gridToIso(0, i, spec);
    const b2 = gridToIso(GRID_SIZE, i, spec);
    graphics.lineBetween(b1.x, b1.y, b2.x, b2.y);
  }

  // Glowing Top Perimeter Bevel
  graphics.lineStyle(2.5, accentColor, 0.85);
  graphics.strokePoints([topCorner, rightCorner, bottomCorner, leftCorner], true);
}

/**
 * Adds crisp A..J and 1..10 coordinate labels along the upper-right and upper-left 2.5D edges
 */
export function addIsoBoardLabels(scene, spec, fontSize = '11px') {
  const isDuel = spec.style === 'DUEL_FIELD';
  for (let x = 0; x < GRID_SIZE; x++) {
    const pt = gridToIso(x + 0.5, isDuel ? -0.55 : -0.45, spec);
    scene.add.text(pt.x, pt.y, COL_LABELS[x], {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize,
      fontStyle: '700',
      color: '#7DD3FC'
    }).setOrigin(0.5);
  }
  for (let y = 0; y < GRID_SIZE; y++) {
    const pt = gridToIso(isDuel ? -0.62 : -0.45, y + 0.5, spec);
    scene.add.text(pt.x, pt.y, ROW_LABELS[y], {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize,
      fontStyle: '700',
      color: '#7DD3FC'
    }).setOrigin(0.5);
  }
}

/**
 * Creates a nested 2.5D container rig (Isometric skewed plane or screen-space Duel Field plane)
 */
export function createIsoUnitContainer(scene, spec) {
  if (spec.style === 'DUEL_FIELD') {
    const inner = scene.add.container(0, 0);
    return { outer: inner, inner };
  }
  const outer = scene.add.container(spec.centerX, spec.topY);
  outer.setScale(1, spec.tileH / spec.tileW);
  const inner = scene.add.container(0, 0);
  inner.setRotation(Math.PI / 4);
  outer.add(inner);
  return { outer, inner };
}

/**
 * Renders 2D ship & command base sprites onto the 2.5D board with floating shadows
 */
export function renderIsoUnitSprites(scene, isoRig, units, spec, options = {}) {
  if (!isoRig || !isoRig.inner) return;
  isoRig.inner.removeAll(true);

  const { onlySunk = false, selectedUnitId = null, fallbackGraphics = null } = options;
  const isDuel = spec.style === 'DUEL_FIELD';
  const cellFlat = isDuel ? 1 : spec.tileW / Math.SQRT2;

  for (const unit of units) {
    if (!unit.placed || !unit.cells || unit.cells.length === 0) continue;
    if (onlySunk && !unit.isSunk) continue;

    const texKey = getUnitTextureKey(unit);
    if (!texKey || !scene.textures.exists(texKey)) {
      if (fallbackGraphics) {
        const col = unit.id === selectedUnitId ? 0xffe66d : unit.isSunk ? 0xff2a54 : unit.color || 0x00bbf9;
        for (const pt of unit.cells) {
          drawIsoCellDiamond(fallbackGraphics, pt.x, pt.y, spec, col, 0.55, col, 0.95, 2, 0.08);
        }
      }
      continue;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of unit.cells) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }

    const spanW = maxX - minX + 1;
    const spanH = maxY - minY + 1;
    const isCommandBase = unit.id === 'command_base';
    const isVertical = !isCommandBase && (unit.orientation === 'V' || spanH > spanW);

    let cx;
    let cy;
    let dispW;
    let dispH;
    let angleDeg = 0;

    if (isDuel) {
      const gxMid = minX + spanW / 2;
      const gyMid = minY + spanH / 2;
      const centerPt = gridToIso(gxMid, gyMid, spec);
      cx = centerPt.x;
      cy = centerPt.y;

      // Local perspective cell width & height at unit's centroid
      const leftPt = gridToIso(gxMid - 0.5, gyMid, spec);
      const rightPt = gridToIso(gxMid + 0.5, gyMid, spec);
      const topPt = gridToIso(gxMid, gyMid - 0.5, spec);
      const botPt = gridToIso(gxMid, gyMid + 0.5, spec);
      const localW = Math.hypot(rightPt.x - leftPt.x, rightPt.y - leftPt.y);
      const localH = Math.hypot(botPt.x - topPt.x, botPt.y - topPt.y);

      if (isCommandBase) {
        dispW = 3 * localW * 0.92;
        dispH = 3 * localH * 0.92;
      } else if (isVertical) {
        const spanTop = gridToIso(gxMid, minY, spec);
        const spanBot = gridToIso(gxMid, maxY + 1, spec);
        const spanLen = Math.hypot(spanBot.x - spanTop.x, spanBot.y - spanTop.y);
        dispW = spanLen * 0.94;
        dispH = localW * 0.78;
        angleDeg = (Math.atan2(spanBot.y - spanTop.y, spanBot.x - spanTop.x) * 180) / Math.PI;
      } else {
        dispW = unit.size * localW * 0.94;
        dispH = localH * 0.88;
      }
    } else {
      cx = (minX + spanW / 2) * cellFlat;
      cy = (minY + spanH / 2) * cellFlat;
      const pad = 4;
      if (isCommandBase) {
        dispW = 3 * cellFlat - pad;
        dispH = 3 * cellFlat - pad;
      } else {
        dispW = unit.size * cellFlat - pad;
        dispH = cellFlat - pad;
        if (isVertical) angleDeg = 90;
      }
    }

    // 1. 2.5D Drop Shadow on the water surface
    const shadow = scene.add.image(cx + (isDuel ? 3 : 4), cy + (isDuel ? 6 : 5), texKey);
    shadow.setDisplaySize(dispW, dispH);
    if (angleDeg !== 0) shadow.setAngle(angleDeg);
    shadow.setTint(0x000000);
    shadow.setAlpha(unit.isSunk ? 0.25 : 0.48);
    isoRig.inner.add(shadow);

    // 2. Elevated Hull Sprite
    const sprite = scene.add.image(cx - (isDuel ? 0 : 2), cy - (isDuel ? 3 : 2), texKey);
    sprite.setDisplaySize(dispW, dispH);
    if (angleDeg !== 0) sprite.setAngle(angleDeg);

    if (unit.isSunk) {
      sprite.setTint(unit.isDecoy ? 0xc77dff : 0xff4d6d);
      sprite.setAlpha(0.75);
    } else if (unit.id === selectedUnitId) {
      sprite.setTint(0xfff3b0);
    } else if (unit.isDecoy) {
      sprite.setAlpha(0.86);
    }

    isoRig.inner.add(sprite);
  }
}

/**
 * Draws a Commander Avatar badge with fallback procedural portrait if texture isn't loaded
 */
export function createCommanderBadge(scene, x, y, size, commander) {
  const container = scene.add.container(x, y);

  const frame = scene.add.rectangle(0, 0, size, size, 0x07172b, 1);
  frame.setStrokeStyle(2.5, commander.hexColor, 1);
  container.add(frame);

  if (scene.textures.exists(commander.portraitKey)) {
    const img = scene.add.image(0, 0, commander.portraitKey);
    img.setDisplaySize(size - 4, size - 4);
    container.add(img);
  } else {
    const fallback = scene.add.text(0, 0, commander.name.charAt(0), {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: `${Math.floor(size * 0.45)}px`,
      fontStyle: '700',
      color: commander.accentColor
    }).setOrigin(0.5);
    container.add(fallback);
  }

  return container;
}
