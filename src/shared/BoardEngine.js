import { GRID_SIZE, UNIT_TEMPLATES, TOTAL_BASE_CELLS } from './constants.js';

/**
 * Creates a fresh fleet of 6 base units (22 cells total)
 */
export function createInitialFleet() {
  return UNIT_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    type: tpl.type,
    name: tpl.name,
    shortName: tpl.shortName,
    size: tpl.size,
    rotatable: tpl.rotatable,
    isDecoy: Boolean(tpl.isDecoy),
    isSplitPart: false,
    shape: tpl.shape.map((pt) => ({ dx: pt.dx, dy: pt.dy })),
    color: tpl.color,
    placed: false,
    anchorX: -1,
    anchorY: -1,
    orientation: 'H', // 'H' or 'V'
    cells: [],        // [{x, y}]
    hitCells: [],     // ["x,y"]
    isSunk: false,
    decoyRevealed: false
  }));
}

/**
 * Creates an empty 10x10 player board state
 */
export function createPlayerBoard(commanderId = 'SPLITTER') {
  const cells = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({
        x,
        y,
        unitId: null,
        isShot: false,
        isHit: false,
        sonarDetected: false,
        sonarScanned: false
      });
    }
    cells.push(row);
  }

  return {
    commanderId,
    cells,
    units: createInitialFleet(),
    ammo: {
      STANDARD: Infinity,
      CLUSTER: 1,
      RICOCHET: 1
    },
    skillUsed: false,
    fogTurnsRemaining: 0
  };
}

/**
 * Computes the absolute grid coordinates occupied by a unit at (anchorX, anchorY) with orientation
 */
export function getUnitCells(unit, anchorX, anchorY, orientation = 'H') {
  const useOrientation = unit.rotatable ? orientation : 'H';
  return unit.shape.map(({ dx, dy }) => {
    if (useOrientation === 'V') {
      return { x: anchorX - dy, y: anchorY + dx };
    }
    return { x: anchorX + dx, y: anchorY + dy };
  });
}

/**
 * Checks if a coordinate (x, y) is inside the 10x10 board
 */
export function isInBounds(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

/**
 * Validates whether a unit can be placed at (anchorX, anchorY) with orientation
 */
export function canPlaceUnit(board, unit, anchorX, anchorY, orientation = 'H', options = {}) {
  const { ignoreUnitId = unit.id, forbidShotCells = false } = options;
  const targetCells = getUnitCells(unit, anchorX, anchorY, orientation);

  for (const { x, y } of targetCells) {
    if (!isInBounds(x, y)) {
      return false;
    }
    const cell = board.cells[y][x];
    if (cell.unitId && cell.unitId !== ignoreUnitId) {
      return false;
    }
    if (forbidShotCells && cell.isShot) {
      return false;
    }
  }
  return true;
}

/**
 * Removes a unit from the board grid (keeps it in board.units as unplaced)
 */
export function removeUnitFromGrid(board, unitId) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit) return false;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (board.cells[y][x].unitId === unitId) {
        board.cells[y][x].unitId = null;
      }
    }
  }

  unit.placed = false;
  unit.anchorX = -1;
  unit.anchorY = -1;
  unit.cells = [];
  return true;
}

/**
 * Places a unit on the board at (anchorX, anchorY) with orientation
 */
export function placeUnitOnGrid(board, unitId, anchorX, anchorY, orientation = 'H', options = {}) {
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit) return false;

  if (!canPlaceUnit(board, unit, anchorX, anchorY, orientation, { ...options, ignoreUnitId: unitId })) {
    return false;
  }

  removeUnitFromGrid(board, unitId);

  const occupied = getUnitCells(unit, anchorX, anchorY, orientation);
  for (const { x, y } of occupied) {
    board.cells[y][x].unitId = unit.id;
  }

  unit.placed = true;
  unit.anchorX = anchorX;
  unit.anchorY = anchorY;
  unit.orientation = unit.rotatable ? orientation : 'H';
  unit.cells = occupied;
  return true;
}

/**
 * Clears all placed units on the board
 */
export function clearAllPlacements(board) {
  for (const unit of board.units) {
    removeUnitFromGrid(board, unit.id);
  }
}

/**
 * Automatically places all unplaced (or all) units randomly on the 10x10 board
 */
export function autoPlaceFleet(board, resetExisting = true, rng = Math.random) {
  if (resetExisting) {
    clearAllPlacements(board);
  }

  // Sort larger / non-rotatable shapes first for guaranteed placement
  const unitsToPlace = [...board.units]
    .filter((u) => !u.placed)
    .sort((a, b) => b.size - a.size);

  for (const unit of unitsToPlace) {
    let placed = false;
    const candidates = [];
    const orientations = unit.rotatable ? ['H', 'V'] : ['H'];

    for (const ori of orientations) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (canPlaceUnit(board, unit, x, y, ori)) {
            candidates.push({ x, y, ori });
          }
        }
      }
    }

    if (candidates.length > 0) {
      const choice = candidates[Math.floor(rng() * candidates.length)];
      placeUnitOnGrid(board, unit.id, choice.x, choice.y, choice.ori);
      placed = true;
    }

    if (!placed) {
      return false;
    }
  }

  return areAllUnitsPlaced(board);
}

/**
 * Returns true if every unit in board.units is placed and total real cells == 22
 */
export function areAllUnitsPlaced(board) {
  if (!board.units || board.units.length === 0) return false;
  let realCellsCount = 0;
  for (const u of board.units) {
    if (!u.placed || u.cells.length !== u.size) return false;
    if (!u.isDecoy) {
      realCellsCount += u.size;
    }
  }
  return realCellsCount === TOTAL_BASE_CELLS;
}

/**
 * Calculates remaining intact cells of real units (excluding Phantom decoy)
 */
export function getRemainingRealCells(board) {
  let totalReal = 0;
  let totalHits = 0;
  for (const unit of board.units) {
    if (!unit.isDecoy) {
      totalReal += unit.size;
      totalHits += unit.hitCells.length;
    }
  }
  return Math.max(0, totalReal - totalHits);
}

/**
 * Checks if all real units on a board have been destroyed
 */
export function isFleetDefeated(board) {
  return getRemainingRealCells(board) === 0;
}

