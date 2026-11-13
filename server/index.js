import { WebSocketServer } from 'ws';
import { resolveFireShot } from '../src/shared/AmmoSystem.js';
import {
  useEvacuatorSkill,
  useSonarSkill,
  useFogSkill
} from '../src/shared/CommanderSkills.js';

const PORT = process.env.PORT || 3006;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function sendTo(ws, type, payload = {}) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastRoom(room, type, payloadBuilder) {
  room.players.forEach((p, idx) => {
    if (p && p.ws) {
      const data = typeof payloadBuilder === 'function' ? payloadBuilder(idx) : payloadBuilder;
      sendTo(p.ws, type, data);
    }
  });
}

/**
 * Sanitizes enemy board for Fog of War before sending to client:
 * - Only reveals unit positions if unit isSunk === true
 * - If Phantom decoy has < 3 hits, hides that it is a decoy so hits look like real ship hits
 */
function sanitizeEnemyBoardForViewer(enemyBoard) {
  const safeCells = enemyBoard.cells.map((row) =>
    row.map((cell) => ({
      x: cell.x,
      y: cell.y,
      isShot: cell.isShot,
      isHit: cell.isHit,
      sonarDetected: cell.sonarDetected,
      sonarScanned: cell.sonarScanned,
      unitId: null
    }))
  );

  const safeUnits = enemyBoard.units.map((u) => {
    if (u.isSunk) {
      return { ...u };
    }
    return {
      id: u.id,
      name: u.isDecoy ? 'Tàu Bí Ẩn' : u.name,
      shortName: u.isDecoy ? '???' : u.shortName,
      size: u.size,
      isDecoy: false, // Hide decoy status until sunk!
      placed: true,
      cells: [],
      hitCells: u.hitCells,
      isSunk: false,
      decoyRevealed: false
    };
  });

  return {
    commanderId: enemyBoard.commanderId,
    cells: safeCells,
    units: safeUnits,
    ammo: enemyBoard.ammo,
    skillUsed: enemyBoard.skillUsed,
    fogTurnsRemaining: enemyBoard.fogTurnsRemaining
  };
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerIndex = -1;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, payload = {} } = msg;

    if (type === 'CREATE_ROOM') {
      const code = generateRoomCode();
      const room = {
        code,
        phase: 'LOBBY',
        currentTurn: 0,
        players: [
          {
            ws,
            name: payload.playerName || 'Chỉ Huy 1',
            commanderId: null,
            board: null,
            ready: false
          },
          null
        ]
      };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.playerIndex = 0;

      sendTo(ws, 'ROOM_CREATED', {
        roomCode: code,
        playerIndex: 0,
        isHost: true
      });
      broadcastRoom(room, 'ROOM_UPDATED', (idx) => ({
        roomCode: code,
        playerIndex: idx,
        isHost: idx === 0,
        playersCount: room.players.filter(Boolean).length,
        players: room.players.map((p) => (p ? { name: p.name } : null))
      }));
    } else if (type === 'JOIN_ROOM') {
      const code = String(payload.roomCode || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        sendTo(ws, 'ROOM_ERROR', { message: `Không tìm thấy phòng [${code}]!` });
        return;
      }
      if (room.players[1] !== null || room.phase !== 'LOBBY') {
        sendTo(ws, 'ROOM_ERROR', { message: `Phòng [${code}] đã đầy hoặc đang trong trận!` });
        return;
      }

      room.players[1] = {
        ws,
        name: payload.playerName || 'Chỉ Huy 2',
        commanderId: null,
        board: null,
        ready: false
      };
      ws.roomCode = code;
      ws.playerIndex = 1;

      sendTo(ws, 'ROOM_JOINED', {
        roomCode: code,
        playerIndex: 1,
        isHost: false
      });
      broadcastRoom(room, 'ROOM_UPDATED', (idx) => ({
        roomCode: code,
        playerIndex: idx,
        isHost: idx === 0,
        playersCount: 2,
        players: room.players.map((p) => (p ? { name: p.name } : null))
      }));
    } else if (type === 'QUICK_MATCH') {
      let openRoom = null;
      for (const r of rooms.values()) {
        if (r.phase === 'LOBBY' && r.players[0] && !r.players[1]) {
          openRoom = r;
          break;
        }
      }

      if (openRoom) {
        openRoom.players[1] = {
          ws,
          name: payload.playerName || 'Chỉ Huy 2',
          commanderId: null,
          board: null,
          ready: false
        };
        ws.roomCode = openRoom.code;
        ws.playerIndex = 1;
        sendTo(ws, 'ROOM_JOINED', {
          roomCode: openRoom.code,
          playerIndex: 1,
          isHost: false
        });
        broadcastRoom(openRoom, 'ROOM_UPDATED', (idx) => ({
          roomCode: openRoom.code,
          playerIndex: idx,
          isHost: idx === 0,
          playersCount: 2,
          players: openRoom.players.map((p) => (p ? { name: p.name } : null))
        }));
      } else {
        const code = generateRoomCode();
        const room = {
          code,
          phase: 'LOBBY',
          currentTurn: 0,
          players: [
            {
              ws,
              name: payload.playerName || 'Chỉ Huy 1',
              commanderId: null,
              board: null,
              ready: false
            },
            null
          ]
        };
        rooms.set(code, room);
        ws.roomCode = code;
        ws.playerIndex = 0;
        sendTo(ws, 'ROOM_CREATED', {
          roomCode: code,
          playerIndex: 0,
          isHost: true
        });
        broadcastRoom(room, 'ROOM_UPDATED', (idx) => ({
          roomCode: code,
          playerIndex: idx,
          isHost: idx === 0,
          playersCount: 1,
          players: room.players.map((p) => (p ? { name: p.name } : null))
        }));
      }
    } else if (type === 'START_MATCH') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.players[0] || !room.players[1]) {
        sendTo(ws, 'ROOM_ERROR', { message: 'Cần đủ 2 người chơi trong phòng để bắt đầu!' });
        return;
      }
      room.phase = 'COMMANDER_SELECT';
      broadcastRoom(room, 'MATCH_STARTED', (idx) => ({
        roomCode: room.code,
        playerIndex: idx
      }));
    } else if (type === 'SELECT_COMMANDER') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const player = room.players[ws.playerIndex];
      if (!player) return;
      player.commanderId = payload.commanderId;

      const oppIdx = ws.playerIndex === 0 ? 1 : 0;
      const opp = room.players[oppIdx];
      if (opp && opp.ws) {
        sendTo(opp.ws, 'OPPONENT_COMMANDER_LOCKED', {
          commanderId: payload.commanderId
        });
      }
    } else if (type === 'SUBMIT_FLEET') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const player = room.players[ws.playerIndex];
      if (!player) return;

      player.board = payload.board;
      player.commanderId = payload.board.commanderId;
      player.ready = true;

      const oppIdx = ws.playerIndex === 0 ? 1 : 0;
      const opp = room.players[oppIdx];
      if (opp && opp.ws) {
        sendTo(opp.ws, 'OPPONENT_FLEET_READY', {});
      }

      if (room.players[0]?.ready && room.players[1]?.ready) {
        room.phase = 'BATTLE';
        room.currentTurn = 0;
        broadcastRoom(room, 'BATTLE_START', (idx) => {
          const myBoard = room.players[idx].board;
          const enemyBoard = room.players[idx === 0 ? 1 : 0].board;
          return {
            playerIndex: idx,
            currentTurn: room.currentTurn,
            myBoard,
            enemyBoard: sanitizeEnemyBoardForViewer(enemyBoard)
          };
        });
      }
    } else if (type === 'USE_SKILL') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.phase !== 'BATTLE') return;
      if (room.currentTurn !== ws.playerIndex) return;

      const attacker = room.players[ws.playerIndex];
      const defender = room.players[ws.playerIndex === 0 ? 1 : 0];
      if (!attacker || !defender) return;

      const { skillType, params = {} } = payload;
      let res = null;
      if (skillType === 'EVACUATOR') {
        res = useEvacuatorSkill(attacker.board, params.unitId, params.x, params.y, params.orientation);
      } else if (skillType === 'SONAR') {
        res = useSonarSkill(attacker.board, defender.board, params.x, params.y);
      } else if (skillType === 'FOG') {
        res = useFogSkill(attacker.board, defender.board);
      }

      if (res && res.valid) {
        broadcastRoom(room, 'SKILL_USED', (idx) => {
          const myBoard = room.players[idx].board;
          const enemyBoard = room.players[idx === 0 ? 1 : 0].board;
          return {
            byPlayerIndex: ws.playerIndex,
            skillResult: res,
            currentTurn: room.currentTurn,
            myBoard,
            enemyBoard: sanitizeEnemyBoardForViewer(enemyBoard)
          };
        });
      } else if (res) {
        sendTo(ws, 'ACTION_ERROR', { message: res.reason });
      }
    } else if (type === 'FIRE_SHOT') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.phase !== 'BATTLE') return;
      if (room.currentTurn !== ws.playerIndex) return;

      const attacker = room.players[ws.playerIndex];
      const defender = room.players[ws.playerIndex === 0 ? 1 : 0];
      if (!attacker || !defender) return;

      const shotRes = resolveFireShot(
        attacker.board,
        defender.board,
        payload.ammoType,
        payload.x,
        payload.y
      );

      if (!shotRes.valid) {
        sendTo(ws, 'ACTION_ERROR', { message: shotRes.reason });
        return;
      }

      if (!shotRes.keepTurn && !shotRes.gameOver) {
        room.currentTurn = ws.playerIndex === 0 ? 1 : 0;
      }
      if (shotRes.gameOver) {
        room.phase = 'FINISHED';
      }

      broadcastRoom(room, 'SHOT_RESULT', (idx) => {
        const myBoard = room.players[idx].board;
        const enemyBoard = room.players[idx === 0 ? 1 : 0].board;
        return {
          shooterIndex: ws.playerIndex,
          shotResult: shotRes,
          currentTurn: room.currentTurn,
          winnerIndex: shotRes.gameOver ? ws.playerIndex : null,
          myBoard,
          enemyBoard: shotRes.gameOver ? enemyBoard : sanitizeEnemyBoardForViewer(enemyBoard)
        };
      });
    } else if (type === 'REQUEST_REMATCH') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.players[0] || !room.players[1]) return;
      room.phase = 'COMMANDER_SELECT';
      room.players.forEach((p) => {
        if (p) {
          p.commanderId = null;
          p.board = null;
          p.ready = false;
        }
      });
      broadcastRoom(room, 'MATCH_STARTED', (idx) => ({
        roomCode: room.code,
        playerIndex: idx
      }));
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms.has(ws.roomCode)) {
      const room = rooms.get(ws.roomCode);
      const oppIdx = ws.playerIndex === 0 ? 1 : 0;
      const opp = room.players[oppIdx];
      if (opp && opp.ws) {
        sendTo(opp.ws, 'OPPONENT_LEFT', {
          message: 'Đối phương đã rời khỏi phòng.'
        });
      }
      rooms.delete(ws.roomCode);
    }
  });
});

console.log(`[AnotherBattle WS Server] Listening on ws://localhost:${PORT}`);

