import Phaser from 'phaser';
import {
  GRID_SIZE,
  COL_LABELS,
  ROW_LABELS,
  GAME_MODES,
  COMMANDERS
} from '../shared/constants.js';
import {
  getUnitCells,
  canPlaceUnit,
  getRemainingRealCells
} from '../shared/BoardEngine.js';
import { resolveFireShot } from '../shared/AmmoSystem.js';
import {
  useEvacuatorSkill,
  useSonarSkill,
  useFogSkill
} from '../shared/CommanderSkills.js';
import {
  chooseAISkillAction,
  executeAISkill,
  chooseAIShot
} from '../shared/TacticalAI.js';
import {
  createRadarBackground,
  createTacticalButton,
  drawIsoBoardBase,
  addIsoBoardLabels,
  drawIsoCellDiamond,
  drawSunkUnitZone,
  gridToIso,
  screenToGrid,
  createIsoUnitContainer,
  renderIsoUnitSprites,
  createCommanderBadge
} from '../utils/RadarRenderer.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';
import { NetClient } from '../network/NetworkManager.js';

/**
 * TASK-08: Single-Main-Board Dynamic Perspective Battle Scene
 * Rule:
 * - On your turn -> Main center map displays the ENEMY MAP (for attacking/scanning).
 * - On opponent's turn -> Main center map displays YOUR OWN MAP (watching enemy shots land on your fleet).
 * - During Akira Sato's EVACUATOR skill (or manual peek toggle) -> Displays YOUR OWN MAP to relocate ship, then switches back to ENEMY MAP.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    this.mode = data.mode || GAME_MODES.PVE_AI;
    this.roomCode = data.roomCode || null;
    this.playerIndex = data.playerIndex ?? 0;
    this.currentTurn = data.currentTurn ?? 0; // 0 = P1, 1 = P2/AI

    this.p1Board = data.p1Board;
    this.p2Board = data.p2Board;

    this.selectedAmmo = 'STANDARD';
    this.activeSkillMode = null; // null | 'SONAR_AIM' | 'EVAC_PICK' | 'EVAC_PLACE'
    this.evacSelectedUnitId = null;
    this.evacOrientation = 'H';

    this.manualPeekOwnBoard = false;
    this.hoverCell = null;
    this.isAnimatingAction = false;
    this.animWatchdogTimer = null;
    this.passCurtainOpen = false;
  }

  setAnimatingLock(flag) {
    this.isAnimatingAction = Boolean(flag);
    if (this.animWatchdogTimer) {
      this.animWatchdogTimer.remove();
      this.animWatchdogTimer = null;
    }
    if (flag) {
      // Safety auto-recovery: never allow animation lock to freeze game longer than 3.0s
      this.animWatchdogTimer = this.time.delayedCall(3000, () => {
        if (this.isAnimatingAction) {
          console.warn('[BattleScene] Watchdog: animation lock auto-released to prevent hang.');
          this.isAnimatingAction = false;
          this.redrawReticleOnly();
        }
      });
    }
  }

  /**
   * Returns { myBoard, enemyBoard, isMyTurn, viewingEnemyMap, myCommander, enemyCommander }
   */
  getPerspective() {
    let myBoard;
    let enemyBoard;
    let isMyTurn;

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      isMyTurn = this.currentTurn === this.playerIndex;
      myBoard = this.p1Board;
      enemyBoard = this.p2Board;
    } else if (this.mode === GAME_MODES.LOCAL_PVP) {
      const isP1 = this.currentTurn === 0;
      myBoard = isP1 ? this.p1Board : this.p2Board;
      enemyBoard = isP1 ? this.p2Board : this.p1Board;
      isMyTurn = !this.passCurtainOpen;
    } else {
      // PVE_AI
      myBoard = this.p1Board;
      enemyBoard = this.p2Board;
      isMyTurn = this.currentTurn === 0;
    }

    // Core rule requested by user:
    // - When it's my turn -> Show Enemy Map (unless using EVACUATOR skill on own fleet or manually peeking)
    // - When it's opponent's turn -> Show My Own Map so I watch opponent fire at my ships!
    const isEvacMode =
      this.activeSkillMode === 'EVAC_PICK' || this.activeSkillMode === 'EVAC_PLACE';
    const viewingEnemyMap = isMyTurn && !isEvacMode && !this.manualPeekOwnBoard;

    return {
      myBoard,
      enemyBoard,
      isMyTurn,
      viewingEnemyMap,
      myCommander: COMMANDERS[myBoard.commanderId] || COMMANDERS.SPLITTER,
      enemyCommander: COMMANDERS[enemyBoard.commanderId] || COMMANDERS.SONAR
    };
  }

  create() {
    const { width } = this.scale;
    createRadarBackground(this);

    if (this.input.mouse) {
      this.input.mouse.disableContextMenu();
    }

    // Centered 10x10 2.5D Duel Field Tactical Map (Yu-Gi-Oh Perspective)
    this.boardSpec = {
      style: 'DUEL_FIELD',
      centerX: Math.floor(width / 2),
      topY: 175,
      bottomY: 495,
      topWidth: 370,
      bottomWidth: 520,
      slabDepth: 24
    };

    // Top Header
    this.add.text(28, 16, '⚔️ TRUNG TÂM CHỈ HUY TÁC CHIẾN // ANOTHER BATTLE', {
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
      '◄ RỜI TRẬN ĐẤU',
      () => {
        if (this.mode === GAME_MODES.ONLINE_PVP) {
          NetClient.clearListeners();
          NetClient.disconnect();
        }
        this.scene.start('MenuScene');
      },
      { primaryColor: 0x64748b, fontSize: '12px' }
    );

    // Build Center Map Frame
    this.buildCenterBoardFrame();

    // Build Left Panel (Allied Commander & Fleet Status)
    this.buildLeftAlliedPanel();

    // Build Right Panel (Enemy Commander, Turn Status & Combat Log)
    this.buildRightEnemyPanel();

    // Build Bottom Weapons & Skill Dock
    this.buildBottomWeaponsDock();

    // Build Pass-and-Play Curtain for Local PvP
    this.buildPassAndPlayCurtain();

    // Rotate shortcut R / SPACE during Evacuator relocation
    const rotateEvac = () => {
      if (this.activeSkillMode === 'EVAC_PLACE') {
        this.evacOrientation = this.evacOrientation === 'H' ? 'V' : 'H';
        SoundFX.playClick(620);
        this.redrawReticleOnly();
      }
    };
    this.input.keyboard.on('keydown-R', rotateEvac);
    this.input.keyboard.on('keydown-SPACE', rotateEvac);

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      this.setupOnlineBattleEvents();
    }

    this.sweepGraphics = this.add.graphics().setDepth(5);
    this.sweepAngle = 0;

    this.refreshHUD();
    this.redrawAll();
  }

  update(time, delta) {
    if (!this.sweepGraphics || !this.boardSpec) return;
    this.sweepAngle = (this.sweepAngle + delta * 0.0012) % (Math.PI * 2);
    const center = gridToIso(5, 5, this.boardSpec);
    const rx = this.boardSpec.topWidth * 0.45;
    const ry = (this.boardSpec.bottomY - this.boardSpec.topY) * 0.42;

    this.sweepGraphics.clear();
    const { viewingEnemyMap } = this.getPerspective();
    const sweepCol = viewingEnemyMap ? 0x00f5d4 : 0x00bbf9;

    // 2.5D Elliptical radar sweep beam
    this.sweepGraphics.lineStyle(1.5, sweepCol, 0.24);
    this.sweepGraphics.lineBetween(
      center.x,
      center.y,
      center.x + Math.cos(this.sweepAngle) * rx,
      center.y + Math.sin(this.sweepAngle) * ry
    );
    this.sweepGraphics.lineStyle(1, sweepCol, 0.1);
    this.sweepGraphics.strokeEllipse(center.x, center.y, rx * 1.3, ry * 1.3);
  }

  buildCenterBoardFrame() {
    // Outer frame graphics (redrawn dynamically to match Allied Blue vs Enemy Red/Cyan theme)
    this.frameGraphics = this.add.graphics();

    // Top Map Mode Banner
    this.mapHeaderTitle = this.add.text(
      this.boardSpec.centerX,
      125,
      'RADAR MỤC TIÊU ĐỐI PHƯƠNG (BẤM ĐỂ KHAI HỎA)',
      {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '16px',
        fontStyle: '700',
        color: '#00F5D4'
      }
    ).setOrigin(0.5);

    addIsoBoardLabels(this, this.boardSpec, '10.5px');

    this.isoUnitRig = createIsoUnitContainer(this, this.boardSpec);
    this.boardGraphics = this.add.graphics();
    this.fxGraphics = this.add.graphics();

    // Single Interactive Zone over the Center 10x10 2.5D Duel Field
    const gridZone = this.add
      .zone(
        this.boardSpec.centerX - this.boardSpec.bottomWidth / 2,
        this.boardSpec.topY,
        this.boardSpec.bottomWidth,
        this.boardSpec.bottomY - this.boardSpec.topY
      )
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    gridZone.on('pointermove', (pointer) => {
      const { x: gx, y: gy } = screenToGrid(pointer.x, pointer.y, this.boardSpec);
      const newHover =
        gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE ? { x: gx, y: gy } : null;
      if (
        (this.hoverCell === null && newHover !== null) ||
        (this.hoverCell !== null && newHover === null) ||
        (this.hoverCell && newHover && (this.hoverCell.x !== newHover.x || this.hoverCell.y !== newHover.y))
      ) {
        this.hoverCell = newHover;
        this.redrawReticleOnly();
      }
    });

    gridZone.on('pointerout', () => {
      if (this.hoverCell !== null) {
        this.hoverCell = null;
        this.redrawReticleOnly();
      }
    });

    gridZone.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown() || (pointer.button && pointer.button === 2)) {
        if (this.activeSkillMode === 'EVAC_PLACE') {
          this.evacOrientation = this.evacOrientation === 'H' ? 'V' : 'H';
          SoundFX.playClick(620);
          this.redrawReticleOnly();
        }
        return; // Ignore right-clicks for shooting
      }

      const { x: gx, y: gy } = screenToGrid(pointer.x, pointer.y, this.boardSpec);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        this.handleCenterBoardClick(gx, gy);
      }
    });
  }

  buildLeftAlliedPanel() {
    const lx = 195;

    const panelBg = this.add.rectangle(lx, 338, 340, 470, 0x07172b, 0.94);
    panelBg.setStrokeStyle(2, 0x00bbf9, 0.75);

    this.add.text(lx, 122, '🛡️ HẠM ĐỘI CỦA BẠN', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      color: '#00BBF9'
    }).setOrigin(0.5);

    this.myBadgeContainer = this.add.container(lx - 102, 185);

    this.myCmdNameText = this.add.text(lx - 42, 154, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '17px',
      fontStyle: '700',
      color: '#FFFFFF'
    });

    this.myCmdSkillText = this.add.text(lx - 42, 178, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#00F5D4'
    });

    this.myHpText = this.add.text(lx - 42, 202, 'HP: 22/22 Ô', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      fontStyle: '700',
      color: '#7DD3FC'
    });

    // Fleet ship status list
    this.add.text(lx, 248, '— TRẠNG THÁI ĐƠN VỊ ĐỒNG MINH —', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: '#94A3B8'
    }).setOrigin(0.5);

    this.myFleetListContainer = this.add.container(0, 0);

    // Quick Peek Toggle Button (lets player peek at their own map during their turn if desired)
    this.peekMapBtn = createTacticalButton(
      this,
      lx,
      534,
      304,
      44,
      '👁️ XEM NHANH BẢN ĐỒ HẠM ĐỘI NHÀ',
      () => {
        const { isMyTurn } = this.getPerspective();
        if (!isMyTurn || this.isAnimatingAction) return;
        this.manualPeekOwnBoard = !this.manualPeekOwnBoard;
        SoundFX.playClick(640);
        this.refreshHUD();
        this.redrawAll();
      },
      { primaryColor: 0x00bbf9, fontSize: '13px' }
    );
  }

  buildRightEnemyPanel() {
    const rx = 1085;

    const panelBg = this.add.rectangle(rx, 338, 340, 470, 0x07172b, 0.94);
    panelBg.setStrokeStyle(2, 0xff2a54, 0.75);

    // Active Turn Banner at Top of Right Panel
    this.turnBannerBg = this.add.rectangle(rx, 148, 308, 64, 0x0b213d, 0.96);
    this.turnBannerBg.setStrokeStyle(2, 0x00f5d4, 0.95);

    this.turnText = this.add.text(rx, 136, '🟢 LƯỢT CỦA BẠN', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '19px',
      fontStyle: '700',
      color: '#00F5D4'
    }).setOrigin(0.5);

    this.turnSubText = this.add.text(rx, 160, 'Đang hiện: Bản đồ Đối Phương', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: '#E2F1FF'
    }).setOrigin(0.5);

    // Enemy Commander Info
    this.add.text(rx, 206, '🎯 CHỈ HUY ĐỐI PHƯƠNG', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#FF6B35'
    }).setOrigin(0.5);

    this.enBadgeContainer = this.add.container(rx - 102, 266);

    this.enCmdNameText = this.add.text(rx - 42, 236, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '17px',
      fontStyle: '700',
      color: '#FFFFFF'
    });

    this.enCmdSkillText = this.add.text(rx - 42, 260, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#FF859B'
    });

    this.enHpText = this.add.text(rx - 42, 284, 'HP: 22/22 Ô', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      fontStyle: '700',
      color: '#FF6B35'
    });

    // Combat Log Box
    this.add.text(rx, 336, '— NHẬT KÝ TÁC CHIẾN RADAR —', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: '#94A3B8'
    }).setOrigin(0.5);

    const logBg = this.add.rectangle(rx, 448, 308, 190, 0x040d1a, 0.95);
    logBg.setStrokeStyle(1.5, 0x334155, 0.85);

    this.combatLogText = this.add.text(
      rx,
      448,
      'Trận hải chiến bắt đầu!\n• Khi tới lượt bạn: Màn hình hiện Bản đồ Đối phương để bạn khai hỏa.\n• Khi tới lượt đối phương: Màn hình hiện Bản đồ của bạn để quan sát phòng thủ.',
      {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '14px',
        fontStyle: '600',
        color: '#FFE66D',
        align: 'center',
        wordWrap: { width: 284 }
      }
    ).setOrigin(0.5);
  }

  buildBottomWeaponsDock() {
    const dockY = 652;
    const dockBg = this.add.rectangle(640, dockY, 1230, 88, 0x07172b, 0.96);
    dockBg.setStrokeStyle(2, 0x00f5d4, 0.7);

    // 1. Standard 1x1 Ammo Button
    this.btnAmmoStandard = createTacticalButton(
      this,
      195,
      dockY,
      260,
      60,
      '🎯 ĐẠN THƯỜNG (1x1)',
      () => this.selectAmmo('STANDARD'),
      {
        primaryColor: 0x00f5d4,
        fontSize: '15px',
        subLabel: 'Số lượng: VÔ HẠN (∞)'
      }
    );

    // 2. Cluster 3x3 Ammo Button
    this.btnAmmoCluster = createTacticalButton(
      this,
      475,
      dockY,
      260,
      60,
      '💥 ĐẠN CHÙM (3x3)',
      () => this.selectAmmo('CLUSTER'),
      {
        primaryColor: 0xff6b35,
        fontSize: '15px',
        subLabel: 'Còn lại: 1/1 lần'
      }
    );

    // 3. Ricochet +2 Ammo Button
    this.btnAmmoRicochet = createTacticalButton(
      this,
      755,
      dockY,
      260,
      60,
      '⚡ ĐẠN NẢY (+2 Ô)',
      () => this.selectAmmo('RICOCHET'),
      {
        primaryColor: 0xffe66d,
        fontSize: '15px',
        subLabel: 'Còn lại: 1/1 lần'
      }
    );

    // 4. Commander Skill Button
    this.btnCommanderSkill = createTacticalButton(
      this,
      1060,
      dockY,
      310,
      60,
      '🎖️ KỸ NĂNG CHỈ HUY',
      () => this.triggerCommanderSkillButton(),
      {
        primaryColor: 0xc77dff,
        fontSize: '15px',
        subLabel: '1 lần / trận (Không mất lượt bắn)'
      }
    );
  }

  buildPassAndPlayCurtain() {
    const { width, height } = this.scale;
    this.passCurtain = this.add.container(0, 0).setDepth(100);
    this.passCurtain.setVisible(false);

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x030914, 0.98);
    overlay.setInteractive();

    const box = this.add.rectangle(width / 2, height / 2, 580, 280, 0x081b33, 1);
    box.setStrokeStyle(3, 0x00f5d4, 0.9);

    this.curtainTitle = this.add.text(width / 2, height / 2 - 55, 'CHUYỂN GIAO QUYỀN CHỈ HUY', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '26px',
      fontStyle: '700',
      color: '#00F5D4'
    }).setOrigin(0.5);

    this.curtainSub = this.add.text(
      width / 2,
      height / 2 - 10,
      'Màn hình đã được khóa để bảo mật vị trí tàu.\nHãy trao máy cho người chơi tiếp theo!',
      {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '15px',
        color: '#E2F1FF',
        align: 'center'
      }
    ).setOrigin(0.5);

    const openBtn = createTacticalButton(
      this,
      width / 2,
      height / 2 + 68,
      320,
      58,
      '🔓 MỞ RADAR ĐỐI PHƯƠNG & BẮN',
      () => {
        this.passCurtainOpen = false;
        this.manualPeekOwnBoard = false;
        this.passCurtain.setVisible(false);
        this.refreshHUD();
        this.redrawAll();
      },
      { primaryColor: 0xffe66d, fontSize: '17px' }
    );

    this.passCurtain.add([overlay, box, this.curtainTitle, this.curtainSub, openBtn]);
  }

  selectAmmo(type) {
    const { myBoard, isMyTurn } = this.getPerspective();
    if (!isMyTurn || this.isAnimatingAction) return;

    if (type === 'CLUSTER' && myBoard.ammo.CLUSTER <= 0) {
      SoundFX.playExplosion(false);
      this.combatLogText.setText('❌ Bạn đã sử dụng hết Đạn Chùm 3x3!');
      return;
    }
    if (type === 'RICOCHET' && myBoard.ammo.RICOCHET <= 0) {
      SoundFX.playExplosion(false);
      this.combatLogText.setText('❌ Bạn đã sử dụng hết Đạn Nảy!');
      return;
    }

    this.activeSkillMode = null;
    this.evacSelectedUnitId = null;
    this.manualPeekOwnBoard = false; // Switch back to Enemy Map so player can aim
    this.selectedAmmo = type;
    SoundFX.playClick(700);
    this.refreshHUD();
    this.redrawAll();
  }

  triggerCommanderSkillButton() {
    const { myBoard, enemyBoard, isMyTurn, myCommander } = this.getPerspective();
    if (!isMyTurn || this.isAnimatingAction) return;

    if (myCommander.phase === 'DEPLOY') {
      this.combatLogText.setText(`ℹ️ Kỹ năng [${myCommander.skillName}] đã được áp dụng khi thiết kế đội hình.`);
      return;
    }

    if (myBoard.skillUsed) {
      SoundFX.playExplosion(false);
      this.combatLogText.setText(`❌ Kỹ năng [${myCommander.skillName}] đã được sử dụng trong trận này!`);
      return;
    }

    // Cancel if already aiming skill
    if (this.activeSkillMode) {
      this.activeSkillMode = null;
      this.evacSelectedUnitId = null;
      this.combatLogText.setText('Đã hủy chế độ kỹ năng. Quay về Bản đồ Đối phương.');
      this.refreshHUD();
      this.redrawAll();
      return;
    }

    if (myCommander.id === 'FOG') {
      if (this.mode === GAME_MODES.ONLINE_PVP) {
        NetClient.send('USE_SKILL', { skillType: 'FOG', params: {} });
        return;
      }

      const res = useFogSkill(myBoard, enemyBoard);
      if (res.valid) {
        SoundFX.playSkillActivate();
        this.combatLogText.setText(
          '🌫️ KÍCH HOẠT SƯƠNG MÙ! Bản đồ quan sát của đối phương bị che khuất trong 2 lượt tới.\nBạn vẫn được bắn lượt này!'
        );
        this.refreshHUD();
        this.redrawAll();
      }
    } else if (myCommander.id === 'SONAR') {
      SoundFX.playSonarPing();
      this.manualPeekOwnBoard = false;
      this.activeSkillMode = 'SONAR_AIM';
      this.combatLogText.setText(
        '📡 ĐẠN DÒ TÌM (3x3): Hãy click chọn tâm vùng 3x3 trên Bản đồ Đối phương để quét!'
      );
      this.refreshHUD();
      this.redrawAll();
    } else if (myCommander.id === 'EVACUATOR') {
      const hasUndamaged = myBoard.units.some((u) => u.placed && u.hitCells.length === 0 && !u.isSunk);
      if (!hasUndamaged) {
        SoundFX.playExplosion(false);
        this.combatLogText.setText('❌ Không còn đơn vị nào nguyên vẹn (chưa trúng đạn) để Di Tản!');
        return;
      }
      SoundFX.playSkillActivate();
      this.activeSkillMode = 'EVAC_PICK';
      this.combatLogText.setText(
        '🚁 CHẾ ĐỘ DI TẢN: Đang hiện Bản đồ của bạn — Hãy click chọn 1 tàu nguyên vẹn để di dời!'
      );
      this.refreshHUD();
      this.redrawAll();
    }
  }

  handleCenterBoardClick(gx, gy) {
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return;
    const { myBoard, enemyBoard, isMyTurn, viewingEnemyMap } = this.getPerspective();
    if (!isMyTurn || this.isAnimatingAction) return;

    // 1. If currently in Akira Sato's EVACUATOR skill mode (viewing own board)
    if (this.activeSkillMode === 'EVAC_PICK') {
      const unitId = myBoard.cells[gy][gx].unitId;
      if (!unitId) return;
      const unit = myBoard.units.find((u) => u.id === unitId);
      if (!unit || unit.hitCells.length > 0 || unit.isSunk) {
        SoundFX.playExplosion(false);
        this.combatLogText.setText('⚠️ Chỉ có thể chọn đơn vị CHƯA BỊ BẮN TRÚNG để Di Tản!');
        return;
      }
      this.evacSelectedUnitId = unit.id;
      this.evacOrientation = unit.orientation || 'H';
      this.activeSkillMode = 'EVAC_PLACE';
      SoundFX.playClick(760);
      this.combatLogText.setText(
        `🚁 Đang di tản [${unit.name}]: Click chọn vị trí mới (Nhấn R / Space / Chuột phải để xoay).`
      );
      this.redrawAll();
      return;
    }

    if (this.activeSkillMode === 'EVAC_PLACE') {
      if (this.mode === GAME_MODES.ONLINE_PVP) {
        NetClient.send('USE_SKILL', {
          skillType: 'EVACUATOR',
          params: {
            unitId: this.evacSelectedUnitId,
            x: gx,
            y: gy,
            orientation: this.evacOrientation
          }
        });
        this.activeSkillMode = null;
        this.evacSelectedUnitId = null;
        return;
      }

      const res = useEvacuatorSkill(
        myBoard,
        this.evacSelectedUnitId,
        gx,
        gy,
        this.evacOrientation
      );
      if (!res.valid) {
        SoundFX.playExplosion(false);
        this.combatLogText.setText(`❌ ${res.reason}`);
        return;
      }

      SoundFX.playSkillActivate();
      this.activeSkillMode = null;
      this.evacSelectedUnitId = null;
      this.combatLogText.setText(
        '✔ Đã Di Tản đơn vị thành công! Đã chuyển về Bản đồ Đối phương để bạn bắn lượt này.'
      );
      this.refreshHUD();
      this.redrawAll();
      return;
    }

    // If player is manually peeking at their own board, switch back to enemy board on click
    if (!viewingEnemyMap) {
      this.manualPeekOwnBoard = false;
      SoundFX.playClick(640);
      this.refreshHUD();
      this.redrawAll();
      return;
    }

    // 2. If in Lyra Chen's SONAR_AIM mode on Enemy Map
    if (this.activeSkillMode === 'SONAR_AIM') {
      if (this.mode === GAME_MODES.ONLINE_PVP) {
        NetClient.send('USE_SKILL', {
          skillType: 'SONAR',
          params: { x: gx, y: gy }
        });
        this.activeSkillMode = null;
        return;
      }

      const res = useSonarSkill(myBoard, enemyBoard, gx, gy);
      if (res.valid) {
        SoundFX.playSonarPing();
        this.activeSkillMode = null;
        const count = res.detectedCells.length;
        this.combatLogText.setText(
          count > 0
            ? `📡 SONAR PHÁT HIỆN ${count} Ô CÓ ĐƠN VỊ ĐỊCH! Hãy khai hỏa ngay!`
            : '📡 Khu vực 3x3 vừa quét trống trải. Hãy khai hỏa sang vùng khác!'
        );
        this.refreshHUD();
        this.redrawAll();
      }
      return;
    }

    // 3. Standard Weapon Firing on Enemy Map
    if (this.mode === GAME_MODES.ONLINE_PVP) {
      NetClient.send('FIRE_SHOT', {
        ammoType: this.selectedAmmo,
        x: gx,
        y: gy
      });
      return;
    }

    const shotRes = resolveFireShot(myBoard, enemyBoard, this.selectedAmmo, gx, gy);
    if (!shotRes.valid) {
      SoundFX.playExplosion(false);
      this.combatLogText.setText(`⚠️ ${shotRes.reason}`);
      return;
    }

    if (this.selectedAmmo !== 'STANDARD') {
      this.selectedAmmo = 'STANDARD';
    }

    this.playShotFeedback(shotRes, () => {
      if (shotRes.gameOver) {
        const winnerLabel =
          this.mode === GAME_MODES.LOCAL_PVP
            ? `NGƯỜI CHƠI ${this.currentTurn + 1} CHIẾN THẮNG!`
            : 'CHIẾN THẮNG! HẠM ĐỘI ĐỊCH ĐÃ BỊ TIÊU DIỆT!';
        this.scene.start('ResultScene', {
          mode: this.mode,
          isVictory: true,
          commanderId: this.getPerspective().myCommander.id,
          winnerLabel,
          p1Board: this.p1Board,
          p2Board: this.p2Board
        });
        return;
      }

      if (!shotRes.keepTurn) {
        // Pause briefly so player sees their miss, then switch turn (and switch map!)
        this.setAnimatingLock(true);
        this.time.delayedCall(550, () => {
          this.setAnimatingLock(false);
          this.currentTurn = this.currentTurn === 0 ? 1 : 0;
          this.manualPeekOwnBoard = false;

          if (this.mode === GAME_MODES.LOCAL_PVP) {
            this.showPassCurtainForPlayer(this.currentTurn + 1);
          } else if (this.mode === GAME_MODES.PVE_AI && this.currentTurn === 1) {
            // Switch to player's own map so player watches AI shoot at player's fleet!
            this.setAnimatingLock(true);
            this.refreshHUD();
            this.redrawAll();
            this.time.delayedCall(750, () => this.runAITurn());
            return;
          }
          this.refreshHUD();
          this.redrawAll();
        });
        return;
      }

      this.refreshHUD();
      this.redrawAll();
    });
  }

  runAITurn() {
    if (this.currentTurn !== 1) {
      this.setAnimatingLock(false);
      return;
    }
    this.setAnimatingLock(true);

    try {
      // 1. AI checks active skill
      const aiSkill = chooseAISkillAction(this.p2Board, this.p1Board);
      if (aiSkill) {
        const skillRes = executeAISkill(this.p2Board, this.p1Board, aiSkill);
        if (skillRes && skillRes.valid) {
          SoundFX.playSkillActivate();
          const aiCmd = COMMANDERS[this.p2Board.commanderId];
          this.combatLogText.setText(
            `🤖 Chỉ huy AI [${aiCmd.name}] vừa kích hoạt kỹ năng: ${aiCmd.skillName}!`
          );
          this.refreshHUD();
          this.redrawAll();
        }
      }

      // 2. AI fires at player's map (currently displayed in center!)
      this.time.delayedCall(650, () => {
        try {
          const shotChoice = chooseAIShot(this.p2Board, this.p1Board);
          let shotRes = resolveFireShot(
            this.p2Board,
            this.p1Board,
            shotChoice.ammoType,
            shotChoice.x,
            shotChoice.y
          );

          // If AI shot returned invalid for any reason, find any valid unshot cell immediately
          if (!shotRes || !shotRes.valid) {
            const fallbackUnshot = [];
            for (let y = 0; y < GRID_SIZE; y++) {
              for (let x = 0; x < GRID_SIZE; x++) {
                if (!this.p1Board.cells[y][x].isShot) {
                  fallbackUnshot.push({ x, y });
                }
              }
            }
            if (fallbackUnshot.length > 0) {
              const fb = fallbackUnshot[Math.floor(Math.random() * fallbackUnshot.length)];
              shotRes = resolveFireShot(this.p2Board, this.p1Board, 'STANDARD', fb.x, fb.y);
            }
          }

          if (!shotRes || !shotRes.valid) {
            // No more valid shots possible
            this.currentTurn = 0;
            this.setAnimatingLock(false);
            this.refreshHUD();
            this.redrawAll();
            return;
          }

          this.playShotFeedback(shotRes, () => {
            if (shotRes.gameOver) {
              this.scene.start('ResultScene', {
                mode: this.mode,
                isVictory: false,
                commanderId: this.p1Commander.id,
                winnerLabel: 'THẤT BẠI! HẠM ĐỘI CỦA BẠN ĐÃ BỊ ĐÁNH CHÌM!',
                p1Board: this.p1Board,
                p2Board: this.p2Board
              });
              return;
            }

            if (shotRes.keepTurn) {
              this.combatLogText.setText(
                '💥 ĐỐI PHƯƠNG BẮN TRÚNG TÀU CỦA BẠN! Đối phương được bắn tiếp lượt nữa!'
              );
              this.setAnimatingLock(true);
              this.refreshHUD();
              this.redrawAll();
              this.time.delayedCall(850, () => this.runAITurn());
            } else {
              // Pause 700ms so player clearly sees where AI missed on their board before switching back to Enemy Map
              this.setAnimatingLock(true);
              this.time.delayedCall(700, () => {
                this.currentTurn = 0;
                this.setAnimatingLock(false);
                this.manualPeekOwnBoard = false;
                this.combatLogText.setText(
                  '🌊 Đối phương bắn trượt! Đã chuyển sang Bản đồ Đối phương — Đến lượt bạn khai hỏa!'
                );
                this.refreshHUD();
                this.redrawAll();
              });
            }
          });
        } catch (innerErr) {
          console.error('[BattleScene] Error in AI shot execution:', innerErr);
          this.currentTurn = 0;
          this.setAnimatingLock(false);
          this.refreshHUD();
          this.redrawAll();
        }
      });
    } catch (outerErr) {
      console.error('[BattleScene] Error in AI turn:', outerErr);
      this.currentTurn = 0;
      this.setAnimatingLock(false);
      this.refreshHUD();
      this.redrawAll();
    }
  }

  playShotFeedback(shotRes, onComplete) {
    this.setAnimatingLock(true);
    SoundFX.playCannonFire(shotRes.ammoType);

    const impacts = shotRes.impacts || [];
    impacts.forEach((imp, idx) => {
      this.time.delayedCall(idx * 150, () => {
        const pt = gridToIso(imp.x + 0.5, imp.y + 0.5, this.boardSpec);
        const cx = pt.x;
        const cy = pt.y;

        // 1. Ricochet bounce lightning arc or tracer streak
        if (idx > 0 && shotRes.ammoType === 'RICOCHET') {
          SoundFX.playRicochetBounce(idx);
          const prev = impacts[idx - 1];
          const prevPt = gridToIso(prev.x + 0.5, prev.y + 0.5, this.boardSpec);
          const px = prevPt.x;
          const py = prevPt.y;
          const arcG = this.add.graphics().setDepth(20);
          arcG.lineStyle(3, 0xffe66d, 0.95);
          arcG.lineBetween(px, py, cx, cy);
          this.tweens.add({
            targets: arcG,
            alpha: 0,
            duration: 280,
            onComplete: () => arcG.destroy()
          });
        } else if (idx === 0) {
          const shell = this.add.circle(640, 610, 5, 0xffe66d, 1).setDepth(20);
          this.tweens.add({
            targets: shell,
            x: cx,
            y: cy,
            duration: 90,
            ease: 'Cubic.easeOut',
            onComplete: () => shell.destroy()
          });
        }

        if (imp.isHit) {
          const isBig = Boolean(imp.unitSunk || imp.decoyRevealed);
          SoundFX.playExplosion(isBig);
          this.cameras.main.shake(isBig ? 220 : 110, isBig ? 0.007 : 0.0035);

          // Fiery shockwave ring
          const ring = this.add.circle(cx, cy, 8, 0xff6b35, 0.95).setDepth(18);
          ring.setStrokeStyle(2.5, 0xffe66d, 1);
          this.tweens.add({
            targets: ring,
            radius: this.cellSize * (isBig ? 1.3 : 0.9),
            alpha: 0,
            duration: isBig ? 520 : 380,
            onComplete: () => ring.destroy()
          });

          // Flying spark embers
          const sparkCount = isBig ? 12 : 7;
          for (let s = 0; s < sparkCount; s++) {
            const ang = (Math.PI * 2 * s) / sparkCount + (Math.random() - 0.5) * 0.4;
            const dist = (isBig ? 38 : 24) + Math.random() * 14;
            const spark = this.add
              .rectangle(cx, cy, 4, 4, s % 2 === 0 ? 0xffe66d : 0xff2a54, 1)
              .setDepth(19);
            this.tweens.add({
              targets: spark,
              x: cx + Math.cos(ang) * dist,
              y: cy + Math.sin(ang) * dist,
              alpha: 0,
              scale: 0.2,
              duration: 360 + Math.random() * 140,
              ease: 'Cubic.easeOut',
              onComplete: () => spark.destroy()
            });
          }

          // Floating tactical callout on sink / decoy
          if (isBig) {
            const label = imp.decoyRevealed ? '👻 MỒI NHỬ!' : '🔥 ĐÁNH CHÌM!';
            const col = imp.decoyRevealed ? '#C77DFF' : '#FFE66D';
            const pop = this.add
              .text(cx, cy - 10, label, {
                fontFamily: '"Chakra Petch", sans-serif',
                fontSize: '15px',
                fontStyle: '700',
                color: col,
                stroke: '#040B14',
                strokeThickness: 4
              })
              .setOrigin(0.5)
              .setDepth(25);
            this.tweens.add({
              targets: pop,
              y: cy - 46,
              alpha: 0,
              duration: 900,
              ease: 'Cubic.easeOut',
              onComplete: () => pop.destroy()
            });
          }
        } else {
          SoundFX.playSplash();
          // Dual cyan water splash ripples
          const r1 = this.add.circle(cx, cy, 5, 0x38bdf8, 0.75).setDepth(18);
          r1.setStrokeStyle(2, 0x7dd3fc, 0.9);
          this.tweens.add({
            targets: r1,
            radius: this.cellSize * 0.68,
            alpha: 0,
            duration: 420,
            onComplete: () => r1.destroy()
          });
        }

        this.redrawAll();
      });
    });

    const totalDelay = Math.max(440, impacts.length * 160 + 260);
    this.time.delayedCall(totalDelay, () => {
      this.setAnimatingLock(false);

      if (shotRes.revealedDecoys && shotRes.revealedDecoys.length > 0) {
        this.combatLogText.setText(
          '👻 PHÁT HIỆN THUYỀN MA MỒI NHỬ! (3 ô vừa bắn hạ là Thuyền Ma mồi nhử)'
        );
      } else if (shotRes.sunkUnits && shotRes.sunkUnits.length > 0) {
        const names = shotRes.sunkUnits.map((u) => u.name).join(', ');
        this.combatLogText.setText(`🔥 ĐÁNH CHÌM [${names.toUpperCase()}]! Được bắn tiếp lượt nữa!`);
      } else if (shotRes.anyHit) {
        this.combatLogText.setText('🎯 BẮN TRÚNG MỤC TIÊU! Được thưởng thêm lượt bắn tiếp theo!');
      } else {
        this.combatLogText.setText('🌊 Đạn rơi xuống biển (Trượt)!');
      }

      if (onComplete) onComplete();
    });
  }

  showPassCurtainForPlayer(nextPlayerNum) {
    this.passCurtainOpen = true;
    this.curtainTitle.setText(`ĐẾN LƯỢT NGƯỜI CHƠI ${nextPlayerNum}`);
    this.passCurtain.setVisible(true);
  }

  setupOnlineBattleEvents() {
    NetClient.clearListeners();

    NetClient.on('SKILL_USED', (payload) => {
      this.p1Board = payload.myBoard;
      this.p2Board = payload.enemyBoard;
      this.currentTurn = payload.currentTurn;
      SoundFX.playSkillActivate();

      const byMe = payload.byPlayerIndex === this.playerIndex;
      const skillName = payload.skillResult?.skill || 'KỸ NĂNG';
      this.combatLogText.setText(
        byMe
          ? `⚡ Đã kích hoạt kỹ năng [${skillName}]! Hãy thực hiện phát bắn trên Bản đồ Đối phương.`
          : `⚠️ Đối phương vừa kích hoạt kỹ năng Chỉ huy [${skillName}]!`
      );
      this.refreshHUD();
      this.redrawAll();
    });

    NetClient.on('SHOT_RESULT', (payload) => {
      this.p1Board = payload.myBoard;
      this.p2Board = payload.enemyBoard;

      const byMe = payload.shooterIndex === this.playerIndex;
      if (byMe && this.selectedAmmo !== 'STANDARD') {
        this.selectedAmmo = 'STANDARD';
      }

      // Keep viewing the board where the shot landed during impact animation
      this.playShotFeedback(payload.shotResult, () => {
        if (payload.shotResult.gameOver) {
          const isVictory = payload.winnerIndex === this.playerIndex;
          this.scene.start('ResultScene', {
            mode: GAME_MODES.ONLINE_PVP,
            roomCode: this.roomCode,
            playerIndex: this.playerIndex,
            isVictory,
            commanderId: this.getPerspective().myCommander.id,
            winnerLabel: isVictory
              ? 'CHIẾN THẮNG! BẠN ĐÃ ĐÁNH BẠI HẠM ĐỘI ĐỐI PHƯƠNG!'
              : 'THẤT BẠI! HẠM ĐỘI CỦA BẠN ĐÃ BỊ HẠ GỤC!',
            p1Board: this.p1Board,
            p2Board: this.p2Board
          });
          return;
        }

        // After brief delay, update turn so the board smoothly flips between Enemy Map and Own Map
        this.time.delayedCall(450, () => {
          this.currentTurn = payload.currentTurn;
          this.manualPeekOwnBoard = false;
          this.refreshHUD();
          this.redrawAll();
        });
      });
    });

    NetClient.on('ACTION_ERROR', ({ message }) => {
      SoundFX.playExplosion(false);
      this.combatLogText.setText(`❌ ${message}`);
    });

    NetClient.on('OPPONENT_LEFT', ({ message }) => {
      alert(message || 'Đối phương đã rời trận đấu.');
      this.scene.start('MenuScene');
    });
  }

  refreshHUD() {
    const { myBoard, enemyBoard, isMyTurn, viewingEnemyMap, myCommander, enemyCommander } =
      this.getPerspective();

    // Update Turn Banner
    if (isMyTurn) {
      this.turnBannerBg.setStrokeStyle(2.5, 0x00f5d4, 1);
      this.turnText.setText(
        this.mode === GAME_MODES.LOCAL_PVP ? `🟢 LƯỢT NGƯỜI CHƠI ${this.currentTurn + 1}` : '🟢 LƯỢT CỦA BẠN'
      );
      this.turnText.setColor('#00F5D4');
      this.turnSubText.setText(
        viewingEnemyMap
          ? 'Đang hiện: BẢN ĐỒ ĐỐI PHƯƠNG (Ngắm bắn)'
          : 'Đang hiện: BẢN ĐỒ HẠM ĐỘI NHÀ'
      );
    } else {
      this.turnBannerBg.setStrokeStyle(2, 0xff6b35, 0.9);
      this.turnText.setText('🛡️ LƯỢT ĐỐI PHƯƠNG');
      this.turnText.setColor('#FF6B35');
      this.turnSubText.setText('Đang hiện: BẢN ĐỒ CỦA BẠN (Quan sát địch bắn)');
    }

    // Update Allied Commander & Fleet list on Left Panel
    if (this.renderedMyCmdId !== myCommander.id) {
      this.renderedMyCmdId = myCommander.id;
      this.myBadgeContainer.removeAll(true);
      this.myBadgeContainer.add(createCommanderBadge(this, 0, 0, 72, myCommander));
    }
    this.myCmdNameText.setText(myCommander.name.toUpperCase());
    this.myCmdSkillText.setText(`⚡ ${myCommander.skillName}`);
    this.myHpText.setText(`Ô ĐƠN VỊ: ${getRemainingRealCells(myBoard)}/22`);

    if (!this.fleetRowViews || this.fleetRowViews.length !== myBoard.units.length) {
      this.myFleetListContainer.removeAll(true);
      this.fleetRowViews = [];
      myBoard.units.forEach((u, idx) => {
        const ry = 278 + idx * 33;
        const rowBg = this.add.rectangle(195, ry, 304, 28, 0x0b1f38, 0.9);
        rowBg.setStrokeStyle(1, 0x1e3a5f, 0.8);

        const uName = this.add.text(54, ry, '', {
          fontFamily: '"Chakra Petch", sans-serif',
          fontSize: '12.5px',
          fontStyle: '700',
          color: '#E2F1FF'
        }).setOrigin(0, 0.5);

        const uHp = this.add.text(336, ry, '', {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          color: '#00F5D4'
        }).setOrigin(1, 0.5);

        this.myFleetListContainer.add([rowBg, uName, uHp]);
        this.fleetRowViews.push({ rowBg, uName, uHp });
      });
    }

    myBoard.units.forEach((u, idx) => {
      const view = this.fleetRowViews[idx];
      if (!view) return;
      const intact = u.size - u.hitCells.length;
      view.rowBg.setFillStyle(u.isSunk ? 0x2b111b : 0x0b1f38, 0.9);
      view.rowBg.setStrokeStyle(1, u.isSunk ? 0xff2a54 : 0x1e3a5f, 0.8);
      view.uName.setText(`${u.isSunk ? '💀' : '🚢'} ${u.name}`);
      view.uName.setColor(u.isSunk ? '#FF2A54' : u.isDecoy ? '#C77DFF' : '#E2F1FF');
      view.uHp.setText(u.isSunk ? 'ĐÃ CHÌM' : `${intact}/${u.size} ô`);
      view.uHp.setColor(u.isSunk ? '#FF2A54' : '#00F5D4');
    });

    this.peekMapBtn.setDisabled(!isMyTurn);
    this.peekMapBtn.setLabel(
      this.manualPeekOwnBoard
        ? '🎯 QUAY LẠI BẢN ĐỒ ĐỐI PHƯƠNG ĐỂ BẮN'
        : '👁️ XEM NHANH BẢN ĐỒ HẠM ĐỘI NHÀ'
    );

    // Update Enemy Commander Info on Right Panel
    if (this.renderedEnCmdId !== enemyCommander.id) {
      this.renderedEnCmdId = enemyCommander.id;
      this.enBadgeContainer.removeAll(true);
      this.enBadgeContainer.add(createCommanderBadge(this, 0, 0, 72, enemyCommander));
    }
    this.enCmdNameText.setText(enemyCommander.name.toUpperCase());
    this.enCmdSkillText.setText(`⚡ ${enemyCommander.skillName}`);
    this.enHpText.setText(`Ô ĐƠN VỊ: ${getRemainingRealCells(enemyBoard)}/22`);

    // Update Bottom Ammo & Skill Buttons
    this.btnAmmoStandard.setDisabled(!isMyTurn);
    this.btnAmmoStandard.setLabel(
      this.selectedAmmo === 'STANDARD' ? '▶ 🎯 ĐẠN THƯỜNG (1x1)' : '🎯 ĐẠN THƯỜNG (1x1)',
      'Số lượng: VÔ HẠN (∞)'
    );

    const clusterLeft = myBoard.ammo.CLUSTER || 0;
    this.btnAmmoCluster.setDisabled(!isMyTurn || clusterLeft <= 0);
    this.btnAmmoCluster.setLabel(
      this.selectedAmmo === 'CLUSTER' ? '▶ 💥 ĐẠN CHÙM (3x3)' : '💥 ĐẠN CHÙM (3x3)',
      `Còn lại: ${clusterLeft}/1 lần`
    );

    const ricochetLeft = myBoard.ammo.RICOCHET || 0;
    this.btnAmmoRicochet.setDisabled(!isMyTurn || ricochetLeft <= 0);
    this.btnAmmoRicochet.setLabel(
      this.selectedAmmo === 'RICOCHET' ? '▶ ⚡ ĐẠN NẢY (+2 Ô)' : '⚡ ĐẠN NẢY (+2 Ô)',
      `Còn lại: ${ricochetLeft}/1 lần`
    );

    if (myCommander.phase === 'DEPLOY') {
      this.btnCommanderSkill.setDisabled(true);
      this.btnCommanderSkill.setLabel(
        `✔ ${myCommander.skillName.toUpperCase()}`,
        'Kỹ năng đã áp dụng khi Thiết kế đội hình'
      );
    } else if (myBoard.skillUsed) {
      this.btnCommanderSkill.setDisabled(true);
      this.btnCommanderSkill.setLabel(
        `✔ ĐÃ DÙNG: ${myCommander.skillName.toUpperCase()}`,
        '0/1 lần còn lại'
      );
    } else {
      this.btnCommanderSkill.setDisabled(!isMyTurn);
      const isAimingSkill = Boolean(this.activeSkillMode);
      this.btnCommanderSkill.setLabel(
        isAimingSkill
          ? `✖ HỦY NGẮM (${myCommander.skillName.toUpperCase()})`
          : `⚡ KỸ NĂNG: ${myCommander.skillName.toUpperCase()}`,
        'Còn 1/1 lần • Không tốn lượt bắn'
      );
    }
  }

  redrawAll() {
    this.frameGraphics.clear();
    this.boardGraphics.clear();
    this.fxGraphics.clear();
    if (this.isoUnitRig?.inner) this.isoUnitRig.inner.removeAll(true);

    const { myBoard, enemyBoard, isMyTurn, viewingEnemyMap } = this.getPerspective();
    const themeColor = viewingEnemyMap ? 0x00f5d4 : 0x00bbf9;

    // Draw 2.5D Extruded Ocean Slab & Isometric Grid
    drawIsoBoardBase(this.frameGraphics, this.boardSpec, themeColor);

    // CASE A: Viewing ENEMY MAP (On Player's Turn)
    if (viewingEnemyMap) {
      this.mapHeaderTitle.setText('🎯 BẢN ĐỒ ĐỐI PHƯƠNG 2.5D — CHỌN MỤC TIÊU KHAI HỎA');
      this.mapHeaderTitle.setColor('#00F5D4');

      const isBlindedByFog = myBoard.fogTurnsRemaining > 0;

      if (!isBlindedByFog) {
        // Highlight Sunk Zone cells + outer warning border under sunk enemy ships
        for (const unit of enemyBoard.units) {
          if (unit.isSunk) {
            drawSunkUnitZone(this.frameGraphics, unit, this.boardSpec);
          }
        }

        // Draw only SUNK enemy units using 2.5D sprites
        renderIsoUnitSprites(
          this,
          this.isoUnitRig,
          enemyBoard.units,
          this.boardSpec,
          { onlySunk: true, fallbackGraphics: this.boardGraphics }
        );

        // Draw 2.5D Shot Markers, Vertical Flame Pillars & Sonar Beacons
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const cell = enemyBoard.cells[y][x];
            const pt = gridToIso(x + 0.5, y + 0.5, this.boardSpec);
            const px = pt.x;
            const py = pt.y;

            if (cell.isShot) {
              if (cell.isHit) {
                // Isometric crater + 3D rising flame plume
                drawIsoCellDiamond(this.boardGraphics, x, y, this.boardSpec, 0xff2a54, 0.28, 0xff6b35, 0.7, 1.5, 0.14);
                this.boardGraphics.fillStyle(0xff6b35, 0.9);
                this.boardGraphics.fillEllipse(px, py, 16, 9);
                this.boardGraphics.lineStyle(2.5, 0xffe66d, 0.95);
                this.boardGraphics.lineBetween(px, py, px, py - 18);
                this.boardGraphics.fillStyle(0xffe66d, 0.9);
                this.boardGraphics.fillCircle(px, py - 18, 3.5);
              } else {
                // 2.5D Water splash elliptical ripple
                this.boardGraphics.lineStyle(1.5, 0x38bdf8, 0.65);
                this.boardGraphics.strokeEllipse(px, py, 18, 10);
                this.boardGraphics.fillStyle(0x7dd3fc, 0.78);
                this.boardGraphics.fillEllipse(px, py, 7, 4);
              }
            } else if (cell.sonarDetected) {
              drawIsoCellDiamond(this.boardGraphics, x, y, this.boardSpec, 0xffe66d, 0.3, 0xffe66d, 0.95, 2, 0.08);
              // 3D Vertical Sonar Beacon Beam
              this.boardGraphics.lineStyle(2, 0xffe66d, 0.85);
              this.boardGraphics.lineBetween(px, py, px, py - 24);
              this.boardGraphics.fillStyle(0xffe66d, 0.95);
              this.boardGraphics.fillCircle(px, py - 24, 3.5);
            } else if (cell.sonarScanned) {
              drawIsoCellDiamond(this.boardGraphics, x, y, this.boardSpec, 0x00f5d4, 0.12, 0x00f5d4, 0.28, 1, 0.06);
            }
          }
        }
      } else {
        // Viktor Krane's Smoke Fog of War covering 2.5D Diamond
        const top = gridToIso(0, 0, this.boardSpec);
        const right = gridToIso(GRID_SIZE, 0, this.boardSpec);
        const bottom = gridToIso(GRID_SIZE, GRID_SIZE, this.boardSpec);
        const left = gridToIso(0, GRID_SIZE, this.boardSpec);
        this.boardGraphics.fillStyle(0x1e293b, 0.9);
        this.boardGraphics.fillPoints([top, right, bottom, left], true);
        this.boardGraphics.lineStyle(2, 0x94a3b8, 0.45);
        const center = gridToIso(5, 5, this.boardSpec);
        for (let i = 0; i < 5; i++) {
          this.boardGraphics.strokeEllipse(
            center.x + (i - 2) * 58,
            center.y + (i % 2 === 0 ? -16 : 16),
            92,
            48
          );
        }
      }
    } else {
      // CASE B: Viewing MY OWN MAP (During Opponent's Turn OR During EVACUATOR Skill / Manual Peek)
      const headerTxt = !isMyTurn
        ? '🛡️ BẢN ĐỒ HẠM ĐỘI 2.5D CỦA BẠN — ĐỐI PHƯƠNG ĐANG TẤN CÔNG'
        : this.activeSkillMode
          ? '🚁 BẢN ĐỒ HẠM ĐỘI 2.5D CỦA BẠN — CHỌN VỊ TRÍ DI TẢN TÀU'
          : '👁️ BẢN ĐỒ HẠM ĐỘI 2.5D CỦA BẠN (CLICK BẤT KỲ ĐỂ QUAY LẠI BẮN)';
      this.mapHeaderTitle.setText(headerTxt);
      this.mapHeaderTitle.setColor('#00BBF9');

      // Highlight Sunk Zone cells + outer warning border under sunk allied ships
      for (const unit of myBoard.units) {
        if (unit.isSunk) {
          drawSunkUnitZone(this.frameGraphics, unit, this.boardSpec);
        }
      }

      // Draw all Allied Units using 2.5D sprites
      renderIsoUnitSprites(
        this,
        this.isoUnitRig,
        myBoard.units,
        this.boardSpec,
        { fallbackGraphics: this.boardGraphics }
      );

      // Draw Enemy Shots on Allied 2.5D Board
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = myBoard.cells[y][x];
          const pt = gridToIso(x + 0.5, y + 0.5, this.boardSpec);
          const px = pt.x;
          const py = pt.y;

          if (cell.isShot) {
            if (cell.isHit) {
              drawIsoCellDiamond(this.boardGraphics, x, y, this.boardSpec, 0xff2a54, 0.28, 0xff6b35, 0.75, 1.5, 0.14);
              this.boardGraphics.fillStyle(0xff6b35, 0.9);
              this.boardGraphics.fillEllipse(px, py, 16, 9);
              this.boardGraphics.lineStyle(2.5, 0xffe66d, 1);
              this.boardGraphics.lineBetween(px, py, px, py - 18);
              this.boardGraphics.fillStyle(0xffe66d, 0.95);
              this.boardGraphics.fillCircle(px, py - 18, 3.5);
            } else {
              this.boardGraphics.lineStyle(1.5, 0x38bdf8, 0.6);
              this.boardGraphics.strokeEllipse(px, py, 18, 10);
              this.boardGraphics.fillStyle(0x7dd3fc, 0.72);
              this.boardGraphics.fillEllipse(px, py, 7, 4);
            }
          }
        }
      }
    }

    this.redrawReticleOnly();
  }

  redrawReticleOnly() {
    this.fxGraphics.clear();
    const { myBoard, isMyTurn, viewingEnemyMap } = this.getPerspective();

    if (viewingEnemyMap) {
      // Draw 2.5D Targeting Reticle on Enemy Map
      if (isMyTurn && this.hoverCell && !this.isAnimatingAction) {
        const isArea3x3 =
          this.activeSkillMode === 'SONAR_AIM' ||
          (this.activeSkillMode === null && this.selectedAmmo === 'CLUSTER');

        const reticleCol =
          this.activeSkillMode === 'SONAR_AIM'
            ? 0xffe66d
            : this.selectedAmmo === 'CLUSTER'
              ? 0xff6b35
              : this.selectedAmmo === 'RICOCHET'
                ? 0xffe66d
                : 0x00f5d4;

        const radius = isArea3x3 ? 1 : 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const cx = this.hoverCell.x + dx;
            const cy = this.hoverCell.y + dy;
            if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
              drawIsoCellDiamond(this.fxGraphics, cx, cy, this.boardSpec, reticleCol, 0.28, reticleCol, 0.95, 2, 0.05);
            }
          }
        }

        // 3D Vertical Targeting Laser Beam at hover center
        const centerPt = gridToIso(this.hoverCell.x + 0.5, this.hoverCell.y + 0.5, this.boardSpec);
        this.fxGraphics.lineStyle(1.5, reticleCol, 0.65);
        this.fxGraphics.lineBetween(centerPt.x, centerPt.y, centerPt.x, centerPt.y - 36);
        this.fxGraphics.fillStyle(reticleCol, 0.95);
        this.fxGraphics.fillCircle(centerPt.x, centerPt.y - 36, 3);
      }
    } else {
      // Draw Evacuator Relocation Ghost Preview in 2.5D
      if (this.activeSkillMode === 'EVAC_PLACE' && this.evacSelectedUnitId && this.hoverCell) {
        const unit = myBoard.units.find((u) => u.id === this.evacSelectedUnitId);
        if (unit) {
          const valid = canPlaceUnit(
            myBoard,
            unit,
            this.hoverCell.x,
            this.hoverCell.y,
            this.evacOrientation,
            { ignoreUnitId: unit.id, forbidShotCells: true }
          );
          const cells = getUnitCells(unit, this.hoverCell.x, this.hoverCell.y, this.evacOrientation);
          const col = valid ? 0x00f5d4 : 0xff2a54;
          for (const pt of cells) {
            if (pt.x >= 0 && pt.x < GRID_SIZE && pt.y >= 0 && pt.y < GRID_SIZE) {
              drawIsoCellDiamond(this.fxGraphics, pt.x, pt.y, this.boardSpec, col, 0.35, col, 1, 2, 0.05);
            }
          }
        }
      }
    }
  }
}
