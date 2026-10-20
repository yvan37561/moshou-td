/**
 * 《山海机关录：墨守》现代Q版纯原生矢量渲染引擎 (0KB资源加载·视网膜级锐利·生动表情动画)
 */

// 1. 画布与上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 5, COLS = 9;
const CELL_W = 92, CELL_H = 96;
const BOARD_X = 96, BOARD_Y = 24;

// 2. 墨家 8 张经典种子卡牌配置 (搭配鲜艳明快的 Q 版图标)
const SEED_CATALOG = [
  { id: 'furnace', name: '聚灵炉', cost: 50, cd: 6000, hp: 300, icon: '🔥', desc: '产出灵气齿轮，九宫格攻速+15%' },
  { id: 'crossbow', name: '连弩车', cost: 100, cd: 4000, hp: 300, icon: '🏹', desc: '直线发射铜箭，第4次触发双发连射' },
  { id: 'shield', name: '玄武盾', cost: 75, cd: 12000, hp: 1600, icon: '🐢', desc: '软萌高防坚壁，反弹荆棘反伤，动态换表情' },
  { id: 'taotie', name: '饕餮兽', cost: 125, cd: 8000, hp: 450, icon: '👹', desc: '大口吞噬近战小怪，腮帮咀嚼消化产灵气' },
  { id: 'landmine', name: '震天雷', cost: 25, cd: 10000, hp: 200, icon: '💣', desc: '埋地转动发条，就绪后触发1500巨额范围轰爆' },
  { id: 'frost_mage', name: '霜方士', cost: 175, cd: 6000, hp: 300, icon: '❄️', desc: '发射冰霜符减速，叠满冻结敌人为冰块' },
  { id: 'pear_blossom', name: '梨花针', cost: 200, cd: 9000, hp: 350, icon: '🌸', desc: '暴雨梨花多向破甲散弹齐射' },
  { id: 'fire_crow', name: '火飞鸦', cost: 150, cd: 16000, hp: 9999, icon: '🚀', desc: '火箭飞鸢掠过整行，全屏贯穿烈焰轰炸' }
];

// 3. 鲁班天工密卷肉鸽强化词条
const ROGUE_BUFFS = [
  { id: 'thunder_bow', tag: '天工进化', title: '【雷公连弩】', desc: '连弩车射出弹射电弧箭，伤害提升 40% 并连锁周围敌人！' },
  { id: 'sun_furnace', tag: '太阳奇术', title: '【金乌产气】', desc: '聚灵炉产气间隔缩短 3 秒，每次产气向随机敌人射出烈阳弹！' },
  { id: 'iron_wall', tag: '坚壁清野', title: '【重甲反震】', desc: '玄武盾生命上限翻倍，受到攻击反弹 35 点强力金石反伤！' },
  { id: 'deep_freeze', tag: '奇门遁甲', title: '【极寒领域】', desc: '霜方士攻速提升 25%，处于减速状态的敌人受到伤害增加 30%！' },
  { id: 'overdrive', tag: '矩子神机', title: '【周天灵脉】', desc: '立即获得 150 灵气，全场所有机关攻击速度永久提升 20%！' }
];

// 4. 全局核心状态
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
  towers: [],
  enemies: [],
  bullets: [],
  gears: [],
  particles: [],
  lions: [true, true, true, true, true],
  seedCooldowns: {},
  screenShake: 0
};

// 5. 初始化种子卡槽 DOM (纯纯的现代明亮 Q 版图标)
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
      <div class="card-avatar-wrap" style="background: radial-gradient(circle, #385548 0%, #172421 100%);">
        <span style="font-size: 26px;">${seed.icon}</span>
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
  state.overloadTimer = 420;
  state.screenShake = 12;
  if (window.soundEngine) window.soundEngine.playLawnMower();
  spawnFloatText(BOARD_X + 380, BOARD_Y + 220, '⚡ 全军机巧过载！攻速激增！', '#ffca28', 26);
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

// 6. 交互监听 (鼠标与触摸手势)
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

  // 1. 收集飘落齿轮
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

  // 2. 铲子模式
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

  // 3. 种植机关 (Q弹落子)
  if (state.selectedSeed && existingIdx === -1) {
    const s = state.selectedSeed;
    state.qi -= s.cost;
    state.seedCooldowns[s.id] = s.cd;

    const posX = BOARD_X + c * CELL_W + CELL_W / 2;
    const posY = BOARD_Y + r * CELL_H + CELL_H / 2;

    if (window.soundEngine) window.soundEngine.playPlant();

    if (s.id === 'fire_crow') {
      spawnFireCrowRow(r, posY);
    } else {
      state.towers.push({
        id: s.id, name: s.name, r, c, x: posX, y: posY,
        hp: s.hp, maxHp: s.hp, cost: s.cost,
        timer: 0, shotCount: 0,
        scaleX: 1.45, scaleY: 0.6, hitFlash: 0,
        armed: s.id !== 'landmine', armTimer: 0,
        chewingTimer: 0
      });
    }

    // 落地金光微粒
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
  spawnFloatText(g.x, g.y, `+${g.val}`, '#ffe066', 22);
  document.getElementById('qi-val').classList.add('pop-bounce');
  setTimeout(() => document.getElementById('qi-val').classList.remove('pop-bounce'), 300);
  state.gears.splice(idx, 1);
  updateHUD();
}

function spawnFireCrowRow(r, y) {
  state.screenShake = 6;
  spawnFloatText(BOARD_X + 220, y, '🔥 火飞鸦 · 焚尽八荒！', '#ff5722', 22);
  state.bullets.push({
    x: BOARD_X, y, r, vx: 10, dmg: 1400, isCrow: true, radius: 24
  });
}

// 7. 敌人生成与战役推进
let spawnCounter = 0;
function spawnEnemy() {
  const r = Math.floor(Math.random() * ROWS);
  const y = BOARD_Y + r * CELL_H + CELL_H / 2;

  const enemyTypes = [
    { name: '兵俑', hp: 220, spd: 0.42, color: '#bcaaa4', radius: 24, type: 'soldier' },
    { name: '藤甲兵', hp: 440, spd: 0.38, color: '#81c784', radius: 25, type: 'vine' },
    { name: '力士', hp: 900, spd: 0.28, color: '#ffb74d', radius: 30, type: 'brute' },
    { name: '山魈', hp: 300, spd: 0.85, color: '#ba68c8', radius: 22, type: 'imp' }
  ];

  const idx = Math.min(enemyTypes.length - 1, Math.floor(Math.random() * (1 + state.wave * 0.4)));
  const tpl = enemyTypes[idx];
  const waveMult = 1 + (state.wave - 1) * 0.18;

  state.enemies.push({
    ...tpl, r, x: BOARD_X + COLS * CELL_W + 35, y,
    hp: Math.floor(tpl.hp * waveMult),
    maxHp: Math.floor(tpl.hp * waveMult),
    chillTimer: 0, freezeTimer: 0, hitFlash: 0,
    wobble: Math.random() * 10
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

// 8. 游戏物理逻辑循环 (60FPS)
let lastTime = performance.now();
function updateGame(now) {
  const dt = (now - lastTime) * state.gameSpeed;
  lastTime = now;
  if (state.paused) return;

  SEED_CATALOG.forEach(s => {
    if (state.seedCooldowns[s.id] > 0) {
      state.seedCooldowns[s.id] = Math.max(0, state.seedCooldowns[s.id] - dt);
    }
  });

  if (state.overloadTimer > 0) state.overloadTimer--;
  if (state.screenShake > 0) state.screenShake--;

  // 天降灵气齿轮 (PvZ 阳光)
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

  // 刷怪节奏
  spawnCounter += state.gameSpeed;
  const spawnThreshold = Math.max(80, 240 - state.wave * 14);
  if (spawnCounter >= spawnThreshold) {
    spawnCounter = 0;
    spawnEnemy();
  }

  // 更新我方机关
  state.towers.forEach((t, tIdx) => {
    t.scaleX += (1 - t.scaleX) * 0.15;
    t.scaleY += (1 - t.scaleY) * 0.15;
    if (t.hitFlash > 0) t.hitFlash--;

    let speedMult = state.overloadTimer > 0 ? 2.0 : 1.0;
    if (state.activeBuffs.has('overdrive')) speedMult *= 1.2;
    t.timer += speedMult * state.gameSpeed;

    // 聚灵炉 (向日葵)
    if (t.id === 'furnace') {
      const interval = state.activeBuffs.has('sun_furnace') ? 460 : 640;
      if (t.timer >= interval) {
        t.timer = 0;
        t.scaleX = 1.35; t.scaleY = 0.75;
        state.gears.push({
          x: t.x + (Math.random() - 0.5) * 36,
          y: t.y - 10,
          targetY: t.y + 24,
          val: 25, life: 750, sway: 0
        });
      }
    }
    // 连弩车 (豌豆射手)
    else if (t.id === 'crossbow') {
      const hasTarget = state.enemies.some(e => e.r === t.r && e.x > t.x);
      if (hasTarget && t.timer >= 80) {
        t.timer = 0;
        t.shotCount++;
        t.scaleX = 0.8; t.scaleY = 1.25;
        if (window.soundEngine) window.soundEngine.playArrow();

        const isThunder = state.activeBuffs.has('thunder_bow');
        const dmg = isThunder ? 38 : 25;
        state.bullets.push({
          x: t.x + 24, y: t.y, r: t.r, vx: 8.5, dmg,
          isThunder, color: isThunder ? '#e040fb' : '#ffca28', radius: 5
        });

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
    // 震天雷 (土豆地雷)
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
    // 霜方士 (寒冰射手)
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
    // 梨花针 (散弹射手)
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
    // 饕餮兽 (大嘴花)
    else if (t.id === 'taotie') {
      if (t.chewingTimer > 0) {
        t.chewingTimer--;
      } else {
        const prey = state.enemies.find(e => e.r === t.r && e.x > t.x && e.x - t.x < 110);
        if (prey) {
          t.scaleX = 1.5; t.scaleY = 1.3;
          t.chewingTimer = 360;
          if (window.soundEngine) window.soundEngine.playChomp();
          spawnFloatText(t.x, t.y - 20, '😋 大快朵颐!', '#ff7043', 18);
          state.enemies.splice(state.enemies.indexOf(prey), 1);
          setTimeout(() => {
            state.gears.push({ x: t.x, y: t.y - 10, targetY: t.y + 20, val: 35, life: 750, sway: 0 });
          }, 3500);
        }
      }
    }
  });

  // 更新子弹
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

        if (b.isThunder && state.enemies.length > 1) {
          const other = state.enemies.find(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 160);
          if (other) {
            other.hp -= b.dmg * 0.5;
            other.hitFlash = 6;
          }
        }

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

  // 更新敌人
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.chillTimer > 0) e.chillTimer--;
    if (e.freezeTimer > 0) { e.freezeTimer--; continue; }

    const blocker = state.towers.find(t => t.r === e.r && Math.abs(t.x - e.x) < 36);
    if (blocker) {
      blocker.hp -= 0.8;
      blocker.hitFlash = 4;
      if (blocker.id === 'shield' && state.activeBuffs.has('iron_wall')) {
        e.hp -= 0.6;
      }
      if (blocker.hp <= 0) {
        state.towers.splice(state.towers.indexOf(blocker), 1);
      }
    } else {
      const spdMult = e.chillTimer > 0 ? 0.5 : 1;
      e.x -= e.spd * spdMult * state.gameSpeed;
    }

    // 触发阵眼石狮小推车
    if (e.x < BOARD_X - 12) {
      if (state.lions[e.r]) {
        state.lions[e.r] = false;
        state.screenShake = 10;
        if (window.soundEngine) window.soundEngine.playLawnMower();
        spawnFloatText(BOARD_X + 60, e.y, '🦁 阵眼石狮怒吼冲刺！', '#f5b041', 20);
        spawnFireCrowRow(e.r, e.y);
      } else {
        e.x = BOARD_X + COLS * CELL_W;
      }
    }

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

  // 更新粒子
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  updateHUD();
}

// 9. 现代Q版纯原生矢量绘制系统 (0KB资源加载·视网膜超清·生动表情)

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
  }

  // 1. 经典植物大战僵尸交替青绿草坪格 (PvZ Lawn)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * CELL_W;
      const y = BOARD_Y + r * CELL_H;
      const isAlt = (r + c) % 2 === 0;

      // 清新现代青玉草坪格
      ctx.fillStyle = isAlt ? '#255241' : '#1c4335';
      ctx.fillRect(x, y, CELL_W, CELL_H);

      // 内高光与暗金边
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_W, CELL_H);
    }
  }

  // 2. 放置与拆解光圈
  if (state.hoverCell.r >= 0 && (state.selectedSeed || state.shovelActive)) {
    const { r, c } = state.hoverCell;
    const hx = BOARD_X + c * CELL_W;
    const hy = BOARD_Y + r * CELL_H;
    ctx.save();
    ctx.fillStyle = state.shovelActive ? 'rgba(231, 76, 60, 0.18)' : 'rgba(255, 234, 121, 0.15)';
    ctx.fillRect(BOARD_X, hy, COLS * CELL_W, CELL_H);
    ctx.fillRect(hx, BOARD_Y, CELL_W, ROWS * CELL_H);

    ctx.strokeStyle = state.shovelActive ? '#e74c3c' : '#ffe066';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(hx + 2, hy + 2, CELL_W - 4, CELL_H - 4);
    ctx.restore();
  }

  // 3. 左侧阵眼石狮小推车 (PvZ Lawn Mower)
  for (let r = 0; r < ROWS; r++) {
    if (!state.lions[r]) continue;
    const lx = BOARD_X - 48;
    const ly = BOARD_Y + r * CELL_H + CELL_H / 2;
    drawChibiLion(lx, ly);
  }

  // 4. 绘制场上机关兽 (纯矢量 Chibi Q 版形象)
  const idleWobble = Math.sin(Date.now() / 240) * 0.04;
  state.towers.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scaleX, t.scaleY + idleWobble);

    // 阴影底座
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 烘炉九宫格光环
    if (t.id === 'furnace') {
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 202, 40, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 绘制具体机关造型
    drawChibiTower(t);

    // 耐久血条
    if (t.hp < t.maxHp) {
      drawChunkyBar(-26, -44, 52, 6, t.hp / t.maxHp, '#2ecc71');
    }
    ctx.restore();
  });

  // 5. 绘制山海魇魔敌人 (纯矢量 Q 版形象)
  state.enemies.forEach(e => {
    ctx.save();
    ctx.translate(e.x, e.y);

    // 椭圆投影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius, e.radius * 0.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    drawChibiEnemy(e);

    // 冰封冰块
    if (e.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(129, 212, 250, 0.65)';
      ctx.strokeStyle = '#e1f5fe';
      ctx.lineWidth = 2;
      ctx.fillRect(-e.radius - 4, -e.radius - 4, (e.radius + 4) * 2, (e.radius + 4) * 2);
      ctx.strokeRect(-e.radius - 4, -e.radius - 4, (e.radius + 4) * 2, (e.radius + 4) * 2);
    }

    drawChunkyBar(-24, -e.radius - 12, 48, 5, e.hp / e.maxHp, '#e74c3c');
    ctx.restore();
  });

  // 6. 绘制投射物 (发光箭矢与火箭飞鸦)
  state.bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.isCrow) {
      drawChibiFireCrow(0, 0);
    } else {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // 箭头尾迹
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2, 0, b.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 7. 绘制天降灵气齿轮 (PvZ 经典金黄旋转太阳)
  state.gears.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Date.now() / 320);
    drawChibiSunGear();
    ctx.restore();
  });

  // 8. 绘制粒子与浮空文字
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

// 10. 极致精细的纯 Canvas 2D Q版角色造型函数集

function drawChibiTower(t) {
  const isFlash = t.hitFlash > 0;
  if (isFlash) {
    ctx.filter = 'brightness(220%) contrast(150%)';
  }

  // 1. 聚灵炉 (胖乎乎微笑炉子)
  if (t.id === 'furnace') {
    // 炉身
    ctx.fillStyle = '#b87333';
    ctx.beginPath();
    ctx.arc(0, 4, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5b041';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 炉耳
    ctx.fillStyle = '#8c5324';
    ctx.beginPath();
    ctx.arc(-28, -2, 7, 0, Math.PI * 2);
    ctx.arc(28, -2, 7, 0, Math.PI * 2);
    ctx.fill();

    // 炉顶小烟囱与青烟
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-10, -32, 20, 10);
    const smokeOffset = (Date.now() / 200) % 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(0, -38 - smokeOffset, 6 + smokeOffset * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 萌系眼睛与腮红
    ctx.fillStyle = '#ff8a80';
    ctx.beginPath();
    ctx.arc(-16, 12, 6, 0, Math.PI * 2);
    ctx.arc(16, 12, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#261a12';
    ctx.beginPath();
    ctx.arc(-10, 2, 4, 0, Math.PI * 2);
    ctx.arc(10, 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // 眼神高光
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-9, 1, 1.8, 0, Math.PI * 2);
    ctx.arc(11, 1, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 开心嘴巴
    ctx.strokeStyle = '#261a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 12, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // 2. 连弩车 (呆萌木鸟弩机)
  else if (t.id === 'crossbow') {
    // 弩木底盘
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-22, 14, 44, 14);
    ctx.fillStyle = '#b7791f';
    ctx.beginPath();
    ctx.arc(-15, 28, 8, 0, Math.PI * 2);
    ctx.arc(15, 28, 8, 0, Math.PI * 2);
    ctx.fill();

    // 鸟型发射头
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.arc(0, -4, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 弩嘴
    ctx.fillStyle = '#f5b041';
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(28, -4);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();

    // 瞄准大眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(8, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(9, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 弓臂弹簧
    ctx.strokeStyle = '#f5b041';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-6, -4, 22, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
  }
  // 3. 玄武盾 (萌系小乌龟·动态表情)
  else if (t.id === 'shield') {
    const hpRatio = t.hp / t.maxHp;

    // 绿色龟头与小四肢
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(0, -22, 12, 0, Math.PI * 2); // 龟头
    ctx.arc(-22, 14, 8, 0, Math.PI * 2); // 四肢
    ctx.arc(22, 14, 8, 0, Math.PI * 2);
    ctx.fill();

    // 坚硬龟壳
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(0, 4, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 龟壳纹理
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -6, 20, 20);

    // 动态换表情
    if (hpRatio > 0.6) {
      // 满血灿烂笑容
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(-4, -24, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -24, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -20, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (hpRatio > 0.3) {
      // 半血擦汗吃力
      ctx.fillStyle = '#212121';
      ctx.fillRect(-6, -24, 4, 2);
      ctx.fillRect(2, -24, 4, 2);
      // 汗珠
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(8, -28, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 残血晕圈眼
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-4, -24, 4, 0, Math.PI * 2);
      ctx.arc(4, -24, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // 4. 震天雷 (萌系土豆雷)
  else if (t.id === 'landmine') {
    if (!t.armed) {
      // 钻地未就绪：泥土堆与旋转发条
      ctx.fillStyle = '#795548';
      ctx.beginPath();
      ctx.arc(0, 16, 22, Math.PI, 0);
      ctx.fill();

      // 旋转发条旋钮
      ctx.save();
      ctx.translate(0, 8);
      ctx.rotate(Date.now() / 150);
      ctx.fillStyle = '#f5b041';
      ctx.fillRect(-3, -12, 6, 24);
      ctx.fillRect(-12, -3, 24, 6);
      ctx.restore();

      // 睡觉呼噜泡泡
      ctx.fillStyle = 'rgba(129, 212, 250, 0.7)';
      ctx.beginPath();
      ctx.arc(14, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 就绪：钻出地面的元气土豆炸弹
      ctx.fillStyle = '#a1887f';
      ctx.beginPath();
      ctx.ellipse(0, 8, 24, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 红色必胜头带
      ctx.fillStyle = '#e53935';
      ctx.fillRect(-22, -6, 44, 8);

      // 元气大眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-8, 8, 6, 0, Math.PI * 2);
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(-8, 8, 3.5, 0, Math.PI * 2);
      ctx.arc(8, 8, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 怒吼嘴
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.arc(0, 20, 5, 0, Math.PI);
      ctx.fill();
    }
  }
  // 5. 饕餮兽 (大嘴凶萌兽)
  else if (t.id === 'taotie') {
    ctx.fillStyle = '#512da8';
    ctx.beginPath();
    ctx.arc(0, 6, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d1c4e9';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 双小角
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.moveTo(-16, -16); ctx.lineTo(-24, -30); ctx.lineTo(-8, -20); ctx.fill();
    ctx.moveTo(16, -16); ctx.lineTo(24, -30); ctx.lineTo(8, -20); ctx.fill();

    // 巨口
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, t.chewingTimer > 0 ? 8 : 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尖尖小虎牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(-6, 8); ctx.lineTo(-2, 0); ctx.fill();
    ctx.moveTo(2, 0); ctx.lineTo(6, 8); ctx.lineTo(10, 0); ctx.fill();

    // 萌眼睛
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(-10, -6, 4, 0, Math.PI * 2);
    ctx.arc(10, -6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 6. 霜方士 (小法师)
  else if (t.id === 'frost_mage') {
    // 蓝色小道袍
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(24, 28); ctx.lineTo(-24, 28); ctx.closePath();
    ctx.fill();

    // 脑袋
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, Math.PI * 2);
    ctx.fill();

    // 巫师高帽
    ctx.fillStyle = '#0d47a1';
    ctx.beginPath();
    ctx.moveTo(-18, -14); ctx.lineTo(0, -38); ctx.lineTo(18, -14); ctx.closePath();
    ctx.fill();

    // 冰晶法杖
    ctx.strokeStyle = '#90caf9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 26); ctx.lineTo(20, -16);
    ctx.stroke();
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(20, -18, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 7. 暴雨梨花 (莲花机关)
  else if (t.id === 'pear_blossom') {
    ctx.save();
    ctx.rotate(Date.now() / 300);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.fillStyle = i % 2 === 0 ? '#ec407a' : '#f48fb1';
      ctx.beginPath();
      ctx.ellipse(0, 18, 8, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#f5b041';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 11. 绘制山海魇魔 Chibi 敌人
function drawChibiEnemy(e) {
  const isFlash = e.hitFlash > 0;
  if (isFlash) {
    ctx.filter = 'brightness(220%) contrast(150%)';
  }

  // 1. 呆萌兵俑 (小泥人)
  ctx.fillStyle = e.chillTimer > 0 ? '#81d4fa' : e.color;
  ctx.beginPath();
  ctx.arc(0, -4, 18, 0, Math.PI * 2); // 脑袋
  ctx.fill();
  ctx.fillRect(-12, 10, 24, 20); // 身体

  // 巨大青铜陶甲头盔与红缨
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.arc(0, -8, 20, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#e53935'; // 红缨
  ctx.beginPath();
  ctx.arc(0, -28, 6, 0, Math.PI * 2);
  ctx.fill();

  // 亮红凶呆小眼睛
  ctx.fillStyle = '#d50000';
  ctx.beginPath();
  ctx.arc(-6, -4, 3, 0, Math.PI * 2);
  ctx.arc(6, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // 走路摇晃小脚
  const legOffset = Math.sin(Date.now() / 120 + e.wobble) * 4;
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(-10, 28 + legOffset, 8, 8);
  ctx.fillRect(2, 28 - legOffset, 8, 8);
}

// 12. 绘制阵眼石狮小推车
function drawChibiLion(x, y) {
  ctx.save();
  ctx.translate(x, y);

  // 双轮木车板
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(-22, 14, 44, 10);
  ctx.fillStyle = '#b7791f';
  ctx.beginPath();
  ctx.arc(-14, 24, 8, 0, Math.PI * 2);
  ctx.arc(14, 24, 8, 0, Math.PI * 2);
  ctx.fill();

  // 胖墩墩青石石狮
  ctx.fillStyle = '#78909c';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 卷曲狮鬃
  ctx.fillStyle = '#546e7a';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 20, Math.sin(a) * 20, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 金黄威武大眼睛与红舌头
  ctx.fillStyle = '#ffea79';
  ctx.beginPath();
  ctx.arc(-7, -4, 4.5, 0, Math.PI * 2);
  ctx.arc(7, -4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e91e63';
  ctx.beginPath();
  ctx.arc(0, 8, 4, 0, Math.PI);
  ctx.fill();

  // 脖间小金铃
  ctx.fillStyle = '#f5b041';
  ctx.beginPath();
  ctx.arc(0, 16, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 13. 绘制火飞鸦
function drawChibiFireCrow(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f4511e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // 火焰喷尾
  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.moveTo(-20, -8); ctx.lineTo(-38, 0); ctx.lineTo(-20, 8); ctx.closePath();
  ctx.fill();
  // 护目镜
  ctx.fillStyle = '#263238';
  ctx.fillRect(4, -8, 12, 16);
  ctx.restore();
}

// 14. 绘制天降旋转金太阳齿轮
function drawChibiSunGear() {
  ctx.shadowColor = '#ffe066';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffea79';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  // 齿轮齿
  ctx.strokeStyle = '#f5b041';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const rad = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * 14, Math.sin(rad) * 14);
    ctx.lineTo(Math.cos(rad) * 20, Math.sin(rad) * 20);
    ctx.stroke();
  }

  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawChunkyBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}

// 15. 启动引擎与主循环
initSeedBankUI();
updateHUD();

function mainLoop(now) {
  updateGame(now);
  renderGame();
  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);
