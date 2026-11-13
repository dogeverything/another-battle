import Phaser from 'phaser';
import {
  GRID_SIZE,
  GAME_MODES,
  COMMANDERS
} from '../shared/constants.js';
import {
  createPlayerBoard,
  getUnitCells,
  canPlaceUnit,
  placeUnitOnGrid,
  removeUnitFromGrid,
  clearAllPlacements,
  autoPlaceFleet,
  areAllUnitsPlaced
} from '../shared/BoardEngine.js';
import { useSplitterSkill, usePhantomSkill } from '../shared/CommanderSkills.js';
import { setupAIBoard } from '../shared/TacticalAI.js';
import {
  createRadarBackground,
  createTacticalButton,
  drawIsoBoardBase,
  addIsoBoardLabels,
  drawIsoCellDiamond,
  screenToGrid,
  createIsoUnitContainer,
  renderIsoUnitSprites,
  createCommanderBadge
} from '../utils/RadarRenderer.js';
import { SoundFX } from '../utils/SoundSynthesizer.js';
import { NetClient } from '../network/NetworkManager.js';

/**
 * TASK-07: Fleet Deployment Scene (Thiết Kế Đội Hình 10x10)
 * Features:
 * - Click or Drag to place/move units
 * - Rotate units before OR after placing (via Rotate Button, Right-Click, R key, Space key, or per-unit 🔄 button)
 */
export class DeployScene extends Phaser.Scene {
  constructor() {
    super('DeployScene');
  }

  init(data) {
    this.mode = data.mode || GAME_MODES.PVE_AI;
    this.roomCode = data.roomCode || null;
    this.playerIndex = data.playerIndex ?? 0;
    this.deployingPlayer = data.deployingPlayer || 1;
    this.p1CommanderId = data.p1CommanderId || 'SPLITTER';
    this.p2CommanderId = data.p2CommanderId || 'SONAR';
    this.p1SavedBoard = data.p1SavedBoard || null;

    const activeCmdId = this.deployingPlayer === 2 ? this.p2CommanderId : this.p1CommanderId;
    this.board = createPlayerBoard(activeCmdId);
    this.commander = COMMANDERS[activeCmdId];

    this.selectedUnitId = this.board.units[0].id;
    this.currentOrientation = 'H';
    this.hoverCell = null;
    this.waitingOnlineOpponent = false;
  }

  create() {
    const { width } = this.scale;
    createRadarBackground(this);

    if (this.input.mouse) {
      this.input.mouse.disableContextMenu();
    }

    this.gridOriginX = 415;
    this.gridOriginY = 126;
    this.cellSize = 48;

    // Header
    const headerTitle =
      this.mode === GAME_MODES.LOCAL_PVP
        ? `⚓ BƯỚC 2: THIẾT KẾ ĐỘI HÌNH (NGƯỜI CHƠI ${this.deployingPlayer} — ${this.commander.name.toUpperCase()})`
        : `⚓ BƯỚC 2: THIẾT KẾ ĐỘI HÌNH HẠM ĐỘI 10x10 — CHỈ HUY ${this.commander.name.toUpperCase()}`;

    this.add.text(28, 16, headerTitle, {
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
      '◄ ĐỔI CHỈ HUY',
      () => {
        if (this.mode === GAME_MODES.ONLINE_PVP) {
          NetClient.clearListeners();
          NetClient.disconnect();
          this.scene.start('MenuScene');
        } else {
          this.scene.start('CommanderScene', { mode: this.mode });
        }
      },
      { primaryColor: 0x64748b, fontSize: '12px' }
    );

    // Orientation Status Pill above the Grid
    this.orientationBadgeBg = this.add.rectangle(655, 68, 480, 26, 0x0b213d, 0.92);
    this.orientationBadgeBg.setStrokeStyle(1.5, 0x00bbf9, 0.8);
    this.orientationBadgeText = this.add.text(
      655,
      68,
      '🔄 HƯỚNG ĐẶT HIỆN TẠI: NGANG (━)  |  Nhấn [R] / [SPACE] / Chuột Phải để Xoay',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11.5px',
        fontStyle: '700',
        color: '#FFE66D'
      }
    ).setOrigin(0.5);

    // 1. Center 10x10 2.5D Duel Field Board Grid (Yu-Gi-Oh Perspective)
    this.boardSpec = {
      style: 'DUEL_FIELD',
      centerX: 646,
      topY: 182,
      bottomY: 505,
      topWidth: 380,
      bottomWidth: 530,
      slabDepth: 24
    };

    this.add.text(this.boardSpec.centerX, 128, 'BÀN ĐẤU HẠM ĐỘI 2.5D — DUEL FIELD (10x10)', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#00F5D4'
    }).setOrigin(0.5);

    const baseGraphics = this.add.graphics();
    drawIsoBoardBase(baseGraphics, this.boardSpec, 0x00f5d4);
    addIsoBoardLabels(this, this.boardSpec, '10.5px');

    this.placedGraphics = this.add.graphics();
    this.isoUnitRig = createIsoUnitContainer(this, this.boardSpec);
    this.previewGraphics = this.add.graphics();

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
      if (this.waitingOnlineOpponent) return;
      const { x: gx, y: gy } = screenToGrid(pointer.x, pointer.y, this.boardSpec);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        this.hoverCell = { x: gx, y: gy };
      } else {
        this.hoverCell = null;
      }
      this.redrawBoard();
    });

    gridZone.on('pointerout', () => {
      this.hoverCell = null;
      this.redrawBoard();
    });

    gridZone.on('pointerdown', (pointer) => {
      if (this.waitingOnlineOpponent) return;
      const { x: gx, y: gy } = screenToGrid(pointer.x, pointer.y, this.boardSpec);

      // Right-click on grid rotates unit immediately!
      if (pointer.rightButtonDown()) {
        const cellUnitId =
          gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE
            ? this.board.cells[gy][gx].unitId
            : null;
        if (cellUnitId) {
          this.selectedUnitId = cellUnitId;
          this.rotateUnitById(cellUnitId);
        } else {
          this.rotateSelectedUnit();
        }
        return;
      }

      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        this.handleGridClick(gx, gy);
      }
    });

    // 2. Left Panel: Fleet Unit Roster Tray
    const trayBg = this.add.rectangle(190, 368, 336, 540, 0x07172b, 0.94);
    trayBg.setStrokeStyle(2, 0x00bbf9, 0.7);

    this.add.text(190, 118, 'DANH SÁCH ĐƠN VỊ (CLICK 🔄 ĐỂ XOAY)', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#00BBF9'
    }).setOrigin(0.5);

    this.unitListContainer = this.add.container(0, 0);
    this.buildUnitRosterUI();

    // 3. Right Panel: Commander Card, Deployment Skill & Action Buttons
    const rightX = 1095;
    const rightBg = this.add.rectangle(rightX, 368, 320, 540, 0x07172b, 0.94);
    rightBg.setStrokeStyle(2, this.commander.hexColor, 0.75);

    createCommanderBadge(this, rightX - 95, 162, 82, this.commander);

    this.add.text(rightX - 42, 126, this.commander.name.toUpperCase(), {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '18px',
      fontStyle: '700',
      color: '#FFFFFF'
    });

    this.add.text(rightX - 42, 150, this.commander.title, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: '#94A3B8'
    });

    this.add.text(rightX - 42, 172, `⚡ ${this.commander.skillName}`, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '14px',
      fontStyle: '700',
      color: this.commander.accentColor
    });

    this.add.text(rightX, 232, this.commander.description, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '12px',
      color: '#E2F1FF',
      align: 'center',
      wordWrap: { width: 290 }
    }).setOrigin(0.5);

    // Deployment Skill Button (Active for Kael Vance SPLITTER & Vespera Noctis PHANTOM)
    const isDeploySkill = this.commander.id === 'SPLITTER' || this.commander.id === 'PHANTOM';
    const deploySkillLabel =
      this.commander.id === 'SPLITTER'
        ? '✂️ KÍCH HOẠT: PHÂN TÁCH ĐƠN VỊ'
        : this.commander.id === 'PHANTOM'
          ? '👻 KÍCH HOẠT: THÊM THUYỀN MA (+3 Ô)'
          : `⚡ KỸ NĂNG: ${this.commander.skillName.toUpperCase()}`;

    const deploySkillSub =
      this.commander.id === 'SPLITTER'
        ? 'Tách đơn vị đang chọn (>1 ô) thành 2 tàu nhỏ'
        : this.commander.id === 'PHANTOM'
          ? 'Triệu hồi thêm 1 Thuyền Ma 3 ô làm mồi nhử'
          : 'Kỹ năng này sẽ kích hoạt chủ động trong trận đấu';

    this.deploySkillBtn = createTacticalButton(
      this,
      rightX,
      298,
      288,
      52,
      deploySkillLabel,
      () => this.activateDeploymentSkill(),
      {
        primaryColor: this.commander.hexColor,
        fontSize: '13.5px',
        subLabel: deploySkillSub,
        disabled: !isDeploySkill
      }
    );

    // Prominent Rotate Button (rotates both unplaced preview AND already-placed selected unit!)
    this.rotateBtn = createTacticalButton(
      this,
      rightX,
      368,
      288,
      52,
      '🔄 XOAY ĐƠN VỊ ĐANG CHỌN (R / SPACE)',
      () => this.rotateSelectedUnit(),
      {
        primaryColor: 0x00bbf9,
        fontSize: '14px',
        subLabel: 'Đang đặt: NGANG (━) -> Nhấn để đổi sang DỌC (┃)'
      }
    );

    createTacticalButton(
      this,
      rightX - 74,
      432,
      140,
      44,
      '🎲 XẾP NGẪU NHIÊN',
      () => {
        SoundFX.playClick(640);
        autoPlaceFleet(this.board, true);
        this.selectNextUnplacedUnit();
        this.updateOrientationLabels();
        this.updateUnitRosterUI();
        this.redrawBoard();
      },
      { primaryColor: 0xffe66d, fontSize: '13px' }
    );

    createTacticalButton(
      this,
      rightX + 74,
      432,
      140,
      44,
      '🗑️ ĐẶT LẠI HẾT',
      () => {
        SoundFX.playClick(420);
        clearAllPlacements(this.board);
        this.selectedUnitId = this.board.units[0].id;
        this.updateOrientationLabels();
        this.updateUnitRosterUI();
        this.redrawBoard();
      },
      { primaryColor: 0xff6b35, fontSize: '13px' }
    );

    this.statusToast = this.add.text(
      rightX,
      492,
      'Mẹo: Nhấn R, Phím Cách (Space) hoặc Chuột Phải để xoay tàu bất kỳ lúc nào!',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11.5px',
        color: '#7DD3FC',
        align: 'center',
        wordWrap: { width: 290 }
      }
    ).setOrigin(0.5);

    this.readyBtn = createTacticalButton(
      this,
      rightX,
      570,
      288,
      64,
      '⚔️ SẴN SÀNG XUẤT KÍCH',
      () => this.confirmDeployment(),
      {
        primaryColor: 0x00f5d4,
        fontSize: '18px',
        subLabel: 'Đặt đủ toàn bộ đơn vị để bắt đầu',
        disabled: true
      }
    );

    // Keyboard shortcuts R and SPACE to rotate
    this.input.keyboard.on('keydown-R', () => {
      if (!this.waitingOnlineOpponent) {
        this.rotateSelectedUnit();
      }
    });
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.waitingOnlineOpponent) {
        this.rotateSelectedUnit();
      }
    });

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      this.setupOnlineListeners();
    }

    this.updateOrientationLabels();
    this.redrawBoard();
  }

  updateOrientationLabels() {
    const oriLabel = this.currentOrientation === 'H' ? 'NGANG (━)' : 'DỌC (┃)';
    const nextLabel = this.currentOrientation === 'H' ? 'DỌC (┃)' : 'NGANG (━)';
    if (this.orientationBadgeText) {
      this.orientationBadgeText.setText(
        `🔄 HƯỚNG ĐẶT HIỆN TẠI: ${oriLabel}  |  Nhấn [R] / [SPACE] / Chuột Phải để Xoay`
      );
    }
    if (this.rotateBtn) {
      this.rotateBtn.setLabel(
        '🔄 XOAY ĐƠN VỊ ĐANG CHỌN (R / SPACE)',
        `Hướng hiện tại: ${oriLabel} -> Nhấn để đổi sang ${nextLabel}`
      );
    }
  }

  /**
   * Rotates a specific unit by ID (works whether the unit is already placed on the grid or unplaced!)
   */
  rotateUnitById(unitId) {
    const unit = this.board.units.find((u) => u.id === unitId);
    if (!unit) return;

    if (!unit.rotatable) {
      SoundFX.playClick(450);
      this.statusToast.setText(`ℹ️ [${unit.name}] có hình chữ thập (+) đối xứng 4 hướng nên không cần xoay.`);
      return;
    }

    const targetOri = (unit.placed ? unit.orientation : this.currentOrientation) === 'H' ? 'V' : 'H';
    this.currentOrientation = targetOri;

    if (unit.placed) {
      const oldX = unit.anchorX;
      const oldY = unit.anchorY;

      // Try rotating directly at current anchor, or nudging nearby if near board edge
      const candidateOffsets = [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: -2, dy: 0 },
        { dx: 0, dy: -2 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -3, dy: 0 },
        { dx: 0, dy: -3 },
        { dx: -4, dy: 0 },
        { dx: 0, dy: -4 }
      ];

      let rotatedInPlace = false;
      for (const off of candidateOffsets) {
        const nx = oldX + off.dx;
        const ny = oldY + off.dy;
        if (canPlaceUnit(this.board, unit, nx, ny, targetOri, { ignoreUnitId: unit.id })) {
          placeUnitOnGrid(this.board, unit.id, nx, ny, targetOri);
          rotatedInPlace = true;
          break;
        }
      }

      if (rotatedInPlace) {
        SoundFX.playClick(760);
        this.statusToast.setText(
          `🔄 Đã xoay [${unit.name}] sang hướng ${targetOri === 'H' ? 'NGANG (━)' : 'DỌC (┃)'}!`
        );
      } else {
        // Pick up unit in the new orientation so player can place it freely
        removeUnitFromGrid(this.board, unit.id);
        SoundFX.playClick(600);
        this.statusToast.setText(
          `🔄 Đã xoay [${unit.name}] sang hướng ${targetOri === 'H' ? 'NGANG' : 'DỌC'} — Hãy chọn vị trí đặt mới!`
        );
      }
    } else {
      SoundFX.playClick(680);
      this.statusToast.setText(
        `🔄 Đã chuyển hướng đặt [${unit.name}] sang ${targetOri === 'H' ? 'NGANG (━)' : 'DỌC (┃)'}.`
      );
    }

    this.updateOrientationLabels();
    this.updateUnitRosterUI();
    this.redrawBoard();
  }

  rotateSelectedUnit() {
    this.rotateUnitById(this.selectedUnitId);
  }

  buildUnitRosterUI() {
    this.unitListContainer.removeAll(true);
    this.rosterRows = new Map();

    const startY = 160;
    const rowH = 54;

    this.board.units.forEach((unit, idx) => {
      const y = startY + idx * rowH;
      const isSelected = unit.id === this.selectedUnitId;

      const rowContainer = this.add.container(190, y);

      // Left clickable body for selecting the unit (no overlap with rotate button)
      const bg = this.add.rectangle(-36, 0, 236, 46, isSelected ? 0x13355e : 0x0a1c34, 0.95);
      const borderCol = isSelected ? 0xffe66d : unit.placed ? 0x00f5d4 : 0x334155;
      bg.setStrokeStyle(isSelected ? 2.5 : 1.5, borderCol, 1);
      bg.setInteractive({ useHandCursor: true });

      const statusIcon = unit.placed ? '✔' : '○';
      const oriTag = unit.rotatable
        ? (unit.placed ? unit.orientation : isSelected ? this.currentOrientation : 'H') === 'V'
          ? '[DỌC ┃]'
          : '[NGANG ━]'
        : '[DẤU +]';

      const nameLabel = this.add.text(-144, -9, `${statusIcon} ${unit.name}`, {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '13.5px',
        fontStyle: '700',
        color: unit.placed ? '#00F5D4' : '#FFFFFF'
      });

      const subLabel = this.add.text(-144, 8, `${unit.size} ô • ${oriTag}`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10.5px',
        color: unit.isDecoy ? '#C77DFF' : '#94A3B8'
      });

      rowContainer.add([bg, nameLabel, subLabel]);

      let rotBtnBg = null;
      let rotBtnTxt = null;

      // Dedicated per-unit Rotate button [🔄 XOAY] on rotatable units (placed at x: 112, non-overlapping)
      if (unit.rotatable) {
        rotBtnBg = this.add.rectangle(112, 0, 60, 36, 0x0e2a4c, 1);
        rotBtnBg.setStrokeStyle(1.5, 0x00bbf9, 0.9);
        rotBtnBg.setInteractive({ useHandCursor: true });

        rotBtnTxt = this.add.text(112, 0, '🔄 XOAY', {
          fontFamily: '"Chakra Petch", sans-serif',
          fontSize: '11px',
          fontStyle: '700',
          color: '#FFE66D'
        }).setOrigin(0.5);

        rotBtnBg.on('pointerdown', (pointer) => {
          if (pointer && pointer.button !== 0) return;
          if (this.waitingOnlineOpponent) return;
          this.selectedUnitId = unit.id;
          this.rotateUnitById(unit.id);
        });

        rowContainer.add([rotBtnBg, rotBtnTxt]);
      } else {
        const fixedTxt = this.add.text(112, 0, 'CỐ ĐỊNH', {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10px',
          color: '#64748B'
        }).setOrigin(0.5);
        rowContainer.add(fixedTxt);
      }

      bg.on('pointerdown', (pointer) => {
        if (pointer && pointer.button !== 0) return;
        if (this.waitingOnlineOpponent) return;
        SoundFX.playClick(620);
        if (this.selectedUnitId === unit.id && unit.rotatable) {
          this.rotateUnitById(unit.id);
          return;
        }
        this.selectedUnitId = unit.id;
        if (unit.placed) {
          this.currentOrientation = unit.orientation || 'H';
        }
        this.updateOrientationLabels();
        this.updateUnitRosterUI();
        this.redrawBoard();
      });

      this.unitListContainer.add(rowContainer);

      this.rosterRows.set(unit.id, {
        bg,
        nameLabel,
        subLabel,
        rotBtnBg,
        rotBtnTxt
      });
    });
  }

  updateUnitRosterUI() {
    if (!this.rosterRows) {
      this.buildUnitRosterUI();
      return;
    }

    this.board.units.forEach((unit) => {
      const row = this.rosterRows.get(unit.id);
      if (!row) return;

      const isSelected = unit.id === this.selectedUnitId;
      const borderCol = isSelected ? 0xffe66d : unit.placed ? 0x00f5d4 : 0x334155;

      row.bg.setFillStyle(isSelected ? 0x13355e : 0x0a1c34, 0.95);
      row.bg.setStrokeStyle(isSelected ? 2.5 : 1.5, borderCol, 1);

      const statusIcon = unit.placed ? '✔' : '○';
      const oriTag = unit.rotatable
        ? (unit.placed ? unit.orientation : isSelected ? this.currentOrientation : 'H') === 'V'
          ? '[DỌC ┃]'
          : '[NGANG ━]'
        : '[DẤU +]';

      row.nameLabel.setText(`${statusIcon} ${unit.name}`);
      row.nameLabel.setColor(unit.placed ? '#00F5D4' : '#FFFFFF');

      row.subLabel.setText(`${unit.size} ô • ${oriTag}`);
      row.subLabel.setColor(unit.isDecoy ? '#C77DFF' : '#94A3B8');

      if (row.rotBtnBg) {
        row.rotBtnBg.setStrokeStyle(1.5, isSelected ? 0xffe66d : 0x00bbf9, 0.9);
      }
    });
  }

  handleGridClick(gx, gy) {
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return;

    const selectedUnit = this.board.units.find((u) => u.id === this.selectedUnitId);
    const cellUnitId = this.board.cells[gy][gx].unitId;

    // If clicking an already placed unit on the board:
    // - If it's the currently selected unit AND already placed, pick it up so user can move or rotate it
    // - If it's a different unit while our current unit is already placed, pick up that clicked unit
    if (cellUnitId && (!selectedUnit || selectedUnit.placed)) {
      const clickedUnit = this.board.units.find((u) => u.id === cellUnitId);
      if (clickedUnit) {
        this.selectedUnitId = clickedUnit.id;
        this.currentOrientation = clickedUnit.orientation || 'H';
        removeUnitFromGrid(this.board, clickedUnit.id);
        SoundFX.playClick(520);
        this.statusToast.setText(
          `Đã nhấc [${clickedUnit.name}] lên (Nhấn R để xoay hoặc click ô mới để đặt).`
        );
        this.updateOrientationLabels();
        this.updateUnitRosterUI();
        this.redrawBoard();
        return;
      }
    }

    if (!selectedUnit) return;

    const ok = placeUnitOnGrid(this.board, selectedUnit.id, gx, gy, this.currentOrientation);
    if (ok) {
      SoundFX.playClick(820);
      this.statusToast.setText(
        `✔ Đã đặt [${selectedUnit.name}] (${this.currentOrientation === 'H' ? 'Ngang' : 'Dọc'}) tại (${gx + 1}, ${gy + 1}).`
      );
      this.selectNextUnplacedUnit();
      this.updateOrientationLabels();
      this.updateUnitRosterUI();
      this.redrawBoard();
    } else {
      SoundFX.playExplosion(false);
      this.statusToast.setText('❌ Vị trí không hợp lệ (Tràn biên hoặc đè lên đơn vị khác)!');
    }
  }

  selectNextUnplacedUnit() {
    const nextUnplaced = this.board.units.find((u) => !u.placed);
    if (nextUnplaced) {
      this.selectedUnitId = nextUnplaced.id;
    }
  }

  activateDeploymentSkill() {
    if (this.board.skillUsed) return;

    if (this.commander.id === 'SPLITTER') {
      const targetId = this.selectedUnitId || 'carrier';
      const res = useSplitterSkill(this.board, targetId);
      if (!res.valid) {
        SoundFX.playExplosion(false);
        this.statusToast.setText(`❌ ${res.reason}`);
        return;
      }
      SoundFX.playSkillActivate();
      this.selectedUnitId = res.createdUnits[0].id;
      this.deploySkillBtn.setDisabled(true);
      this.deploySkillBtn.setLabel(
        '✔ ĐÃ KÍCH HOẠT PHÂN TÁCH',
        `Đã tách thành ${res.createdUnits[0].name} & ${res.createdUnits[1].name}`
      );
      this.statusToast.setText('✂️ Đã phân tách đơn vị thành 2 tàu nhỏ độc lập!');
      this.buildUnitRosterUI();
      this.redrawBoard();
    } else if (this.commander.id === 'PHANTOM') {
      const res = usePhantomSkill(this.board, false);
      if (!res.valid) {
        SoundFX.playExplosion(false);
        this.statusToast.setText(`❌ ${res.reason}`);
        return;
      }
      SoundFX.playSkillActivate();
      this.selectedUnitId = res.phantomUnit.id;
      this.deploySkillBtn.setDisabled(true);
      this.deploySkillBtn.setLabel('✔ ĐÃ TRIỆU HỒI THUYỀN MA', 'Hãy đặt Thuyền Ma (3 ô) lên bản đồ');
      this.statusToast.setText('👻 Đã thêm Thuyền Ma (3 ô) vào khay đơn vị!');
      this.buildUnitRosterUI();
      this.redrawBoard();
    }
  }

  redrawBoard() {
    this.placedGraphics.clear();
    this.previewGraphics.clear();

    // Draw all placed units using 2.5D sprites (with golden highlight for selected unit)
    renderIsoUnitSprites(
      this,
      this.isoUnitRig,
      this.board.units,
      this.boardSpec,
      {
        selectedUnitId: this.selectedUnitId,
        fallbackGraphics: this.placedGraphics
      }
    );

    // Draw Ghost Hover Preview for currently selected unit
    const selectedUnit = this.board.units.find((u) => u.id === this.selectedUnitId);
    if (selectedUnit && this.hoverCell && !this.waitingOnlineOpponent) {
      const valid = canPlaceUnit(
        this.board,
        selectedUnit,
        this.hoverCell.x,
        this.hoverCell.y,
        this.currentOrientation,
        { ignoreUnitId: selectedUnit.id }
      );
      const previewCells = getUnitCells(
        selectedUnit,
        this.hoverCell.x,
        this.hoverCell.y,
        this.currentOrientation
      );
      const col = valid ? 0x00f5d4 : 0xff2a54;

      for (const pt of previewCells) {
        if (pt.x >= 0 && pt.x < GRID_SIZE && pt.y >= 0 && pt.y < GRID_SIZE) {
          drawIsoCellDiamond(this.previewGraphics, pt.x, pt.y, this.boardSpec, col, 0.34, col, 0.92, 2, 0.06);
        }
      }
    }

    const allReady = areAllUnitsPlaced(this.board);
    if (!this.waitingOnlineOpponent) {
      this.readyBtn.setDisabled(!allReady);
      if (allReady) {
        this.readyBtn.setLabel('⚔️ SẴN SÀNG XUẤT KÍCH', 'Toàn bộ đội hình đã vào vị trí chiến đấu!');
      } else {
        const remaining = this.board.units.filter((u) => !u.placed).length;
        this.readyBtn.setLabel('⚔️ SẴN SÀNG XUẤT KÍCH', `Còn ${remaining} đơn vị chưa đặt lên bản đồ`);
      }
    }
  }

  setupOnlineListeners() {
    NetClient.clearListeners();

    NetClient.on('OPPONENT_FLEET_READY', () => {
      SoundFX.playSonarPing();
      this.statusToast.setText('🔔 Đối phương đã xếp xong đội hình! Đang chờ bạn...');
    });

    NetClient.on('BATTLE_START', (payload) => {
      SoundFX.playSkillActivate();
      NetClient.clearListeners();
      this.scene.start('BattleScene', {
        mode: GAME_MODES.ONLINE_PVP,
        roomCode: this.roomCode,
        playerIndex: payload.playerIndex,
        currentTurn: payload.currentTurn,
        p1Board: payload.myBoard,
        p2Board: payload.enemyBoard
      });
    });

    NetClient.on('OPPONENT_LEFT', ({ message }) => {
      alert(message || 'Đối phương đã thoát trận.');
      this.scene.start('MenuScene');
    });
  }

  confirmDeployment() {
    if (!areAllUnitsPlaced(this.board)) return;
    SoundFX.playSkillActivate();

    if (this.mode === GAME_MODES.LOCAL_PVP) {
      if (this.deployingPlayer === 1) {
        this.scene.restart({
          mode: GAME_MODES.LOCAL_PVP,
          deployingPlayer: 2,
          p1CommanderId: this.p1CommanderId,
          p2CommanderId: this.p2CommanderId,
          p1SavedBoard: this.board
        });
      } else {
        this.scene.start('BattleScene', {
          mode: GAME_MODES.LOCAL_PVP,
          p1Board: this.p1SavedBoard,
          p2Board: this.board,
          currentTurn: 0
        });
      }
      return;
    }

    if (this.mode === GAME_MODES.ONLINE_PVP) {
      this.waitingOnlineOpponent = true;
      this.readyBtn.setDisabled(true);
      this.readyBtn.setLabel('⏳ ĐANG CHỜ ĐỐI THỦ...', 'Đã gửi đội hình lên Máy chủ');
      this.statusToast.setText('Đang chờ đối phương hoàn tất thiết kế đội hình...');
      NetClient.send('SUBMIT_FLEET', { board: this.board });
      return;
    }

    // PVE_AI mode
    const aiBoard = setupAIBoard();
    this.scene.start('BattleScene', {
      mode: GAME_MODES.PVE_AI,
      p1Board: this.board,
      p2Board: aiBoard,
      currentTurn: 0
    });
  }
}
