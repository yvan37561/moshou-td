/**
 * 《山海机关录：墨守》八阵图无界肉鸽模式管理器
 * 负责分岔地图生成、半继承中枢阵盘、结算赏金数学模型、天道法则与局内构筑池
 */

class RogueliteManager {
  constructor(game) {
    this.game = game;
    this.currentFloor = 1;
    this.maxFloorReached = 1;
    this.activeScrolls = [];  // 已获得的墨家竹简
    this.activeRelics = [];   // 已持有的墨家信物
    this.inheritedGridState = []; // 第 2、3 列继承的机关快照
    this.inheritedQiBonus = 0;    // 外围拆解折算带入的灵气（上限 300）

    this.activeLaws = [];     // 25层后的天道法则

    // 节点拓扑地图：每层生成 2-3 个可选节点
    this.mapNodes = [];
    this.currentNode = null;
    this.visitedEventIds = new Set(); // 已触发的天机赌局事件 ID，保证整局不重复

    this.initMap();
  }

  // 初始化八阵图星图拓扑
  initMap() {
    this.mapNodes = [];
    // 生成前 24 层的节点结构
    for (let floor = 1; floor <= 24; floor++) {
      const layer = [];
      const nodeTypes = this.determineLayerNodeTypes(floor);
      for (let i = 0; i < nodeTypes.length; i++) {
        layer.push({
          id: `${floor}_${i}`,
          floor,
          type: nodeTypes[i], // 'battle' | 'elite' | 'shop' | 'workshop' | 'event' | 'boss'
          title: this.getNodeTitle(nodeTypes[i], floor),
          visited: false
        });
      }
      this.mapNodes.push(layer);
    }
    // 默认起点
    this.currentNode = this.mapNodes[0][0];
  }

  determineLayerNodeTypes(floor) {
    // 遵循策划案硬性约束与防脸黑保底：
    // 第 1 层：固定常规战
    if (floor === 1) return ['battle'];
    // 第 8、16、24 层：固定章节 Boss
    if (floor === 8 || floor === 16 || floor === 24) return ['boss'];
    // 第 4 层：必刷至少 1 条商铺
    if (floor === 4) return ['battle', 'shop'];
    // 第 7、15、23 层：工坊 + 商铺二选一
    if (floor % 8 === 7) return ['workshop', 'shop'];

    // 其他常规层：随机分岔组合
    const pool = ['battle', 'battle', 'elite', 'event', 'shop'];
    const count = 2; // 分岔 2 条路线
    const result = [];
    while (result.length < count) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!result.includes(pick)) result.push(pick);
    }
    return result;
  }

  getNodeTitle(type, floor) {
    switch (type) {
      case 'battle': return `第${floor}层 · 常规战`;
      case 'elite': return `第${floor}层 · 血月精英`;
      case 'shop': return `第${floor}层 · 鬼谷商铺`;
      case 'workshop': return `第${floor}层 · 墨家工坊`;
      case 'event': return `第${floor}层 · 天机赌局`;
      case 'boss': return `第${floor}层 · 山海巨兽`;
    }
    return `第${floor}层`;
  }

  // 结算古铜钱公式 (GDD 1.1)
  calculateFloorRewards(isElite, isBoss, noLionTriggered, noCoreDamage) {
    // 1. 基础通关赏金: G_base = 45 + floor(Floor * 3.5)
    const baseReward = 45 + Math.floor(this.currentFloor * 3.5);

    // 2. 精英/首领猎杀奖: 普通精英 +40；章节 Boss +150
    let killReward = 0;
    if (isBoss) killReward = 150;
    else if (isElite) killReward = 40;

    // 3. 墨家钱庄利息: 每持 50 枚铜钱 +5 钱，上限 +25
    const interest = Math.min(25, Math.floor(this.game.coins / 50) * 5);

    // 4. 无损守阵奖励: 未触发石狮且中枢无损 +20
    let perfectReward = 0;
    if (noLionTriggered && noCoreDamage) {
      perfectReward = 20;
    }

    const totalCoins = baseReward + killReward + interest + perfectReward;
    return {
      baseReward,
      killReward,
      interest,
      perfectReward,
      totalCoins
    };
  }

  // 完成本层战斗：提取中枢机关继承状态并折算外围灵气
  finishFloorBattle(rewardInfo) {
    this.game.addCoins(rewardInfo.totalCoins);

    // 中枢锁阵继承 (第 2、3 列)
    const { inherited, dismantledQiRefund } = this.game.grid.extractInheritedState();
    this.inheritedGridState = inherited;

    // 外围折算灵气（上限 300）
    this.inheritedQiBonus = Math.min(300, dismantledQiRefund);

    // 推进层数
    this.currentFloor++;
    if (this.currentFloor > this.maxFloorReached) {
      this.maxFloorReached = this.currentFloor;
    }

    // 25 层后动态叠加天道法则
    if (this.currentFloor >= 25 && this.currentFloor % 5 === 0) {
      this.applyChaosLaw();
    }
  }

  // 25层后天道法则
  applyChaosLaw() {
    const laws = [
      { id: 'law_lightning', name: '法则·雷泽暴走', desc: '全场每秒随机劈下2道落雷，造成150伤害并麻痹1秒。' },
      { id: 'law_blood_harvest', name: '法则·血肉丰收', desc: '不再掉落自然灵气，但每击杀一只魇魔爆出15-30灵气。' },
      { id: 'law_vein_chaos', name: '法则·五行逆乱', desc: '每30秒棋盘五行地脉格随机洗牌一次。' },
      { id: 'law_giant_fiends', name: '法则·巨兽横行', desc: '所有杂兵体型与血量翻倍，移速减半，免疫击退。' }
    ];
    const pick = laws[Math.floor(Math.random() * laws.length)];
    if (!this.activeLaws.some(l => l.id === pick.id)) {
      this.activeLaws.push(pick);
      this.game.renderer.addFloatingText(`降临天道：${pick.name}`, 500, 200, '#e74c3c');
    }
  }

  // 获取可升级/进化的机关改造三选一
  generateForgeOptions() {
    const candidates = [];
    for (const key of Object.keys(CONFIG.AUTOMATA)) {
      const cfg = CONFIG.AUTOMATA[key];
      if (cfg.branches) {
        candidates.push({
          autoId: key,
          branch: 'A',
          name: cfg.branches.A.name,
          desc: cfg.branches.A.desc,
          icon: cfg.icon
        });
        candidates.push({
          autoId: key,
          branch: 'B',
          name: cfg.branches.B.name,
          desc: cfg.branches.B.desc,
          icon: cfg.icon
        });
      }
    }
    // 洗牌取3个
    return candidates.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  // 获取竹简三选一
  generateScrollOptions() {
    const available = CONFIG.SCROLLS.filter(s => !this.activeScrolls.some(as => as.id === s.id));
    return available.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  addScroll(scroll) {
    this.activeScrolls.push(scroll);
    // 检查是否有羁绊激活
    this.checkSynergies();
  }

  checkSynergies() {
    const fireCount = this.activeScrolls.filter(s => s.tag === 'fire').length;
    const heavyCount = this.activeScrolls.filter(s => s.tag === 'heavy').length;
    const talismanCount = this.activeScrolls.filter(s => s.tag === 'talisman').length;

    if (fireCount >= 3) this.game.hasFireSynergy = true;
    if (heavyCount >= 3) this.game.hasHeavySynergy = true;
    if (talismanCount >= 3) this.game.hasTalismanSynergy = true;
  }
}
