import Phaser from 'phaser';
import { GAME_MODES, COMMANDER_LIST, COMMANDERS } from '../shared/constants.js';
import {
  createRadarBackground,
  createTacticalButton,
  createCommanderBadge
} from '../utils/RadarRenderer.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';
import { NetClient } from '../network/NetworkManager.js';

/**
 * TASK-06: Commander Selection Scene
 * Flow: Vào Game -> Chọn Chỉ Huy -> Thiết Kế Đội Hình
 */
export class CommanderScene extends Phaser.Scene {
  constructor() {
    super('CommanderScene');
  }

  init(data) {
    this.mode = data.mode || GAME_MODES.PVE_AI;
    this.roomCode = data.roomCode || null;
    this.playerIndex = data.playerIndex ?? 0;
    this.SelectingPlayer = data.selectingPlayer || 1; // 1 or 2 (for LOCAL_PVP)
    this.p1CommanderId = data.p1CommanderId || null;
    this.selectedCommanderId = COMMANDER_LIST[0].id;
  }

  create() {
    const { width, height } = this.scale;
    createRadarBackground(this);

    const headerLabel =
      this.mode === GAME_MODES.LOCAL_PVP
        ? `🎖️ BƯỚC 1: CHỌN CHỈ HUY HẠM ĐỘI — NGƯỜI CHƠI ${this.SelectingPlayer}`
        : `🎖️ BƯỚC 1: CHỌN CHỈ HUY HẠM ĐỘI ${this.roomCode ? `[PHÒNG ${this.roomCode}]` : ''}`;

    this.add.text(28, 16, headerLabel, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      fontStyle: '700',
      color: '#00F5D4'
    });

    createTacticalButton(
      this,
      width - 105,
      27,
      160,
      34,
      '◄ THOÁT TRẬN',
      () => {
        if (this.mode === GAME_MODES.ONLINE_PVP) {
          NetClient.clearListeners();
          NetClient.disconnect();
        }
        this.scene.start('MenuScene');
      },
      { primaryColor: 0x64748b, fontSize: '12px' }
    );

    this.add.text(width / 2, 82, 'HÃY LỰA CHỌN CHỈ HUY ĐỒNG HÀNH CÙNG HẠM ĐỘI CỦA BẠN', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '22px',
      fontStyle: '700',
      color: '#FFFFFF'
    }).setOrigin(0.5);

    // 5 Commander Cards Row
    this.cardObjects = [];
    const startX = width / 2 - 472;
    const spacing = 236;
    const cardY = 278;

    COMMANDER_LIST.forEach((cmd, idx) => {
      const cx = startX + idx * spacing;
      const container = this.add.container(cx, cardY);

      const bg = this.add.rectangle(0, 0, 222, 310, 0x07172b, 0.94);
      bg.setStrokeStyle(2, cmd.hexColor, 0.6);
      bg.setInteractive({ useHandCursor: true });

      const portrait = createCommanderBadge(this, 0, -68, 134, cmd);

      const nameTxt = this.add.text(0, 18, cmd.name.toUpperCase(), {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '17px',
        fontStyle: '700',
        color: '#FFFFFF'
      }).setOrigin(0.5);

      const titleTxt = this.add.text(0, 38, cmd.title, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#94A3B8'
      }).setOrigin(0.5);

      const skillPill = this.add.rectangle(0, 68, 192, 28, 0x0d2747, 1);
      skillPill.setStrokeStyle(1.5, cmd.hexColor, 0.9);

      const skillTxt = this.add.text(0, 68, `⚡ ${cmd.skillName.toUpperCase()}`, {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: cmd.accentColor
      }).setOrigin(0.5);

      const phaseTxt = this.add.text(0, 96, cmd.phaseLabel, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10.5px',
        color: '#CBD5E1'
      }).setOrigin(0.5);

      const descTxt = this.add.text(0, 128, cmd.description, {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '11.5px',
        color: '#E2F1FF',
        align: 'center',
        wordWrap: { width: 202 }
      }).setOrigin(0.5);

      container.add([bg, portrait, nameTxt, titleTxt, skillPill, skillTxt, phaseTxt, descTxt]);

      bg.on('pointerdown', () => {
        SoundFX.playClick(720);
        SoundFX.playCommanderVoice(cmd.id, 'select');
        this.selectCommander(cmd.id);
      });

      this.cardObjects.push({ id: cmd.id, container, bg, cmd });
    });

    // Bottom Selected Commander Detail Panel & Confirm Button
    const detailPanel = this.add.rectangle(width / 2 - 170, 560, 820, 118, 0x07172b, 0.95);
    detailPanel.setStrokeStyle(2, 0x00f5d4, 0.75);

    this.detailNameText = this.add.text(78, 520, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      color: '#00F5D4'
    });

    this.detailQuoteText = this.add.text(78, 548, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '14px',
      fontStyle: 'italic',
      color: '#FFE66D'
    });

    this.detailDescText = this.add.text(78, 574, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '14px',
      color: '#E2F1FF',
      wordWrap: { width: 780 }
    });

    createTacticalButton(
      this,
      width - 195,
      560,
      300,
      74,
      '✔ XÁC NHẬN CHỈ HUY',
      () => this.confirmSelection(),
      {
        primaryColor: 0x00f5d4,
        fontSize: '19px',
        subLabel: 'Tiếp tục -> Thiết Kế Đội Hình 10x10'
      }
    );

    this.selectCommander(this.selectedCommanderId);
  }

  selectCommander(commanderId) {
    this.selectedCommanderId = commanderId;
    const chosen = COMMANDERS[commanderId];

    this.cardObjects.forEach((item) => {
      const isSelected = item.id === commanderId;
      if (isSelected) {
        item.bg.setFillStyle(0x102c4e, 1);
        item.bg.setStrokeStyle(3, 0xffe66d, 1);
        item.container.setScale(1.04);
      } else {
        item.bg.setFillStyle(0x07172b, 0.9);
        item.bg.setStrokeStyle(1.5, item.cmd.hexColor, 0.5);
        item.container.setScale(1.0);
      }
    });

    this.detailNameText.setText(`${chosen.name.toUpperCase()} — ${chosen.title}  |  KỸ NĂNG: ${chosen.skillName.toUpperCase()} (${chosen.phaseLabel})`);
    this.detailNameText.setColor(chosen.accentColor);
    this.detailQuoteText.setText(chosen.quote);
    this.detailDescText.setText(chosen.description);
  }

  confirmSelection() {
    SoundFX.stopCommanderVoice();
    SoundFX.playSkillActivate();

    if (this.mode === GAME_MODES.LOCAL_PVP && this.SelectingPlayer === 1) {
      this.scene.restart({
        mode: GAME_MODES.LOCAL_PVP,
        selectingPlayer: 2,
        p1CommanderId: this.selectedCommanderId
      });
      return;
    }

    if (this.mode === GAME_MODES.LOCAL_PVP && this.SelectingPlayer === 2) {
      this.scene.start('DeployScene', {
        mode: GAME_MODES.LOCAL_PVP,
        deployingPlayer: 1,
        p1CommanderId: this.p1CommanderId,
        p2CommanderId: this.selectedCommanderId
      });
      return;
    }

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      NetClient.send('SELECT_COMMANDER', {
        commanderId: this.selectedCommanderId
      });
      this.scene.start('DeployScene', {
        mode: GAME_MODES.ONLINE_PVP,
        roomCode: this.roomCode,
        playerIndex: this.playerIndex,
        p1CommanderId: this.selectedCommanderId
      });
      return;
    }

    // PVE_AI mode
    this.scene.start('DeployScene', {
      mode: GAME_MODES.PVE_AI,
      p1CommanderId: this.selectedCommanderId
    });
  }
}

