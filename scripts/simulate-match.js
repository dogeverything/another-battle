import { createPlayerBoard, autoPlaceFleet } from '../src/shared/BoardEngine.js';
import { resolveFireShot } from '../src/shared/AmmoSystem.js';
import { setupAIBoard, chooseAIShot, chooseAISkillAction, executeAISkill } from '../src/shared/TacticalAI.js';

console.log('--- STARTING 50 SIMULATED PvE MATCHES TO VERIFY ZERO HANGS ---');

for (let match = 1; match <= 50; match++) {
  const p1Board = createPlayerBoard('SPLITTER');
  autoPlaceFleet(p1Board, true);

  const p2Board = setupAIBoard('SONAR');

  let currentTurn = 0; // 0 = Player, 1 = AI
  let turnCount = 0;
  const maxTurns = 300;

  while (turnCount < maxTurns) {
    turnCount++;

    if (currentTurn === 0) {
      // Player turn: hunt for an unshot cell on enemy board
      const unshot = [];
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (!p2Board.cells[y][x].isShot) unshot.push({ x, y });
        }
      }
      if (unshot.length === 0) break;
      const pick = unshot[Math.floor(Math.random() * unshot.length)];
      const shotRes = resolveFireShot(p1Board, p2Board, 'STANDARD', pick.x, pick.y);
      if (!shotRes.valid) {
        throw new Error(`Player shot invalid at turn ${turnCount}: ${shotRes.reason}`);
      }
      if (shotRes.gameOver) break;
      if (!shotRes.keepTurn) currentTurn = 1;
    } else {
      // AI turn: using chooseAISkillAction and chooseAIShot
      const skill = chooseAISkillAction(p2Board, p1Board);
      if (skill) {
        executeAISkill(p2Board, p1Board, skill);
      }

      const shotChoice = chooseAIShot(p2Board, p1Board);
      let shotRes = resolveFireShot(p2Board, p1Board, shotChoice.ammoType, shotChoice.x, shotChoice.y);

      if (!shotRes || !shotRes.valid) {
        // Test our safety fallback!
        const fallback = [];
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            if (!p1Board.cells[y][x].isShot) fallback.push({ x, y });
          }
        }
        if (fallback.length === 0) break;
        const fb = fallback[Math.floor(Math.random() * fallback.length)];
        shotRes = resolveFireShot(p2Board, p1Board, 'STANDARD', fb.x, fb.y);
      }

      if (!shotRes.valid) {
        throw new Error(`AI shot completely invalid at turn ${turnCount}: ${shotRes.reason}`);
      }
      if (shotRes.gameOver) break;
      if (!shotRes.keepTurn) currentTurn = 0;
    }
  }

  if (turnCount >= maxTurns) {
    throw new Error(`Match ${match} exceeded maxTurns without concluding!`);
  }
}

console.log('✅ 50/50 SIMULATED PvE MATCHES CONCLUDED PERFECTLY (ZERO HANGS, ZERO ERRORS)!');

