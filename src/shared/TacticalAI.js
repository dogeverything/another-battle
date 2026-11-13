import { GRID_SIZE, COMMANDER_LIST } from './constants.js';
import {
  createPlayerBoard,
  isInBounds,
  canPlaceUnit,
  autoPlaceFleet
} from './BoardEngine.js';
import {
  useSplitterSkill,
  usePhantomSkill,
  useEvacuatorSkill,
  useSonarSkill,
  useFogSkill
} from './CommanderSkills.js';

/**
 * Picks a random commander for AI
 */
export function pickAICommander(rng = Math.random) {
  const idx = Math.floor(rng() * COMMANDER_LIST.length);
  return COMMANDER_LIST[idx].id;
}

/**
 * Prepares and deploys AI's board, automatically activating deployment skills if applicable
 */
export function setupAIBoard(commanderId, rng = Math.random) {
  const chosenCmd = commanderId || pickAICommander(rng);
  const board = createPlayerBoard(chosenCmd);

  if (chosenCmd === 'SPLITTER') {
    // Split carrier or battleship for deceptive layout
    const candidates = ['carrier', 'battleship', 'command_base'];
    const targetId = candidates[Math.floor(rng() * candidates.length)];
    useSplitterSkill(board, targetId);
  } else if (chosenCmd === 'PHANTOM') {
    usePhantomSkill(board, false);
  }

  autoPlaceFleet(board, true, rng);
  return board;
}

/**
 * Decides if AI should use its active Battle Skill before firing on its turn
 */
export function chooseAISkillAction(aiBoard, playerBoard, rng = Math.random) {
  if (aiBoard.skillUsed) return null;

  const cmd = aiBoard.commanderId;

  if (cmd === 'FOG') {
    // Use Fog early/mid game when opponent doesn't already have fog
    if (playerBoard.fogTurnsRemaining === 0 && rng() < 0.65) {
      return { skillType: 'FOG', params: {} };
    }
  } else if (cmd === 'SONAR') {
    // Pick a 3x3 region with maximum unshot cells
    let bestCenter = null;
    let bestScore = -1;
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        let unshotCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const c = playerBoard.cells[y + dy][x + dx];
            if (!c.isShot && !c.sonarScanned) unshotCount++;
          }
        }
        if (unshotCount >= 7) {
          const score = unshotCount + rng() * 0.5;
          if (score > bestScore) {
            bestScore = score;
            bestCenter = { x, y };
          }
        }
      }
    }
    if (bestCenter && rng() < 0.75) {
      return { skillType: 'SONAR', params: { x: bestCenter.x, y: bestCenter.y } };
    }
  } else if (cmd === 'EVACUATOR') {
    // Relocate an undamaged ship if enemy shots have landed adjacent to it
    const undamagedUnits = aiBoard.units.filter((u) => u.placed && u.hitCells.length === 0 && !u.isSunk);
    for (const unit of undamagedUnits) {
      let dangerNearby = false;
      for (const pt of unit.cells) {
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];
        for (const d of dirs) {
          const nx = pt.x + d.dx;
          const ny = pt.y + d.dy;
          if (isInBounds(nx, ny) && aiBoard.cells[ny][nx].isShot) {
            dangerNearby = true;
            break;
          }
        }
      }

      if (dangerNearby) {
        const orientations = unit.rotatable ? ['H', 'V'] : ['H'];
        const validMoves = [];
        for (const ori of orientations) {
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              if (
                (x !== unit.anchorX || y !== unit.anchorY) &&
                canPlaceUnit(aiBoard, unit, x, y, ori, { ignoreUnitId: unit.id, forbidShotCells: true })
              ) {
                validMoves.push({ x, y, ori });
              }
            }
          }
        }
        if (validMoves.length > 0) {
          const pick = validMoves[Math.floor(rng() * validMoves.length)];
          return {
            skillType: 'EVACUATOR',
            params: { unitId: unit.id, x: pick.x, y: pick.y, orientation: pick.ori }
          };
        }
      }
    }
  }

  return null;
}

/**
 * Executes AI's chosen skill on the boards
 */
export function executeAISkill(aiBoard, playerBoard, skillDecision) {
  if (!skillDecision) return null;
  const { skillType, params } = skillDecision;
  if (skillType === 'FOG') {
    return useFogSkill(aiBoard, playerBoard);
  }
  if (skillType === 'SONAR') {
    return useSonarSkill(aiBoard, playerBoard, params.x, params.y);
  }
  if (skillType === 'EVACUATOR') {
    return useEvacuatorSkill(aiBoard, params.unitId, params.x, params.y, params.orientation);
  }
  return null;
}

/**
 * Chooses AI's shot (ammoType, x, y) using Hunt & Target heuristics
 */
export function chooseAIShot(aiBoard, playerBoard, rng = Math.random) {
  const isUnderFog = aiBoard.fogTurnsRemaining > 0;

  // 1. If not under Fog, check Sonar-detected cells first
  if (!isUnderFog) {
    const sonarTargets = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const c = playerBoard.cells[y][x];
        if (!c.isShot && c.sonarDetected) {
          sonarTargets.push({ x, y });
        }
      }
    }
    if (sonarTargets.length > 0) {
      const target = sonarTargets[Math.floor(rng() * sonarTargets.length)];
      if (aiBoard.ammo.CLUSTER > 0 && sonarTargets.length >= 2) {
        return { ammoType: 'CLUSTER', x: target.x, y: target.y };
      }
      return { ammoType: 'STANDARD', x: target.x, y: target.y };
    }

    // 2. Target Mode: Look for hit cells belonging to unsunk units
    const activeHitCells = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const c = playerBoard.cells[y][x];
        if (c.isShot && c.isHit && c.unitId) {
          const unit = playerBoard.units.find((u) => u.id === c.unitId);
          if (unit && !unit.isSunk) {
            activeHitCells.push({ x, y });
          }
        }
      }
    }

    if (activeHitCells.length > 0) {
      // Collect orthogonal unshot neighbors of active hits
      const neighborPool = [];
      for (const hit of activeHitCells) {
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];
        for (const d of dirs) {
          const nx = hit.x + d.dx;
          const ny = hit.y + d.dy;
          if (isInBounds(nx, ny) && !playerBoard.cells[ny][nx].isShot) {
            neighborPool.push({ x: nx, y: ny });
          }
        }
      }

      if (neighborPool.length > 0) {
        const chosen = neighborPool[Math.floor(rng() * neighborPool.length)];
        if (aiBoard.ammo.CLUSTER > 0 && rng() < 0.45) {
          return { ammoType: 'CLUSTER', x: chosen.x, y: chosen.y };
        }
        return { ammoType: 'STANDARD', x: chosen.x, y: chosen.y };
      }
    }
  }

  // 3. Hunt Mode: Parity checkerboard unshot cells
  const unshotCells = [];
  const parityCells = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!playerBoard.cells[y][x].isShot) {
        unshotCells.push({ x, y });
        if ((x + y) % 2 === 0) {
          parityCells.push({ x, y });
        }
      }
    }
  }

  const pool = parityCells.length > 0 ? parityCells : unshotCells;
  const pick = pool[Math.floor(rng() * pool.length)] || { x: 0, y: 0 };

  if (aiBoard.ammo.RICOCHET > 0 && unshotCells.length > 15 && rng() < 0.35) {
    return { ammoType: 'RICOCHET', x: pick.x, y: pick.y };
  }
  if (aiBoard.ammo.CLUSTER > 0 && unshotCells.length > 25 && rng() < 0.25) {
    const cx = Math.min(8, Math.max(1, pick.x));
    const cy = Math.min(8, Math.max(1, pick.y));
    let hasUnshotInCluster = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!playerBoard.cells[cy + dy][cx + dx].isShot) {
          hasUnshotInCluster = true;
          break;
        }
      }
      if (hasUnshotInCluster) break;
    }
    if (hasUnshotInCluster) {
      return { ammoType: 'CLUSTER', x: cx, y: cy };
    }
  }

  const fallback = unshotCells.length > 0 ? pick : { x: 0, y: 0 };
  return { ammoType: 'STANDARD', x: fallback.x, y: fallback.y };
}

