import Phaser from 'phaser';
import { GAME_MODES, COMMANDER_LIST } from '../shared/constants.js';
import {
  createRadarBackground,
  createTacticalButton,
  createCommanderBadge
} from '../utils/RadarRenderer.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;
    createRadarBackground(this);

    // Rotating Radar Sweep line in background
    this.sweepLine = this.add.graphics();
    this.sweepAngle = 0;

    // Top Header
    this.add.text(28, 16, '⚓ HỆ THỐNG TÁC CHIẾN HẢI QUÂN // ANOTHER BATTLE v1.0', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#00F5D4'
    });

    // Audio Mute Toggle
    const muteBtn = this.add.text(width - 28, 16, SoundFX.muted ? '🔇 ÂM THANH: TẮT' : '🔊 ÂM THANH: BẬT', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#FFE66D'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    muteBtn.on('pointerdown', () => {
      const muted = SoundFX.toggleMute();
      muteBtn.setText(muted ? '🔇 ÂM THANH: TẮT' : '🔊 ÂM THANH: BẬT');
    });

    // Main Title Banner
    const titleBox = this.add.rectangle(width / 2, 138, 760, 112, 0x07172b, 0.9);
    titleBox.setStrokeStyle(2, 0x00f5d4, 0.8);

    this.add.text(width / 2, 118, 'ANOTHER BATTLE', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '48px',
      fontStyle: '700',
      color: '#00F5D4',
      stroke: '#041020',
      strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(width / 2, 166, 'HẢI CHIẾN RADAR THEO LƯỢT • 22 Ô ĐƠN VỊ • 3 LOẠI ĐẠN • 5 CHỈ HUY', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#94A3B8'
    }).setOrigin(0.5);

    // 3 Game Mode Buttons (Center Column)
    createTacticalButton(
      this,
      width / 2,
      260,
      440,
      58,
      '🌐 ĐẤU TRỰC TUYẾN (ONLINE PVP)',
      () => {
        this.scene.start('LobbyScene');
      },
      {
        primaryColor: 0x00f5d4,
        fontSize: '18px',
        subLabel: 'Tạo Phòng / Nhập Mã Phòng -> Vào Game -> Chọn Chỉ Huy'
      }
    );

    createTacticalButton(
      this,
      width / 2,
      336,
      440,
      58,
      '⚔️ ĐẤU 2 NGƯỜI CÙNG MÁY (LOCAL PVP)',
      () => {
        this.scene.start('CommanderScene', {
          mode: GAME_MODES.LOCAL_PVP
        });
      },
      {
        primaryColor: 0x00bbf9,
        fontSize: '18px',
        subLabel: 'Luân phiên 2 Chỉ huy trên 1 thiết bị (Có màn chắn bảo mật)'
      }
    );

    createTacticalButton(
      this,
      width / 2,
      412,
      440,
      58,
      '🤖 CHIẾN ĐẤU VỚI AI (PVE TACTICAL BOT)',
      () => {
        this.scene.start('CommanderScene', {
          mode: GAME_MODES.PVE_AI
        });
      },
      {
        primaryColor: 0xffe66d,
        fontSize: '18px',
        subLabel: 'Rèn luyện chiến thuật đối đầu Trí tuệ nhân tạo Hải quân'
      }
    );

    // Commander Roster Showcase Strip at Bottom
    this.add.text(width / 2, 488, '— DANH SÁCH 5 CHỈ HUY HẠM ĐỘI —', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#7DD3FC'
    }).setOrigin(0.5);

    const startX = width / 2 - 440;
    const spacing = 220;

    COMMANDER_LIST.forEach((cmd, idx) => {
      const cx = startX + idx * spacing;
      const cy = 588;

      const card = this.add.rectangle(cx, cy, 204, 152, 0x081a30, 0.92);
      card.setStrokeStyle(1.5, cmd.hexColor, 0.75);

      createCommanderBadge(this, cx, cy - 34, 62, cmd);

      this.add.text(cx, cy + 12, cmd.name.toUpperCase(), {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: '#FFFFFF'
      }).setOrigin(0.5);

      this.add.text(cx, cy + 30, `Kỹ năng: ${cmd.skillName}`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        fontStyle: '700',
        color: cmd.accentColor
      }).setOrigin(0.5);

      this.add.text(cx, cy + 52, cmd.phaseLabel, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        color: '#94A3B8'
      }).setOrigin(0.5);
    });
  }

  update(_, delta) {
    this.sweepAngle += (delta / 1000) * 0.8;
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const tx = cx + Math.cos(this.sweepAngle) * 500;
    const ty = cy + Math.sin(this.sweepAngle) * 500;

    this.sweepLine.clear();
    this.sweepLine.lineStyle(2, 0x00f5d4, 0.14);
    this.sweepLine.lineBetween(cx, cy, tx, ty);
  }
}

