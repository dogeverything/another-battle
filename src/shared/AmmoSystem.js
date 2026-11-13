import { GRID_SIZE } from './constants.js';
import { isInBounds, isFleetDefeated } from './BoardEngine.js';

/**
 * Fires a single cell impact and returns detailed result for that cell
 */
export function applyCellImpact(targetBoard, x, y) {
  if (!isInBounds(x, y)) return null;
  const cell = targetBoard.cells[y][x];
  if (cell.isShot) return null;

  cell.isShot = true;
  cell.sonarDetected = false;

  if (!cell.unitId) {
    cell.isHit = false;
    return {
      x,
      y,
      outcome: 'MISS',
      isHit: false,
      unitSunk: null,
      decoyRevealed: null
    };
  }

  const unit = targetBoard.units.find((u) => u.id === cell.unitId);
  cell.isHit = true;
  const key = `${x},${y}`;
  if (!unit.hitCells.includes(key)) {
    unit.hitCells.push(key);
  }

  let unitSunk = null;
  let decoyRevealed = null;

  if (unit.hitCells.length >= unit.size) {
    unit.isSunk = true;
    if (unit.isDecoy) {
      unit.decoyRevealed = true;
      decoyRevealed = {
        id: unit.id,
        name: unit.name,
        cells: unit.cells
      };
    } else {
      unitSunk = {
        id: unit.id,
        name: unit.name,
        size: unit.size,
        cells: unit.cells
      };
    }
  }

  return {
    x,
    y,
    outcome: 'HIT',
    isHit: true,
    unitId: unit.id,
    unitSunk,
    decoyRevealed
  };
}

/**
 * Resolves firing a weapon (STANDARD 1x1, CLUSTER 3x3, or RICOCHET 1 + 2 random unshot cells)
 *
 * Rule:
 * - If at least 1 impacted cell is a HIT (real ship or unrevealed decoy), attacker gets a bonus turn (`keepTurn: true`).
 * - CLUSTER and RICOCHET consume 1 charge.
 */
export function resolveFireShot(attackerBoard, defenderBoard, ammoType, targetX, targetY, rng = Math.random) {
  if (!isInBounds(targetX, targetY)) {
    return { valid: false, reason: 'Tọa độ nằm ngoài bản đồ.' };
  }

  const type = ammoType || 'STANDARD';
  const impacts = [];

  if (type === 'STANDARD') {
    if (defenderBoard.cells[targetY][targetX].isShot) {
      return { valid: false, reason: 'Ô này đã bị bắn trước đó!' };
    }
    const res = applyCellImpact(defenderBoard, targetX, targetY);
    if (res) impacts.push(res);
  } else if (type === 'CLUSTER') {
    if ((attackerBoard.ammo.CLUSTER || 0) <= 0) {
      return { valid: false, reason: 'Đã hết Đạn Chùm 3x3!' };
    }

    const clusterCoords = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = targetX + dx;
        const cy = targetY + dy;
        if (isInBounds(cx, cy) && !defenderBoard.cells[cy][cx].isShot) {
          clusterCoords.push({ x: cx, y: cy });
        }
      }
    }

    if (clusterCoords.length === 0) {
      return { valid: false, reason: 'Toàn bộ vùng 3x3 này đều đã bị bắn!' };
    }

    attackerBoard.ammo.CLUSTER = 0;
    for (const pt of clusterCoords) {
      const res = applyCellImpact(defenderBoard, pt.x, pt.y);
      if (res) impacts.push(res);
    }
  } else if (type === 'RICOCHET') {
    if ((attackerBoard.ammo.RICOCHET || 0) <= 0) {
      return { valid: false, reason: 'Đã hết Đạn Nảy!' };
    }
    if (defenderBoard.cells[targetY][targetX].isShot) {
      return { valid: false, reason: 'Ô mục tiêu đầu tiên đã bị bắn trước đó!' };
    }

    attackerBoard.ammo.RICOCHET = 0;

    // 1. Primary impact
    const primaryRes = applyCellImpact(defenderBoard, targetX, targetY);
    if (primaryRes) {
      primaryRes.bounceIndex = 0;
      impacts.push(primaryRes);
    }

    // 2. Bounce to up to 2 random unshot cells on the board
    const unshotPool = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!defenderBoard.cells[y][x].isShot) {
          unshotPool.push({ x, y });
        }
      }
    }

    for (let b = 1; b <= 2; b++) {
      if (unshotPool.length === 0) break;
      const randIdx = Math.floor(rng() * unshotPool.length);
      const picked = unshotPool.splice(randIdx, 1)[0];
      const bounceRes = applyCellImpact(defenderBoard, picked.x, picked.y);
      if (bounceRes) {
        bounceRes.bounceIndex = b;
        impacts.push(bounceRes);
      }
    }
  } else {
    return { valid: false, reason: 'Loại đạn không hợp lệ.' };
  }

  const anyHit = impacts.some((imp) => imp.isHit);
  const sunkUnits = impacts.filter((imp) => imp.unitSunk).map((imp) => imp.unitSunk);
  const revealedDecoys = impacts.filter((imp) => imp.decoyRevealed).map((imp) => imp.decoyRevealed);
  const gameOver = isFleetDefeated(defenderBoard);

  // If attacker was under enemy Fog of War and their turn ends (no bonus turn), decrement fog counter
  if (!anyHit && attackerBoard.fogTurnsRemaining > 0) {
    attackerBoard.fogTurnsRemaining = Math.max(0, attackerBoard.fogTurnsRemaining - 1);
  }

  return {
    valid: true,
    ammoType: type,
    targetX,
    targetY,
    impacts,
    anyHit,
    keepTurn: anyHit && !gameOver,
    sunkUnits,
    revealedDecoys,
    gameOver
  };
}

