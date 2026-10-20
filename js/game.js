/**
 * 《山海机关录：墨守》现代Q版核心引擎 (PvZ 风格经典视效与Q弹战斗手感)
 */

// 1. 画布与上下文配置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 5, COLS = 9;
const CELL_W = 92, CELL_H = 96;
const BOARD_X = 96, BOARD_Y = 24;

// 2. 高清美术资源加载器
const ASSET_PATHS = {
  bg: 'assets/background.jpg',
  furnace: 'assets/furnace.jpg',
  crossbow: 'assets/crossbow.jpg',
  shield: 'assets/shield.jpg',
  taotie: 'assets/taotie.jpg',
  landmine: 'assets/landmine.jpg',
  frost_mage: 'assets/frost_mage.jpg',
  pear_blossom: 'assets/pear_blossom.jpg',
  fire_crow: 'assets/fire_crow.jpg',
  lion: 'assets/guardian_lion.jpg',
  soldier: 'assets/soldier.jpg'
};

const IMAGES = {};
Object.keys(ASSET_PATHS).forEach(key => {
  const img = new Image();
  img.src = ASSET_PATHS[key];
  IMAGES[key] = img;
});

// 3. 墨家机关 8 张经典种子卡牌配置
const SEED_CATALOG = [
  { id: 'furnace', name: '聚灵炉', cost: 50, cd: 6000, hp: 300, imgKey: 'furnace', desc: '产出灵气齿轮，九宫格攻速+15%' },
  { id: 'crossbow', name: '连弩车', cost: 100, cd: 4000, hp: 300, imgKey: 'crossbow', desc: '直线发射铜箭，第4次触发连击' },
  { id: 'shield', name: '玄武盾', cost: 75, cd: 12000, hp: 1600, imgKey: 'shield', desc: '高耐久坚壁，反弹荆棘近战反震' },
  { id: 'taotie', name: '饕餮兽', cost: 125, cd: 8000, hp: 450, imgKey: 'taotie', desc: '近战巨口吞噬小怪，消化后吐出灵气' },
  { id: 'landmine', name: '震天雷', cost: 25, cd: 10000, hp: 200, imgKey: 'landmine', desc: '埋地发条旋紧后，触发1500巨额爆破' },
  { id: 'frost_mage', name: '霜方士', cost: 175, cd: 6000, hp: 300, imgKey: 'frost_mage', desc: '发射冰霜灵符减速，叠满冰封敌人' },
  { id: 'pear_blossom', name: '梨花针', cost: 200, cd: 9000, hp: 350, imgKey: 'pear_blossom', desc: '暴雨梨花多向破甲散弹齐射' },
  { id: 'fire_crow', name: '火飞鸦', cost: 150, cd: 16000, hp: 9999, imgKey: 'fire_crow', desc: '火焰飞鸢掠过本行，全屏贯穿轰炸' }
];

// 4. 鲁班天工密卷肉鸽强化词条
const ROGUE_BUFFS = [
  { id: 'thunder_bow', tag: '天工进化', title: '【雷公连弩】', desc: '诸葛连弩进化为连锁闪电箭，攻击+40%并弹射周围2名敌人！' },
  { id: 'sun_furnace', tag: '太阳奇术', title: '【金乌产气】', desc: '聚灵烘炉产气间隔缩短 3 秒，每次产气向随机敌人射出烈阳弹！' },
  { id: 'iron_wall', tag: '坚壁清野', title: '【重甲反震】', desc: '玄武盾生命上限翻倍，受到攻击反弹 35 点强力金石伤害！' },
  { id: 'deep_freeze', tag: '奇门遁甲', title: '【极寒领域】', desc: '寒霜方士攻速提升 25%，处于减速状态的敌人受到伤害增加 30%！' },
  { id: 'overdrive', tag: '矩子神机', title: '【周天灵脉】', desc: '立即获得 150 灵气，全场所有机关攻击速度永久提升 20%！' }
];

// 5. 核心游戏运行状态
let state = {
  qi: 150,
  wave: 1,
  maxWave: 10,
  waveKills: 0,
  energy: 40,
  gameSpeed: 1,
  selectedSeed: null,
  shovelActive: false,
  hoverCell: { r: -1, c: -1 },
  overloadTimer: 0,
  paused: false,
  activeBuffs: new Set(),
  elementalTiles: {}, // 'r_c': 'fire' | 'water' | 'earth' | 'metal'
  towers: [],
  enemies: [],
  bullets: [],
  gears: [],
  particles: [],
  lions: [true, true, true, true, true],
  seedCooldowns: {},
  screenShake: 0
};

// 6. 初始化种子卡槽 DOM (PvZ 经典样式)
function initSeedBankUI() {
  const container = document.getElementById('seed-bank');
  container.innerHTML = '';
  SEED_CATALOG.forEach(seed => {
    state.seedCooldowns[seed.id] = 0;
    const card = document.createElement('div');
    card.className = 'seed-card';
    card.id = `seed-${seed.id}`;
    card.title = `${seed.name}: ${seed.desc}`;
    card.onclick = () => selectSeed(seed);
    card.innerHTML = `
      <div class="card-avatar-wrap">
        <img src="${ASSET_PATHS[seed.imgKey]}" onerror="this.style.background='#27ae60'">
      </div>
      <div class="card-title">${seed.name}</div>
      <div class="card-cost-pill">⚙ ${seed.cost}</div>
      <div class="cd-curtain" id="cd-${seed.id}"></div>
    `;
    container.appendChild(card);
  });
}

function selectSeed(seed) {
  if (state.paused) return;
  if (state.qi < seed.cost || state.seedCooldowns[seed.id] > 0) return;
  state.shovelActive = false;
  document.getElementById('shovel-slot').classList.remove('active');
  state.selectedSeed = (state.selectedSeed && state.selectedSeed.id === seed.id) ? null : seed;
  updateHUD();
}

function toggleShovelMode() {
  state.selectedSeed = null;
  state.shovelActive = !state.shovelActive;
  document.getElementById('shovel-slot').classList.toggle('active', state.shovelActive);
  updateHUD();
}

function triggerOverload() {
  if (state.energy < 50 || state.overloadTimer > 0) return;
  state.energy -= 50;
  state.overloadTimer = 420; // 持续 7 秒过载
  state.screenShake = 12;
  if (window.soundEngine) window.soundEngine.playLawnMower();
  spawnFloatText(BOARD_X + 380, BOARD_Y + 220, '⚡ 全军过载！攻速激增！', '#ffca28', 26);
  updateHUD();
}

function toggleGameSpeed() {
  state.gameSpeed = state.gameSpeed === 1 ? 2 : 1;
  document.getElementById('speed-btn').innerText = `⏩ ${state.gameSpeed}X`;
}

function toggleModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  const isShown = el.style.display === 'flex';
  el.style.display = isShown ? 'none' : 'flex';
  state.paused = !isShown;
}

function showHugeWaveAlert() {
  const banner = document.getElementById('huge-wave-banner');
  banner.style.display = 'flex';
  if (window.soundEngine) window.soundEngine.playHugeWave();
  setTimeout(() => { banner.style.display = 'none'; }, 2600);
}

function updateHUD() {
  const qiEl = document.getElementById('qi-val');
  qiEl.innerText = Math.floor(state.qi);

  document.getElementById('wave-num-text').innerText = `${state.wave} / ${state.maxWave}`;
  const waveRatio = Math.min(100, (state.wave / state.maxWave) * 100);
  document.getElementById('wave-fill').style.width = `${waveRatio}%`;
  document.getElementById('wave-head').style.right = `${Math.max(-6, 100 - waveRatio - 6)}%`;

  const overloadBtn = document.getElementById('overload-btn');
  overloadBtn.disabled = state.energy < 50 || state.overloadTimer > 0;
  overloadBtn.style.opacity = state.energy >= 50 ? '1' : '0.6';

  SEED_CATALOG.forEach(s => {
    const cardEl = document.getElementById(`seed-${s.id}`);
    const curtain = document.getElementById(`cd-${s.id}`);
    const canAfford = state.qi >= s.cost && state.seedCooldowns[s.id] <= 0;
    cardEl.classList.toggle('disabled', !canAfford);
    cardEl.classList.toggle('selected', state.selectedSeed && state.selectedSeed.id === s.id);
    const ratio = Math.max(0, state.seedCooldowns[s.id] / s.cd) * 100;
    curtain.style.height = `${ratio}%`;
  });
}

// 7. 交互监听 (鼠标与触摸放置、灵气齿轮点击拾取、拆解铲模式)
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function handlePointerMove(e) {
  const { x, y } = getCanvasCoords(e);
  const c = Math.floor((x - BOARD_X) / CELL_W);
  const r = Math.floor((y - BOARD_Y) / CELL_H);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    state.hoverCell = { r, c };
  } else {
    state.hoverCell = { r: -1, c: -1 };
  }
}

function handlePointerClick(e) {
  if (state.paused) return;
  const { x, y } = getCanvasCoords(e);

  // 1. 点击飘落灵气齿轮 (PvZ 点阳光收集)
  for (let i = state.gears.length - 1; i >= 0; i--) {
    const g = state.gears[i];
    if (Math.hypot(x - g.x, y - g.y) < 32) {
      collectGear(g, i);
      return;
    }
  }

  const { r, c } = state.hoverCell;
  if (r < 0 || c < 0) return;

  const existingIdx = state.towers.findIndex(t => t.r === r && t.c === c);

  // 2. 铲子拆解模式
  if (state.shovelActive) {
    if (existingIdx !== -1) {
      const removed = state.towers[existingIdx];
      const refund = Math.floor(removed.cost * 0.5);
      state.qi += refund;
      spawnFloatText(removed.x, removed.y, `拆解 +${refund}`, '#4fc3f7');
      if (window.soundEngine) window.soundEngine.playShovel();
      state.towers.splice(existingIdx, 1);
      state.shovelActive = false;
      document.getElementById('shovel-slot').classList.remove('active');
      updateHUD();
    }
    return;
  }

  // 3. 种植机关模式 (PvZ Q弹落子)
  if (state.selectedSeed && existingIdx === -1) {
    const s = state.selectedSeed;
    state.qi -= s.cost;
    state.seedCooldowns[s.id] = s.cd;

    const posX = BOARD_X + c * CELL_W + CELL_W / 2;
    const posY = BOARD_Y + r * CELL_H + CELL_H / 2;

    if (window.soundEngine) window.soundEngine.playPlant();

    // 神火飞鸦为整行火箭贯穿轰炸
    if (s.id === 'fire_crow') {
      spawnFireCrowRow(r, posY);
    } else {
      state.towers.push({
        id: s.id, name: s.name, r, c, x: posX, y: posY,
        hp: s.hp, maxHp: s.hp, cost: s.cost,
        imgKey: s.imgKey,
        timer: 0, shotCount: 0,
        scaleX: 1.45, scaleY: 0.6, hitFlash: 0,
        armed: s.id !== 'landmine', armTimer: 0,
        chewingTimer: 0
      });
    }

    // Q弹落地烟尘粒子
    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x: posX, y: posY + 26,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 1) * 3,
        size: 3 + Math.random() * 4, color: '#f5b041', life: 25
      });
    }

    state.selectedSeed = null;
    updateHUD();
  }
}

canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mousedown', handlePointerClick);
canvas.addEventListener('touchstart', e => { handlePointerMove(e); handlePointerClick(e); }, { passive: true });
canvas.addEventListener('touchmove', handlePointerMove, { passive: true });

function collectGear(g, idx) {
  state.qi += g.val;
  if (window.soundEngine) window.soundEngine.playSun();
  spawnFloatText(g.x, g.y, `+${g.val}`, '#ffe066', 20);
  document.getElementById('qi-val').classList.add('pop-bounce');
  setTimeout(() => document.getElementById('qi-val').classList.remove('pop-bounce'), 300);
  state.gears.splice(idx, 1);
  updateHUD();
}

function spawnFireCrowRow(r, y) {
  state.screenShake = 6;
  spawnFloatText(BOARD_X + 220, y, '🔥 神火飞鸦 · 焚尽八荒！', '#ff5722', 22);
  state.bullets.push({
    x: BOARD_X, y, r, vx: 10, dmg: 1400, isCrow: true, radius: 30
  });
}

// 8. 刷怪与敌人逻辑 (PvZ 经典小怪与精英波次)
let spawnCounter = 0;
function spawnEnemy() {
  const r = Math.floor(Math.random() * ROWS);
  const y = BOARD_Y + r * CELL_H + CELL_H / 2;

  const enemyTypes = [
    { name: '兵俑', hp: 220, spd: 0.42, color: '#8d6e63', radius: 24, imgKey: 'soldier' },
    { name: '藤甲兵', hp: 440, spd: 0.38, color: '#4caf50', radius: 25, imgKey: 'soldier' },
    { name: '重锤巨力士', hp: 900, spd: 0.28, color: '#f39c12', radius: 30, imgKey: 'soldier' },
    { name: '飞爪山魈', hp: 300, spd: 0.85, color: '#9c27b0', radius: 22, imgKey: 'soldier' }
  ];

  const idx = Math.min(enemyTypes.length - 1, Math.floor(Math.random() * (1 + state.wave * 0.4)));
  const tpl = enemyTypes[idx];
  const waveMult = 1 + (state.wave - 1) * 0.18;

  state.enemies.push({
    ...tpl, r, x: BOARD_X + COLS * CELL_W + 35, y,
    hp: Math.floor(tpl.hp * waveMult),
    maxHp: Math.floor(tpl.hp * waveMult),
    chillTimer: 0, freezeTimer: 0, hitFlash: 0
  });
}

function showRogueModal() {
  state.paused = true;
  const modal = document.getElementById('rogue-modal');
  const container = document.getElementById('buff-cards-row');
  container.innerHTML = '';

  const shuffled = [...ROGUE_BUFFS].sort(() => 0.5 - Math.random()).slice(0, 3);
  shuffled.forEach(b => {
    const box = document.createElement('div');
    box.className = 'buff-box';
    box.onclick = () => {
      state.activeBuffs.add(b.id);
      if (b.id === 'overdrive') state.qi += 150;
      modal.style.display = 'none';
      state.paused = false;
      spawnFloatText(480, 260, `已习得：${b.title}`, '#ffea79', 24);
      updateHUD();
    };
    box.innerHTML = `
      <div class="buff-tag-pill">${b.tag}</div>
      <div class="buff-name">${b.title}</div>
      <div class="buff-intro">${b.desc}</div>
    `;
    container.appendChild(box);
  });
  modal.style.display = 'flex';
}

function spawnFloatText(x, y, text, color = '#ffca28', size = 16) {
  state.particles.push({ x, y, vx: 0, vy: -1.3, text, color, size, life: 50 });
}

// 9. 核心物理与战斗逻辑循环 (60FPS)
let lastTime = performance.now();
function updateGame(now) {
  const dt = (now - lastTime) * state.gameSpeed;
  lastTime = now;
  if (state.paused) return;

  // 1. 卡牌冷却恢复
  SEED_CATALOG.forEach(s => {
    if (state.seedCooldowns[s.id] > 0) {
      state.seedCooldowns[s.id] = Math.max(0, state.seedCooldowns[s.id] - dt);
    }
  });

  if (state.overloadTimer > 0) state.overloadTimer--;
  if (state.screenShake > 0) state.screenShake--;

  // 2. 天降灵气齿轮 (PvZ 天降太阳)
  if (Math.random() < 0.005) {
    state.gears.push({
      x: BOARD_X + 60 + Math.random() * (COLS * CELL_W - 120),
      y: BOARD_Y - 20,
      targetY: BOARD_Y + 60 + Math.random() * (ROWS * CELL_H - 120),
      val: 25, life: 750, sway: Math.random() * 10
    });
  }
  state.gears.forEach((g, idx) => {
    if (g.y < g.targetY) g.y += 1.2;
    g.sway += 0.03;
    g.x += Math.sin(g.sway) * 0.5;
    g.life--;
    if (g.life <= 0) state.gears.splice(idx, 1);
  });

  // 3. 刷怪出兵节奏
  spawnCounter += state.gameSpeed;
  const spawnThreshold = Math.max(80, 240 - state.wave * 14);
  if (spawnCounter >= spawnThreshold) {
    spawnCounter = 0;
    spawnEnemy();
  }

  // 4. 更新我方机关
  state.towers.forEach((t, tIdx) => {
    // Q弹形变弹性回缩
    t.scaleX += (1 - t.scaleX) * 0.15;
    t.scaleY += (1 - t.scaleY) * 0.15;
    if (t.hitFlash > 0) t.hitFlash--;

    let speedMult = state.overloadTimer > 0 ? 2.0 : 1.0;
    if (state.activeBuffs.has('overdrive')) speedMult *= 1.2;
    t.timer += speedMult * state.gameSpeed;

    // 聚灵烘炉 (PvZ 向日葵)
    if (t.id === 'furnace') {
      const interval = state.activeBuffs.has('sun_furnace') ? 460 : 640;
      if (t.timer >= interval) {
        t.timer = 0;
        t.scaleX = 1.35; t.scaleY = 0.75; // Q弹膨胀
        state.gears.push({
          x: t.x + (Math.random() - 0.5) * 36,
          y: t.y - 10,
          targetY: t.y + 24,
          val: 25, life: 750, sway: 0
        });
      }
    }
    // 诸葛连弩 (PvZ 豌豆射手)
    else if (t.id === 'crossbow') {
      const hasTarget = state.enemies.some(e => e.r === t.r && e.x > t.x);
      if (hasTarget && t.timer >= 80) {
        t.timer = 0;
        t.shotCount++;
        t.scaleX = 0.8; t.scaleY = 1.25; // 后坐力回弹
        if (window.soundEngine) window.soundEngine.playArrow();

        const isThunder = state.activeBuffs.has('thunder_bow');
        const dmg = isThunder ? 38 : 25;
        state.bullets.push({
          x: t.x + 24, y: t.y, r: t.r, vx: 8.5, dmg,
          isThunder, color: isThunder ? '#e040fb' : '#ffca28', radius: 5
        });

        // 每4次触发双发连击
        if (t.shotCount % 4 === 0) {
          setTimeout(() => {
            state.bullets.push({
              x: t.x + 24, y: t.y, r: t.r, vx: 8.5, dmg,
              isThunder, color: isThunder ? '#e040fb' : '#ffca28', radius: 5
            });
          }, 120);
        }
      }
    }
    // 震天埋雷 (PvZ 土豆地雷)
    else if (t.id === 'landmine') {
      if (!t.armed) {
        t.armTimer++;
        if (t.armTimer >= 260) {
          t.armed = true;
          t.scaleX = 1.3; t.scaleY = 1.3;
          spawnFloatText(t.x, t.y - 20, '⚡ 就绪!', '#ffea79', 14);
        }
      } else {
        const steppedEnemy = state.enemies.find(e => e.r === t.r && Math.abs(e.x - t.x) < 36);
        if (steppedEnemy) {
          triggerExplosion(t.x, t.y, 130, 1500);
          state.towers.splice(tIdx, 1);
        }
      }
    }
    // 寒霜方士 (PvZ 寒冰射手)
    else if (t.id === 'frost_mage') {
      const hasTarget = state.enemies.some(e => e.r === t.r && e.x > t.x);
      if (hasTarget && t.timer >= 90) {
        t.timer = 0;
        t.scaleX = 0.85; t.scaleY = 1.2;
        if (window.soundEngine) window.soundEngine.playFreeze();
        state.bullets.push({
          x: t.x + 24, y: t.y, r: t.r, vx: 7.5, dmg: 22,
          isFrost: true, color: '#4fc3f7', radius: 7
        });
      }
    }
    // 暴雨梨花 (散弹)
    else if (t.id === 'pear_blossom') {
      const hasTarget = state.enemies.some(e => e.r === t.r && e.x > t.x);
      if (hasTarget && t.timer >= 100) {
        t.timer = 0;
        t.scaleX = 1.25; t.scaleY = 0.8;
        if (window.soundEngine) window.soundEngine.playArrow();
        for (let a = -1; a <= 1; a++) {
          state.bullets.push({
            x: t.x + 20, y: t.y, r: t.r, vx: 8, vy: a * 1.5, dmg: 20,
            color: '#f06292', radius: 4
          });
        }
      }
    }
    // 饕餮巨口 (PvZ 大嘴花)
    else if (t.id === 'taotie') {
      if (t.chewingTimer > 0) {
        t.chewingTimer--;
      } else {
        const prey = state.enemies.find(e => e.r === t.r && e.x > t.x && e.x - t.x < 110);
        if (prey) {
          t.scaleX = 1.5; t.scaleY = 1.3;
          t.chewingTimer = 360; // 咀嚼消化
          if (window.soundEngine) window.soundEngine.playChomp();
          spawnFloatText(t.x, t.y - 20, '😋 大快朵颐!', '#ff7043', 18);
          state.enemies.splice(state.enemies.indexOf(prey), 1);
          // 消化产出灵气
          setTimeout(() => {
            state.gears.push({ x: t.x, y: t.y - 10, targetY: t.y + 20, val: 35, life: 750, sway: 0 });
          }, 3500);
        }
      }
    }
  });

  // 5. 更新子弹与碰撞
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    if (b.vy) b.y += b.vy;

    if (b.x > canvas.width + 40) {
      state.bullets.splice(i, 1);
      continue;
    }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (e.r === b.r && Math.abs(e.x - b.x) < e.radius + b.radius) {
        e.hp -= b.dmg;
        e.hitFlash = 6;
        if (window.soundEngine) window.soundEngine.playHit();

        if (b.isFrost) {
          e.chillTimer = 220;
          if (Math.random() < 0.28) e.freezeTimer = 80;
        }

        // 闪电链弹射
        if (b.isThunder && state.enemies.length > 1) {
          const other = state.enemies.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 160);
          if (other) {
            other.hp -= b.dmg * 0.5;
            other.hitFlash = 6;
          }
        }

        // 命中火花粒子
        for (let k = 0; k < 5; k++) {
          state.particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            size: 3, color: b.color || '#ffca28', life: 16
          });
        }

        if (!b.isCrow) {
          state.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  // 6. 更新敌人与小推车割草机逻辑 (PvZ Lawn Mower)
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.chillTimer > 0) e.chillTimer--;
    if (e.freezeTimer > 0) { e.freezeTimer--; continue; }

    // 啃咬机关
    const blocker = state.towers.find(t => t.r === e.r && Math.abs(t.x - e.x) < 36);
    if (blocker) {
      blocker.hp -= 0.8;
      blocker.hitFlash = 4;
      if (blocker.id === 'shield' && state.activeBuffs.has('iron_wall')) {
        e.hp -= 0.6; // 反震
      }
      if (blocker.hp <= 0) {
        state.towers.splice(state.towers.indexOf(blocker), 1);
      }
    } else {
      const spdMult = e.chillTimer > 0 ? 0.5 : 1;
      e.x -= e.spd * spdMult * state.gameSpeed;
    }

    // 触发阵眼石狮小推车 (PvZ Lawn Mower)
    if (e.x < BOARD_X - 12) {
      if (state.lions[e.r]) {
        state.lions[e.r] = false;
        state.screenShake = 10;
        if (window.soundEngine) window.soundEngine.playLawnMower();
        spawnFloatText(BOARD_X + 60, e.y, '🦁 阵眼石狮全速冲锋！', '#f5b041', 20);
        spawnFireCrowRow(e.r, e.y);
      } else {
        e.x = BOARD_X + COLS * CELL_W; // 循环防卡
      }
    }

    // 敌人死亡
    if (e.hp <= 0) {
      state.energy = Math.min(100, state.energy + 8);
      state.waveKills++;
      for (let k = 0; k < 12; k++) {
        state.particles.push({
          x: e.x, y: e.y,
          vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
          size: 4, color: e.color, life: 25
        });
      }
      state.enemies.splice(i, 1);

      // 波次晋级
      if (state.waveKills >= 6 + state.wave * 2) {
        state.waveKills = 0;
        if (state.wave < state.maxWave) {
          state.wave++;
          showHugeWaveAlert();
          if (state.wave % 3 === 0) showRogueModal();
        }
      }
      updateHUD();
    }
  }

  // 7. 更新粒子与飘字
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  updateHUD();
}

function triggerExplosion(x, y, radius, dmg) {
  state.screenShake = 12;
  if (window.soundEngine) window.soundEngine.playExplosion();
  spawnFloatText(x, y, '💥 轰天爆破!', '#ff5722', 24);
  state.enemies.forEach(en => {
    if (Math.hypot(en.x - x, en.y - y) <= radius) {
      en.hp -= dmg;
      en.hitFlash = 10;
    }
  });
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 5.5;
    state.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      size: 4 + Math.random() * 5, color: i % 2 === 0 ? '#ff5722' : '#ffca28', life: 35
    });
  }
}

// 10. 现代Q版渲染主循环 (PvZ 经典棋盘草坪、Q版机关令牌与受击动效)
function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // 震屏处理
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
  }

  // 1. 绘制暗化水墨背景
  if (IMAGES.bg && IMAGES.bg.complete) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(IMAGES.bg, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 2. 绘制 5x9 经典植物大战僵尸青玉草坪 (PvZ Checkered Lawn)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * CELL_W;
      const y = BOARD_Y + r * CELL_H;

      // 交替清爽青玉草坪格
      const isAlt = (r + c) % 2 === 0;
      ctx.fillStyle = isAlt ? '#254b3d' : '#1d3d31';
      ctx.fillRect(x, y, CELL_W, CELL_H);

      // 内框立体高光微线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

      // 暗金网格线
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_W, CELL_H);
    }
  }

  // 3. 种植与拆解十字对齐光圈
  if (state.hoverCell.r >= 0 && (state.selectedSeed || state.shovelActive)) {
    const { r, c } = state.hoverCell;
    const hx = BOARD_X + c * CELL_W;
    const hy = BOARD_Y + r * CELL_H;
    ctx.save();
    ctx.fillStyle = state.shovelActive ? 'rgba(231, 76, 60, 0.18)' : 'rgba(245, 176, 65, 0.14)';
    ctx.fillRect(BOARD_X, hy, COLS * CELL_W, CELL_H);
    ctx.fillRect(hx, BOARD_Y, CELL_W, ROWS * CELL_H);

    ctx.strokeStyle = state.shovelActive ? '#e74c3c' : '#ffe066';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(hx + 2, hy + 2, CELL_W - 4, CELL_H - 4);
    ctx.restore();
  }

  // 4. 绘制每行左侧的【阵眼石狮小推车】(PvZ Lawn Mower)
  for (let r = 0; r < ROWS; r++) {
    if (!state.lions[r]) continue;
    const lx = BOARD_X - 48;
    const ly = BOARD_Y + r * CELL_H + CELL_H / 2;
    drawCircularBadge(IMAGES.lion, lx, ly, 30, '#f5b041', false);
  }

  // 5. 绘制场上机关兽 (Q弹呼吸与形变)
  const idleWobble = Math.sin(Date.now() / 240) * 0.04;
  state.towers.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scaleX, t.scaleY + idleWobble);

    // 聚灵烘炉九宫格光环
    if (t.id === 'furnace') {
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 202, 40, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const borderColor = state.overloadTimer > 0 ? '#ff5722' : '#f5b041';
    drawCircularBadge(IMAGES[t.imgKey], 0, 0, 36, borderColor, t.hitFlash > 0);

    // 埋雷未就绪遮罩
    if (t.id === 'landmine' && !t.armed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffea79';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('发条中...', 0, 4);
    }

    // 饕餮咀嚼中提示
    if (t.id === 'taotie' && t.chewingTimer > 0) {
      ctx.fillStyle = '#ff7043';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('消化中...', 0, -42);
    }

    // 耐久血条
    if (t.hp < t.maxHp) {
      drawChunkyBar(-26, -44, 52, 6, t.hp / t.maxHp, '#2ecc71');
    }
    ctx.restore();
  });

  // 6. 绘制山海魇魔
  state.enemies.forEach(e => {
    ctx.save();
    ctx.translate(e.x, e.y);

    // 底部椭圆投影
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius - 2, e.radius * 0.85, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 令牌本体
    drawCircularBadge(IMAGES.soldier, 0, 0, e.radius, e.chillTimer > 0 ? '#4fc3f7' : '#e74c3c', e.hitFlash > 0);

    // 名字标签
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.name.slice(0, 2), 0, 4);

    // 冰封冰块
    if (e.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
      ctx.fillRect(-e.radius - 2, -e.radius - 2, (e.radius + 2) * 2, (e.radius + 2) * 2);
    }

    drawChunkyBar(-24, -e.radius - 12, 48, 5, e.hp / e.maxHp, '#e74c3c');
    ctx.restore();
  });

  // 7. 绘制投射物 (箭矢与飞鸦)
  state.bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.isCrow) {
      drawCircularBadge(IMAGES.fire_crow, 0, 0, 28, '#ff5722', false);
    } else {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 8. 绘制天降灵气齿轮 (PvZ 太阳)
  state.gears.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Date.now() / 350);
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffea79';
    ctx.strokeStyle = '#b7791f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#261a12';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 9. 飘字与粒子
  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 20);
    if (p.text) {
      ctx.font = `bold ${p.size}px "ZCOOL KuaiLe", sans-serif`;
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

  ctx.restore();
}

// 辅助函数：绘制高颜值现代Q版圆形青铜徽章
function drawCircularBadge(img, x, y, radius, borderColor, isFlash) {
  ctx.save();
  ctx.translate(x, y);

  // 阴影底座
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1e17';
  ctx.fill();

  // 圆形裁切
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  if (isFlash) {
    ctx.filter = 'brightness(250%) contrast(150%)';
  }
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  }
  ctx.restore();

  // 双层金边
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.restore();
}

function drawChunkyBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}

// 11. 启动引擎与主循环
initSeedBankUI();
updateHUD();

function mainLoop(now) {
  updateGame(now);
  renderGame();
  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);
