/**
 * 《山海机关录：墨守》殿堂级骨骼矢量与原画混合渲染引擎 v4.0
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 5, COLS = 9;
const CELL_W = 94, CELL_H = 92;
const BOARD_X = 104, BOARD_Y = 42;

// 绑定 assets 目录下的原画素材
const ASSET_MAP = {
  bg: 'assets/background.jpg',
  furnace: 'assets/furnace.jpg',
  crossbow: 'assets/crossbow.jpg',
  landmine: 'assets/landmine.jpg',
  frost_mage: 'assets/frost_mage.jpg',
  fire_crow: 'assets/fire_crow.jpg',
  lion: 'assets/guardian_lion.jpg'
};
const LOADED_IMAGES = {};
Object.entries(ASSET_MAP).forEach(([k, src]) => {
  const img = new Image();
  img.src = src;
  LOADED_IMAGES[k] = img;
});

// 8 张典藏机关卡配置
const UNIT_CATALOG = [
  { id: 'furnace', name: '聚灵烘炉', role: '经济', cost: 50, cd: 4500, hp: 320, img: ASSET_MAP.furnace, desc: '每16秒产出25灵气齿轮；九宫格友军攻速+15%' },
  { id: 'crossbow', name: '诸葛连弩', role: '连射', cost: 100, cd: 4000, hp: 320, img: ASSET_MAP.crossbow, desc: '发射破甲重箭，每4次射击必定触发双发连射' },
  { id: 'shield', name: '玄武重盾', role: '重装', cost: 75, cd: 9000, hp: 3500, img: null, desc: '先秦青铜玄武巨盾，受击反弹震荡伤害' },
  { id: 'landmine', name: '震天埋雷', role: '陷阱', cost: 25, cd: 10000, hp: 260, img: ASSET_MAP.landmine, desc: '旋紧发条后潜伏地下，踩中引发1500伤害爆破' },
  { id: 'taotie', name: '吞天饕餮', role: '吞噬', cost: 150, cd: 8500, hp: 480, img: null, desc: '一口吞下前方单体魇魔，炼化后吐出25灵气' },
  { id: 'frost_mage', name: '寒霜方士', role: '冰控', cost: 175, cd: 5500, hp: 320, img: ASSET_MAP.frost_mage, desc: '发射玄冰符减速40%，概率触发玄冰封印' },
  { id: 'pear_blossom', name: '暴雨梨花', role: '三行', cost: 225, cd: 7500, hp: 360, img: null, desc: '重型三联排弩，同时向本行及上下相邻行齐射' },
  { id: 'fire_crow', name: '神火飞鸦', role: '轰炸', cost: 150, cd: 15000, hp: 9999, img: ASSET_MAP.fire_crow, desc: '召唤赤金机械火鸦席卷整行，造成1200贯穿焚烧' }
];

const ROGUE_BUFFS = [
  { id: 'thunder_bow', tag: '天工改造', title: '【雷公连弩】', desc: '诸葛连弩与暴雨梨花淬炼紫电，命中触发连锁闪电弹射且伤害+35%！' },
  { id: 'lava_shield', tag: '天工改造', title: '【熔岩玄武】', desc: '玄武重盾展开烈焰八卦障，每秒灼烧前方魇魔且反伤翻倍！' },
  { id: 'gold_furnace', tag: '天工改造', title: '【烈阳金乌炉】', desc: '聚灵烘炉产灵加快30%，且每次产灵自动发射3枚追踪阳炎弹！' },
  { id: 'fast_taotie', tag: '天工改造', title: '【暴食吞天兽】', desc: '吞天饕餮炼化时间减半，消化期获60%减伤且吐出50紫金灵气！' },
  { id: 'mine_shrapnel', tag: '墨家奇术', title: '【草木皆兵】', desc: '鲁班钳拆解返还提至75%，且拆解瞬间在原地引发800伤害爆破！' }
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
  ambientSparks: [],
  lions: [true, true, true, true, true],
  cardCooldowns: {},
  bossSpawned: false
};

// 初始化战场漂浮萤火粒子
for (let i = 0; i < 28; i++) {
  state.ambientSparks.push({
    x: Math.random() * 1000,
    y: Math.random() * 550,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.2 - Math.random() * 0.4,
    r: 1 + Math.random() * 2,
    alpha: Math.random()
  });
}

// ====================================================
// 一、 殿堂级精密机械与山海骨骼矢量绘制库 (MasterArt)
// ====================================================
const BAGUA_RUNES = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];

const MasterArt = {
  // 1. 绘制真实渐开线机械齿轮
  drawCogwheel(ctx, rOuter, rInner, teeth, rot, fillStyle, strokeStyle) {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.5;
      const a3 = a0 + step * 0.72;
      ctx.lineTo(Math.cos(a0) * rInner, Math.sin(a0) * rInner);
      ctx.lineTo(Math.cos(a1) * rOuter, Math.sin(a1) * rOuter);
      ctx.lineTo(Math.cos(a2) * rOuter, Math.sin(a2) * rOuter);
      ctx.lineTo(Math.cos(a3) * rInner, Math.sin(a3) * rInner);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();

    // 齿轮镂空轴承与十字辐条
    ctx.beginPath();
    ctx.arc(0, 0, rInner * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // 2. 绘制八卦青铜浮雕法阵底盘
  drawBaguaPedestal(ctx, radius, rot, glowColor = '#d4af37') {
    ctx.save();
    // 底部环境投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 6, radius + 4, radius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // 外层八角青铜盘
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const px = Math.cos(a) * (radius + 3);
      const py = Math.sin(a) * (radius + 3);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    const baseGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius + 3);
    baseGrad.addColorStop(0, '#2a3d45');
    baseGrad.addColorStop(0.75, '#162126');
    baseGrad.addColorStop(1, '#0d1417');
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = glowColor;
    ctx.stroke();

    // 内圈暗金八卦符文环
    ctx.fillStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.save();
      ctx.translate(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(BAGUA_RUNES[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  },

  // 3. 绘制 8 大墨家机关高精矢量模型
  drawTower(ctx, id, time = 0, opts = {}) {
    const { isOverload = false, armed = true, digesting = false, hasThunder = false, hasLava = false } = opts;
    const accent = isOverload ? '#ff5722' : '#d4af37';

    ctx.save();
    if (id !== 'landmine' && id !== 'fire_crow') {
      this.drawBaguaPedestal(ctx, 33, id === 'furnace' ? time * 0.012 : 0, accent);
    }

    switch (id) {
      case 'furnace': {
        // 【聚灵烘炉】：双层逆向咬合齿轮 + 三足青铜丹鼎 + 体积灵火
        this.drawCogwheel(ctx, 27, 22, 12, -time * 0.02, '#5c4312', '#d4af37');

        // 三足鼎耳与护翼
        ctx.fillStyle = '#9e731c';
        ctx.strokeStyle = '#ffecb3';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / 3);
          ctx.beginPath();
          ctx.roundRect(-5, -31, 10, 9, 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 鼎腹金属球体渐变
        const bodyGrad = ctx.createRadialGradient(-6, -6, 3, 0, 0, 21);
        bodyGrad.addColorStop(0, '#546e7a');
        bodyGrad.addColorStop(0.6, '#263238');
        bodyGrad.addColorStop(1, '#11171a');
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#ffd54f';
        ctx.stroke();

        // 炉口跃动真火 (Additive Glow)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fireR = 13 + Math.sin(time * 0.12) * 2.5;
        const fireGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, fireR);
        fireGrad.addColorStop(0, '#ffffff');
        fireGrad.addColorStop(0.4, '#ffd54f');
        fireGrad.addColorStop(0.8, '#ff5722');
        fireGrad.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(0, 0, fireR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'crossbow':
      case 'pear_blossom': {
        const isMulti = id === 'pear_blossom';
        // 底部传动齿轮
        this.drawCogwheel(ctx, 22, 17, 10, time * 0.015, '#263238', '#90a4ae');

        // 复合反曲黄金弩臂（双层金属质感）
        const bowColor = hasThunder ? '#e040fb' : (isMulti ? '#ff7043' : '#ffd54f');
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(6, -30);
        ctx.bezierCurveTo(22, -18, 20, -6, 12, 0);
        ctx.bezierCurveTo(20, 6, 22, 18, 6, 30);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#4e342e';
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = bowColor;
        ctx.stroke();

        // 弩臂两端雕花金翼
        [[-30, -1], [30, 1]].forEach(([py, dir]) => {
          ctx.beginPath();
          ctx.moveTo(6, py);
          ctx.lineTo(14, py - dir * 5);
          ctx.lineTo(2, py - dir * 2);
          ctx.closePath();
          ctx.fillStyle = '#ffecb3';
          ctx.fill();
        });

        // 紧绷弓弦
        ctx.beginPath();
        ctx.moveTo(6, -29);
        ctx.lineTo(-12, 0);
        ctx.lineTo(6, 29);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = hasThunder ? '#ea80fc' : '#eceff1';
        ctx.stroke();

        // 紫檀木镶金弩身与望山准星
        const stockGrad = ctx.createLinearGradient(-24, -8, 16, 8);
        stockGrad.addColorStop(0, '#3e2723');
        stockGrad.addColorStop(0.5, '#5d4037');
        stockGrad.addColorStop(1, '#271815');
        ctx.fillStyle = stockGrad;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-24, -7, 38, 14, 4);
        ctx.fill();
        ctx.stroke();

        // 上膛箭矢（带金属棱角箭头与赤羽）
        const angles = isMulti ? [-0.26, 0, 0.26] : [0];
        angles.forEach(ang => {
          ctx.save();
          ctx.rotate(ang);
          // 箭杆
          ctx.fillStyle = hasThunder ? '#e1bee7' : '#ffe082';
          ctx.fillRect(-14, -1.2, 32, 2.4);
          // 倒刺破甲箭头
          ctx.beginPath();
          ctx.moveTo(27, 0);
          ctx.lineTo(16, -5.5);
          ctx.lineTo(19, 0);
          ctx.lineTo(16, 5.5);
          ctx.closePath();
          ctx.fillStyle = hasThunder ? '#00e5ff' : '#ffd54f';
          ctx.fill();
          ctx.restore();
        });

        // 中心太极铜枢
        ctx.beginPath();
        ctx.arc(-4, 0, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'shield': {
        // 【玄武重盾】：先秦青铜饕餮纹重装塔盾 + 能量障壁
        ctx.save();
        // 前方半透明八卦护盾光弧
        ctx.beginPath();
        ctx.arc(6, 0, 31, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = hasLava ? 'rgba(255, 87, 34, 0.75)' : 'rgba(0, 229, 255, 0.65)';
        ctx.stroke();

        // 塔盾主体（八角内凹折角）
        ctx.beginPath();
        ctx.moveTo(18, -26);
        ctx.lineTo(26, -14);
        ctx.lineTo(26, 14);
        ctx.lineTo(18, 26);
        ctx.lineTo(-14, 29);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-14, -29);
        ctx.closePath();

        const shGrad = ctx.createLinearGradient(-22, -26, 26, 26);
        if (hasLava) {
          shGrad.addColorStop(0, '#bf360c');
          shGrad.addColorStop(0.5, '#3e2723');
          shGrad.addColorStop(1, '#ff6f00');
        } else {
          shGrad.addColorStop(0, '#455a64');
          shGrad.addColorStop(0.5, '#1c282e');
          shGrad.addColorStop(1, '#0f171b');
        }
        ctx.fillStyle = shGrad;
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = hasLava ? '#ffab00' : '#d4af37';
        ctx.stroke();

        // 盾面青铜龟甲浮雕纹与狮鼻盾心
        ctx.strokeStyle = 'rgba(255, 224, 130, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2, -16); ctx.lineTo(14, 0); ctx.lineTo(2, 16); ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(3, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = hasLava ? '#ff3d00' : '#26a69a';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'landmine': {
        // 【震天埋雷】：精密发条锯齿盘 + 赤玉引信
        ctx.save();
        if (!armed) ctx.globalAlpha = 0.65;
        this.drawCogwheel(ctx, 26, 19, 10, armed ? time * 0.03 : 0, '#263238', armed ? '#ff5252' : '#78909c');

        // 铜制内盘
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#162025';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#d4af37';
        ctx.stroke();

        // 中心呼吸赤玉雷珠
        const pulse = armed ? (Math.sin(time * 0.2) + 1) * 0.5 : 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, 7 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = armed ? '#ff1744' : '#546e7a';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = armed ? 14 : 0;
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'taotie': {
        // 【吞天饕餮】：三星堆/商周青铜兽面纹造型 + 开合巨口獠牙
        ctx.save();
        // 左右盘旋青铜巨角
        ctx.fillStyle = '#b8860b';
        ctx.strokeStyle = '#ffecb3';
        ctx.lineWidth = 1.6;
        [-1, 1].forEach(dir => {
          ctx.beginPath();
          ctx.moveTo(-6, dir * 14);
          ctx.quadraticCurveTo(-24, dir * 32, 6, dir * 28);
          ctx.quadraticCurveTo(-8, dir * 22, -2, dir * 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });

        // 青铜饕餮兽面主体
        const maskGrad = ctx.createRadialGradient(-4, 0, 4, 0, 0, 24);
        maskGrad.addColorStop(0, digesting ? '#6a1b9a' : '#2e4c48');
        maskGrad.addColorStop(1, '#121e1c');
        ctx.fillStyle = maskGrad;
        ctx.strokeStyle = digesting ? '#ea80fc' : '#4db6ac';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-18, -20, 36, 40, 10);
        ctx.fill();
        ctx.stroke();

        // 深渊巨口与交错白玉獠牙
        const mouthOpen = digesting ? 5 + Math.sin(time * 0.2) * 2 : 13 + Math.sin(time * 0.08) * 3;
        ctx.fillStyle = '#1a0508';
        ctx.beginPath();
        ctx.ellipse(6, 0, 11, mouthOpen, 0, 0, Math.PI * 2);
        ctx.fill();

        // 上下交错利齿
        ctx.fillStyle = '#fff8e1';
        [-7, 0, 7].forEach(dy => {
          ctx.beginPath();
          ctx.moveTo(14, dy - 3); ctx.lineTo(7, dy); ctx.lineTo(14, dy + 3);
          ctx.fill();
        });

        // 炼化旋涡特效
        if (digesting) {
          ctx.strokeStyle = '#e040fb';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(6, 0, 6, time * 0.15, time * 0.15 + Math.PI * 1.4);
          ctx.stroke();
        }

        // 凸出青铜纵目
        ctx.fillStyle = digesting ? '#00e5ff' : '#ffd54f';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-6, -10, 4, 0, Math.PI * 2);
        ctx.arc(-6, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'frost_mage': {
        // 【寒霜方士】：双层逆转玄冰星盘 + 环绕符箓
        ctx.save();
        // 外层旋转冰晶六芒星
        ctx.rotate(time * 0.018);
        ctx.strokeStyle = '#80d8ff';
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(0, -27);
          ctx.moveTo(-5, -20); ctx.lineTo(0, -25); ctx.lineTo(5, -20);
          ctx.stroke();
        }

        // 3张环绕飞旋的冰魄符箓
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3 - time * 0.04;
          ctx.save();
          ctx.translate(Math.cos(a) * 23, Math.sin(a) * 23);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = '#0277bd';
          ctx.strokeStyle = '#b3e5fc';
          ctx.lineWidth = 1;
          ctx.fillRect(-4, -7, 8, 14);
          ctx.strokeRect(-4, -7, 8, 14);
          ctx.restore();
        }

        // 中心八面体玄冰晶核
        const iceGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 14);
        iceGrad.addColorStop(0, '#ffffff');
        iceGrad.addColorStop(0.5, '#40c4ff');
        iceGrad.addColorStop(1, '#01579b');
        ctx.fillStyle = iceGrad;
        ctx.beginPath();
        ctx.moveTo(0, -14); ctx.lineTo(14, 0); ctx.lineTo(0, 14); ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'fire_crow': {
        // 【神火飞鸦】：精密青铜机械骨骼木鸢 + 烈焰尾羽
        ctx.save();
        const flap = Math.sin(time * 0.35) * 7;
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 16;

        // 展开的层叠机械火翼
        const wingGrad = ctx.createLinearGradient(-20, 0, 20, 0);
        wingGrad.addColorStop(0, '#b71c1c');
        wingGrad.addColorStop(0.6, '#ff6d00');
        wingGrad.addColorStop(1, '#ffd54f');
        ctx.fillStyle = wingGrad;
        ctx.strokeStyle = '#ffecb3';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-4, -28 + flap);
        ctx.lineTo(-14, -10);
        ctx.lineTo(-28, -6);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-28, 6);
        ctx.lineTo(-14, 10);
        ctx.lineTo(-4, 28 - flap);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 背部中心天工齿轮与锐利金喙
        this.drawCogwheel(ctx, 9, 6, 6, time * 0.1, '#d4af37', '#fff');
        ctx.fillStyle = '#fff8e1';
        ctx.beginPath();
        ctx.moveTo(28, 0); ctx.lineTo(14, -5); ctx.lineTo(14, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  },

  // 4. 绘制山海魇魔多层骨骼动画精灵 (Skeletal Monster Renderer)
  drawMonster(ctx, e, time) {
    const { typeId, radius, hitFlash, chillTimer, freezeTimer, walkPhase, isAttacking } = e;
    const t = time * 0.14 + walkPhase;
    const stride = Math.sin(t) * 6;          // 双腿交替迈步位移
    const bob = Math.abs(Math.cos(t)) * -3.5; // 躯干随步伐上下起伏
    const armSwing = isAttacking ? Math.sin(time * 0.45) * 0.9 : Math.cos(t) * 0.3;

    ctx.save();
    ctx.translate(e.x, e.y);

    // 地面环境椭圆软阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.ellipse(0, radius + 3, radius * 0.9, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bob);
    if (hitFlash > 0) {
      ctx.filter = 'brightness(280%) contrast(160%)';
    } else if (chillTimer > 0) {
      ctx.filter = 'hue-rotate(165deg) saturate(180%)';
    }

    // 迈步双足骨骼（所有陆行单位通用底层）
    if (typeId !== 'boss_head') {
      ctx.fillStyle = '#261c19';
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1.5;
      // 左脚与右脚交替前后
      ctx.beginPath();
      ctx.roundRect(-8 + stride, 12, 9, 10, 3);
      ctx.roundRect(2 - stride, 12, 9, 10, 3);
      ctx.fill();
      ctx.stroke();
    }

    switch (typeId) {
      case 'soldier': {
        // 【残破兵俑】：先秦鱼鳞甲武士俑 + 红缨护肩 + 挥砍青铜剑
        // 1. 后手挥舞青铜古剑
        ctx.save();
        ctx.translate(-8, 0);
        ctx.rotate(armSwing - 0.3);
        // 剑刃金属光泽
        ctx.fillStyle = '#b0bec5';
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-26, -3);
        ctx.lineTo(-34, 0);
        ctx.lineTo(-26, 3);
        ctx.lineTo(-4, 2);
        ctx.lineTo(-4, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 攻击剑气弧光
        if (isAttacking) {
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(-14, 0, 20, Math.PI * 0.7, Math.PI * 1.3);
          ctx.stroke();
        }
        ctx.restore();

        // 2. 陶土玄甲躯干与甲片纹
        const armorGrad = ctx.createLinearGradient(-14, -6, 14, 18);
        armorGrad.addColorStop(0, '#6d4c41');
        armorGrad.addColorStop(1, '#3e2723');
        ctx.fillStyle = armorGrad;
        ctx.strokeStyle = '#1b110e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-13, -5, 26, 22, 5);
        ctx.fill();
        ctx.stroke();

        // 披膊护肩与暗红战裙边
        ctx.fillStyle = '#8d261d';
        ctx.fillRect(-14, 12, 28, 4);
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.roundRect(-17, -6, 7, 12, 3);
        ctx.roundRect(10, -6, 7, 12, 3);
        ctx.fill();
        ctx.stroke();

        // 3. 兵俑头颅与先秦方髻
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath();
        ctx.arc(0, -13, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 束发方冠
        ctx.fillStyle = '#271916';
        ctx.fillRect(-5, -28, 10, 6);
        ctx.strokeStyle = '#d4af37';
        ctx.strokeRect(-5, -28, 10, 6);

        // 幽冥绿魂瞳
        ctx.fillStyle = '#00e676';
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-5, -13, 2.5, 0, Math.PI * 2);
        ctx.arc(2, -13, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }

      case 'rattan': {
        // 【藤甲尸兵】：巫毒木面具 + 荆棘肩甲 + 编织古藤大盾
        // 躯干
        ctx.fillStyle = '#2e4a1e';
        ctx.strokeStyle = '#14240b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-13, -6, 26, 22, 6);
        ctx.fill();
        ctx.stroke();

        // 鹿角巫木面具
        ctx.fillStyle = '#558b2f';
        ctx.beginPath();
        ctx.arc(0, -13, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 枯木双角
        ctx.strokeStyle = '#795548';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-6, -21); ctx.lineTo(-12, -30);
        ctx.moveTo(6, -21); ctx.lineTo(12, -30);
        ctx.stroke();

        // 琥珀妖瞳
        ctx.fillStyle = '#ffab00';
        ctx.beginPath();
        ctx.arc(-4, -13, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 左手前置巨型编织藤盾（随步伐微晃）
        ctx.save();
        ctx.translate(-12, 2);
        ctx.rotate(armSwing * 0.3);
        const shieldGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        shieldGrad.addColorStop(0, '#8bc34a');
        shieldGrad.addColorStop(0.7, '#558b2f');
        shieldGrad.addColorStop(1, '#33691e');
        ctx.fillStyle = shieldGrad;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 藤盾十字铜扣
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-7, -11); ctx.lineTo(7, 11);
        ctx.moveTo(7, -11); ctx.lineTo(-7, 11);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd54f';
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'ape': {
        // 【飞爪山魈】：赤发獠牙鬼面山妖 + 飘带 + 机械飞虎爪
        ctx.save();
        ctx.rotate(-0.18); // 敏捷前冲姿态

        // 身后飘舞的妖风红绸
        ctx.strokeStyle = '#d50000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.quadraticCurveTo(24, -14 + stride, 32, -4 - stride);
        ctx.stroke();

        // 苍紫妖兽躯干
        ctx.fillStyle = '#4a148c';
        ctx.strokeStyle = '#ea80fc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 2, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 怒张赤焰鬃毛与鬼面
        ctx.fillStyle = '#dd2c00';
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(-2, -26);
        ctx.lineTo(6, -18);
        ctx.lineTo(16, -24);
        ctx.lineTo(14, -6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#311b92';
        ctx.beginPath();
        ctx.arc(-4, -9, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 黄金竖瞳与外露白牙
        ctx.fillStyle = '#ffd600';
        ctx.beginPath();
        ctx.arc(-8, -10, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // 前探机械锁链飞虎爪
        ctx.save();
        ctx.translate(-12, 2);
        ctx.rotate(armSwing);
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-16, -4);
        ctx.moveTo(-16, -4); ctx.lineTo(-10, -11);
        ctx.moveTo(-16, -4); ctx.lineTo(-11, 4);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
        break;
      }

      case 'hammer': {
        // 【重锤力士】：重装魔神铁浮屠 + 冲天金角盔 + 擂鼓瓮金锤 + 饕餮重盾
        // 1. 右手高举挥动的巨型青铜重锤
        ctx.save();
        ctx.translate(8, -4);
        ctx.rotate(armSwing * 1.3);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-2, -28, 4, 28);
        // 棱刺重锤头
        const hamGrad = ctx.createRadialGradient(-3, -30, 2, 0, -28, 12);
        hamGrad.addColorStop(0, '#90a4ae');
        hamGrad.addColorStop(1, '#263238');
        ctx.fillStyle = hamGrad;
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -28, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 2. 魁梧重甲霸体躯干
        const bodyGrad = ctx.createLinearGradient(-18, -12, 18, 20);
        bodyGrad.addColorStop(0, '#37474f');
        bodyGrad.addColorStop(0.5, '#1c262b');
        bodyGrad.addColorStop(1, '#0d1316');
        ctx.fillStyle = bodyGrad;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-17, -10, 34, 28, 7);
        ctx.fill();
        ctx.stroke();

        // 兽面护腹吞肩兽头
        ctx.fillStyle = '#b8860b';
        ctx.beginPath();
        ctx.arc(0, 4, 6, 0, Math.PI * 2);
        ctx.fill();

        // 3. 魔神牛角重盔
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.moveTo(-10, -14); ctx.quadraticCurveTo(-24, -28, -14, -34); ctx.lineTo(-5, -18);
        ctx.moveTo(10, -14); ctx.quadraticCurveTo(24, -28, 14, -34); ctx.lineTo(5, -18);
        ctx.fill();

        ctx.fillStyle = '#263238';
        ctx.beginPath();
        ctx.arc(0, -15, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 猩红魔眼十字光
        ctx.fillStyle = '#ff1744';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 8;
        ctx.fillRect(-8, -16, 12, 3);
        ctx.shadowBlur = 0;

        // 4. 左手前置玄铁重盾
        ctx.fillStyle = '#1c282e';
        ctx.strokeStyle = '#ffca28';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-24, -8, 12, 26, 3);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'boss_head': {
        // 【九首凶神·相柳】：多节摆动碧鳞龙蛇躯干 + 冠角龙蛇首 + 剧毒吐息珠
        // 1. 蜿蜒蛇颈鳞片节段
        for (let k = 4; k >= 1; k--) {
          const sx = k * 14;
          const sy = Math.sin(time * 0.12 + k * 0.8 + walkPhase) * 6;
          const segR = 20 - k * 2;
          const neckGrad = ctx.createRadialGradient(sx - 3, sy - 3, 2, sx, sy, segR);
          neckGrad.addColorStop(0, '#26a69a');
          neckGrad.addColorStop(0.7, '#004d40');
          neckGrad.addColorStop(1, '#00251a');
          ctx.fillStyle = neckGrad;
          ctx.strokeStyle = '#64ffda';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, segR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // 2. 龙角妖蛇主首
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(20, -32); ctx.lineTo(10, -12);
        ctx.moveTo(0, 16); ctx.lineTo(20, 32); ctx.lineTo(10, 12);
        ctx.fill();

        const headGrad = ctx.createLinearGradient(-28, -20, 18, 20);
        headGrad.addColorStop(0, '#00bfa5');
        headGrad.addColorStop(0.5, '#00695c');
        headGrad.addColorStop(1, '#00332c');
        ctx.fillStyle = headGrad;
        ctx.strokeStyle = '#a7ffeb';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-28, 2);
        ctx.lineTo(-6, -22);
        ctx.lineTo(18, -14);
        ctx.lineTo(18, 14);
        ctx.lineTo(-6, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. 口中蓄力碧绿剧毒宝珠与分叉蛇信
        const orbPulse = 6 + Math.sin(time * 0.2) * 2.5;
        ctx.fillStyle = '#76ff03';
        ctx.shadowColor = '#76ff03';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(-28, 2, orbPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 竖瞳龙目
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.ellipse(-6, -9, 6.5, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(-7, -12, 2, 6);
        break;
      }
    }

    // 玄冰禁锢琥珀晶簇
    if (freezeTimer > 0) {
      ctx.fillStyle = 'rgba(128, 216, 255, 0.52)';
      ctx.strokeStyle = '#e1f5fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-radius, 18);
      ctx.lineTo(-radius + 4, -radius - 8);
      ctx.lineTo(0, -radius - 16);
      ctx.lineTo(radius - 4, -radius - 6);
      ctx.lineTo(radius, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // 绘制精致金属包边血条
    const barW = e.isBoss ? 72 : 48;
    drawOrnateHealthBar(e.x - barW / 2, e.y - radius - 22, barW, 6, e.hp / e.maxHp, e.isBoss ? '#d500f9' : '#ff5252');
  },

  // 5. 绘制阵眼石狮（黄金镇门兽）
  drawGuardianLion(ctx, x, y, time) {
    ctx.save();
    ctx.translate(x, y);
    this.drawBaguaPedestal(ctx, 26, 0, '#d4af37');

    // 黄金螺发狮鬃
    ctx.fillStyle = '#9e731c';
    ctx.strokeStyle = '#ffecb3';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 14, Math.sin(a) * 14, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // 狮首浮雕
    const lionGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
    lionGrad.addColorStop(0, '#ffd54f');
    lionGrad.addColorStop(1, '#8c6d3b');
    ctx.fillStyle = lionGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 炯炯金睛与口含赤焰珠
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(3, -5, 2.5, 0, Math.PI * 2);
    ctx.arc(3, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff3d00';
    ctx.shadowColor = '#ff3d00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(11, 0, 4 + Math.sin(time * 0.12) * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

// ====================================================
// 二、 典藏级 TCG 卡槽与界面初始化
// ====================================================
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
    card.className = 'tcg-card';
    card.id = `card-${u.id}`;
    card.title = `【${u.name}】${u.desc}`;
    card.onclick = () => selectCard(u);

    const imgTag = u.img
      ? `<img class="card-art-img" src="${u.img}" onerror="this.style.display='none'">`
      : '';

    card.innerHTML = `
      <div class="tcg-card-inner">
        ${imgTag}
        <canvas class="card-art-canvas" id="icon-${u.id}" width="80" height="80"></canvas>
        <div class="card-vignette"></div>
        <div class="card-cost-gem">${u.cost}</div>
        <div class="card-role-badge">${u.role}</div>
        <div class="card-nameplate">
          <div class="card-title">${u.name}</div>
        </div>
        <div class="cd-mask" id="cd-${u.id}"></div>
      </div>
    `;
    container.appendChild(card);

    // 绘制卡牌上的高精矢量立绘（无原画卡全量显示，有原画卡作为精致右下角徽章或居中立绘）
    const cCanvas = document.getElementById(`icon-${u.id}`);
    const cCtx = cCanvas.getContext('2d');
    cCtx.save();
    cCtx.translate(40, 42);
    cCtx.scale(u.img ? 0.72 : 1.0, u.img ? 0.72 : 1.0);
    if (u.img) cCtx.globalAlpha = 0.9;
    MasterArt.drawTower(cCtx, u.id, 20, { armed: true });
    cCtx.restore();
  });

  // 绘制鲁班拆解钳法宝矢量图
  const sCanvas = document.getElementById('shovel-canvas');
  const sCtx = sCanvas.getContext('2d');
  sCtx.translate(27, 27);
  MasterArt.drawCogwheel(sCtx, 22, 17, 8, 0.3, '#37474f', '#d4af37');
  sCtx.fillStyle = '#ffd54f';
  sCtx.strokeStyle = '#5c4312';
  sCtx.lineWidth = 1.5;
  sCtx.beginPath();
  sCtx.arc(0, 0, 8, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.stroke();
}

function selectCard(unit) {
  if (state.paused) return;
  if (state.qi < unit.cost || state.cardCooldowns[unit.id] > 0) return;
  state.shovelMode = false;
  document.getElementById('shovel-orb').classList.remove('active');
  state.selectedCard = (state.selectedCard && state.selectedCard.id === unit.id) ? null : unit;
  updateHUD();
}

function toggleShovel() {
  state.selectedCard = null;
  state.shovelMode = !state.shovelMode;
  document.getElementById('shovel-orb').classList.toggle('active', state.shovelMode);
  updateHUD();
}

function triggerGlobalOverload() {
  if (state.energy < 50 || state.overloadTimer > 0) return;
  state.energy -= 50;
  state.overloadTimer = 420;
  state.screenShake = 12;
  spawnFloatingText(BOARD_X + 400, BOARD_Y + 220, '⚡ 矩子神机 · 全军过载开启！', '#ffd54f', 26);
  updateHUD();
}

function updateHUD() {
  document.getElementById('qi-display').innerText = Math.floor(state.qi);
  document.getElementById('wave-display').innerText = state.bossSpawned ? '九首·相柳' : `${state.wave} / ${state.maxWave}`;
  document.getElementById('energy-display').innerText = `${Math.floor(state.energy)}%`;
  document.getElementById('overload-btn').disabled = state.energy < 50 || state.overloadTimer > 0;
  document.getElementById('shovel-rate').innerText = state.activeBuffs.has('mine_shrapnel') ? '返75%+爆' : '返40%灵气';

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

// ====================================================
// 三、 战场交互、分形闪电与游戏主循环
// ====================================================
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

  // 1. 拾取天工灵气齿轮
  for (let i = state.gears.length - 1; i >= 0; i--) {
    const g = state.gears[i];
    if (Math.hypot(mx - g.x, my - g.y) < 32) {
      state.qi += g.val;
      spawnFloatingText(g.x, g.y, `+${g.val} 灵气`, '#ffecb3', 17);
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
      spawnFloatingText(removed.x, removed.y, `回收 +${refund}`, '#40c4ff', 16);
      if (state.activeBuffs.has('mine_shrapnel')) {
        createExplosion(removed.x, removed.y, 130, 800);
      }
      state.towers.splice(existingIdx, 1);
      state.shovelMode = false;
      document.getElementById('shovel-orb').classList.remove('active');
      updateHUD();
    }
    return;
  }

  // 3. 建造机关
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
        scaleX: 1.35, scaleY: 0.65, hitFlash: 0
      });
    }

    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x, y: y + 18,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 1) * 3.5,
        size: 3 + Math.random() * 3, color: '#ffd54f', life: 24
      });
    }
    state.selectedCard = null;
    updateHUD();
  }
});

function spawnFireCrowRow(r, y) {
  state.screenShake = 8;
  spawnFloatingText(BOARD_X + 260, y - 12, '🔥 神火飞鸦 · 焚尽八荒！', '#ff6d00', 21);
  state.bullets.push({
    x: BOARD_X - 10, y, r, vx: 10, dmg: 1200, isCrow: true, radius: 32
  });
}

function createExplosion(x, y, radius, dmg) {
  state.screenShake = 10;
  state.enemies.forEach(en => {
    if (Math.hypot(en.x - x, en.y - y) <= radius) {
      en.hp -= dmg;
      en.hitFlash = 8;
    }
  });
  for (let i = 0; i < 34; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 6;
    state.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      size: 4 + Math.random() * 5,
      color: i % 2 === 0 ? '#ff3d00' : '#ffd54f',
      life: 32
    });
  }
}

function spawnFloatingText(x, y, text, color = '#fff', size = 15) {
  state.particles.push({ x, y, vx: 0, vy: -1.2, text, color, size, life: 45 });
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
      spawnFloatingText(500, 260, `✨ 习得秘术：${b.title}`, '#ffd54f', 23);
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

// 刷怪控制器
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
    isAttacking: false,
    walkPhase: Math.random() * Math.PI * 2
  });
}

function spawnXiangliuBoss() {
  state.bossSpawned = true;
  state.screenShake = 15;
  spawnFloatingText(500, 240, '🐍 山海凶神【九首·相柳】破阵降临！', '#64ffda', 26);
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

  // 环境萤火粒子漂浮
  state.ambientSparks.forEach(sp => {
    sp.x += sp.vx;
    sp.y += sp.vy;
    if (sp.y < 0) { sp.y = 550; sp.x = Math.random() * 1000; }
  });

  // 天降灵气齿轮
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

  // 更新机关单位
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
        t.scaleX = 1.25; t.scaleY = 0.8;
        state.gears.push({ x: t.x + (Math.random() - 0.5) * 28, y: t.y - 10, targetY: t.y + 20, val: 25, life: 600 });
        if (state.activeBuffs.has('gold_furnace') && state.enemies.length > 0) {
          state.enemies.slice(0, 3).forEach(target => {
            state.bullets.push({ x: t.x, y: t.y, r: target.r, vx: 8.5, dmg: 60, color: '#ff6d00', radius: 6 });
          });
        }
      }
    } else if (t.id === 'landmine') {
      if (!t.armed) {
        t.armTimer++;
        if (t.armTimer >= 250) {
          t.armed = true;
          spawnFloatingText(t.x, t.y - 24, '⚡ 埋雷就绪!', '#ffd54f', 13);
        }
      } else {
        const trigger = state.enemies.find(e => e.r === t.r && Math.abs(e.x - t.x) < 38);
        if (trigger) {
          createExplosion(t.x, t.y, 125, 1500);
          spawnFloatingText(t.x, t.y, '💥 震天爆破!', '#ff3d00', 20);
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
          spawnFloatingText(t.x, t.y - 20, `炼化 +${bonusQi}灵气`, '#ea80fc', 15);
        }
      } else {
        const preyIdx = state.enemies.findIndex(e => !e.isBoss && e.r === t.r && e.x > t.x - 10 && e.x < t.x + 85);
        if (preyIdx !== -1) {
          state.enemies.splice(preyIdx, 1);
          t.digesting = true;
          t.digestTimer = state.activeBuffs.has('fast_taotie') ? 360 : 720;
          t.scaleX = 1.4; t.scaleY = 1.4;
          spawnFloatingText(t.x, t.y, '👄 饕餮吞噬!', '#ffd54f', 16);
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
      if (hasEnemy && t.timer >= 78) {
        t.timer = 0;
        t.shotCount++;
        t.scaleX = 0.8; t.scaleY = 1.22;

        const isFrost = t.id === 'frost_mage';
        const isThunder = !isFrost && state.activeBuffs.has('thunder_bow');
        let dmg = isFrost ? 24 : (isThunder ? 36 : 26);
        if (elem === 'fire') dmg += 8;

        const rowsToShoot = t.id === 'pear_blossom' ? [t.r - 1, t.r, t.r + 1] : [t.r];
        rowsToShoot.forEach(targetRow => {
          if (targetRow >= 0 && targetRow < ROWS) {
            state.bullets.push({
              x: t.x + 22,
              y: BOARD_Y + targetRow * CELL_H + CELL_H / 2,
              r: targetRow,
              vx: 9, dmg, isFrost, isThunder,
              color: isFrost ? '#40c4ff' : (isThunder ? '#e040fb' : '#ffd54f'),
              radius: isFrost ? 6 : 4.5
            });
          }
        });
      }
    }
  });

  // 更新子弹与分形闪电链
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    if (b.isCrow && tickCount % 2 === 0) {
      state.particles.push({
        x: b.x - 15, y: b.y + (Math.random() - 0.5) * 20,
        vx: -1.5, vy: (Math.random() - 0.5) * 2,
        size: 4 + Math.random() * 4, color: '#ff6d00', life: 18
      });
    }
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
          const near = state.enemies.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 170);
          if (near) {
            near.hp -= b.dmg * 0.55;
            near.hitFlash = 5;
            state.lightningArcs.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, life: 10 });
          }
        }
        for (let k = 0; k < 5; k++) {
          state.particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 4.5, vy: (Math.random() - 0.5) * 4.5,
            size: 2.8, color: b.color || '#ffd54f', life: 15
          });
        }
        if (!b.isCrow) {
          state.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  // 更新闪电链生命周期
  for (let i = state.lightningArcs.length - 1; i >= 0; i--) {
    state.lightningArcs[i].life--;
    if (state.lightningArcs[i].life <= 0) state.lightningArcs.splice(i, 1);
  }

  // 更新山海魇魔
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.chillTimer > 0) e.chillTimer--;
    if (e.freezeTimer > 0) { e.freezeTimer--; continue; }

    const blocker = state.towers.find(t => t.r === e.r && Math.abs(t.x - e.x) < 38);
    if (blocker) {
      e.isAttacking = true;
      if (e.canVault && state.elementalTiles[`${blocker.r}_${blocker.c}`] !== 'earth') {
        e.canVault = false;
        e.x -= 88;
        spawnFloatingText(e.x, e.y - 25, '飞爪翻越!', '#ea80fc', 14);
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

    if (e.x < BOARD_X - 8) {
      if (state.lions[e.r]) {
        state.lions[e.r] = false;
        spawnFireCrowRow(e.r, e.y);
        spawnFloatingText(BOARD_X + 75, e.y, '🦁 阵眼石狮吐焰！', '#ffd54f', 19);
      } else {
        e.x = BOARD_X + COLS * CELL_W;
      }
    }

    if (e.hp <= 0) {
      state.energy = Math.min(100, state.energy + 8);
      waveKills++;
      for (let k = 0; k < 14; k++) {
        state.particles.push({
          x: e.x, y: e.y,
          vx: (Math.random() - 0.5) * 5.5, vy: (Math.random() - 0.5) * 5.5,
          size: 3.5, color: '#a1887f', life: 24
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

// ====================================================
// 四、 战场立体浮雕与光影渲染管线
// ====================================================
function render() {
  ctx.save();
  if (state.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * state.screenShake, (Math.random() - 0.5) * state.screenShake);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 远景古战场原画肌理与暗角压暗
  const bgImg = LOADED_IMAGES.bg;
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 棋盘外框立体石台底座
  ctx.fillStyle = '#090f12';
  ctx.strokeStyle = '#7a5c29';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(BOARD_X - 8, BOARD_Y - 8, COLS * CELL_W + 16, ROWS * CELL_H + 20, 8);
  ctx.fill();
  ctx.stroke();

  // 2. 绘制 3D 倒角浮雕青石棋盘与五行灵脉阵眼
  const elemStyles = {
    fire: { color: 'rgba(255, 87, 34, 0.48)', stroke: '#ff7043', rune: '离', label: '火脉·攻速' },
    water: { color: 'rgba(0, 229, 255, 0.45)', stroke: '#40c4ff', rune: '坎', label: '水脉·减CD' },
    earth: { color: 'rgba(255, 193, 7, 0.45)', stroke: '#ffd54f', rune: '坤', label: '土脉·免越' },
    metal: { color: 'rgba(224, 224, 224, 0.42)', stroke: '#f5f5f5', rune: '乾', label: '金脉·破甲' }
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * CELL_W;
      const y = BOARD_Y + r * CELL_H;
      const isCore = (c === 1 || c === 2);

      // 石砖底侧面厚度阴影
      ctx.fillStyle = '#0b1114';
      ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 2);

      // 石砖表面微渐变
      const tileGrad = ctx.createLinearGradient(x, y, x, y + CELL_H - 5);
      if (isCore) {
        tileGrad.addColorStop(0, (r + c) % 2 === 0 ? '#293b42' : '#233339');
        tileGrad.addColorStop(1, '#182429');
      } else {
        tileGrad.addColorStop(0, (r + c) % 2 === 0 ? '#202e34' : '#1a262b');
        tileGrad.addColorStop(1, '#121b1f');
      }
      ctx.fillStyle = tileGrad;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, CELL_W - 4, CELL_H - 6, 4);
      ctx.fill();

      // 石砖顶部受光高光边
      ctx.strokeStyle = isCore ? 'rgba(212, 175, 55, 0.38)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 8);

      // 中心暗刻八卦底纹
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(BAGUA_RUNES[(r * COLS + c) % 8], x + CELL_W / 2, y + CELL_H / 2 - 2);

      // 五行灵脉法阵特效
      const key = `${r}_${c}`;
      if (state.elementalTiles[key]) {
        const st = elemStyles[state.elementalTiles[key]];
        const pulse = (Math.sin(tickCount * 0.06) + 1) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(
          x + CELL_W / 2, y + CELL_H / 2, 4,
          x + CELL_W / 2, y + CELL_H / 2, CELL_W * 0.46
        );
        grad.addColorStop(0, st.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 6);

        // 阵眼中心古篆字
        ctx.font = 'bold 22px "STKaiti", "KaiTi", serif';
        ctx.fillStyle = st.stroke;
        ctx.globalAlpha = 0.35;
        ctx.fillText(st.rune, x + CELL_W / 2, y + CELL_H / 2 - 4);
        ctx.restore();

        ctx.fillStyle = st.stroke;
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.label, x + CELL_W / 2, y + CELL_H - 11);
      }
    }
  }

  // 3. 悬停十字光带与矢量虚影
  if (state.hoverCell.r >= 0 && (state.selectedCard || state.shovelMode)) {
    const { r, c } = state.hoverCell;
    const hx = BOARD_X + c * CELL_W;
    const hy = BOARD_Y + r * CELL_H;
    ctx.save();
    ctx.fillStyle = state.shovelMode ? 'rgba(255, 82, 82, 0.14)' : 'rgba(255, 215, 0, 0.08)';
    ctx.fillRect(BOARD_X, hy, COLS * CELL_W, CELL_H);
    ctx.fillRect(hx, BOARD_Y, CELL_W, ROWS * CELL_H);

    ctx.strokeStyle = state.shovelMode ? '#ff5252' : '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx + 3, hy + 3, CELL_W - 6, CELL_H - 8);

    if (state.selectedCard) {
      ctx.translate(hx + CELL_W / 2, hy + CELL_H / 2);
      ctx.globalAlpha = 0.6;
      MasterArt.drawTower(ctx, state.selectedCard.id, tickCount, { armed: true });
    }
    ctx.restore();
  }

  // 4. 阵眼石狮
  for (let r = 0; r < ROWS; r++) {
    if (state.lions[r]) {
      MasterArt.drawGuardianLion(ctx, BOARD_X - 46, BOARD_Y + r * CELL_H + CELL_H / 2, tickCount);
    }
  }

  // 5. 场上墨家机关
  const breath = Math.sin(tickCount * 0.08) * 0.03;
  state.towers.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scaleX, t.scaleY + breath);
    if (t.hitFlash > 0) ctx.filter = 'brightness(250%)';

    MasterArt.drawTower(ctx, t.id, tickCount, {
      isOverload: state.overloadTimer > 0,
      armed: t.armed,
      digesting: t.digesting,
      hasThunder: state.activeBuffs.has('thunder_bow'),
      hasLava: state.activeBuffs.has('lava_shield')
    });

    if (t.hp < t.maxHp) {
      drawOrnateHealthBar(-24, -42, 48, 5, t.hp / t.maxHp, '#00e676');
    }
    ctx.restore();
  });

  // 6. 山海魇魔与相柳 Boss
  state.enemies.forEach(e => {
    MasterArt.drawMonster(ctx, e, tickCount);
  });

  // 7. 分形锯齿闪电链渲染
  state.lightningArcs.forEach(arc => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ea80fc';
    ctx.shadowColor = '#e040fb';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(arc.x1, arc.y1);
    const midX = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 24;
    const midY = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 24;
    ctx.lineTo(midX, midY);
    ctx.lineTo(arc.x2, arc.y2);
    ctx.stroke();
    ctx.restore();
  });

  // 8. 箭矢与神火飞鸦
  state.bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.isCrow) {
      MasterArt.drawTower(ctx, 'fire_crow', tickCount);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.fillRect(-12, -1.8, 20, 3.6);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(5, -5.5); ctx.lineTo(7, 0); ctx.lineTo(5, 5.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });

  // 9. 精细渐开线天工灵气齿轮
  state.gears.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 14;
    MasterArt.drawCogwheel(ctx, 16, 11, 8, tickCount * 0.04, '#ffca28', '#fff8e1');
    ctx.restore();
  });

  // 10. 战场环境萤火与受击飘字
  state.ambientSparks.forEach(sp => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 213, 79, ${0.2 + Math.sin(tickCount * 0.05 + sp.x) * 0.15})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 18);
    if (p.text) {
      ctx.font = `bold ${p.size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  ctx.restore();
}

function drawOrnateHealthBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(8, 12, 14, 0.85)';
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 1;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
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