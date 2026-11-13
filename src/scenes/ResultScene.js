import Phaser from 'phaser';
import { GRID_SIZE, GAME_MODES, COMMANDERS } from '../shared/constants.js';

const COMMANDER_QUOTES = {
  SPLITTER: {
    win: '“Tiên Phong toàn thắng!”',
    lose: '“Rút lui tái tập hợp!”'
  },
  PHANTOM: {
    win: '“Hạm đội Ảo Ảnh thắng!”',
    lose: '“Ảo ảnh tan biến...”'
  },
  EVACUATOR: {
    win: '“Quá nhanh để bắt kịp!”',
    lose: '“Đánh hay lắm, Chỉ huy.”'
  },
  SONAR: {
    win: '“Đã quét sạch mục tiêu!”',
    lose: '“Mất tín hiệu...”'
  },
  FOG: {
    win: '“Nghiền nát dưới thép!”',
    lose: '“Pháo đài sụp đổ...”'
  }
};
import {
  createRadarBackground,
  createTacticalButton,
  drawIsoBoardBase,
  addIsoBoardLabels,
  drawSunkUnitZone,
  gridToIso,
  createIsoUnitContainer,
  renderIsoUnitSprites
} from '../utils/RadarRenderer.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';
import { NetClient } from '../network/NetworkManager.js';

/**
 * TASK-10: Post-Battle Result & Full Board Reveal Scene
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.mode = data.mode || GAME_MODES.PVE_AI;
    this.roomCode = data.roomCode || null;
    this.playerIndex = data.playerIndex ?? 0;
    this.isVictory = Boolean(data.isVictory);
    this.commanderId = data.commanderId || 'SPLITTER';
    this.winnerLabel = data.winnerLabel || 'TRẬN ĐẤU KẾT THÚC';
    this.p1Board = data.p1Board;
    this.p2Board = data.p2Board;
  }

  create() {
    const { width, height } = this.scale;
    createRadarBackground(this);

    if (this.isVictory) {
      SoundFX.playVictory();
      this.time.delayedCall(320, () => {
        SoundFX.playCommanderVoice(this.commanderId, true);
      });
    } else {
      SoundFX.playCommanderVoice(this.commanderId, false);
    }

    const bannerColor = this.isVictory ? 0x00f5d4 : 0xff2a54;
    const bannerBox = this.add.rectangle(width / 2, 62, 880, 66, 0x07172b, 0.95);
    bannerBox.setStrokeStyle(2.5, bannerColor, 0.9);

    this.add.text(width / 2, 52, this.winnerLabel, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '25px',
      fontStyle: '700',
      color: this.isVictory ? '#00F5D4' : '#FF2A54'
    }).setOrigin(0.5);

    const cmd = COMMANDERS[this.commanderId] || COMMANDERS.SPLITTER;
    const quoteSet = COMMANDER_QUOTES[this.commanderId] || COMMANDER_QUOTES.SPLITTER;
    const quoteLine = this.isVictory ? quoteSet.win : quoteSet.lose;
    this.add.text(width / 2, 81, `🎙️ ${cmd.name.toUpperCase()}: ${quoteLine}`, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '13.5px',
      fontStyle: '600',
      color: '#FFE66D'
    }).setOrigin(0.5);

    // Reveal Both Boards Side-by-Side in 2.5D Duel Field View
    const p1Spec = {
      style: 'DUEL_FIELD',
      centerX: 345,
      topY: 195,
      bottomY: 465,
      topWidth: 300,
      bottomWidth: 430,
      slabDepth: 18
    };
    const p2Spec = {
      style: 'DUEL_FIELD',
      centerX: 935,
      topY: 195,
      bottomY: 465,
      topWidth: 300,
      bottomWidth: 430,
      slabDepth: 18
    };

    this.add.text(p1Spec.centerX, 152, 'BẢN ĐỒ HẠM ĐỘI 1 (2.5D TOÀN CẢNH)', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#00BBF9'
    }).setOrigin(0.5);

    this.add.text(p2Spec.centerX, 152, 'BẢN ĐỒ HẠM ĐỘI 2 (2.5D TOÀN CẢNH)', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#FF6B35'
    }).setOrigin(0.5);

    const baseG = this.add.graphics();
    drawIsoBoardBase(baseG, p1Spec, 0x00bbf9);
    drawIsoBoardBase(baseG, p2Spec, 0xff6b35);
    addIsoBoardLabels(this, p1Spec, '9.5px');
    addIsoBoardLabels(this, p2Spec, '9.5px');

    const p1Rig = createIsoUnitContainer(this, p1Spec);
    const p2Rig = createIsoUnitContainer(this, p2Spec);
    const g = this.add.graphics();
    this.drawRevealedBoard(baseG, p1Rig, g, this.p1Board, p1Spec);
    this.drawRevealedBoard(baseG, p2Rig, g, this.p2Board, p2Spec);

    // Action Buttons
    createTacticalButton(
      this,
      width / 2 - 170,
      645,
      290,
      56,
      '🔄 TÁI ĐẤU VÁN MỚI',
      () => {
        SoundFX.stopVictory();
        SoundFX.stopCommanderVoice();
        if (this.mode === GAME_MODES.ONLINE_PVP) {
          NetClient.send('REQUEST_REMATCH', {});
        } else {
          this.scene.start('CommanderScene', { mode: this.mode });
        }
      },
      { primaryColor: 0x00f5d4, fontSize: '17px' }
    );

    createTacticalButton(
      this,
      width / 2 + 170,
      645,
      290,
      56,
      '🏠 VỀ MENU CHÍNH',
      () => {
        SoundFX.stopVictory();
        SoundFX.stopCommanderVoice();
        if (this.mode === GAME_MODES.ONLINE_PVP) {
          NetClient.clearListeners();
          NetClient.disconnect();
        }
        this.scene.start('MenuScene');
      },
      { primaryColor: 0xffe66d, fontSize: '17px' }
    );

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      NetClient.clearListeners();
      NetClient.on('MATCH_STARTED', ({ roomCode, playerIndex }) => {
        SoundFX.playSkillActivate();
        this.scene.start('CommanderScene', {
          mode: GAME_MODES.ONLINE_PVP,
          roomCode,
          playerIndex
        });
      });
    }
  }

  drawRevealedBoard(zoneGraphics, isoRig, graphics, board, spec) {
    if (!board) return;
    for (const unit of board.units || []) {
      if (unit.isSunk) {
        drawSunkUnitZone(zoneGraphics, unit, spec);
      }
    }
    renderIsoUnitSprites(
      this,
      isoRig,
      board.units || [],
      spec,
      { fallbackGraphics: graphics }
    );
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = board.cells[y][x];
        const pt = gridToIso(x + 0.5, y + 0.5, spec);
        if (cell.isShot) {
          if (cell.isHit) {
            graphics.fillStyle(0xff2a54, 0.88);
            graphics.fillEllipse(pt.x, pt.y, 12, 7);
            graphics.lineStyle(2, 0xffe66d, 0.9);
            graphics.lineBetween(pt.x, pt.y, pt.x, pt.y - 12);
          } else {
            graphics.fillStyle(0x38bdf8, 0.5);
            graphics.fillEllipse(pt.x, pt.y, 7, 4);
          }
        }
      }
    }
  }
}

