import assert from 'node:assert/strict';
import { TOTAL_BASE_CELLS, UNIT_TEMPLATES, COMMANDERS } from '../src/shared/constants.js';
import {
  createPlayerBoard,
  canPlaceUnit,
  placeUnitOnGrid,
  autoPlaceFleet,
  areAllUnitsPlaced,
  getRemainingRealCells,
  isFleetDefeated
} from '../src/shared/BoardEngine.js';
import { resolveFireShot } from '../src/shared/AmmoSystem.js';
import {
  useSplitterSkill,
  usePhantomSkill,
  useEvacuatorSkill,
  useSonarSkill,
  useFogSkill
} from '../src/shared/CommanderSkills.js';

console.log('===============================================================');
console.log('   ANOTHER BATTLE - AUTOMATED CORE LOGIC VERIFICATION SUITE    ');
console.log('===============================================================\n');

// 1. Verify 22-cell Base Fleet & Command Base '+' shape
{
  const totalCells = UNIT_TEMPLATES.reduce((sum, u) => sum + u.size, 0);
  assert.equal(totalCells, 22, 'Total cells of base units must equal 22');
  assert.equal(TOTAL_BASE_CELLS, 22);

  const board = createPlayerBoard('SPLITTER');
  // Command base '+' cannot be placed at (0,0) because (-1,0) and (0,-1) are out of bounds
  const cmdBase = board.units.find((u) => u.id === 'command_base');
  assert.equal(canPlaceUnit(board, cmdBase, 0, 0, 'H'), false, 'Command base + cannot be at (0,0)');
  assert.equal(canPlaceUnit(board, cmdBase, 2, 2, 'H'), true, 'Command base + valid at (2,2)');
  placeUnitOnGrid(board, 'command_base', 2, 2, 'H');
  assert.equal(cmdBase.cells.length, 5);

  const autoOk = autoPlaceFleet(board, true);
  assert.equal(autoOk, true, 'Auto-place fleet must succeed');
  assert.equal(areAllUnitsPlaced(board), true);
  assert.equal(getRemainingRealCells(board), 22);
  console.log('  ✓ [TEST 1] Bản đồ 10x10 & Đội hình 6 đơn vị (22 ô, Căn cứ dấu +) hợp lệ.');
}

// 2. Verify Turn Rules & 3 Ammo Types (Standard 1x1, Cluster 3x3, Ricochet +2)
{
  const p1 = createPlayerBoard('SPLITTER');
  const p2 = createPlayerBoard('SPLITTER');
  placeUnitOnGrid(p2, 'scout', 4, 4, 'H'); // occupies (4,4) and (5,4)

  // Standard Miss -> keepTurn: false
  const missRes = resolveFireShot(p1, p2, 'STANDARD', 0, 0);
  assert.equal(missRes.valid, true);
  assert.equal(missRes.anyHit, false);
  assert.equal(missRes.keepTurn, false);

  // Standard Hit -> keepTurn: true
  const hitRes = resolveFireShot(p1, p2, 'STANDARD', 4, 4);
  assert.equal(hitRes.valid, true);
  assert.equal(hitRes.anyHit, true);
  assert.equal(hitRes.keepTurn, true);

  // Cluster 3x3 around (5,4) -> hits (5,4) and sinks scout, consumes 1 charge
  const clusterRes = resolveFireShot(p1, p2, 'CLUSTER', 5, 4);
  assert.equal(clusterRes.valid, true);
  assert.equal(clusterRes.anyHit, true);
  assert.equal(clusterRes.sunkUnits.length, 1);
  assert.equal(p1.ammo.CLUSTER, 0);

  // Second Cluster attempt must fail
  const clusterFail = resolveFireShot(p1, p2, 'CLUSTER', 8, 8);
  assert.equal(clusterFail.valid, false);

  // Ricochet shot -> hits primary + 2 random unshot cells (total 3 impacts)
  const ricochetRes = resolveFireShot(p1, p2, 'RICOCHET', 9, 9);
  assert.equal(ricochetRes.valid, true);
  assert.equal(ricochetRes.impacts.length, 3, 'Ricochet must impact 1 primary + 2 bounce cells');
  assert.equal(p1.ammo.RICOCHET, 0);
  console.log('  ✓ [TEST 2] Luật bắn tiếp khi trúng & 3 loại Đạn pháo (1x1, Chùm 3x3, Đạn nảy +2) hoạt động chuẩn xác.');
}

// 3. Verify Commander 1: Kael Vance (SPLITTER - Phân tách)
{
  const board = createPlayerBoard('SPLITTER');
  const splitRes = useSplitterSkill(board, 'carrier'); // 5 cells -> 3 + 2
  assert.equal(splitRes.valid, true);
  assert.equal(splitRes.createdUnits[0].size, 3);
  assert.equal(splitRes.createdUnits[1].size, 2);
  assert.equal(board.units.length, 7); // 6 - 1 + 2 = 7 units
  autoPlaceFleet(board, true);
  assert.equal(areAllUnitsPlaced(board), true);
  assert.equal(getRemainingRealCells(board), 22, 'Total real cells after split must remain 22');
  console.log('  ✓ [TEST 3] Chỉ huy Kael Vance (Phân tách): Tách đơn vị lớn thành 2 đơn vị nhỏ, bảo toàn 22 ô máu.');
}

// 4. Verify Commander 2: Vespera Noctis (PHANTOM - Thuyền ma)
{
  const p1 = createPlayerBoard('SPLITTER');
  const p2 = createPlayerBoard('PHANTOM');
  const phRes = usePhantomSkill(p2, false);
  assert.equal(phRes.valid, true);
  autoPlaceFleet(p2, true);

  const decoy = p2.units.find((u) => u.isDecoy);
  assert.ok(decoy, 'Phantom decoy unit must exist');
  assert.equal(decoy.size, 3);
  assert.equal(getRemainingRealCells(p2), 22, 'Phantom decoy must not count toward 22 real HP cells');

  // Shooting first 2 cells of Phantom reports HIT without revealing decoy yet
  const [c1, c2, c3] = decoy.cells;
  const s1 = resolveFireShot(p1, p2, 'STANDARD', c1.x, c1.y);
  assert.equal(s1.anyHit, true);
  assert.equal(s1.revealedDecoys.length, 0);

  const s2 = resolveFireShot(p1, p2, 'STANDARD', c2.x, c2.y);
  assert.equal(s2.anyHit, true);
  assert.equal(s2.revealedDecoys.length, 0);

  // Shooting 3rd cell reveals decoy!
  const s3 = resolveFireShot(p1, p2, 'STANDARD', c3.x, c3.y);
  assert.equal(s3.anyHit, true);
  assert.equal(s3.revealedDecoys.length, 1, '3rd hit on Phantom must reveal decoy');
  assert.equal(getRemainingRealCells(p2), 22, 'Sinking Phantom decoy does not reduce real HP');
  console.log('  ✓ [TEST 4] Chỉ huy Vespera Noctis (Thuyền ma): Mồi nhử 3 ô giả báo Trúng và lộ diện khi chìm.');
}

// 5. Verify Commander 3, 4, 5: Akira Sato (EVACUATOR), Lyra Chen (SONAR), Viktor Krane (FOG)
{
  const pEvac = createPlayerBoard('EVACUATOR');
  placeUnitOnGrid(pEvac, 'scout', 0, 0, 'H');
  const evacRes = useEvacuatorSkill(pEvac, 'scout', 5, 5, 'V');
  assert.equal(evacRes.valid, true);
  const scout = pEvac.units.find((u) => u.id === 'scout');
  assert.equal(scout.anchorX, 5);
  assert.equal(scout.anchorY, 5);
  assert.equal(scout.orientation, 'V');

  const pSonar = createPlayerBoard('SONAR');
  const sonarRes = useSonarSkill(pSonar, pEvac, 5, 5);
  assert.equal(sonarRes.valid, true);
  assert.equal(sonarRes.detectedCells.length, 2, 'Sonar must detect both cells of relocated scout');

  const pFog = createPlayerBoard('FOG');
  const fogRes = useFogSkill(pFog, pSonar);
  assert.equal(fogRes.valid, true);
  assert.equal(pSonar.fogTurnsRemaining, 2, 'Opponent must have 2 turns of fog');

  // Opponent misses -> fog decrements to 1
  resolveFireShot(pSonar, pFog, 'STANDARD', 9, 9);
  assert.equal(pSonar.fogTurnsRemaining, 1);
  console.log('  ✓ [TEST 5] Chỉ huy Akira Sato (Di tản), Lyra Chen (Đạn dò tìm 3x3), Viktor Krane (Sương mù 2 lượt) hoạt động chuẩn xác.');
}

console.log('\n===============================================================');
console.log('ALL 5/5 CORE LOGIC TEST SUITES PASSED (0 ERRORS)');
console.log('===============================================================');

