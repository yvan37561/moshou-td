/**
 * 《山海机关录：墨守》游戏主控制器与主循环
 * 协调战场逻辑、用户输入、手牌CD、九宫光环、波次生成、关卡流转及UI交互
 */

class GameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.grid = new Grid(CONFIG.GRID.ROWS, CONFIG.GRID.COLS);
    this.renderer = new GameRenderer(this.canvas, this);

    // 核心子系统
    this.roguelite = new RogueliteManager(this);
    this.shop = new ShopSystem(this);
    this.events = new EventSystem(this);
    this.talents = new TalentSystem(this);

    // 局内核心资源
    this.qi = CONFIG.RESOURCE.INITIAL_QI + this.talents.getInitialQiBonus();
    this.coins = 100; // 局内先秦刀币初始
    this.overloadEnergy = 0;
    this.gameSpeed = 1;
    this.isPaused = false;

    // 实体容器
    this.automata = [];
    this.fiends = [];
    this.projectiles = [];
    this.dropItems = [];
    this.guardianLions = [];
    this.currentBoss = null;

    // 交互状态
    this.dragCard = null;
    this.isDismantleMode = false;
    this.isOverloadSelectMode = false;
    this.mousePos = { x: 0, y: 0 };

    // 卡牌冷却字典
    this.cardCooldowns = {};
    for (const id of Object.keys(CONFIG.AUTOMATA)) {
      this.cardCooldowns[id] = 0;
    }

    // 羁绊与全局 Buff
    this.hasFireSynergy = false;
    this.hasHeavySynergy = false;
    this.hasTalismanSynergy = false;
    this.globalDamageMultiplier = 1.0;
    this.globalArmorPenetration = 0;

    // 事件附加状态
    this.nextBattleExtraQi = 0;
    this.nextBattleSpawnHeavy = false;
    this.dualBranchBuffBattles = 0;
    this.sacrificedLionsCount = 0;
    this.giftFurnaceBattles = 0;
    this.zeroRewardBattles = 0;

    // 波次生成控制
    this.waveTimer = 0;
    this.currentWave = 1;
    this.maxWaves = 4;
    this.waveSpawnQueue = [];
    this.isBattleActive = false;

    // 木鸢巡天定时器
    this.kiteTimer = 0;

    window.gameInstance = this;
    this.initLions();
    this.bindEvents();
    this.renderHandCards();
    this.startFloorBattle();
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  initLions() {
    this.guardianLions = [];
    for (let r = 0; r < this.grid.rows; r++) {
      const lion = new GuardianLion(r, this);
      // 背水一战词条献祭判定
      if (this.hasScroll('scroll_beishui')) {
        lion.sacrifice();
        this.globalDamageMultiplier += 0.12;
      }
      this.guardianLions.push(lion);
    }
  }

  // 检查是否拥有某竹简词条
  hasScroll(scrollId) {
    return this.roguelite.activeScrolls.some(s => s.id === scrollId);
  }

  // 检查是否拥有某信物
  hasRelic(relicId) {
    return this.roguelite.activeRelics.some(r => r.id === relicId) || this.talents.equippedRelics.includes(relicId);
  }

  addQi(amount) {
    this.qi += amount;
    this.updateResourceUI();
  }

  deductQi(amount) {
    this.qi = Math.max(0, this.qi - amount);
    this.updateResourceUI();
  }

  addCoins(amount) {
    if (this.zeroRewardBattles > 0) return; // 未来借贷惩罚
    this.coins += amount;
    this.updateResourceUI();
  }

  deductCoins(amount) {
    this.coins = Math.max(0, this.coins - amount);
    this.updateResourceUI();
  }

  addOverloadEnergy(amount) {
    const gainMul = this.talents.getOverloadGainMultiplier();
    this.overloadEnergy = Math.min(CONFIG.RESOURCE.MAX_OVERLOAD, this.overloadEnergy + amount * gainMul);
    this.updateResourceUI();
  }

  triggerPixiuBonus() {
    this.addCoins(2);
  }

  // 生成掉落物
  spawnDropItem(type, x, y, value) {
    const greedy = this.hasScroll('scroll_greedy');
    this.dropItems.push(new DropItem(type, x, y, value, { greedyClock: greedy }));
  }

  // 开始当前层的战斗
  startFloorBattle() {
    const floor = this.roguelite.currentFloor;
    this.isBattleActive = true;
    this.fiends = [];
    this.projectiles = [];
    this.dropItems = [];
    this.currentBoss = null;
    this.waveTimer = 0;
    this.currentWave = 1;

    // 初始灵气赋能
    this.qi = CONFIG.RESOURCE.INITIAL_QI + this.talents.getInitialQiBonus() + this.roguelite.inheritedQiBonus + this.nextBattleExtraQi;
    this.nextBattleExtraQi = 0;

    // 生成五行地脉格
    const veinCount = this.talents.getVeinCount();
    this.grid.generateVeins(veinCount);

    // 恢复中枢继承机关
    this.grid.restoreInheritedState(this.roguelite.inheritedGridState, (id, r, c) => new Automaton(id, r, c, this));

    // 赠送乾坤聚宝盆
    if (this.giftFurnaceBattles > 0) {
      this.giftFurnaceBattles--;
      const auto = new Automaton('furnace', 2, 0, this);
      auto.setBranch('B');
      this.grid.cells[2][0].automaton = auto;
    }

    // 3重装羁绊【铁壁】：在第6列升起一排木栅栏
    if (this.hasHeavySynergy) {
      for (let r = 0; r < this.grid.rows; r++) {
        this.grid.addObstacle('机关木栅栏', r, 5, 500, false);
      }
    }

    // 确定本层敌人波次配置
    const isBossFloor = (floor % 8 === 0);
    const isElite = this.roguelite.currentNode && this.roguelite.currentNode.type === 'elite';

    if (isBossFloor) {
      this.maxWaves = 1;
      // 第8层相柳，第16/24层刑天
      if (floor === 8) {
        this.currentBoss = new XiangliuBoss(this);
      } else {
        this.currentBoss = new XingtianBoss(this);
      }
      this.fiends.push(this.currentBoss);
    } else {
      this.maxWaves = isElite ? 5 : 4;
      this.prepareWave(1);
    }

    this.updateResourceUI();
    this.renderer.addFloatingText(`第 ${floor} 层 守阵开始！`, 500, 180, '#f1c40f', 24);
  }

  prepareWave(waveNum) {
    this.waveSpawnQueue = [];
    const floor = this.roguelite.currentFloor;
    const count = 3 + waveNum * 2 + Math.floor(floor * 0.8);

    const types = ['soldier', 'rattan'];
    if (floor >= 2) types.push('heavy');
    if (floor >= 3) types.push('mandrill');
    if (floor >= 4) types.push('berserk_ghost');
    if (floor >= 6) types.push('chariot');

    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const row = Math.floor(Math.random() * this.grid.rows);
      this.waveSpawnQueue.push({
        type: t,
        row,
        delay: i * (1.8 - Math.min(0.8, floor * 0.04))
      });
    }
  }

  spawnFiend(type, row) {
    const f = new Fiend(type, row, this);
    this.fiends.push(f);
  }

  // 主更新
  update(dt) {
    if (this.isPaused) return;
    dt = dt * this.gameSpeed;

    // 更新网格与地表
    this.grid.update(dt);

    // 九宫动力链计算（烘炉给周围3x3加层数）
    this.updateNinePalaceBuffs();

    // 更新各机关
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const auto = this.grid.cells[r][c].automaton;
        if (auto) {
          auto.update(dt, this);
          if (auto.isDead) {
            this.grid.cells[r][c].automaton = null;
          }
        }
      }
    }

    // 更新投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this);
      if (p.isDead) {
        this.projectiles.splice(i, 1);
      }
    }

    // 更新敌人
    for (let i = this.fiends.length - 1; i >= 0; i--) {
      const f = this.fiends[i];
      f.update(dt, this);
      if (f.isDead && !f.isBoss) {
        this.fiends.splice(i, 1);
      }
    }

    // 更新 Boss
    if (this.currentBoss && !this.currentBoss.isDead) {
      this.currentBoss.update(dt, this);
    }

    // 更新掉落物
    for (let i = this.dropItems.length - 1; i >= 0; i--) {
      const item = this.dropItems[i];
      item.update(dt, this);
      if (item.isDead) {
        this.dropItems.splice(i, 1);
      }
    }

    // 木鸢巡天自动吸附
    if (this.talents.hasKiteAutoCollect()) {
      this.kiteTimer += dt;
      if (this.kiteTimer >= 4.0) {
        this.kiteTimer = 0;
        const available = this.dropItems.filter(d => !d.isAttracting && !d.isDead);
        if (available.length > 0) {
          available[0].collect(this);
        }
      }
    }

    // 更新阵眼石狮
    for (const lion of this.guardianLions) {
      lion.update(dt, this);
    }

    // 卡牌冷却衰减
    for (const key of Object.keys(this.cardCooldowns)) {
      if (this.cardCooldowns[key] > 0) {
        let cdRate = 1.0;
        if (this.hasScroll('scroll_quick_gear')) cdRate += 0.15;
        this.cardCooldowns[key] = Math.max(0, this.cardCooldowns[key] - dt * cdRate);
      }
    }
    this.updateCardCooldownUI();

    // 波次生成与战斗结算
    this.updateBattleWaves(dt);
  }

  updateNinePalaceBuffs() {
    // 重置所有机关光环层数
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const a = this.grid.cells[r][c].automaton;
        if (a) a.buffLayers = 0;
      }
    }

    // 烘炉提供九宫格增益
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const a = this.grid.cells[r][c].automaton;
        if (a && a.id === 'furnace' && a.branch !== 'B') {
          // 乾坤聚宝盆移除光环
          const radius = (this.furnaceAuraLarge && c === 0) ? 2 : 1; // 稳守后方 5x5
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const tr = r + dr;
              const tc = c + dc;
              if (tr >= 0 && tr < this.grid.rows && tc >= 0 && tc < this.grid.cols) {
                const target = this.grid.cells[tr][tc].automaton;
                if (target && target !== a) {
                  target.buffLayers = Math.min(2, target.buffLayers + 1);
                }
              }
            }
          }
        }
      }
    }
  }

  updateBattleWaves(dt) {
    if (!this.isBattleActive) return;

    if (this.currentBoss) {
      if (this.currentBoss.isDead) {
        this.isBattleActive = false;
        setTimeout(() => this.onFloorVictory(), 1000);
      }
      return;
    }

    // 常规敌人生成
    if (this.waveSpawnQueue.length > 0) {
      this.waveTimer += dt;
      for (let i = this.waveSpawnQueue.length - 1; i >= 0; i--) {
        const item = this.waveSpawnQueue[i];
        if (this.waveTimer >= item.delay) {
          this.spawnFiend(item.type, item.row);
          this.waveSpawnQueue.splice(i, 1);
        }
      }
    } else {
      // 当前波怪物清空，推进下一波
      if (this.fiends.length === 0) {
        if (this.currentWave < this.maxWaves) {
          this.currentWave++;
          this.waveTimer = 0;
          this.prepareWave(this.currentWave);
          this.renderer.addFloatingText(`第 ${this.currentWave} 波 进攻！`, 500, 150, '#e74c3c');
        } else {
          // 本层全胜！
          this.isBattleActive = false;
          setTimeout(() => this.onFloorVictory(), 1000);
        }
      }
    }
  }

  onFloorVictory() {
    AudioSys.playLionRoar();
    const isElite = this.roguelite.currentNode && this.roguelite.currentNode.type === 'elite';
    const isBoss = !!this.currentBoss;
    const noLionTriggered = !this.guardianLions.some(l => l.isTriggered);
    const noCoreDamage = true; // 中枢完好

    const rewardInfo = this.roguelite.calculateFloorRewards(isElite, isBoss, noLionTriggered, noCoreDamage);
    this.roguelite.finishFloorBattle(rewardInfo);

    // 弹出通关结算界面与三选一
    this.showVictoryModal(rewardInfo);
  }

  onBossDefeated(boss) {
    this.talents.addInk(50); // 击败 Boss 奖励天工墨锭
  }

  // 主循环
  loop(now) {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render(dt);

    requestAnimationFrame(this.loop.bind(this));
  }

  // 建造机关
  buildAutomaton(cardId, row, col) {
    const cfg = CONFIG.AUTOMATA[cardId];
    if (!cfg) return false;
    if (this.qi < cfg.cost) {
      this.renderer.addFloatingText('灵气不足！', this.mousePos.x, this.mousePos.y, '#e74c3c');
      return false;
    }
    if (this.cardCooldowns[cardId] > 0) {
      this.renderer.addFloatingText('尚在回转冷却！', this.mousePos.x, this.mousePos.y, '#e74c3c');
      return false;
    }
    if (this.grid.cells[row][col].automaton) {
      this.renderer.addFloatingText('已有机关布设！', this.mousePos.x, this.mousePos.y, '#e74c3c');
      return false;
    }

    // 扣除灵气并进入冷却
    this.deductQi(cfg.cost);
    let cd = cfg.cooldown;
    if (this.grid.cells[row][col].vein === 'water') cd *= 0.75; // 水脉格减CD
    this.cardCooldowns[cardId] = cd;

    const auto = new Automaton(cardId, row, col, this);
    this.grid.cells[row][col].automaton = auto;
    AudioSys.playGearClick();
    this.renderer.addHitSparks(auto.x, auto.y, '#2ecc71', 12);
    return true;
  }

  // 鲁班拆解钳拆除机关
  dismantleAt(row, col) {
    const cell = this.grid.cells[row][col];
    if (!cell.automaton) return;

    const auto = cell.automaton;

    // 草木皆兵词条：不再返还灵气，改为原地引发800伤害震天雷
    if (this.hasScroll('scroll_caomu')) {
      AudioSys.playExplosion();
      this.renderer.addExplosionEffect(auto.x, auto.y, 60);
      for (const f of this.fiends) {
        if (!f.isDead && Math.hypot(f.x - auto.x, f.y - auto.y) < 120) {
          f.takeDamage(800, { isExplosion: true }, this);
        }
      }
    } else {
      // 正常回收灵气：默认40%，受天赋加成
      let refundRatio = this.talents.getDismantleRefundRatio();
      if (cell.vein === 'wood' || cell.vein === 'taiji') refundRatio = 1.0;
      const refund = Math.floor(auto.cost * refundRatio);
      this.addQi(refund);
      this.renderer.addFloatingText(`回收灵气 +${refund}`, auto.x, auto.y - 20, '#2ecc71');
    }

    cell.automaton.takeDamage(999999, 'dismantled');
    cell.automaton = null;
    AudioSys.playGearClick();
  }

  // 释放机巧过载
  triggerOverloadAt(row, col) {
    const auto = this.grid.cells[row][col].automaton;
    if (!auto) return;
    if (this.overloadEnergy < CONFIG.RESOURCE.OVERLOAD_COST) {
      this.renderer.addFloatingText('天工炉能量未盈！', auto.x, auto.y, '#e74c3c');
      return;
    }

    this.overloadEnergy -= CONFIG.RESOURCE.OVERLOAD_COST;
    auto.activateOverload();

    // 3符箓共鸣【通灵】：全屏机关刷新攻击间隔并回复15%耐久
    if (this.hasTalismanSynergy) {
      for (let r = 0; r < this.grid.rows; r++) {
        for (let c = 0; c < this.grid.cols; c++) {
          const a = this.grid.cells[r][c].automaton;
          if (a && !a.isDead) {
            a.attackTimer = 999;
            a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.15);
          }
        }
      }
      this.renderer.addFloatingText('通灵共振！全军回复刷新！', 500, 100, '#3498db');
    }

    // 武备堂终极基石【同频共振】：同行同名机关50%概率次级过载
    if (this.talents.hasResonance()) {
      for (let c = 0; c < this.grid.cols; c++) {
        const sameRowAuto = this.grid.cells[row][c].automaton;
        if (sameRowAuto && sameRowAuto !== auto && sameRowAuto.id === auto.id && Math.random() < 0.5) {
          sameRowAuto.isOverloaded = true;
          sameRowAuto.overloadTimer = 4.0;
          this.renderer.addFloatingText('同频共振！', sameRowAuto.x, sameRowAuto.y - 20, '#f1c40f');
        }
      }
    }

    this.updateResourceUI();
  }

  // 玄武重盾反弹近战伤害
  reflectMeleeDamage(row, col, reflectDmg) {
    for (const f of this.fiends) {
      if (!f.isDead && f.row === row && Math.abs(f.x - (this.grid.originX + col * this.grid.cellWidth)) < 60) {
        f.takeDamage(reflectDmg, { isReflect: true }, this);
        this.renderer.addFloatingText(`反震 ${reflectDmg}`, f.x, f.y - 15, '#f39c12');
      }
    }
  }

  // 击退某行所有敌人
  knockbackRow(row, cellsCount) {
    for (const f of this.fiends) {
      if (!f.isDead && f.row === row && !f.immuneKnockback) {
        f.x = Math.min(this.grid.originX + this.grid.cols * this.grid.cellWidth + 30, f.x + cellsCount * this.grid.cellWidth);
      }
    }
    this.renderer.addFloatingText('磁暴电磁震退！', 600, this.grid.getCellBounds(row, 0).centerY, '#3498db');
  }

  // 自动响应式与移动端屏幕缩放适配
  setupResponsiveScaling() {
    const container = document.getElementById('gameContainer');
    const notice = document.getElementById('orientationNotice');
    const dismissBtn = document.getElementById('dismissNoticeBtn');

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        if (notice) notice.classList.add('hidden');
      };
    }

    const resizeFn = () => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      // 竖屏检测与提示
      if (winH > winW && winW < 768) {
        if (notice && !notice.dataset.dismissed) {
          notice.classList.remove('hidden');
        }
      } else {
        if (notice) notice.classList.add('hidden');
      }

      // 等比计算缩放系数铺满手机屏幕
      const targetW = 1160;
      const targetH = 640;
      const scale = Math.min(winW / targetW, winH / targetH);
      container.style.transform = `scale(${scale})`;
    };

    window.addEventListener('resize', resizeFn);
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeFn, 200);
    });
    resizeFn();
  }

  // 绑定交互事件（同时支持鼠标与移动端触摸）
  bindEvents() {
    this.setupResponsiveScaling();

    const getCanvasCoordinates = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    // 鼠标移动
    this.canvas.addEventListener('mousemove', (e) => {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      this.mousePos.x = coords.x;
      this.mousePos.y = coords.y;

      for (const item of this.dropItems) {
        if (item.checkHover(this.mousePos.x, this.mousePos.y)) {
          item.collect(this);
        }
      }
    });

    // 触控滑动（手指划过自动拾取，极佳手感）
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const coords = getCanvasCoordinates(e.touches[0].clientX, e.touches[0].clientY);
        this.mousePos.x = coords.x;
        this.mousePos.y = coords.y;

        for (const item of this.dropItems) {
          if (item.checkHover(this.mousePos.x, this.mousePos.y)) {
            item.collect(this);
          }
        }
      }
    }, { passive: false });

    // 统一点击/触摸处理
    const handleTap = (clientX, clientY) => {
      AudioSys.init();
      const coords = getCanvasCoordinates(clientX, clientY);
      this.mousePos.x = coords.x;
      this.mousePos.y = coords.y;

      // 拾取掉落物判定
      for (const item of this.dropItems) {
        if (item.checkHover(this.mousePos.x, this.mousePos.y)) {
          item.collect(this);
          return;
        }
      }

      const pos = this.grid.getGridPosAt(this.mousePos.x, this.mousePos.y);
      if (!pos) return;

      if (this.isDismantleMode) {
        this.dismantleAt(pos.row, pos.col);
        this.isDismantleMode = false;
        document.getElementById('dismantleBtn').classList.remove('active');
        return;
      }

      if (this.isOverloadSelectMode) {
        this.triggerOverloadAt(pos.row, pos.col);
        this.isOverloadSelectMode = false;
        document.getElementById('overloadBtn').classList.remove('active');
        return;
      }

      if (this.dragCard) {
        if (this.buildAutomaton(this.dragCard, pos.row, pos.col)) {
          this.dragCard = null;
          document.querySelectorAll('.card-item').forEach(el => el.classList.remove('selected'));
        }
      }
    };

    this.canvas.addEventListener('click', (e) => {
      handleTap(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        handleTap(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // 鲁班拆解钳按钮
    const dismantleBtn = document.getElementById('dismantleBtn');
    if (dismantleBtn) {
      dismantleBtn.addEventListener('click', () => {
        AudioSys.init();
        this.isDismantleMode = !this.isDismantleMode;
        this.dragCard = null;
        this.isOverloadSelectMode = false;
        dismantleBtn.classList.toggle('active', this.isDismantleMode);
      });
    }

    // 机巧过载按钮
    const overloadBtn = document.getElementById('overloadBtn');
    if (overloadBtn) {
      overloadBtn.addEventListener('click', () => {
        AudioSys.init();
        if (this.overloadEnergy >= CONFIG.RESOURCE.OVERLOAD_COST) {
          this.isOverloadSelectMode = !this.isOverloadSelectMode;
          this.dragCard = null;
          this.isDismantleMode = false;
          overloadBtn.classList.toggle('active', this.isOverloadSelectMode);
        } else {
          this.renderer.addFloatingText('过载能量不足 50 点！', 100, 50, '#e74c3c');
        }
      });
    }

    // 倍速与暂停
    document.getElementById('speedBtn').addEventListener('click', () => {
      this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
      document.getElementById('speedBtn').textContent = `${this.gameSpeed}X 速`;
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      document.getElementById('pauseBtn').textContent = this.isPaused ? '继续' : '暂停';
    });
  }

  // 渲染手牌卡槽
  renderHandCards() {
    const container = document.getElementById('cardSlots');
    container.innerHTML = '';

    for (const key of Object.keys(CONFIG.AUTOMATA)) {
      const cfg = CONFIG.AUTOMATA[key];
      const cardEl = document.createElement('div');
      cardEl.className = 'card-item';
      cardEl.id = `card_${key}`;
      cardEl.innerHTML = `
        <div class="card-icon-wrap">
          <img src="assets/${key}.jpg" class="card-thumb" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="fallback-icon" style="display:none;">${cfg.icon}</span>
        </div>
        <div class="card-info">
          <div class="card-name">${cfg.name}</div>
          <div class="card-cost">${cfg.cost} 灵</div>
        </div>
        <div class="cooldown-overlay" id="cd_${key}"></div>
      `;

      cardEl.addEventListener('click', () => {
        AudioSys.init();
        if (this.dragCard === key) {
          this.dragCard = null;
          cardEl.classList.remove('selected');
        } else {
          this.dragCard = key;
          this.isDismantleMode = false;
          this.isOverloadSelectMode = false;
          document.querySelectorAll('.card-item').forEach(el => el.classList.remove('selected'));
          cardEl.classList.add('selected');
        }
      });

      container.appendChild(cardEl);
    }
  }

  updateCardCooldownUI() {
    for (const key of Object.keys(CONFIG.AUTOMATA)) {
      const cdEl = document.getElementById(`cd_${key}`);
      const cfg = CONFIG.AUTOMATA[key];
      const currentCd = this.cardCooldowns[key] || 0;
      if (cdEl) {
        if (currentCd > 0) {
          const percent = currentCd / cfg.cooldown;
          cdEl.style.height = `${percent * 100}%`;
        } else {
          cdEl.style.height = '0%';
        }
      }
    }
  }

  updateResourceUI() {
    document.getElementById('qiValue').textContent = Math.floor(this.qi);
    document.getElementById('coinValue').textContent = this.coins;
    document.getElementById('overloadBar').style.width = `${(this.overloadEnergy / CONFIG.RESOURCE.MAX_OVERLOAD) * 100}%`;
    document.getElementById('overloadText').textContent = `${Math.floor(this.overloadEnergy)} / 100`;
    document.getElementById('floorLabel').textContent = `第 ${this.roguelite.currentFloor} 层`;
  }

  // 通关胜利弹窗与三选一
  showVictoryModal(rewardInfo) {
    const modal = document.getElementById('victoryModal');
    const content = document.getElementById('victoryContent');

    content.innerHTML = `
      <h3>🎉 守关大捷！</h3>
      <div class="reward-box">
        <p>基础赏金：+${rewardInfo.baseReward} 刀币</p>
        <p>击杀奖赏：+${rewardInfo.killReward} 刀币</p>
        <p>墨家钱庄利息：+${rewardInfo.interest} 刀币</p>
        <p>无损守阵奖励：+${rewardInfo.perfectReward} 刀币</p>
        <h4>总计斩获：+${rewardInfo.totalCoins} 先秦刀币</h4>
      </div>
      <h4>【天工锻造 / 墨家竹简】三选一抉择：</h4>
      <div class="choice-cards" id="victoryChoices"></div>
    `;

    const choicesContainer = document.getElementById('victoryChoices');
    const scrollOpts = this.roguelite.generateScrollOptions();

    scrollOpts.forEach(scroll => {
      const card = document.createElement('div');
      card.className = 'reward-choice-card';
      card.innerHTML = `
        <h5 style="color:${scroll.color}">📜 ${scroll.name}</h5>
        <p>${scroll.desc}</p>
        <button class="choice-btn">拓印收录</button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        this.roguelite.addScroll(scroll);
        modal.classList.add('hidden');
        this.openMapModal();
      });
      choicesContainer.appendChild(card);
    });

    modal.classList.remove('hidden');
  }

  // 打开八阵图分岔星图
  openMapModal() {
    const modal = document.getElementById('mapModal');
    const container = document.getElementById('mapNodesContainer');
    container.innerHTML = '';

    const currentLayer = this.roguelite.mapNodes[this.roguelite.currentFloor - 1];
    if (!currentLayer) {
      alert('恭喜矩子破界飞升，登顶无界封神榜！');
      return;
    }

    currentLayer.forEach(node => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'map-node-card';
      nodeEl.innerHTML = `
        <h4>${node.title}</h4>
        <p>节点类型：${node.type.toUpperCase()}</p>
        <button class="node-enter-btn">踏入此阵</button>
      `;
      nodeEl.querySelector('button').addEventListener('click', () => {
        this.roguelite.currentNode = node;
        modal.classList.add('hidden');
        this.handleNodeEnter(node);
      });
      container.appendChild(nodeEl);
    });

    modal.classList.remove('hidden');
  }

  handleNodeEnter(node) {
    if (node.type === 'shop') {
      this.openShopModal();
    } else if (node.type === 'event') {
      this.openEventModal();
    } else if (node.type === 'workshop') {
      this.openWorkshopModal();
    } else {
      this.startFloorBattle();
    }
  }

  // 打开鬼谷商铺
  openShopModal() {
    const modal = document.getElementById('shopModal');
    const container = document.getElementById('shopItemsContainer');
    container.innerHTML = '';

    const items = this.shop.generateShelves(this.roguelite.currentFloor);
    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'shop-item-card';
      el.innerHTML = `
        <h5>${item.name} ${item.isHalfPrice ? '🔥半价' : ''}</h5>
        <p>${item.desc}</p>
        <div class="shop-price">${item.price} 刀币</div>
        <button class="buy-btn" ${item.bought ? 'disabled' : ''}>${item.bought ? '已售罄' : '购买'}</button>
      `;
      el.querySelector('.buy-btn').addEventListener('click', () => {
        const res = this.shop.buyItem(index);
        this.renderer.addFloatingText(res.msg, 500, 250, res.success ? '#f1c40f' : '#e74c3c');
        if (res.success) this.openShopModal();
      });
      container.appendChild(el);
    });

    document.getElementById('rerollShopBtn').onclick = () => {
      const res = this.shop.rerollShelves(this.roguelite.currentFloor);
      this.renderer.addFloatingText(res.msg, 500, 250, res.success ? '#f1c40f' : '#e74c3c');
      if (res.success) this.openShopModal();
    };

    document.getElementById('repairCoreBtn').onclick = () => {
      const res = this.shop.repairCore();
      this.renderer.addFloatingText(res.msg, 500, 250, res.success ? '#2ecc71' : '#e74c3c');
    };

    document.getElementById('closeShopBtn').onclick = () => {
      modal.classList.add('hidden');
      this.startFloorBattle();
    };

    modal.classList.remove('hidden');
  }

  // 打开天机赌局事件
  openEventModal() {
    const modal = document.getElementById('eventModal');
    const ev = this.events.getRandomEvent();

    document.getElementById('eventTitle').textContent = `【天机赌局】${ev.name}`;
    document.getElementById('eventStory').textContent = ev.story;

    const optContainer = document.getElementById('eventOptionsContainer');
    optContainer.innerHTML = '';

    ev.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'event-choice-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => {
        const resultMsg = opt.action(this);
        alert(resultMsg);
        modal.classList.add('hidden');
        this.startFloorBattle();
      });
      optContainer.appendChild(btn);
    });

    modal.classList.remove('hidden');
  }

  // 打开墨家工坊营地
  openWorkshopModal() {
    alert('【墨家工坊营地】：全军中枢机关彻底修复 100% 耐久！');
    for (const s of this.roguelite.inheritedGridState) s.currentHp = s.maxHp;
    this.startFloorBattle();
  }

  applyAutomatonBranch(autoId, branch) {
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const auto = this.grid.cells[r][c].automaton;
        if (auto && auto.id === autoId) {
          auto.setBranch(branch);
        }
      }
    }
  }

  upgradeCoreAutomatonToGold() {
    for (let r = 0; r < this.grid.rows; r++) {
      for (const c of this.grid.coreCols) {
        const auto = this.grid.cells[r][c].automaton;
        if (auto) {
          auto.isGolden = true;
          return;
        }
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
