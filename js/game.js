/**
 * 《山海机关录：墨守》纯矢量精绘引擎 v3.0
 * 包含：8种高精矢量墨家机关 + 4种骨骼化山海魇魔 + 九首凶神相柳Boss战
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 5, COLS = 9;
const CELL_W = 94, CELL_H = 92;
const BOARD_X = 92, BOARD_Y = 42;

// 保留背景纹理图（若存在）
const bgImage = new Image();
bgImage.src = 'assets/background.jpg';

// 完整 8 张墨家机关卡牌配置
const UNIT_CATALOG = [
  { id: 'furnace', name: '聚灵烘炉', tag: '经济·光环', cost: 50, cd: 4500, hp: 300, desc: '每18秒产出25灵气齿轮；周围3x3友军攻速+15%' },
  { id: 'crossbow', name: '诸葛连弩', tag: '远程·连射', cost: 100, cd: 4000, hp: 300, desc: '发射破甲铜箭，每第4次射击必定触发双连射' },
  { id: 'shield', name: '玄武重盾', tag: '前排·反伤', cost: 75, cd: 10000, hp: 3200, desc: '墨家玄铁重盾，受近战敲击时反弹震荡伤害' },
  { id: 'landmine', name: '震天埋雷', tag: '陷阱·爆破', cost: 25, cd: 11000, hp: 250, desc: '埋地旋紧发条后激活，触碰造成1500范围轰炸' },
  { id: 'taotie', name: '吞天饕餮', tag: '吞噬·产灵', cost: 150, cd: 9000, hp: 450, desc: '一口吞下前方单体魇魔，炼化20秒后吐出25灵气' },
  { id: 'frost_mage', name: '寒霜方士', tag: '法术·冰控', cost: 175, cd: 5500, hp: 300, desc: '发射寒冰符减速35%，叠满4层触发冰封禁锢' },
  { id: 'pear_blossom', name: '暴雨梨花', tag: '散射·多行', cost: 225, cd: 7500, hp: 350, desc: '重型散射机弩，命中主目标后分裂袖箭打击上下行' },
  { id: 'fire_crow', name: '神火飞鸦', tag: '奇术·全行', cost: 150, cd: 16000, hp: 9999, desc: '放出一只烈焰木鸢掠过整行，造成1200毁灭灼烧' }
];

// 肉鸽锻造词条池
const ROGUE_BUFFS = [
  { id: 'thunder_bow', tag: '天工改造', title: '【雷公连弩】', desc: '诸葛连弩与暴雨梨花附加雷电链，弹射周围2名敌人且伤害+35%！' },
  { id: 'lava_shield', tag: '天工改造', title: '【熔岩玄武】', desc: '玄武重盾周身燃起烈焰，每秒灼烧前方敌人60点生命且反伤翻倍！' },
  { id: 'gold_furnace', tag: '天工改造', title: '【烈阳金乌炉】', desc: '聚灵烘炉产出加快30%，且每次产灵气发射3枚60伤害追踪阳炎弹！' },
  { id: 'fast_taotie', tag: '天工改造', title: '【暴食吞天兽】', desc: '吞天饕餮炼化时间减半，消化期间获得60%减伤且吐出50巨额灵气！' },
  { id: 'mine_shrapnel', tag: '墨家竹简', title: '【草木皆兵】', desc: '鲁班拆解钳返还灵气提至75%，且拆解瞬间在原地引发800伤害爆炸！' }
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
  paused: false,
  activeBuffs: new Set(),
  elementalTiles: {},
  towers: [],
  enemies: [],
  bullets: [],
  gears: [],
  particles: [],
  lions: [true, true, true, true, true],
  cardCooldowns: {},
  bossSpawned: false
};

// ==========================================
// 一、 纯矢量精细图形绘制库 (Vector Art Engine)
// ==========================================
const VectorArt = {
  // 绘制八卦青铜外底座
  drawBronzeBase(ctx, radius, glowColor = '#d4af37', rot = 0) {
    ctx.save();
    ctx.rotate(rot);
    // 八角外盘
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const r = radius + 3;
      const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#192428';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = glowColor;
    ctx.stroke();

    // 内圈铜环
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#233238';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.stroke();
    ctx.restore();
  },

  // 1. 机关矢量图绘制（同时用于棋盘实体与底部卡牌图标）
  drawTowerUnit(ctx, id, time = 0, options = {}) {
    const { isOverload = false, armed = true, digesting = false, hasThunder = false, hasLava = false } = options;
    const glow = isOverload ? '#ff5722' : '#d4af37';

    ctx.save();
    // 底部八卦盘
    if (id !== 'landmine' && id !== 'fire_crow') {
      this.drawBronzeBase(ctx, 32, glow, id === 'furnace' ? time * 0.01 : 0);
    }

    switch (id) {
      case 'furnace': {
        // 聚灵烘炉：青铜三足鼎 + 齿轮刻度 + 跃动灵火
        ctx.fillStyle = '#8c6d3b';
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
          ctx.fillRect(-5, -30, 10, 8);
          ctx.restore();
        }
        // 炉膛暗金外圈
        const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
        grad.addColorStop(0, '#fff59d');
        grad.addColorStop(0.45, '#ff9800');
        grad.addColorStop(0.85, '#b71c1c');
        grad.addColorStop(1, '#263238');
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffd54f';
        ctx.stroke();

        // 中心旋转天工齿轮
        ctx.save();
        ctx.rotate(-time * 0.025);
        ctx.strokeStyle = '#fff8e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + Math.sin(time * 0.08) * 2, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
          ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'crossbow':
      case 'pear_blossom': {
        const isMulti = id === 'pear_blossom';
        // 木质弩身底座
        ctx.fillStyle = isMulti ? '#4a2c2a' : '#5d4037';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-22, -7, 38, 14, 4);
        else ctx.rect(-22, -7, 38, 14);
        ctx.fill();
        ctx.stroke();

        // 金属复合反曲弓臂
        ctx.beginPath();
        ctx.moveTo(4, -26);
        ctx.quadraticCurveTo(18, -12, 10, 0);
        ctx.quadraticCurveTo(18, 12, 4, 26);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = hasThunder ? '#e040fb' : (isMulti ? '#ff7043' : '#c5a059');
        ctx.stroke();

        // 弓弦
        ctx.beginPath();
        ctx.moveTo(4, -25);
        ctx.lineTo(-10, 0);
        ctx.lineTo(4, 25);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#eceff1';
        ctx.stroke();

        // 箭矢
        const angles = isMulti ? [-0.22, 0, 0.22] : [0];
        angles.forEach(ang => {
          ctx.save();
          ctx.rotate(ang);
          ctx.fillStyle = hasThunder ? '#ea80fc' : '#ffd54f';
          ctx.fillRect(-10, -1.5, 28, 3);
          // 箭头
          ctx.beginPath();
          ctx.moveTo(24, 0);
          ctx.lineTo(16, -5);
          ctx.lineTo(18, 0);
          ctx.lineTo(16, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });

        // 中枢轴承铜钉
        ctx.beginPath();
        ctx.arc(-4, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();
        break;
      }

      case 'shield': {
        // 玄武重盾：厚重龟甲八边形青铜巨盾
        ctx.beginPath();
        ctx.moveTo(18, -24);
        ctx.lineTo(26, -12);
        ctx.lineTo(26, 12);
        ctx.lineTo(18, 24);
        ctx.lineTo(-16, 28);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-16, -28);
        ctx.closePath();

        const shieldGrad = ctx.createLinearGradient(-24, -24, 26, 24);
        if (hasLava) {
          shieldGrad.addColorStop(0, '#bf360c');
          shieldGrad.addColorStop(0.5, '#3e2723');
          shieldGrad.addColorStop(1, '#ff6f00');
        } else {
          shieldGrad.addColorStop(0, '#37474f');
          shieldGrad.addColorStop(0.5, '#1c262b');
          shieldGrad.addColorStop(1, '#263238');
        }
        ctx.fillStyle = shieldGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = hasLava ? '#ff9100' : '#d4af37';
        ctx.stroke();

        // 龟甲纹理
        ctx.strokeStyle = hasLava ? 'rgba(255, 111, 0, 0.6)' : 'rgba(128, 203, 196, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(2, 0, 12, 0, Math.PI * 2);
        ctx.stroke();

        // 盾面铆钉
        [[-12, -18], [-12, 18], [14, -16], [14, 16]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd54f';
          ctx.fill();
        });
        break;
      }

      case 'landmine': {
        ctx.save();
        if (!armed) ctx.globalAlpha = 0.65;
        ctx.rotate(armed ? time * 0.02 : 0);
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = armed ? '#ff5252' : '#90a4ae';
        ctx.lineWidth = 2;

        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 4);
          ctx.fillRect(-4, -24, 8, 48);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const pulse = armed ? (Math.sin(time * 0.18) + 1) * 0.5 : 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = armed ? `rgba(255, 61, 0, ${0.6 + pulse * 0.4})` : '#546e7a';
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'taotie': {
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(-12, -16, 12, Math.PI * 0.8, Math.PI * 1.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-12, 16, 12, Math.PI * 0.4, Math.PI * 1.2);
        ctx.stroke();

        ctx.fillStyle = digesting ? '#4a148c' : '#1f2c33';
        ctx.strokeStyle = digesting ? '#ea80fc' : '#26a69a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const jawOpen = digesting ? 4 + Math.sin(time * 0.15) * 2 : 12 + Math.sin(time * 0.08) * 3;
        ctx.fillStyle = '#310b0b';
        ctx.beginPath();
        ctx.ellipse(6, 0, 12, jawOpen, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff8e1';
        [-6, 0, 6].forEach(dy => {
          ctx.beginPath();
          ctx.moveTo(10, dy - 3);
          ctx.lineTo(17, dy);
          ctx.lineTo(10, dy + 3);
          ctx.fill();
        });

        ctx.fillStyle = digesting ? '#00e5ff' : '#ffca28';
        ctx.beginPath();
        ctx.arc(-6, -9, 3.5, 0, Math.PI * 2);
        ctx.arc(-6, 9, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'frost_mage': {
        ctx.save();
        ctx.rotate(time * 0.015);
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -24);
          ctx.moveTo(-5, -16);
          ctx.lineTo(0, -21);
          ctx.lineTo(5, -16);
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#e1f5fe';
        ctx.strokeStyle = '#0288d1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(13, 0);
        ctx.lineTo(0, 13);
        ctx.lineTo(-13, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'fire_crow': {
        const wingFlap = Math.sin(time * 0.3) * 6;
        ctx.fillStyle = '#ff5722';
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-6, -24 + wingFlap);
        ctx.lineTo(-14, -8);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-14, 8);
        ctx.lineTo(-6, 24 - wingFlap);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(12, -5);
        ctx.lineTo(12, 5);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  },

  drawGuardianLion(ctx, x, y, time) {
    ctx.save();
    ctx.translate(x, y);
    this.drawBronzeBase(ctx, 26, '#d4af37', 0);

    ctx.fillStyle = '#8c6d3b';
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 14, Math.sin(a) * 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff59d';
    ctx.beginPath();
    ctx.arc(4, -5, 3, 0, Math.PI * 2);
    ctx.arc(4, 5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff3d00';
    ctx.beginPath();
    ctx.arc(11, 0, 4 + Math.sin(time * 0.1) * 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawEnemyUnit(ctx, enemy, time) {
    const { typeId, radius, hitFlash, chillTimer, freezeTimer, walkPhase } = enemy;
    const bob = Math.sin(time * 0.12 + walkPhase) * 3;
    const swing = Math.cos(time * 0.12 + walkPhase) * 0.25;

    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, radius + 2, radius * 0.85, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bob);
    if (hitFlash > 0) {
      ctx.filter = 'brightness(280%) contrast(150%)';
    } else if (chillTimer > 0) {
      ctx.filter = 'hue-rotate(170deg) saturate(160%)';
    }

    switch (typeId) {
      case 'soldier': {
        ctx.save();
        ctx.rotate(swing);
        ctx.fillStyle = '#78909c';
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-26, -6);
        ctx.lineTo(-8, -2);
        ctx.lineTo(-8, 4);
        ctx.lineTo(-24, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#6d4c41';
        ctx.strokeStyle = '#271c19';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-14, -4, 28, 24, 5);
        else ctx.rect(-14, -4, 28, 24);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#4e342e';
        ctx.beginPath();
        ctx.moveTo(-12, 6); ctx.lineTo(12, 6);
        ctx.moveTo(0, -4); ctx.lineTo(0, 18);
        ctx.stroke();

        ctx.fillStyle = '#8d6e63';
        ctx.beginPath();
        ctx.arc(0, -11, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-5, -27, 10, 6);

        ctx.fillStyle = '#76ff03';
        ctx.shadowColor = '#76ff03';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(-5, -12, 2.5, 0, Math.PI * 2);
        ctx.arc(3, -12, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }

      case 'rattan': {
        ctx.fillStyle = '#33691e';
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(2, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#558b2f';
        ctx.beginPath();
        ctx.moveTo(-16, -8);
        ctx.lineTo(0, -24);
        ctx.lineTo(16, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#689f38';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(-10, 2, 10, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#33691e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-16, -10); ctx.lineTo(-4, 14);
        ctx.moveTo(-4, -10); ctx.lineTo(-16, 14);
        ctx.stroke();
        break;
      }

      case 'hammer': {
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-18, -14, 36, 34, 8);
        else ctx.rect(-18, -14, 36, 34);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, -14); ctx.lineTo(-18, -28); ctx.lineTo(-4, -16);
        ctx.moveTo(10, -14); ctx.lineTo(18, -28); ctx.lineTo(4, -16);
        ctx.fillStyle = '#ffd54f';
        ctx.fill();

        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(-6, -4, 3, 0, Math.PI * 2);
        ctx.arc(4, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#455a64';
        ctx.strokeStyle = '#ffca28';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-24, -10, 12, 28, 3);
        else ctx.rect(-24, -10, 12, 28);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.rotate(swing * 1.4);
        ctx.fillStyle = '#37474f';
        ctx.strokeStyle = '#d4af37';
        ctx.fillRect(6, -24, 4, 22);
        ctx.beginPath();
        ctx.arc(8, -26, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'ape': {
        ctx.save();
        ctx.rotate(-0.15);
        ctx.fillStyle = '#6a1b9a';
        ctx.strokeStyle = '#ea80fc';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff3d00';
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.lineTo(2, -24);
        ctx.lineTo(8, -12);
        ctx.lineTo(18, -18);
        ctx.lineTo(12, -4);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-26, -6);
        ctx.moveTo(-26, -6); ctx.lineTo(-20, -12);
        ctx.moveTo(-26, -6); ctx.lineTo(-22, 2);
        ctx.stroke();

        ctx.fillStyle = '#ffee58';
        ctx.beginPath();
        ctx.arc(-8, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'boss_head': {
        ctx.fillStyle = '#004d40';
        ctx.strokeStyle = '#00bfa5';
        ctx.lineWidth = 2;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(k * 14, Math.sin(time * 0.1 + k) * 4, 18 - k * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.fillStyle = '#00695c';
        ctx.strokeStyle = '#64ffda';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-26, 4);
        ctx.lineTo(-4, -22);
        ctx.lineTo(18, -14);
        ctx.lineTo(18, 14);
        ctx.lineTo(-4, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const tongueLen = 10 + Math.sin(time * 0.25) * 6;
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-26, 4);
        ctx.lineTo(-26 - tongueLen, 4);
        ctx.lineTo(-32 - tongueLen, 0);
        ctx.moveTo(-26 - tongueLen, 4);
        ctx.lineTo(-32 - tongueLen, 8);
        ctx.stroke();

        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.ellipse(-6, -8, 6, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(-7, -11, 2, 6);
        break;
      }
    }

    if (freezeTimer > 0) {
      ctx.fillStyle = 'rgba(129, 212, 250, 0.55)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-radius, -radius - 6, radius * 2, radius * 2 + 8, 6);
      else ctx.rect(-radius, -radius - 6, radius * 2, radius * 2 + 8);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    const barW = enemy.isBoss ? 68 : 46;
    drawHealthBar(enemy.x - barW / 2, enemy.y - radius - 16, barW, 5, enemy.hp / enemy.maxHp, enemy.isBoss ? '#ab47bc' : '#ef5350');
  }
};

// ==========================================
// 二、 UI 初始化与矢量卡牌图标渲染
// ==========================================
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
    card.title = `${u.name}：${u.desc}`;
    card.onclick = () => selectCard(u);

    card.innerHTML = `
      <span class="card-tag">${u.tag}</span>
      <canvas class="card-icon-canvas" id="icon-${u.id}" width="72" height="72"></canvas>
      <div class="card-footer">
        <div class="card-name">${u.name}</div>
        <div class="card-cost">⚙ ${u.cost}</div>
      </div>
      <div class="cd-overlay" id="cd-${u.id}"></div>
    `;
    container.appendChild(card);

    const iconCanvas = document.getElementById(`icon-${u.id}`);
    const ictx = iconCanvas.getContext('2d');
    ictx.save();
    ictx.translate(36, 36);
    ictx.scale(0.95, 0.95);
    VectorArt.drawTowerUnit(ictx, u.id, 15, { armed: true });
    ictx.restore();
  });
}

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
  if (window.soundEngine) window.soundEngine.playLawnMower();
  spawnFloatingText(BOARD_X + 380, BOARD_Y + 220, '⚡ 矩子令：全军机巧过载！', '#ffca28', 24);
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
    const canAfford = state.qi >= u.cost && state.cardCooldowns[u.id] <= 0;
    el.classList.toggle('disabled', !canAfford);
    el.classList.toggle('selected', state.selectedCard && state.selectedCard.id === u.id);
    const ratio = Math.max(0, state.cardCooldowns[u.id] / u.cd) * 100;
    cdEl.style.height = `${ratio}%`;
  });
}

// ==========================================
// 三、 战场交互与战斗逻辑
// ==========================================
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const c = Math.floor((mx - BOARD_X) / CELL_W);
  const r = Math.floor((my - BOARD_Y) / CELL_H);
  state.hoverCell = (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? { r, c } : { r: -1, c: -1 };
});

canvas.addEventListener('click', e => {
  if (state.paused) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // 1. 点击拾取天工灵气齿轮
  for (let i = state.gears.length - 1; i >= 0; i--) {
    const g = state.gears[i];
    if (Math.hypot(mx - g.x, my - g.y) < 30) {
      state.qi += g.val;
      if (window.soundEngine) window.soundEngine.playSun();
      spawnFloatingText(g.x, g.y, `+${g.val} 灵气`, '#ffe082', 16);
      state.gears.splice(i, 1);
      updateHUD();
      return;
    }
  }

  const { r, c } = state.hoverCell;
  if (r < 0 || c < 0) return;

  const existingIdx = state.towers.findIndex(t => t.r === r && t.c === c);

  // 2. 鲁班拆解钳回收
  if (state.shovelMode) {
    if (existingIdx !== -1) {
      const removed = state.towers[existingIdx];
      const rate = state.activeBuffs.has('mine_shrapnel') ? 0.75 : 0.4;
      const refund = Math.floor(removed.cost * rate);
      state.qi += refund;
      if (window.soundEngine) window.soundEngine.playShovel();
      spawnFloatingText(removed.x, removed.y, `回收 +${refund}`, '#4fc3f7', 16);
      if (state.activeBuffs.has('mine_shrapnel')) {
        createExplosion(removed.x, removed.y, 130, 800);
      }
      state.towers.splice(existingIdx, 1);
      state.shovelMode = false;
      document.getElementById('shovel-btn').classList.remove('active');
      updateHUD();
    }
    return;
  }

  // 3. 部署墨家机关
  if (state.selectedCard && existingIdx === -1) {
    const u = state.selectedCard;
    const elem = state.elementalTiles[`${r}_${c}`];
    state.qi -= u.cost;
    state.cardCooldowns[u.id] = elem === 'water' ? u.cd * 0.7 : u.cd;

    const x = BOARD_X + c * CELL_W + CELL_W / 2;
    const y = BOARD_Y + r * CELL_H + CELL_H / 2;

    if (window.soundEngine) window.soundEngine.playPlant();

    if (u.id === 'fire_crow') {
      spawnFireCrowRow(r, y);
    } else {
      state.towers.push({
        id: u.id, name: u.name, r, c, x, y,
        hp: u.hp, maxHp: u.hp, cost: u.cost,
        timer: 0, shotCount: 0,
        armed: u.id !== 'landmine', armTimer: 0,
        digesting: false, digestTimer: 0,
        scaleX: 1.35, scaleY: 0.65, hitFlash: 0
      });
    }

    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x, y: y + 18,
        vx: (Math.random() - 0.5) * 4.5, vy: (Math.random() - 1) * 3.5,
        size: 3 + Math.random() * 3, color: '#d4af37', life: 24
      });
    }
    state.selectedCard = null;
    updateHUD();
  }
});

function spawnFireCrowRow(r, y) {
  if (window.soundEngine) window.soundEngine.playLawnMower();
  spawnFloatingText(BOARD_X + 240, y - 10, '🔥 神火飞鸦 · 焚尽八荒！', '#ff7043', 20);
  state.bullets.push({
    x: BOARD_X - 10, y, r, vx: 9.5, dmg: 1200, isCrow: true, radius: 30
  });
}

function createExplosion(x, y, radius, dmg) {
  if (window.soundEngine) window.soundEngine.playExplosion();
  state.enemies.forEach(en => {
    if (Math.hypot(en.x - x, en.y - y) <= radius) {
      en.hp -= dmg;
      en.hitFlash = 8;
    }
  });
  for (let i = 0; i < 30; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 5.5;
    state.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      size: 4 + Math.random() * 5,
      color: i % 2 === 0 ? '#ff5722' : '#ffca28',
      life: 32
    });
  }
}

function spawnFloatingText(x, y, text, color = '#fff', size = 15) {
  state.particles.push({ x, y, vx: 0, vy: -1.1, text, color, size, life: 45 });
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
      spawnFloatingText(490, 260, `✨ 习得秘术：${b.title}`, '#ffca28', 22);
      updateHUD();
    };
    div.innerHTML = `
      <div class="buff-tag">${b.tag}</div>
      <div class="buff-title">${b.title}</div>
      <div class="buff-desc">${b.desc}</div>
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
    { typeId: 'soldier', name: '残破兵俑', hp: 250, spd: 0.45, radius: 22 },
    { typeId: 'rattan', name: '藤甲尸兵', hp: 480, spd: 0.38, radius: 24 },
    { typeId: 'ape', name: '飞爪山魈', hp: 340, spd: 0.85, radius: 21, canVault: true },
    { typeId: 'hammer', name: '重锤力士', hp: 980, spd: 0.28, radius: 27 }
  ];
  const maxIdx = Math.min(roster.length - 1, Math.floor(state.wave * 0.55));
  const tpl = roster[Math.floor(Math.random() * (maxIdx + 1))];
  const mult = 1 + (state.wave - 1) * 0.18;

  state.enemies.push({
    ...tpl, r, x: BOARD_X + COLS * CELL_W + 30, y,
    hp: Math.floor(tpl.hp * mult),
    maxHp: Math.floor(tpl.hp * mult),
    chillTimer: 0, freezeTimer: 0, hitFlash: 0,
    walkPhase: Math.random() * Math.PI * 2
  });
}

function spawnXiangliuBoss() {
  state.bossSpawned = true;
  if (window.soundEngine) window.soundEngine.playHugeWave();
  spawnFloatingText(490, 240, '🐍 山海凶神【九首·相柳】降临！', '#00bfa5', 26);
  for (let r = 0; r < ROWS; r++) {
    const y = BOARD_Y + r * CELL_H + CELL_H / 2;
    state.enemies.push({
      typeId: 'boss_head', name: `相柳蛇首`,
      r, x: BOARD_X + COLS * CELL_W - 25, y,
      hp: 2600, maxHp: 2600, spd: 0.06, radius: 30,
      isBoss: true, chillTimer: 0, freezeTimer: 0, hitFlash: 0,
      walkPhase: r
    });
  }
}

// ==========================================
// 四、 主循环更新与渲染 (60FPS)
// ==========================================
let lastTime = performance.now();
let tickCount = 0;

function update(now) {
  const dt = now - lastTime;
  lastTime = now;
  if (state.paused) return;
  tickCount++;

  UNIT_CATALOG.forEach(u => {
    if (state.cardCooldowns[u.id] > 0) {
      state.cardCooldowns[u.id] = Math.max(0, state.cardCooldowns[u.id] - dt);
    }
  });
  if (state.overloadTimer > 0) state.overloadTimer--;

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
      const wait = state.activeBuffs.has('gold_furnace') ? 450 : 640;
      if (t.timer >= wait) {
        t.timer = 0;
        t.scaleX = 1.25; t.scaleY = 0.8;
        state.gears.push({ x: t.x + (Math.random() - 0.5) * 28, y: t.y - 10, targetY: t.y + 20, val: 25, life: 600 });
        if (state.activeBuffs.has('gold_furnace') && state.enemies.length > 0) {
          state.enemies.slice(0, 3).forEach(target => {
            state.bullets.push({ x: t.x, y: t.y, r: target.r, vx: 8, dmg: 60, color: '#ff5722', radius: 6 });
          });
        }
      }
    }
    else if (t.id === 'landmine') {
      if (!t.armed) {
        t.armTimer++;
        if (t.armTimer >= 260) {
          t.armed = true;
          spawnFloatingText(t.x, t.y - 24, '⚡ 埋雷激活!', '#ffca28', 13);
        }
      } else {
        const trigger = state.enemies.find(e => e.r === t.r && Math.abs(e.x - t.x) < 38);
        if (trigger) {
          createExplosion(t.x, t.y, 125, 1500);
          spawnFloatingText(t.x, t.y, '💥 震天爆破!', '#ff5722', 20);
          state.towers.splice(tIdx, 1);
        }
      }
    }
    else if (t.id === 'taotie') {
      if (t.digesting) {
        t.digestTimer--;
        if (t.digestTimer <= 0) {
          t.digesting = false;
          const bonusQi = state.activeBuffs.has('fast_taotie') ? 50 : 25;
          state.qi += bonusQi;
          spawnFloatingText(t.x, t.y - 20, `炼化完成 +${bonusQi}灵气`, '#ea80fc', 15);
        }
      } else {
        const preyIdx = state.enemies.findIndex(e => !e.isBoss && e.r === t.r && e.x > t.x - 10 && e.x < t.x + 85);
        if (preyIdx !== -1) {
          state.enemies.splice(preyIdx, 1);
          t.digesting = true;
          t.digestTimer = state.activeBuffs.has('fast_taotie') ? 360 : 720;
          t.scaleX = 1.4; t.scaleY = 1.4;
          if (window.soundEngine) window.soundEngine.playChomp();
          spawnFloatingText(t.x, t.y, '👄 吞噬炼化!', '#ffca28', 16);
        }
      }
    }
    else if (t.id === 'shield' && state.activeBuffs.has('lava_shield') && tickCount % 30 === 0) {
      state.enemies.forEach(e => {
        if (e.r === t.r && Math.abs(e.x - t.x) < 75) {
          e.hp -= 30;
          e.hitFlash = 3;
        }
      });
    }
    else if (t.id === 'crossbow' || t.id === 'frost_mage' || t.id === 'pear_blossom') {
      const hasEnemy = state.enemies.some(e => (t.id === 'pear_blossom' ? Math.abs(e.r - t.r) <= 1 : e.r === t.r) && e.x > t.x);
      if (hasEnemy && t.timer >= 80) {
        t.timer = 0;
        t.shotCount++;
        t.scaleX = 0.8; t.scaleY = 1.2;

        const isFrost = t.id === 'frost_mage';
        const isThunder = !isFrost && state.activeBuffs.has('thunder_bow');
        let dmg = isFrost ? 22 : (isThunder ? 36 : 26);
        if (elem === 'fire') dmg += 8;

        if (window.soundEngine) {
          if (isFrost) window.soundEngine.playFreeze();
          else window.soundEngine.playArrow();
        }

        const rowsToShoot = t.id === 'pear_blossom' ? [t.r - 1, t.r, t.r + 1] : [t.r];
        rowsToShoot.forEach(targetRow => {
          if (targetRow >= 0 && targetRow < ROWS) {
            state.bullets.push({
              x: t.x + 22,
              y: BOARD_Y + targetRow * CELL_H + CELL_H / 2,
              r: targetRow,
              vx: 8.5, dmg, isFrost, isThunder,
              color: isFrost ? '#4fc3f7' : (isThunder ? '#e040fb' : '#ffd54f'),
              radius: isFrost ? 6 : 4.5
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
        if (window.soundEngine) window.soundEngine.playHit();

        if (b.isFrost) {
          e.chillTimer = 240;
          if (Math.random() < 0.25) e.freezeTimer = 75;
        }
        if (b.isThunder && state.enemies.length > 1) {
          const near = state.enemies.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 160);
          if (near) {
            near.hp -= b.dmg * 0.5;
            near.hitFlash = 5;
          }
        }
        for (let k = 0; k < 4; k++) {
          state.particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            size: 2.5, color: b.color || '#ffd54f', life: 14
          });
        }
        if (!b.isCrow) {
          state.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.chillTimer > 0) e.chillTimer--;
    if (e.freezeTimer > 0) { e.freezeTimer--; continue; }

    const blocker = state.towers.find(t => t.r === e.r && Math.abs(t.x - e.x) < 36);
    if (blocker) {
      if (e.canVault && state.elementalTiles[`${blocker.r}_${blocker.c}`] !== 'earth') {
        e.canVault = false;
        e.x -= 85;
        spawnFloatingText(e.x, e.y - 25, '飞爪翻越!', '#ea80fc', 14);
      } else {
        const dmgReduction = (blocker.id === 'taotie' && blocker.digesting && state.activeBuffs.has('fast_taotie')) ? 0.4 : 1;
        blocker.hp -= 0.75 * dmgReduction;
        blocker.hitFlash = 2;
        if (blocker.id === 'shield') {
          e.hp -= state.activeBuffs.has('lava_shield') ? 0.8 : 0.35;
        }
        if (blocker.hp <= 0) {
          const idx = state.towers.indexOf(blocker);
          if (idx !== -1) state.towers.splice(idx, 1);
        }
      }
    } else {
      const spdMult = e.chillTimer > 0 ? 0.5 : 1;
      e.x -= e.spd * spdMult;
    }

    if (e.x < BOARD_X - 8) {
      if (state.lions[e.r]) {
        state.lions[e.r] = false;
        if (window.soundEngine) window.soundEngine.playLawnMower();
        spawnFireCrowRow(e.r, e.y);
        spawnFloatingText(BOARD_X + 70, e.y, '🦁 石狮吐焰！', '#ffca28', 18);
      } else {
        e.x = BOARD_X + COLS * CELL_W;
      }
    }

    if (e.hp <= 0) {
      state.energy = Math.min(100, state.energy + 8);
      waveKills++;
      for (let k = 0; k < 12; k++) {
        state.particles.push({
          x: e.x, y: e.y,
          vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
          size: 3.5, color: '#8d6e63', life: 24
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

  updateHUD();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  const elemStyles = {
    fire: { color: 'rgba(235, 77, 45, 0.45)', stroke: '#ff7043', label: '🔥火脉·攻速' },
    water: { color: 'rgba(41, 182, 246, 0.45)', stroke: '#4fc3f7', label: '💧水脉·减CD' },
    earth: { color: 'rgba(218, 165, 32, 0.45)', stroke: '#ffd54f', label: '⛰️土脉·免越' },
    metal: { color: 'rgba(224, 224, 224, 0.4)', stroke: '#eceff1', label: '⚔️金脉·破甲' }
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * CELL_W;
      const y = BOARD_Y + r * CELL_H;
      const isCore = (c === 1 || c === 2);

      ctx.fillStyle = (r + c) % 2 === 0
        ? (isCore ? '#25353b' : '#1d292e')
        : (isCore ? '#1f2d33' : '#162024');
      ctx.fillRect(x, y, CELL_W, CELL_H);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);

      const key = `${r}_${c}`;
      if (state.elementalTiles[key]) {
        const st = elemStyles[state.elementalTiles[key]];
        const pulse = (Math.sin(tickCount * 0.06) + 1) * 0.5;
        const grad = ctx.createRadialGradient(
          x + CELL_W / 2, y + CELL_H / 2, 4,
          x + CELL_W / 2, y + CELL_H / 2, CELL_W * 0.48
        );
        grad.addColorStop(0, st.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.65 + pulse * 0.35;
        ctx.fillRect(x, y, CELL_W, CELL_H);
        ctx.globalAlpha = 1;

        ctx.fillStyle = st.stroke;
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.label, x + CELL_W / 2, y + CELL_H - 7);
      }

      ctx.strokeStyle = isCore ? 'rgba(212, 175, 55, 0.36)' : 'rgba(212, 175, 55, 0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_W, CELL_H);
    }
  }

  if (state.hoverCell.r >= 0 && (state.selectedCard || state.shovelMode)) {
    const { r, c } = state.hoverCell;
    const hx = BOARD_X + c * CELL_W;
    const hy = BOARD_Y + r * CELL_H;
    ctx.save();
    ctx.fillStyle = state.shovelMode ? 'rgba(255, 82, 82, 0.12)' : 'rgba(255, 215, 0, 0.07)';
    ctx.fillRect(BOARD_X, hy, COLS * CELL_W, CELL_H);
    ctx.fillRect(hx, BOARD_Y, CELL_W, ROWS * CELL_H);

    if (state.selectedCard) {
      ctx.translate(hx + CELL_W / 2, hy + CELL_H / 2);
      ctx.globalAlpha = 0.55;
      VectorArt.drawTowerUnit(ctx, state.selectedCard.id, tickCount, { armed: true });
    }
    ctx.restore();
  }

  for (let r = 0; r < ROWS; r++) {
    if (state.lions[r]) {
      VectorArt.drawGuardianLion(ctx, BOARD_X - 44, BOARD_Y + r * CELL_H + CELL_H / 2, tickCount);
    }
  }

  const breath = Math.sin(tickCount * 0.08) * 0.03;
  state.towers.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scaleX, t.scaleY + breath);
    if (t.hitFlash > 0) ctx.filter = 'brightness(250%)';

    VectorArt.drawTowerUnit(ctx, t.id, tickCount, {
      isOverload: state.overloadTimer > 0,
      armed: t.armed,
      digesting: t.digesting,
      hasThunder: state.activeBuffs.has('thunder_bow'),
      hasLava: state.activeBuffs.has('lava_shield')
    });

    if (t.hp < t.maxHp) {
      drawHealthBar(-24, -40, 48, 5, t.hp / t.maxHp, '#66bb6a');
    }
    ctx.restore();
  });

  state.enemies.forEach(e => {
    VectorArt.drawEnemyUnit(ctx, e, tickCount);
  });

  state.bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.isCrow) {
      VectorArt.drawTowerUnit(ctx, 'fire_crow', tickCount);
    } else {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.fillRect(-10, -2, 18, 4);
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -5);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });

  state.gears.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(tickCount * 0.04);
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffca28';
    ctx.strokeStyle = '#8c6d3b';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -16, 6, 32);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#162024';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });

  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 18);
    if (p.text) {
      ctx.font = `bold ${p.size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawHealthBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}

initElementalTiles();
initCardsUI();
updateHUD();

function gameLoop(now) {
  update(now);
  render();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
