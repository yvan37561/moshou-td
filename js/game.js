/**
 * 《山海机关录：墨守》国风赛璐璐厚涂引擎 v8.0
 * 核心美术准则：
 * 1. 统一深墨褐外轮廓 (#1c1714, 3.5px 圆角连接) + 内部温润厚涂明暗色块，彻底告别细碎简笔画与浮夸霓虹灯。
 * 2. 严格实装玩家锁定的 4 大设计方案：
 *    - 聚灵烘炉：方案 A（司母戊·四足龙耳方鼎）
 *    - 震天埋雷：方案 C（天工开物·十二刺铁壳引信雷）
 *    - 寒霜方士：方案 D（玄冥拜月祭司·残月飞剑）
 *    - 神火飞鸦：方案 D（大荒毕方·青红流火神鸟）
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tooltipEl = document.getElementById('tooltip');

const ROWS = 5, COLS = 9;
const CELL_W = 96, CELL_H = 92;
const BOARD_X = 136, BOARD_Y = 44;

const INK = '#1c1714'; // 统一深墨褐轮廓色

const UNIT_CATALOG = [
  { id: 'furnace', name: '聚灵烘炉', role: '经济', cost: 50, cd: 4500, hp: 320, desc: '【司母戊·龙耳鼎】每16秒产出25灵气；周围3x3机关攻速+15%。' },
  { id: 'crossbow', name: '诸葛连弩', role: '连射', cost: 100, cd: 4000, hp: 320, desc: '【檀木青铜床弩】发射破甲重箭，每4次射击必定触发双连射。' },
  { id: 'shield', name: '玄武重盾', role: '肉盾', cost: 75, cd: 9000, hp: 3500, desc: '【包铜玄武门盾】厚重前排防线，阻挡魇魔并反弹近战伤害。' },
  { id: 'landmine', name: '震天埋雷', role: '陷阱', cost: 25, cd: 10000, hp: 260, desc: '【十二刺铁壳雷】旋紧引信后激活，对踩中魇魔造成1500范围爆炸。' },
  { id: 'taotie', name: '吞天饕餮', role: '吞噬', cost: 150, cd: 8500, hp: 480, desc: '【虎食人卣机关】一口吞下前方单体魇魔，炼化后吐出25灵气。' },
  { id: 'frost_mage', name: '寒霜方士', role: '冰控', cost: 175, cd: 5500, hp: 320, desc: '【拜月玄冥祭司】御使冰剑减速敌人40%，概率触发冰封。' },
  { id: 'pear_blossom', name: '暴雨梨花', role: '三行', cost: 225, cd: 7500, hp: 360, desc: '【三联重型排弩】每次击发同时覆盖本行及上下相邻共3行。' },
  { id: 'fire_crow', name: '神火飞鸦', role: '轰炸', cost: 150, cd: 15000, hp: 9999, desc: '【大荒毕方神鸟】掠过整行降下流火，造成1200贯穿伤害。' }
];

const ROGUE_BUFFS = [
  { id: 'thunder_bow', tag: '天工改造', title: '【雷公连弩】', desc: '诸葛连弩与暴雨梨花附带雷电链，弹射周围敌人且伤害+35%。' },
  { id: 'lava_shield', tag: '天工改造', title: '【熔岩玄武】', desc: '玄武重盾散发烈焰，每秒灼烧前方敌人60点生命且反伤翻倍。' },
  { id: 'gold_furnace', tag: '天工改造', title: '【烈阳金乌炉】', desc: '聚灵烘炉产灵加快30%，且每次产灵自动发射3枚追踪阳炎弹。' },
  { id: 'fast_taotie', tag: '天工改造', title: '【暴食吞天兽】', desc: '吞天饕餮炼化时间减半，消化期获60%减伤且吐出50灵气。' },
  { id: 'mine_shrapnel', tag: '墨家奇术', title: '【草木皆兵】', desc: '鲁班钳拆解返还提至75%，且拆解瞬间在原地引发800伤害爆破。' }
];

let state = {
  qi: 200,
  wave: 1,
  maxWave: 10,
  energy: 50,
  selectedCard: null,
  shovelMode: false,
  hoverCell: { r: -1, c: -1 },
  overloadTimer: 0,
  screenShake: 0,
  paused: false,
  activeBuffs: new Set(),
  elementalTiles: {},
  towers: [],
  enemies: [],
  bullets: [],
  lightningArcs: [],
  gears: [],
  particles: [],
  lions: [
    { active: true, running: false, x: 70 },
    { active: true, running: false, x: 70 },
    { active: true, running: false, x: 70 },
    { active: true, running: false, x: 70 },
    { active: true, running: false, x: 70 }
  ],
  cardCooldowns: {},
  bossSpawned: false
};

// ==============================================================
// 一、 赛璐璐厚涂绘制工具函数 (Cel-Shaded Art Engine)
// ==============================================================
const CelArt = {
  // 绘制带统一深色墨线描边与填充的厚涂块面
  fillAndInk(ctx, fillStyle, lineWidth = 3.2) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
  },

  // 温润青石圆盘底座
  drawStonePlinth(ctx, r = 32) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 14, r + 3, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 10, r, r * 0.45, 0, 0, Math.PI * 2);
    this.fillAndInk(ctx, '#384349', 3);

    ctx.beginPath();
    ctx.ellipse(0, 7, r * 0.86, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a575e';
    ctx.fill();
    ctx.restore();
  },

  // 1. 绘制 8 大墨家机关（严格采用玩家钦定造型 + 赛璐璐厚涂上色）
  drawTower(ctx, id, time = 0, opts = {}) {
    const { armed = true, digesting = false, hasThunder = false, hasLava = false } = opts;
    ctx.save();

    if (id !== 'landmine' && id !== 'fire_crow') {
      this.drawStonePlinth(ctx, 31);
    }

    switch (id) {
      case 'furnace': {
        // 【方案 A：司母戊·龙耳青铜方鼎】
        // 四足
        [-18, -6, 6, 18].forEach(lx => {
          ctx.beginPath();
          ctx.roundRect(lx - 3.5, 0, 7, 13, 2);
          this.fillAndInk(ctx, '#7a6236', 2.8);
        });
        // 双龙立耳
        [-22, 16].forEach(ex => {
          ctx.beginPath();
          ctx.roundRect(ex, -22, 6, 14, 3);
          this.fillAndInk(ctx, '#c8a65a', 2.8);
        });
        // 厚重方鼎炉身
        ctx.beginPath();
        ctx.roundRect(-21, -16, 42, 20, 4);
        this.fillAndInk(ctx, '#3c6358', 3.4);
        // 鼎腹暗部体积块与金色回纹带
        ctx.fillStyle = '#2b4a41';
        ctx.fillRect(-19, -4, 38, 7);
        ctx.fillStyle = '#d4b263';
        ctx.fillRect(-16, -11, 32, 4);

        // 温润三昧丹火
        const fh = 14 + Math.sin(time * 0.12) * 3;
        ctx.beginPath();
        ctx.moveTo(-12, -16);
        ctx.quadraticCurveTo(-6, -16 - fh, 0, -20 - fh);
        ctx.quadraticCurveTo(6, -16 - fh, 12, -16);
        ctx.closePath();
        this.fillAndInk(ctx, '#e86f2c', 2.5);

        ctx.beginPath();
        ctx.moveTo(-6, -16);
        ctx.quadraticCurveTo(0, -14 - fh * 0.7, 6, -16);
        ctx.fillStyle = '#f7d060';
        ctx.fill();
        break;
      }

      case 'landmine': {
        // 【方案 C：天工开物·十二刺铁壳地火雷】
        ctx.save();
        if (!armed) ctx.globalAlpha = 0.65;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 26, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 外圈破甲狼牙铁刺
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + (armed ? time * 0.015 : 0);
          const x1 = Math.cos(a) * 14, y1 = Math.sin(a) * 10 + 2;
          const x2 = Math.cos(a) * 24, y2 = Math.sin(a) * 17 + 2;
          ctx.beginPath();
          ctx.moveTo(x1 - 3, y1); ctx.lineTo(x2, y2); ctx.lineTo(x1 + 3, y1);
          ctx.closePath();
          this.fillAndInk(ctx, '#9aa5ab', 2.2);
        }

        // 铸铁圆球雷体
        ctx.beginPath();
        ctx.arc(0, 2, 16, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#37434a', 3.2);

        // 顶部高光受光面與引信火花
        ctx.fillStyle = '#52626b';
        ctx.beginPath();
        ctx.arc(-4, -3, 7, 0, Math.PI * 2);
        ctx.fill();

        // 引线与火花
        ctx.strokeStyle = '#c8a65a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -14); ctx.quadraticCurveTo(8, -24, 14, -18);
        ctx.stroke();

        if (armed) {
          ctx.fillStyle = '#f56c42';
          ctx.beginPath();
          ctx.arc(14, -18, 4 + (Math.sin(time * 0.25) + 1) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case 'frost_mage': {
        // 【方案 D：昆仑玄冥拜月祭司】
        const floatY = Math.sin(time * 0.08) * 2.5;
        // 背后幽蓝残月法轮
        ctx.save();
        ctx.translate(0, -12 + floatY);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#4ea8bd', 2.8);
        ctx.beginPath();
        ctx.arc(6, -3, 17, 0, Math.PI * 2);
        ctx.fillStyle = '#253137';
        ctx.fill();

        // 悬浮的三柄玄冰飞剑
        [-28, 0, 28].forEach(deg => {
          ctx.save();
          ctx.rotate((deg * Math.PI) / 180);
          ctx.beginPath();
          ctx.moveTo(0, -32); ctx.lineTo(4, -22); ctx.lineTo(0, -15); ctx.lineTo(-4, -22);
          ctx.closePath();
          this.fillAndInk(ctx, '#a8e1ed', 2);
          ctx.restore();
        });
        ctx.restore();

        // 祭司修长深蓝道袍与广袖
        ctx.beginPath();
        ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(14, 12); ctx.lineTo(-14, 12);
        ctx.closePath();
        this.fillAndInk(ctx, '#28465c', 3.2);

        // 结印广袖
        ctx.beginPath();
        ctx.roundRect(-13, -6, 26, 8, 4);
        this.fillAndInk(ctx, '#3b6480', 2.6);

        // 头部与白玉道冠
        ctx.beginPath();
        ctx.arc(0, -17, 7.5, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#e6dac6', 2.8);
        ctx.beginPath();
        ctx.roundRect(-4, -28, 8, 6, 2);
        this.fillAndInk(ctx, '#d4b263', 2.4);
        break;
      }

      case 'fire_crow': {
        // 【方案 D：大荒毕方·流火神鸟真灵】
        const flap = Math.sin(time * 0.25) * 7;
        // 尾羽流火绸带
        ctx.strokeStyle = '#e86f2c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.quadraticCurveTo(-26, 8 + flap * 0.5, -38, -4);
        ctx.stroke();

        // 青红双色层叠厚涂飞羽翼
        [-1, 1].forEach(dir => {
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.quadraticCurveTo(-2, dir * (26 - flap * 0.5), -18, dir * (18 - flap * 0.5));
          ctx.lineTo(-8, 0);
          ctx.closePath();
          this.fillAndInk(ctx, '#3b8c7d', 3);

          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.quadraticCurveTo(4, dir * (16 - flap * 0.3), -8, dir * (11 - flap * 0.3));
          ctx.lineTo(0, 0);
          ctx.closePath();
          this.fillAndInk(ctx, '#d95338', 2.5);
        });

        // 毕方修长鸟躯与金冠
        ctx.beginPath();
        ctx.ellipse(8, 0, 14, 5.5, 0, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#f2c968', 2.8);
        break;
      }

      case 'crossbow':
      case 'pear_blossom': {
        const isMulti = id === 'pear_blossom';
        const bowColor = hasThunder ? '#9b6bc2' : (isMulti ? '#c9593e' : '#c8a65a');
        // 檀木弩身
        ctx.beginPath();
        ctx.roundRect(-18, -8, 30, 14, 4);
        this.fillAndInk(ctx, '#5c3d2e', 3.2);

        // 反曲厚涂弓臂
        ctx.beginPath();
        ctx.moveTo(4, -24);
        ctx.quadraticCurveTo(18, -12, 10, -1);
        ctx.quadraticCurveTo(18, 10, 4, 22);
        ctx.lineTo(0, 19);
        ctx.quadraticCurveTo(11, 8, 5, -1);
        ctx.quadraticCurveTo(11, -10, 0, -21);
        ctx.closePath();
        this.fillAndInk(ctx, bowColor, 3);

        // 弓弦与铜箭
        ctx.strokeStyle = '#d9d2c5';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(3, -21); ctx.lineTo(-10, -1); ctx.lineTo(3, 19);
        ctx.stroke();

        const angles = isMulti ? [-0.2, 0, 0.2] : [0];
        angles.forEach(a => {
          ctx.save();
          ctx.translate(0, -1);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(22, 0); ctx.lineTo(13, -5); ctx.lineTo(13, 5);
          ctx.closePath();
          this.fillAndInk(ctx, '#e6c675', 2.2);
          ctx.restore();
        });
        break;
      }

      case 'shield': {
        // 【玄武包铜重盾】
        ctx.beginPath();
        ctx.roundRect(-15, -24, 30, 36, 6);
        this.fillAndInk(ctx, hasLava ? '#8c3725' : '#3a545c', 3.5);

        // 盾面内嵌铜框与龟甲心
        ctx.beginPath();
        ctx.roundRect(-10, -18, 20, 24, 4);
        this.fillAndInk(ctx, hasLava ? '#c9593e' : '#2a3d42', 2.5);

        ctx.beginPath();
        ctx.arc(0, -6, 5.5, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#d4b263', 2.4);
        break;
      }

      case 'taotie': {
        // 【商周青铜虎卣吞噬机关】
        const open = digesting ? 2 : 7 + Math.sin(time * 0.1) * 2;
        // 双耳兽角
        [-14, 14].forEach(hx => {
          ctx.beginPath();
          ctx.arc(hx, -20, 6, 0, Math.PI * 2);
          this.fillAndInk(ctx, '#c8a65a', 2.8);
        });
        // 青铜兽首
        ctx.beginPath();
        ctx.roundRect(-18, -20, 36, 30, 7);
        this.fillAndInk(ctx, digesting ? '#523b63' : '#385e54', 3.4);

        // 巨口与白牙
        ctx.fillStyle = '#1c1212';
        ctx.beginPath();
        ctx.roundRect(-12, -4, 24, open + 5, 3);
        ctx.fill();

        ctx.fillStyle = '#ebe3d2';
        [-7, 0, 7].forEach(tx => {
          ctx.fillRect(tx - 2, -4, 4, 4);
        });

        // 铜目
        ctx.fillStyle = '#f0b94a';
        ctx.beginPath();
        ctx.arc(-8, -11, 3.2, 0, Math.PI * 2);
        ctx.arc(8, -11, 3.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  },

  // 2. 绘制左侧【青石镇门石狮】（温润厚涂石雕质感）
  drawGuardianLion(ctx, x, y, isRunning) {
    ctx.save();
    ctx.translate(x, y);
    this.drawStonePlinth(ctx, 26);

    // 石狮蹲坐躯干
    ctx.beginPath();
    ctx.roundRect(-13, -10, 26, 20, 6);
    this.fillAndInk(ctx, '#737d82', 3.2);

    // 狮首与卷毛鬃发
    ctx.beginPath();
    ctx.arc(0, -14, 13, 0, Math.PI * 2);
    this.fillAndInk(ctx, '#889296', 3.2);

    // 额头金印与朱砂绶带
    ctx.fillStyle = '#b83b2b';
    ctx.fillRect(-11, -3, 22, 4);
    ctx.fillStyle = '#f0b94a';
    ctx.beginPath();
    ctx.arc(-4, -15, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -15, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (isRunning) {
      ctx.fillStyle = '#e86f2c';
      ctx.beginPath();
      ctx.arc(14, -10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // 3. 绘制国风赛璐璐厚涂山海魇魔（比例协调、块面扎实、无细碎线条）
  drawMonster(ctx, e, time) {
    const { typeId, hitFlash, chillTimer, freezeTimer, walkPhase, isAttacking } = e;
    const t = time * 0.13 + walkPhase;
    const stride = Math.sin(t) * 5.5;
    const bob = Math.abs(Math.cos(t)) * -2.5;
    const swing = isAttacking ? Math.sin(time * 0.4) * 0.7 : Math.cos(t) * 0.18;

    ctx.save();
    ctx.translate(e.x, e.y);

    // 地面椭圆投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bob);
    if (hitFlash > 0) {
      ctx.filter = 'brightness(220%)';
    } else if (chillTimer > 0) {
      ctx.filter = 'hue-rotate(160deg) saturate(140%)';
    }

    // 通用厚涂迈步双靴
    if (typeId !== 'boss_head') {
      ctx.beginPath();
      ctx.roundRect(-8 + stride, 8, 7, 10, 2);
      ctx.roundRect(1 - stride, 8, 7, 10, 2);
      this.fillAndInk(ctx, '#332924', 2.8);
    }

    switch (typeId) {
      case 'soldier': {
        // 【秦墓玄甲兵俑】
        // 绛红披风角
        ctx.beginPath();
        ctx.moveTo(4, -12); ctx.lineTo(18, 8); ctx.lineTo(6, 11);
        ctx.closePath();
        this.fillAndInk(ctx, '#8c2d25', 2.6);

        // 玄铁札甲身躯
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 22, 5);
        this.fillAndInk(ctx, '#4a3d36', 3.2);
        ctx.fillStyle = '#c8a65a';
        ctx.fillRect(-10, -2, 20, 3);

        // 陶俑头部与方冠
        ctx.beginPath();
        ctx.roundRect(-10, -27, 20, 16, 6);
        this.fillAndInk(ctx, '#9c8474', 3.2);
        ctx.beginPath();
        ctx.roundRect(-5, -33, 10, 7, 2);
        this.fillAndInk(ctx, '#362d28', 2.6);

        // 幽绿魂眼
        ctx.fillStyle = '#68d391';
        ctx.beginPath();
        ctx.arc(-4, -19, 2.2, 0, Math.PI * 2);
        ctx.arc(3, -19, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // 手持青铜长戈
        ctx.save();
        ctx.translate(-4, -3);
        ctx.rotate(swing);
        ctx.beginPath();
        ctx.roundRect(-28, -2, 38, 3.5, 1);
        this.fillAndInk(ctx, '#6e473b', 2.2);
        ctx.beginPath();
        ctx.moveTo(-26, -7); ctx.lineTo(-35, 0); ctx.lineTo(-24, 9);
        ctx.closePath();
        this.fillAndInk(ctx, '#d4b263', 2.2);
        ctx.restore();
        break;
      }

      case 'rattan': {
        // 【南疆藤牌卫】
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 22, 5);
        this.fillAndInk(ctx, '#475936', 3.2);

        ctx.beginPath();
        ctx.arc(0, -20, 10, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#657d4e', 3.2);

        // 前置厚涂大藤盾
        ctx.save();
        ctx.translate(-11, -1);
        ctx.rotate(swing * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#7a9458', 3.2);
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#d4b263', 2.2);
        ctx.restore();
        break;
      }

      case 'ape': {
        // 【赤发飞爪山魈】
        // 赤红发冠
        ctx.beginPath();
        ctx.moveTo(-8, -18); ctx.lineTo(2, -32); ctx.lineTo(14, -22); ctx.lineTo(10, -10);
        ctx.closePath();
        this.fillAndInk(ctx, '#c94a38', 2.8);

        ctx.beginPath();
        ctx.roundRect(-11, -12, 22, 20, 6);
        this.fillAndInk(ctx, '#4f3b63', 3.2);

        // 白骨假面
        ctx.beginPath();
        ctx.arc(-2, -19, 9, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#dfd7c8', 3);
        ctx.fillStyle = '#d95338';
        ctx.beginPath();
        ctx.arc(-5, -19, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'hammer': {
        // 【咸阳金甲巨神兵】
        // 双手重锤
        ctx.save();
        ctx.translate(8, -6);
        ctx.rotate(swing * 1.2);
        ctx.fillStyle = '#5c3d2e';
        ctx.fillRect(-2, -26, 4, 26);
        ctx.beginPath();
        ctx.arc(0, -28, 10, 0, Math.PI * 2);
        this.fillAndInk(ctx, '#c8a65a', 3);
        ctx.restore();

        // 魁梧黑金重甲躯干
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 26, 6);
        this.fillAndInk(ctx, '#384349', 3.5);
        ctx.fillStyle = '#c8a65a';
        ctx.fillRect(-12, -6, 24, 5);

        // 双角铁面盔
        ctx.beginPath();
        ctx.roundRect(-11, -31, 22, 16, 5);
        this.fillAndInk(ctx, '#4a575e', 3.2);
        ctx.fillStyle = '#f0b94a';
        ctx.fillRect(-7, -24, 12, 3);
        break;
      }

      case 'boss_head': {
        // 【九首凶神·相柳】
        for (let k = 3; k >= 1; k--) {
          ctx.beginPath();
          ctx.arc(k * 13, Math.sin(time * 0.1 + k) * 5, 16 - k * 2, 0, Math.PI * 2);
          this.fillAndInk(ctx, '#2d5950', 3);
        }
        ctx.beginPath();
        ctx.roundRect(-24, -16, 34, 32, 9);
        this.fillAndInk(ctx, '#3b7569', 3.5);

        ctx.fillStyle = '#f0b94a';
        ctx.beginPath();
        ctx.arc(-10, -5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    if (freezeTimer > 0) {
      ctx.fillStyle = 'rgba(130, 210, 235, 0.5)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-18, -32, 36, 50, 6);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    const barW = e.isBoss ? 68 : 44;
    drawHealthBar(e.x - barW / 2, e.y - 42, barW, 5, e.hp / e.maxHp, '#e5534b');
  }
};

// ==============================================================
// 二、 界面与同源卡牌初始化
// ==============================================================
function initElementalTiles() {
  const types = ['fire', 'water', 'earth', 'metal'];
  state.elementalTiles = {};
  for (let i = 0; i < 6; i++) {
    const r = Math.floor(Math.random() * ROWS);
    const c = 1 + Math.floor(Math.random() * (COLS - 3));
    state.elementalTiles[`${r}_${c}`] = types[i % types.length];
  }
}

function initCardsUI() {
  const container = document.getElementById('card-list');
  container.innerHTML = '';
  UNIT_CATALOG.forEach(u => {
    state.cardCooldowns[u.id] = 0;
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.id = `card-${u.id}`;
    card.onclick = () => selectCard(u);
    card.onmouseenter = e => showTooltip(e, `<b style="color:#f0b94a">${u.name}</b> (${u.cost} 灵气)<br>${u.desc}`);
    card.onmouseleave = hideTooltip;

    card.innerHTML = `
      <div class="card-cost">⚙ ${u.cost}</div>
      <div class="card-role">${u.role}</div>
      <canvas class="card-canvas" id="preview-${u.id}" width="84" height="80"></canvas>
      <div class="card-name">${u.name}</div>
      <div class="cd-mask" id="cd-${u.id}"></div>
    `;
    container.appendChild(card);
  });

  // 绘制鲁班拆解钳图标
  const sc = document.getElementById('shovel-canvas').getContext('2d');
  sc.translate(24, 24);
  sc.beginPath();
  sc.arc(0, -4, 11, Math.PI * 0.2, Math.PI * 0.8, true);
  sc.lineTo(-3, 14);
  sc.lineTo(3, 14);
  sc.closePath();
  CelArt.fillAndInk(sc, '#c8a65a', 2.8);
}

function renderCardPreviews(time) {
  UNIT_CATALOG.forEach(u => {
    const c = document.getElementById(`preview-${u.id}`);
    if (!c) return;
    const cctx = c.getContext('2d');
    cctx.clearRect(0, 0, c.width, c.height);
    cctx.save();
    cctx.translate(42, 46);
    cctx.scale(0.92, 0.92);
    CelArt.drawTower(cctx, u.id, time, {
      armed: true,
      hasThunder: state.activeBuffs.has('thunder_bow'),
      hasLava: state.activeBuffs.has('lava_shield')
    });
    cctx.restore();
  });
}

function showTooltip(e, html) {
  tooltipEl.innerHTML = html;
  tooltipEl.style.display = 'block';
  const rect = document.getElementById('game-wrapper').getBoundingClientRect();
  tooltipEl.style.left = `${Math.min(780, Math.max(12, e.clientX - rect.left + 16))}px`;
  tooltipEl.style.top = `${Math.max(12, e.clientY - rect.top - 52)}px`;
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

function selectCard(unit) {
  if (state.paused) return;
  if (state.qi < unit.cost || state.cardCooldowns[unit.id] > 0) return;
  state.shovelMode = false;
  document.getElementById('shovel-btn').classList.remove('active');
  state.selectedCard = (state.selectedCard && state.selectedCard.id === unit.id) ? null : unit;
  updateHUD();
}

function toggleShovel() {
  state.selectedCard = null;
  state.shovelMode = !state.shovelMode;
  document.getElementById('shovel-btn').classList.toggle('active', state.shovelMode);
  updateHUD();
}

function triggerGlobalOverload() {
  if (state.energy < 50 || state.overloadTimer > 0) return;
  state.energy -= 50;
  state.overloadTimer = 420;
  state.screenShake = 8;
  spawnFloatingText(BOARD_X + 380, BOARD_Y + 220, '⚡ 全军机巧过载！', '#f0b94a', 24);
  updateHUD();
}

function updateHUD() {
  document.getElementById('qi-display').innerText = Math.floor(state.qi);
  document.getElementById('wave-display').innerText = state.bossSpawned ? 'BOSS · 相柳' : `${state.wave} / ${state.maxWave}`;
  document.getElementById('energy-display').innerText = `${Math.floor(state.energy)}%`;
  document.getElementById('overload-btn').disabled = state.energy < 50 || state.overloadTimer > 0;
  document.getElementById('shovel-rate').innerText = state.activeBuffs.has('mine_shrapnel') ? '返75%+爆' : '返40%';

  UNIT_CATALOG.forEach(u => {
    const el = document.getElementById(`card-${u.id}`);
    const cdEl = document.getElementById(`cd-${u.id}`);
    if (!el || !cdEl) return;
    const canAfford = state.qi >= u.cost && state.cardCooldowns[u.id] <= 0;
    el.classList.toggle('disabled', !canAfford);
    el.classList.toggle('selected', state.selectedCard && state.selectedCard.id === u.id);
    const ratio = Math.max(0, state.cardCooldowns[u.id] / u.cd) * 100;
    cdEl.style.height = `${ratio}%`;
  });
}

// ==============================================================
// 三、 战场交互与主循环
// ==============================================================
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (mx >= 16 && mx <= BOARD_X - 8 && my >= BOARD_Y && my <= BOARD_Y + ROWS * CELL_H) {
    showTooltip(e, `<b style="color:#f0b94a">【守城底线 · 镇门石狮】</b><br>每行左侧的最后保底防线。当魇魔突破防线抵达底线时，镇门石狮将自动冲出，清空本行全部敌人。`);
    state.hoverCell = { r: -1, c: -1 };
    return;
  } else {
    hideTooltip();
  }

  const c = Math.floor((mx - BOARD_X) / CELL_W);
  const r = Math.floor((my - BOARD_Y) / CELL_H);
  state.hoverCell = (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? { r, c } : { r: -1, c: -1 };
});

canvas.addEventListener('click', e => {
  if (state.paused) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = state.gears.length - 1; i >= 0; i--) {
    const g = state.gears[i];
    if (Math.hypot(mx - g.x, my - g.y) < 30) {
      state.qi += g.val;
      spawnFloatingText(g.x, g.y, `+${g.val} 灵气`, '#f0b94a', 16);
      state.gears.splice(i, 1);
      updateHUD();
      return;
    }
  }

  const { r, c } = state.hoverCell;
  if (r < 0 || c < 0) return;

  const existingIdx = state.towers.findIndex(t => t.r === r && t.c === c);

  if (state.shovelMode) {
    if (existingIdx !== -1) {
      const removed = state.towers[existingIdx];
      const rate = state.activeBuffs.has('mine_shrapnel') ? 0.75 : 0.4;
      const refund = Math.floor(removed.cost * rate);
      state.qi += refund;
      spawnFloatingText(removed.x, removed.y, `回收 +${refund}`, '#5ab5a0', 15);
      if (state.activeBuffs.has('mine_shrapnel')) {
        createExplosion(removed.x, removed.y, 125, 800);
      }
      state.towers.splice(existingIdx, 1);
      state.shovelMode = false;
      document.getElementById('shovel-btn').classList.remove('active');
      updateHUD();
    }
    return;
  }

  if (state.selectedCard && existingIdx === -1) {
    const u = state.selectedCard;
    const elem = state.elementalTiles[`${r}_${c}`];
    state.qi -= u.cost;
    state.cardCooldowns[u.id] = elem === 'water' ? u.cd * 0.7 : u.cd;

    const x = BOARD_X + c * CELL_W + CELL_W / 2;
    const y = BOARD_Y + r * CELL_H + CELL_H / 2;

    if (u.id === 'fire_crow') {
      spawnFireCrowRow(r, y);
    } else {
      state.towers.push({
        id: u.id, name: u.name, r, c, x, y,
        hp: u.hp, maxHp: u.hp, cost: u.cost,
        timer: 0, shotCount: 0,
        armed: u.id !== 'landmine', armTimer: 0,
        digesting: false, digestTimer: 0,
        scaleX: 1.25, scaleY: 0.75, hitFlash: 0
      });
    }
    state.selectedCard = null;
    updateHUD();
  }
});

function spawnFireCrowRow(r, y) {
  spawnFloatingText(BOARD_X + 240, y - 12, '🔥 毕方流火 · 焚尽八荒！', '#e86f2c', 20);
  state.bullets.push({
    x: BOARD_X - 10, y, r, vx: 10, dmg: 1200, isCrow: true, radius: 30
  });
}

function createExplosion(x, y, radius, dmg) {
  state.screenShake = 7;
  state.enemies.forEach(en => {
    if (Math.hypot(en.x - x, en.y - y) <= radius) {
      en.hp -= dmg;
      en.hitFlash = 8;
    }
  });
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 5;
    state.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      size: 4 + Math.random() * 4,
      color: i % 2 === 0 ? '#e86f2c' : '#f0b94a',
      life: 26
    });
  }
}

function spawnFloatingText(x, y, text, color = '#fff', size = 15) {
  state.particles.push({ x, y, vx: 0, vy: -1.1, text, color, size, life: 42 });
}

function showRogueModal() {
  state.paused = true;
  const modal = document.getElementById('rogue-modal');
  const list = document.getElementById('buff-list');
  list.innerHTML = '';
  const picks = [...ROGUE_BUFFS].sort(() => 0.5 - Math.random()).slice(0, 3);
  picks.forEach(b => {
    const div = document.createElement('div');
    div.className = 'buff-card';
    div.onclick = () => {
      state.activeBuffs.add(b.id);
      modal.style.display = 'none';
      state.paused = false;
      spawnFloatingText(520, 250, `习得秘术：${b.title}`, '#f0b94a', 22);
      updateHUD();
    };
    div.innerHTML = `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">[${b.tag}]</div>
      <div style="font-size:18px;color:var(--accent-amber);font-weight:bold;margin-bottom:10px;">${b.title}</div>
      <div style="font-size:13px;line-height:1.6;color:var(--text-warm);">${b.desc}</div>
    `;
    list.appendChild(div);
  });
  modal.style.display = 'flex';
}

let spawnCounter = 0;
let waveKills = 0;

function spawnEnemy() {
  if (state.bossSpawned) return;
  const r = Math.floor(Math.random() * ROWS);
  const y = BOARD_Y + r * CELL_H + CELL_H / 2;
  const roster = [
    { typeId: 'soldier', name: '秦墓兵俑', hp: 250, spd: 0.45, radius: 22 },
    { typeId: 'rattan', name: '南疆藤卫', hp: 480, spd: 0.38, radius: 24 },
    { typeId: 'ape', name: '赤发山魈', hp: 340, spd: 0.85, radius: 21, canVault: true },
    { typeId: 'hammer', name: '金甲力士', hp: 980, spd: 0.28, radius: 27 }
  ];
  const maxIdx = Math.min(roster.length - 1, Math.floor(state.wave * 0.55));
  const tpl = roster[Math.floor(Math.random() * (maxIdx + 1))];
  const mult = 1 + (state.wave - 1) * 0.18;

  state.enemies.push({
    ...tpl, r, x: BOARD_X + COLS * CELL_W + 30, y,
    hp: Math.floor(tpl.hp * mult),
    maxHp: Math.floor(tpl.hp * mult),
    chillTimer: 0, freezeTimer: 0, hitFlash: 0,
    isAttacking: false,
    walkPhase: Math.random() * Math.PI * 2
  });
}

function spawnXiangliuBoss() {
  state.bossSpawned = true;
  spawnFloatingText(520, 240, '🐍 首领【九首·相柳】降临！', '#5ab5a0', 24);
  for (let r = 0; r < ROWS; r++) {
    const y = BOARD_Y + r * CELL_H + CELL_H / 2;
    state.enemies.push({
      typeId: 'boss_head', name: `相柳蛇首`,
      r, x: BOARD_X + COLS * CELL_W - 22, y,
      hp: 2600, maxHp: 2600, spd: 0.055, radius: 30,
      isBoss: true, chillTimer: 0, freezeTimer: 0, hitFlash: 0,
      isAttacking: false, walkPhase: r * 1.1
    });
  }
}

let lastTime = performance.now();
let tickCount = 0;

function update(now) {
  const dt = now - lastTime;
  lastTime = now;
  if (state.paused) return;
  tickCount++;

  if (state.screenShake > 0) state.screenShake *= 0.85;
  if (state.screenShake < 0.5) state.screenShake = 0;

  UNIT_CATALOG.forEach(u => {
    if (state.cardCooldowns[u.id] > 0) {
      state.cardCooldowns[u.id] = Math.max(0, state.cardCooldowns[u.id] - dt);
    }
  });
  if (state.overloadTimer > 0) state.overloadTimer--;

  state.lions.forEach((ln, r) => {
    if (ln.running) {
      ln.x += 10;
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.r === r && Math.abs(e.x - ln.x) < 42) {
          e.hp -= 3000;
          e.hitFlash = 8;
        }
      }
      if (ln.x > canvas.width + 60) {
        ln.running = false;
        ln.active = false;
      }
    }
  });

  if (Math.random() < 0.0045) {
    state.gears.push({
      x: BOARD_X + 60 + Math.random() * (COLS * CELL_W - 120),
      y: BOARD_Y - 15,
      targetY: BOARD_Y + 50 + Math.random() * (ROWS * CELL_H - 100),
      val: 25, life: 600
    });
  }
  state.gears.forEach((g, idx) => {
    if (g.y < g.targetY) g.y += 1.3;
    g.life--;
    if (g.life <= 0) state.gears.splice(idx, 1);
  });

  spawnCounter++;
  const interval = Math.max(85, 240 - state.wave * 14);
  if (spawnCounter >= interval) {
    spawnCounter = 0;
    spawnEnemy();
  }

  state.towers.forEach((t, tIdx) => {
    t.scaleX += (1 - t.scaleX) * 0.16;
    t.scaleY += (1 - t.scaleY) * 0.16;
    if (t.hitFlash > 0) t.hitFlash--;

    const elem = state.elementalTiles[`${t.r}_${t.c}`];
    if (elem === 'earth' && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + 0.25);

    let speedMult = 1;
    state.towers.forEach(other => {
      if (other.id === 'furnace' && Math.abs(other.r - t.r) <= 1 && Math.abs(other.c - t.c) <= 1) {
        speedMult = 1.2;
      }
    });
    if (elem === 'fire') speedMult += 0.25;
    if (state.overloadTimer > 0) speedMult *= 2.0;

    t.timer += speedMult;

    if (t.id === 'furnace') {
      const wait = state.activeBuffs.has('gold_furnace') ? 440 : 620;
      if (t.timer >= wait) {
        t.timer = 0;
        t.scaleX = 1.2; t.scaleY = 0.84;
        state.gears.push({ x: t.x + (Math.random() - 0.5) * 26, y: t.y - 10, targetY: t.y + 18, val: 25, life: 600 });
        if (state.activeBuffs.has('gold_furnace') && state.enemies.length > 0) {
          state.enemies.slice(0, 3).forEach(target => {
            state.bullets.push({ x: t.x, y: t.y, r: target.r, vx: 8.5, dmg: 60, color: '#e86f2c', radius: 5 });
          });
        }
      }
    } else if (t.id === 'landmine') {
      if (!t.armed) {
        t.armTimer++;
        if (t.armTimer >= 240) {
          t.armed = true;
          spawnFloatingText(t.x, t.y - 22, '埋雷就绪!', '#f0b94a', 13);
        }
      } else {
        const trigger = state.enemies.find(e => e.r === t.r && Math.abs(e.x - t.x) < 36);
        if (trigger) {
          createExplosion(t.x, t.y, 120, 1500);
          spawnFloatingText(t.x, t.y, '💥 震天爆破!', '#e86f2c', 19);
          state.towers.splice(tIdx, 1);
        }
      }
    } else if (t.id === 'taotie') {
      if (t.digesting) {
        t.digestTimer--;
        if (t.digestTimer <= 0) {
          t.digesting = false;
          const bonusQi = state.activeBuffs.has('fast_taotie') ? 50 : 25;
          state.qi += bonusQi;
          spawnFloatingText(t.x, t.y - 20, `炼化 +${bonusQi}灵气`, '#f0b94a', 14);
        }
      } else {
        const preyIdx = state.enemies.findIndex(e => !e.isBoss && e.r === t.r && e.x > t.x - 10 && e.x < t.x + 80);
        if (preyIdx !== -1) {
          state.enemies.splice(preyIdx, 1);
          t.digesting = true;
          t.digestTimer = state.activeBuffs.has('fast_taotie') ? 360 : 720;
          t.scaleX = 1.3; t.scaleY = 1.3;
          spawnFloatingText(t.x, t.y, '饕餮吞噬!', '#f0b94a', 15);
        }
      }
    } else if (t.id === 'shield' && state.activeBuffs.has('lava_shield') && tickCount % 30 === 0) {
      state.enemies.forEach(e => {
        if (e.r === t.r && Math.abs(e.x - t.x) < 75) {
          e.hp -= 32;
          e.hitFlash = 3;
        }
      });
    } else if (t.id === 'crossbow' || t.id === 'frost_mage' || t.id === 'pear_blossom') {
      const hasEnemy = state.enemies.some(e => (t.id === 'pear_blossom' ? Math.abs(e.r - t.r) <= 1 : e.r === t.r) && e.x > t.x);
      if (hasEnemy && t.timer >= 76) {
        t.timer = 0;
        t.shotCount++;
        t.scaleX = 0.85; t.scaleY = 1.15;

        const isFrost = t.id === 'frost_mage';
        const isThunder = !isFrost && state.activeBuffs.has('thunder_bow');
        let dmg = isFrost ? 24 : (isThunder ? 36 : 26);
        if (elem === 'fire') dmg += 8;

        const rowsToShoot = t.id === 'pear_blossom' ? [t.r - 1, t.r, t.r + 1] : [t.r];
        rowsToShoot.forEach(targetRow => {
          if (targetRow >= 0 && targetRow < ROWS) {
            state.bullets.push({
              x: t.x + 20,
              y: BOARD_Y + targetRow * CELL_H + CELL_H / 2 - 4,
              r: targetRow,
              vx: 9.5, dmg, isFrost, isThunder,
              color: isFrost ? '#76c4d6' : (isThunder ? '#b482d6' : '#f0b94a'),
              radius: 5
            });
          }
        });
      }
    }
  });

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    if (b.x > canvas.width + 40) {
      state.bullets.splice(i, 1);
      continue;
    }
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (e.r === b.r && Math.abs(e.x - b.x) < e.radius + b.radius) {
        e.hp -= b.dmg;
        e.hitFlash = 5;

        if (b.isFrost) {
          e.chillTimer = 240;
          if (Math.random() < 0.25) e.freezeTimer = 75;
        }
        if (b.isThunder && state.enemies.length > 1) {
          const near = state.enemies.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 160);
          if (near) {
            near.hp -= b.dmg * 0.55;
            near.hitFlash = 5;
            state.lightningArcs.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, life: 8 });
          }
        }
        if (!b.isCrow) {
          state.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  for (let i = state.lightningArcs.length - 1; i >= 0; i--) {
    state.lightningArcs[i].life--;
    if (state.lightningArcs[i].life <= 0) state.lightningArcs.splice(i, 1);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.chillTimer > 0) e.chillTimer--;
    if (e.freezeTimer > 0) { e.freezeTimer--; continue; }

    const blocker = state.towers.find(t => t.r === e.r && Math.abs(t.x - e.x) < 36);
    if (blocker) {
      e.isAttacking = true;
      if (e.canVault && state.elementalTiles[`${blocker.r}_${blocker.c}`] !== 'earth') {
        e.canVault = false;
        e.x -= 85;
        spawnFloatingText(e.x, e.y - 25, '翻越!', '#d6ba7b', 13);
      } else {
        const dmgRed = (blocker.id === 'taotie' && blocker.digesting && state.activeBuffs.has('fast_taotie')) ? 0.4 : 1;
        blocker.hp -= 0.75 * dmgRed;
        blocker.hitFlash = 2;
        if (blocker.id === 'shield') {
          e.hp -= state.activeBuffs.has('lava_shield') ? 0.85 : 0.35;
        }
        if (blocker.hp <= 0) {
          const idx = state.towers.indexOf(blocker);
          if (idx !== -1) state.towers.splice(idx, 1);
        }
      }
    } else {
      e.isAttacking = false;
      const spdMult = e.chillTimer > 0 ? 0.5 : 1;
      e.x -= e.spd * spdMult;
    }

    if (e.x < BOARD_X - 6) {
      const ln = state.lions[e.r];
      if (ln && ln.active && !ln.running) {
        ln.running = true;
        spawnFloatingText(BOARD_X + 75, e.y, '镇门石狮出击！', '#f0b94a', 18);
      } else if (!ln.active) {
        e.x = BOARD_X + COLS * CELL_W;
      }
    }

    if (e.hp <= 0) {
      state.energy = Math.min(100, state.energy + 8);
      waveKills++;
      for (let k = 0; k < 8; k++) {
        state.particles.push({
          x: e.x, y: e.y,
          vx: (Math.random() - 0.5) * 4.5, vy: (Math.random() - 0.5) * 4.5,
          size: 3.5, color: '#9c8474', life: 20
        });
      }
      state.enemies.splice(i, 1);

      if (!state.bossSpawned && waveKills >= 5 + state.wave * 2) {
        waveKills = 0;
        if (state.wave < state.maxWave) {
          state.wave++;
          if (state.wave % 3 === 0) showRogueModal();
          if (state.wave === state.maxWave) spawnXiangliuBoss();
        }
      }
      updateHUD();
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  if (tickCount % 3 === 0) renderCardPreviews(tickCount);
  updateHUD();
}

// ==============================================================
// 四、 战场主画布渲染管线
// ==============================================================
function render() {
  ctx.save();
  if (state.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * state.screenShake, (Math.random() - 0.5) * state.screenShake);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 左侧【镇门石狮】石阶防区
  ctx.fillStyle = '#181f24';
  ctx.strokeStyle = '#63553b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(16, BOARD_Y - 28, 108, ROWS * CELL_H + 30, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c8b693';
  ctx.font = 'bold 12px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('底线 · 镇门石狮', 70, BOARD_Y - 10);

  // 2. 绘制 5x9 温润青石古院棋盘
  const elemStyles = {
    fire: { bg: 'rgba(217, 83, 56, 0.22)', text: '#e8836b', label: '火脉·攻速' },
    water: { bg: 'rgba(78, 168, 189, 0.22)', text: '#7ec8d9', label: '水脉·减CD' },
    earth: { bg: 'rgba(200, 166, 90, 0.22)', text: '#dec078', label: '土脉·固阵' },
    metal: { bg: 'rgba(180, 195, 205, 0.18)', text: '#c5d1d9', label: '金脉·破甲' }
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * CELL_W;
      const y = BOARD_Y + r * CELL_H;
      const isCore = (c === 1 || c === 2);

      // 青石砖底色
      ctx.fillStyle = (r + c) % 2 === 0
        ? (isCore ? '#2e3940' : '#263036')
        : (isCore ? '#29343a' : '#222b30');
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4, 4);
      ctx.fill();

      // 五行阵眼温润微光
      const key = `${r}_${c}`;
      if (state.elementalTiles[key]) {
        const st = elemStyles[state.elementalTiles[key]];
        ctx.fillStyle = st.bg;
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8, 4);
        ctx.fill();

        ctx.fillStyle = st.text;
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.label, x + CELL_W / 2, y + CELL_H - 9);
      }

      // 棋盘格细铜边
      ctx.strokeStyle = isCore ? 'rgba(200, 166, 90, 0.35)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
    }
  }

  // 3. 悬停十字对齐提示与半透明预览
  if (state.hoverCell.r >= 0 && (state.selectedCard || state.shovelMode)) {
    const { r, c } = state.hoverCell;
    const hx = BOARD_X + c * CELL_W;
    const hy = BOARD_Y + r * CELL_H;
    ctx.save();
    ctx.fillStyle = state.shovelMode ? 'rgba(229, 83, 75, 0.14)' : 'rgba(240, 185, 74, 0.08)';
    ctx.fillRect(BOARD_X, hy, COLS * CELL_W, CELL_H);
    ctx.fillRect(hx, BOARD_Y, CELL_W, ROWS * CELL_H);

    if (state.selectedCard) {
      ctx.translate(hx + CELL_W / 2, hy + CELL_H / 2);
      ctx.globalAlpha = 0.6;
      CelArt.drawTower(ctx, state.selectedCard.id, tickCount, { armed: true });
    }
    ctx.restore();
  }

  // 4. 绘制左侧【镇门石狮】
  state.lions.forEach((ln, r) => {
    const cy = BOARD_Y + r * CELL_H + CELL_H / 2;
    if (ln.active) {
      CelArt.drawGuardianLion(ctx, ln.x, cy, ln.running);
    } else {
      ctx.fillStyle = '#58656e';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('已出击', 70, cy + 4);
    }
  });

  // 5. 绘制场上墨家机关
  const breath = Math.sin(tickCount * 0.08) * 0.02;
  state.towers.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scaleX, t.scaleY + breath);
    if (t.hitFlash > 0) ctx.filter = 'brightness(220%)';

    CelArt.drawTower(ctx, t.id, tickCount, {
      armed: t.armed,
      digesting: t.digesting,
      hasThunder: state.activeBuffs.has('thunder_bow'),
      hasLava: state.activeBuffs.has('lava_shield')
    });

    if (t.hp < t.maxHp) {
      drawHealthBar(-22, -38, 44, 5, t.hp / t.maxHp, '#5ab5a0');
    }
    ctx.restore();
  });

  // 6. 绘制山海魇魔
  state.enemies.forEach(e => {
    CelArt.drawMonster(ctx, e, tickCount);
  });

  // 7. 闪电链与弹道
  state.lightningArcs.forEach(arc => {
    ctx.save();
    ctx.strokeStyle = '#c69ce6';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(arc.x1, arc.y1);
    ctx.lineTo((arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 18, (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 18);
    ctx.lineTo(arc.x2, arc.y2);
    ctx.stroke();
    ctx.restore();
  });

  state.bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.isCrow) {
      CelArt.drawTower(ctx, 'fire_crow', tickCount);
    } else {
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4);
      ctx.closePath();
      CelArt.fillAndInk(ctx, b.color, 2);
    }
    ctx.restore();
  });

  // 8. 天工灵气齿轮与飘字
  state.gears.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(tickCount * 0.03);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    CelArt.fillAndInk(ctx, '#f0b94a', 2.6);
    ctx.fillStyle = '#222b30';
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  });

  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 18);
    if (p.text) {
      ctx.font = `bold ${p.size}px "PingFang SC", sans-serif`;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  ctx.restore();
}

function drawHealthBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = '#14191c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}

initElementalTiles();
initCardsUI();
renderCardPreviews(0);
updateHUD();

function gameLoop(now) {
  update(now);
  render();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);