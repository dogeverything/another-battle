import Phaser from 'phaser';
import { GAME_MODES } from '../shared/constants.js';
import { createRadarBackground, createTacticalButton } from '../utils/RadarRenderer.js';
import { NetClient } from '../network/NetworkManager.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';

/**
 * TASK-05: Online PvP Lobby Scene
 * Flow: Menu -> Tạo Phòng / Vào Phòng -> Vào Game -> Chọn Chỉ Huy
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    const { width, height } = this.scale;
    createRadarBackground(this);

    this.enteredCode = '';
    this.inRoom = false;
    this.isHost = false;
    this.playersCount = 0;

    // Header
    this.add.text(28, 16, '🌐 SẢNH CHỜ TRỰC TUYẾN // TẠO PHÒNG & GHÉP TRẬN', {
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
      '◄ VỀ MENU CHÍNH',
      () => {
        NetClient.clearListeners();
        NetClient.disconnect();
        this.scene.start('MenuScene');
      },
      { primaryColor: 0x64748b, fontSize: '12px' }
    );

    // Status Banner
    this.statusText = this.add.text(width / 2, 92, 'Đang kết nối tới Máy chủ Radar...', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '18px',
      fontStyle: '700',
      color: '#FFE66D'
    }).setOrigin(0.5);

    // 1. Pre-Room Selection Panel
    this.selectionContainer = this.add.container(0, 0);

    // Left Card: Create Room / Quick Match
    const leftCard = this.add.rectangle(width / 2 - 230, 340, 410, 380, 0x07172b, 0.92);
    leftCard.setStrokeStyle(2, 0x00f5d4, 0.7);

    const leftTitle = this.add.text(width / 2 - 230, 195, 'KHỞI TẠO CHIẾN DỊCH MỚI', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      color: '#00F5D4'
    }).setOrigin(0.5);

    const createRoomBtn = createTacticalButton(
      this,
      width / 2 - 230,
      285,
      330,
      58,
      '➕ TẠO PHÒNG MỚI',
      () => {
        NetClient.send('CREATE_ROOM', { playerName: 'Chỉ Huy 1' });
      },
      {
        primaryColor: 0x00f5d4,
        fontSize: '17px',
        subLabel: 'Nhận mã phòng 4 ký tự để mời bạn bè'
      }
    );

    const quickMatchBtn = createTacticalButton(
      this,
      width / 2 - 230,
      385,
      330,
      58,
      '⚡ GHÉP TRẬN NHANH',
      () => {
        NetClient.send('QUICK_MATCH', { playerName: 'Chỉ Huy' });
      },
      {
        primaryColor: 0xffe66d,
        fontSize: '17px',
        subLabel: 'Tự động tìm phòng đang mở hoặc tạo mới'
      }
    );

    // Right Card: Join by Room Code
    const rightCard = this.add.rectangle(width / 2 + 230, 340, 410, 380, 0x07172b, 0.92);
    rightCard.setStrokeStyle(2, 0x00bbf9, 0.7);

    const rightTitle = this.add.text(width / 2 + 230, 195, 'NHẬP MÃ PHÒNG ĐỐI THỦ', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      color: '#00BBF9'
    }).setOrigin(0.5);

    const codeInputBg = this.add.rectangle(width / 2 + 230, 275, 260, 64, 0x040d1a, 1);
    codeInputBg.setStrokeStyle(2, 0x00bbf9, 0.9);

    this.codeInputText = this.add.text(width / 2 + 230, 275, '____', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '34px',
      fontStyle: '700',
      color: '#FFFFFF',
      letterSpacing: 8
    }).setOrigin(0.5);

    const codeHint = this.add.text(width / 2 + 230, 326, 'Gõ bàn phím 4 ký tự mã phòng (A-Z, 0-9)', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#94A3B8'
    }).setOrigin(0.5);

    const joinRoomBtn = createTacticalButton(
      this,
      width / 2 + 230,
      400,
      280,
      54,
      '🔑 VÀO PHÒNG NGAY',
      () => {
        if (this.enteredCode.length < 4) {
          this.statusText.setText('⚠️ Vui lòng nhập đủ 4 ký tự mã phòng!');
          return;
        }
        NetClient.send('JOIN_ROOM', {
          roomCode: this.enteredCode,
          playerName: 'Chỉ Huy 2'
        });
      },
      { primaryColor: 0x00bbf9, fontSize: '17px' }
    );

    this.selectionContainer.add([
      leftCard,
      leftTitle,
      createRoomBtn,
      quickMatchBtn,
      rightCard,
      rightTitle,
      codeInputBg,
      this.codeInputText,
      codeHint,
      joinRoomBtn
    ]);

    // 2. Active Room Waiting Panel (Hidden until room created/joined)
    this.roomWaitingContainer = this.add.container(0, 0);
    this.roomWaitingContainer.setVisible(false);

    const roomBox = this.add.rectangle(width / 2, 360, 680, 410, 0x07172b, 0.95);
    roomBox.setStrokeStyle(2.5, 0x00f5d4, 0.85);

    const roomHeader = this.add.text(width / 2, 195, 'PHÒNG TÁC CHIẾN ĐÃ SẴN SÀNG', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      color: '#94A3B8'
    }).setOrigin(0.5);

    this.roomCodeBig = this.add.text(width / 2, 248, 'MÃ PHÒNG: ----', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '36px',
      fontStyle: '700',
      color: '#FFE66D'
    }).setOrigin(0.5);

    this.slot1Text = this.add.text(width / 2 - 160, 330, '🟢 VỊ TRÍ 1 (CHỦ PHÒNG)\nĐã kết nối', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      align: 'center',
      color: '#00F5D4'
    }).setOrigin(0.5);

    this.slot2Text = this.add.text(width / 2 + 160, 330, '⏳ VỊ TRÍ 2 (ĐỐI THỦ)\nĐang chờ người chơi vào...', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      align: 'center',
      color: '#94A3B8'
    }).setOrigin(0.5);

    this.startMatchBtn = createTacticalButton(
      this,
      width / 2,
      445,
      360,
      62,
      '🚀 VÀO GAME (CHỌN CHỈ HUY)',
      () => {
        NetClient.send('START_MATCH', { roomCode: NetClient.roomCode });
      },
      {
        primaryColor: 0x00f5d4,
        fontSize: '20px',
        subLabel: 'Đủ 2 người chơi -> Bắt đầu bước Chọn Chỉ Huy',
        disabled: true
      }
    );

    this.roomWaitingContainer.add([
      roomBox,
      roomHeader,
      this.roomCodeBig,
      this.slot1Text,
      this.slot2Text,
      this.startMatchBtn
    ]);

    // Keyboard input for 4-char Room Code
    this.input.keyboard.on('keydown', (event) => {
      if (this.inRoom) return;
      if (event.key === 'Backspace') {
        this.enteredCode = this.enteredCode.slice(0, -1);
        this.updateCodeDisplay();
      } else if (event.key === 'Enter' && this.enteredCode.length === 4) {
        NetClient.send('JOIN_ROOM', {
          roomCode: this.enteredCode,
          playerName: 'Chỉ Huy 2'
        });
      } else if (/^[a-zA-Z0-9]$/.test(event.key) && this.enteredCode.length < 4) {
        this.enteredCode += event.key.toUpperCase();
        SoundFX.playClick(740);
        this.updateCodeDisplay();
      }
    });

    this.setupNetworkEvents();
  }

  updateCodeDisplay() {
    const padded = this.enteredCode.padEnd(4, '_');
    this.codeInputText.setText(padded);
  }

  setupNetworkEvents() {
    NetClient.clearListeners();

    NetClient.connect()
      .then(() => {
        this.statusText.setText('🟢 Đã kết nối Máy chủ Online PvP. Hãy Tạo phòng hoặc Nhập mã phòng!');
        this.statusText.setColor('#00F5D4');
      })
      .catch(() => {
        this.statusText.setText('⚠️ Không kết nối được WebSocket Server (Hãy chạy npm run dev).');
        this.statusText.setColor('#FF2A54');
      });

    NetClient.on('ROOM_CREATED', ({ roomCode, playerIndex }) => {
      NetClient.roomCode = roomCode;
      NetClient.playerIndex = playerIndex;
      NetClient.isHost = true;
      this.showWaitingRoom(roomCode, true, 1);
    });

    NetClient.on('ROOM_JOINED', ({ roomCode, playerIndex }) => {
      NetClient.roomCode = roomCode;
      NetClient.playerIndex = playerIndex;
      NetClient.isHost = false;
      this.showWaitingRoom(roomCode, false, 2);
    });

    NetClient.on('ROOM_UPDATED', ({ roomCode, playersCount }) => {
      this.playersCount = playersCount;
      this.showWaitingRoom(roomCode, NetClient.isHost, playersCount);
    });

    NetClient.on('ROOM_ERROR', ({ message }) => {
      SoundFX.playExplosion(false);
      this.statusText.setText(`❌ ${message}`);
      this.statusText.setColor('#FF2A54');
    });

    NetClient.on('MATCH_STARTED', ({ roomCode, playerIndex }) => {
      SoundFX.playSkillActivate();
      NetClient.clearListeners();
      this.scene.start('CommanderScene', {
        mode: GAME_MODES.ONLINE_PVP,
        roomCode,
        playerIndex
      });
    });
  }

  showWaitingRoom(roomCode, isHost, playersCount) {
    this.inRoom = true;
    this.selectionContainer.setVisible(false);
    this.roomWaitingContainer.setVisible(true);
    this.roomCodeBig.setText(`MÃ PHÒNG: ${roomCode}`);

    if (playersCount >= 2) {
      SoundFX.playSonarPing();
      this.statusText.setText('🟢 Đã đủ 2 Chỉ huy trong phòng! Sẵn sàng VÀO GAME.');
      this.statusText.setColor('#00F5D4');
      this.slot2Text.setText('🟢 VỊ TRÍ 2 (ĐỐI THỦ)\nĐã kết nối sẵn sàng!');
      this.slot2Text.setColor('#00F5D4');
      this.startMatchBtn.setDisabled(false);
      this.startMatchBtn.setLabel(
        '🚀 VÀO GAME (CHỌN CHỈ HUY)',
        'Nhấn để cả 2 người chơi bước vào màn hình Chọn Chỉ Huy'
      );
    } else {
      this.statusText.setText(`Đang chờ người chơi thứ 2 nhập mã [${roomCode}]...`);
      this.statusText.setColor('#FFE66D');
      this.slot2Text.setText('⏳ VỊ TRÍ 2 (ĐỐI THỦ)\nĐang chờ người chơi vào...');
      this.slot2Text.setColor('#94A3B8');
      this.startMatchBtn.setDisabled(true);
      this.startMatchBtn.setLabel(
        '⏳ ĐANG CHỜ ĐỐI THỦ (1/2)...',
        `Chia sẻ mã phòng [${roomCode}] cho bạn bè để bắt đầu`
      );
    }
  }
}

