/**
 * Core Game Constants for Another Battle
 * Shared between Client (Phaser 3) and Server (WebSocket Online PvP)
 */

export const GRID_SIZE = 10;
export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const ROW_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const TOTAL_BASE_CELLS = 22;

export const GAME_MODES = {
  ONLINE_PVP: 'ONLINE_PVP',
  LOCAL_PVP: 'LOCAL_PVP',
  PVE_AI: 'PVE_AI'
};

/**
 * 6 Base Units totaling 22 cells per side:
 * - 1 Command Base (cross '+', 5 cells)
 * - 1 Aircraft Carrier (5 cells)
 * - 1 Battleship (4 cells)
 * - 2 Cruisers (3 cells x 2 = 6 cells)
 * - 1 Scout Ship (2 cells)
 */
export const UNIT_TEMPLATES = [
  {
    id: 'command_base',
    type: 'base',
    name: 'Căn Cứ Chỉ Huy',
    shortName: 'Căn Cứ (+)',
    size: 5,
    rotatable: false,
    shape: [
      { dx: 0, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }
    ],
    color: 0x00f5d4,
    description: 'Hình chữ thập (+) 5 ô kiên cố'
  },
  {
    id: 'carrier',
    type: 'ship',
    name: 'Tàu Sân Bay',
    shortName: 'Tàu Sân Bay',
    size: 5,
    rotatable: true,
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 3, dy: 0 },
      { dx: 4, dy: 0 }
    ],
    color: 0x00bbf9,
    description: 'Soái hạm dài 5 ô'
  },
  {
    id: 'battleship',
    type: 'ship',
    name: 'Thiết Giáp Hạm',
    shortName: 'Thiết Giáp',
    size: 4,
    rotatable: true,
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 3, dy: 0 }
    ],
    color: 0x4ea8de,
    description: 'Chiến hạm hạng nặng 4 ô'
  },
  {
    id: 'cruiser_1',
    type: 'ship',
    name: 'Tàu Tuần Dương Alpha',
    shortName: 'Tuần Dương α',
    size: 3,
    rotatable: true,
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 }
    ],
    color: 0x48bfe3,
    description: 'Tàu tuần dương 3 ô'
  },
  {
    id: 'cruiser_2',
    type: 'ship',
    name: 'Tàu Tuần Dương Bravo',
    shortName: 'Tuần Dương β',
    size: 3,
    rotatable: true,
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 }
    ],
    color: 0x56cfe1,
    description: 'Tàu tuần dương 3 ô'
  },
  {
    id: 'scout',
    type: 'ship',
    name: 'Tàu Do Thám',
    shortName: 'Tàu Do Thám',
    size: 2,
    rotatable: true,
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 }
    ],
    color: 0x64dfdf,
    description: 'Tàu trinh sát cơ động 2 ô'
  }
];

export const PHANTOM_SHIP_TEMPLATE = {
  id: 'phantom_decoy',
  type: 'decoy',
  name: 'Thuyền Ma (Mồi Nhử)',
  shortName: 'Thuyền Ma',
  size: 3,
  rotatable: true,
  isDecoy: true,
  shape: [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 2, dy: 0 }
  ],
  color: 0xc77dff,
  description: 'Mồi nhử 3 ô đánh lừa radar địch'
};

export const AMMO_TYPES = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Đạn Thường (1x1)',
    shortName: 'Đạn 1x1',
    infinite: true,
    maxCharges: Infinity,
    radius: 0,
    color: '#00F5D4',
    hexColor: 0x00f5d4,
    description: 'Bắn 1 ô mục tiêu chỉ định. Không giới hạn số lần.'
  },
  CLUSTER: {
    id: 'CLUSTER',
    name: 'Đạn Chùm (3x3)',
    shortName: 'Đạn Chùm 3x3',
    infinite: false,
    maxCharges: 1,
    radius: 1,
    color: '#FF6B35',
    hexColor: 0xff6b35,
    description: 'Pháo kích toàn bộ vùng 3x3 (9 ô). Dùng 1 lần/trận.'
  },
  RICOCHET: {
    id: 'RICOCHET',
    name: 'Đạn Nảy (+2 Ô)',
    shortName: 'Đạn Nảy +2',
    infinite: false,
    maxCharges: 1,
    bounceCount: 2,
    color: '#FFE66D',
    hexColor: 0xffe66d,
    description: 'Bắn 1 ô chính và tự nảy ngẫu nhiên thêm 2 ô chưa bắn. Dùng 1 lần/trận.'
  }
};

export const COMMANDERS = {
  SPLITTER: {
    id: 'SPLITTER',
    name: 'Kael Vance',
    title: 'Kiến Trúc Sư Hạm Đội',
    skillName: 'Phân Tách',
    phase: 'DEPLOY',
    phaseLabel: 'Kỹ năng Dàn Trận',
    portraitKey: 'cmd_kael_vance',
    portraitAsset: 'assets/commanders/kael_vance.png',
    accentColor: '#00B4D8',
    hexColor: 0x00b4d8,
    quote: '"Chia nhỏ đội hình, nhân đôi bất ngờ chiến thuật!"',
    description: 'Chia 1 đơn vị lớn (> 1 ô) thành 2 đơn vị nhỏ hơn độc lập khi thiết kế đội hình.'
  },
  PHANTOM: {
    id: 'PHANTOM',
    name: 'Vespera Noctis',
    title: 'Bóng Ma Biển Sâu',
    skillName: 'Thuyền Ma',
    phase: 'DEPLOY',
    phaseLabel: 'Kỹ năng Dàn Trận',
    portraitKey: 'cmd_vespera_noctis',
    portraitAsset: 'assets/commanders/vespera_noctis.png',
    accentColor: '#C77DFF',
    hexColor: 0xc77dff,
    quote: '"Thứ chúng thấy trên radar chỉ là cái bóng của tử thần."',
    description: 'Thêm 1 Thuyền Ma dài 3 ô làm mồi nhử. Khi bị bắn vẫn báo TRÚNG cho tới khi cả 3 ô bị hạ.'
  },
  EVACUATOR: {
    id: 'EVACUATOR',
    name: 'Akira Sato',
    title: 'Bậc Thầy Cơ Động',
    skillName: 'Di Tản',
    phase: 'BATTLE',
    phaseLabel: 'Chủ Động Trong Trận',
    portraitKey: 'cmd_akira_sato',
    portraitAsset: 'assets/commanders/akira_sato.png',
    accentColor: '#00F5D4',
    hexColor: 0x00f5d4,
    quote: '"Không kẻ địch nào khóa được tọa độ của hạm đội ta!"',
    description: 'Di dời 1 đơn vị chưa bị bắn trúng sang vị trí mới chưa bị pháo kích ngay trong trận.'
  },
  SONAR: {
    id: 'SONAR',
    name: 'Lyra Chen',
    title: 'Mắt Thần Sonar',
    skillName: 'Đạn Dò Tìm',
    phase: 'BATTLE',
    phaseLabel: 'Chủ Động Trong Trận',
    portraitKey: 'cmd_lyra_chen',
    portraitAsset: 'assets/commanders/lyra_chen.png',
    accentColor: '#FFE66D',
    hexColor: 0xffe66d,
    quote: '"Sóng âm đã khóa mục tiêu. Khai hỏa chính xác!"',
    description: 'Bắn 1 phát đạn dò tìm phát hiện mọi ô có đơn vị địch trong vùng 3x3 mà không mất lượt bắn.'
  },
  FOG: {
    id: 'FOG',
    name: 'Viktor Krane',
    title: 'Bóng Đêm Bắc Cực',
    skillName: 'Sương Mù',
    phase: 'BATTLE',
    phaseLabel: 'Chủ Động Trong Trận',
    portraitKey: 'cmd_viktor_krane',
    portraitAsset: 'assets/commanders/viktor_krane.png',
    accentColor: '#94A3B8',
    hexColor: 0x94a3b8,
    quote: '"Giữa màn sương Bắc Cực, pháo binh của chúng chỉ là kẻ mù."',
    description: 'Tạo màn khói dày đặc che phủ bản đồ quan sát của đối phương trong 2 lượt liên tiếp.'
  }
};

export const COMMANDER_LIST = Object.values(COMMANDERS);

