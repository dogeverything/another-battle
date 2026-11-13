import { PHANTOM_SHIP_TEMPLATE } from './constants.js';
import {
  isInBounds,
  canPlaceUnit,
  placeUnitOnGrid,
  removeUnitFromGrid,
  autoPlaceFleet
} from './BoardEngine.js';

/**
 * Creates a linear horizontal shape of length `len`
 */
function makeLinearShape(len) {
  const shape = [];
  for (let i = 0; i < len; i++) {
    shape.push({ dx: i, dy: 0 });
  }
  return shape;
}

/**
 * DEPLOYMENT SKILL 1: Kael Vance - PHÂN TÁCH (SPLITTER)
 * Splits a unit of size > 1 into 2 smaller independent units:
 * - size 5 -> 3 + 2
 * - size 4 -> 2 + 2
 * - size 3 -> 2 + 1
 * - size 2 -> 1 + 1
 */
export function useSplitterSkill(board, targetUnitId) {
  if (board.commanderId !== 'SPLITTER') {
    return { valid: false, reason: 'Chỉ huy hiện tại không có kỹ năng Phân Tách.' };
  }
  if (board.skillUsed) {
    return { valid: false, reason: 'Kỹ năng Phân Tách đã được sử dụng!' };
  }

  const unitIdx = board.units.findIndex((u) => u.id === targetUnitId);
  if (unitIdx === -1) {
    return { valid: false, reason: 'Không tìm thấy đơn vị cần phân tách.' };
  }

  const unit = board.units[unitIdx];
  if (unit.size <= 1) {
    return { valid: false, reason: 'Đơn vị phải lớn hơn 1 ô mới có thể phân tách!' };
  }

  const wasPlaced = unit.placed;
  removeUnitFromGrid(board, unit.id);

  const sizeA = Math.ceil(unit.size / 2);
  const sizeB = Math.floor(unit.size / 2);

  const partA = {
    id: `${unit.id}_split_a`,
    type: 'ship',
    name: `${unit.shortName || unit.name} [A]`,
    shortName: `${unit.shortName || unit.name} [A]`,
    size: sizeA,
    rotatable: sizeA > 1,
    isDecoy: false,
    isSplitPart: true,
    shape: makeLinearShape(sizeA),
    color: unit.color,
    placed: false,
    anchorX: -1,
    anchorY: -1,
    orientation: 'H',
    cells: [],
    hitCells: [],
    isSunk: false,
    decoyRevealed: false
  };

  const partB = {
    id: `${unit.id}_split_b`,
    type: 'ship',
    name: `${unit.shortName || unit.name} [B]`,
    shortName: `${unit.shortName || unit.name} [B]`,
    size: sizeB,
    rotatable: sizeB > 1,
    isDecoy: false,
    isSplitPart: true,
    shape: makeLinearShape(sizeB),
    color: unit.color,
    placed: false,
    anchorX: -1,
    anchorY: -1,
    orientation: 'H',
    cells: [],
    hitCells: [],
    isSunk: false,
    decoyRevealed: false
  };

  board.units.splice(unitIdx, 1, partA, partB);
  board.skillUsed = true;

  if (wasPlaced) {
    autoPlaceFleet(board, false);
  }

  return {
    valid: true,
    skill: 'SPLITTER',
    originalUnitId: targetUnitId,
    createdUnits: [partA, partB]
  };
}

/**
 * DEPLOYMENT SKILL 2: Vespera Noctis - THUYỀN MA (PHANTOM)
 * Adds a 3-cell Phantom Ship decoy to the player's fleet.
 */
export function usePhantomSkill(board, autoPlace = true) {
  if (board.commanderId !== 'PHANTOM') {
    return { valid: false, reason: 'Chỉ huy hiện tại không có kỹ năng Thuyền Ma.' };
  }
  if (board.skillUsed) {
    return { valid: false, reason: 'Thuyền Ma đã được triệu hồi!' };
  }

  const phantomUnit = {
    id: PHANTOM_SHIP_TEMPLATE.id,
    type: PHANTOM_SHIP_TEMPLATE.type,
    name: PHANTOM_SHIP_TEMPLATE.name,
    shortName: PHANTOM_SHIP_TEMPLATE.shortName,
    size: PHANTOM_SHIP_TEMPLATE.size,
    rotatable: PHANTOM_SHIP_TEMPLATE.rotatable,
    isDecoy: true,
    isSplitPart: false,
    shape: PHANTOM_SHIP_TEMPLATE.shape.map((pt) => ({ dx: pt.dx, dy: pt.dy })),
    color: PHANTOM_SHIP_TEMPLATE.color,
    placed: false,
    anchorX: -1,
    anchorY: -1,
    orientation: 'H',
    cells: [],
    hitCells: [],
    isSunk: false,
    decoyRevealed: false
  };

  board.units.push(phantomUnit);
  board.skillUsed = true;

  if (autoPlace) {
    autoPlaceFleet(board, false);
  }

  return {
    valid: true,
    skill: 'PHANTOM',
    phantomUnit
  };
}

/**
 * BATTLE SKILL 3: Akira Sato - DI TẢN (EVACUATOR)
 * Relocates an undamaged friendly unit (hitCells.length === 0) to a new valid unshot location.
 */
export function useEvacuatorSkill(board, unitId, newAnchorX, newAnchorY, newOrientation = 'H') {
  if (board.commanderId !== 'EVACUATOR') {
    return { valid: false, reason: 'Chỉ huy hiện tại không có kỹ năng Di Tản.' };
  }
  if (board.skillUsed) {
    return { valid: false, reason: 'Kỹ năng Di Tản đã được sử dụng!' };
  }

  const unit = board.units.find((u) => u.id === unitId);
  if (!unit) {
    return { valid: false, reason: 'Không tìm thấy đơn vị cần di tản.' };
  }
  if (unit.hitCells.length > 0 || unit.isSunk) {
    return { valid: false, reason: 'Chỉ có thể di tản đơn vị chưa bị bắn trúng!' };
  }

  const canMove = canPlaceUnit(board, unit, newAnchorX, newAnchorY, newOrientation, {
    ignoreUnitId: unit.id,
    forbidShotCells: true
  });

  if (!canMove) {
    return {
      valid: false,
      reason: 'Vị trí di tản không hợp lệ (tràn biên, trùng tàu khác hoặc ô đã bị địch bắn)!'
    };
  }

  // Clear any sonar detection flags on old cells
  for (const pt of unit.cells) {
    board.cells[pt.y][pt.x].sonarDetected = false;
  }

  placeUnitOnGrid(board, unit.id, newAnchorX, newAnchorY, newOrientation, {
    forbidShotCells: true
  });
  board.skillUsed = true;

  return {
    valid: true,
    skill: 'EVACUATOR',
    unitId: unit.id,
    newCells: unit.cells
  };
}

/**
 * BATTLE SKILL 4: Lyra Chen - ĐẠN DÒ TÌM (SONAR)
 * Scans a 3x3 area on the enemy board and reveals which unshot cells contain enemy units.
 */
export function useSonarSkill(attackerBoard, defenderBoard, centerX, centerY) {
  if (attackerBoard.commanderId !== 'SONAR') {
    return { valid: false, reason: 'Chỉ huy hiện tại không có kỹ năng Đạn Dò Tìm.' };
  }
  if (attackerBoard.skillUsed) {
    return { valid: false, reason: 'Kỹ năng Đạn Dò Tìm đã được sử dụng!' };
  }
  if (!isInBounds(centerX, centerY)) {
    return { valid: false, reason: 'Tọa độ dò tìm nằm ngoài bản đồ.' };
  }

  const scannedCells = [];
  const detectedCells = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = centerX + dx;
      const cy = centerY + dy;
      if (isInBounds(cx, cy)) {
        const cell = defenderBoard.cells[cy][cx];
        cell.sonarScanned = true;
        const hasUnit = Boolean(cell.unitId) && !cell.isShot;
        if (hasUnit) {
          cell.sonarDetected = true;
          detectedCells.push({ x: cx, y: cy });
        }
        scannedCells.push({ x: cx, y: cy, detected: hasUnit });
      }
    }
  }

  attackerBoard.skillUsed = true;

  return {
    valid: true,
    skill: 'SONAR',
    centerX,
    centerY,
    scannedCells,
    detectedCells
  };
}

/**
 * BATTLE SKILL 5: Viktor Krane - SƯƠNG MÙ (FOG)
 * Covers the opponent's observation radar in thick smoke for 2 of the opponent's turns.
 */
export function useFogSkill(attackerBoard, defenderBoard) {
  if (attackerBoard.commanderId !== 'FOG') {
    return { valid: false, reason: 'Chỉ huy hiện tại không có kỹ năng Sương Mù.' };
  }
  if (attackerBoard.skillUsed) {
    return { valid: false, reason: 'Kỹ năng Sương Mù đã được sử dụng!' };
  }

  attackerBoard.skillUsed = true;
  defenderBoard.fogTurnsRemaining = 2;

  return {
    valid: true,
    skill: 'FOG',
    fogTurnsRemaining: defenderBoard.fogTurnsRemaining
  };
}

