/**
 * 《山海机关录：墨守》诡市·鬼谷商铺系统
 * 严格实现 GDD v2.1 动态通胀模型、货架结构、层数递增与二次方惩罚
 */

class ShopSystem {
  constructor(game) {
    this.game = game;
    this.removeCountGlobal = 0; // 全局累计删卡/焚简次数
    this.rerollCountCurrent = 0;// 本次进店刷新次数
    this.items = [];            // 当前货架商品
    this.discountIndex = -1;    // 半价签商品索引
  }

  // 生成货架商品
  generateShelves(floor) {
    this.items = [];
    this.rerollCountCurrent = 0;

    // 1. 生成 3 个竹简词条
    const scrollPool = CONFIG.SCROLLS.filter(s => !this.game.roguelite.activeScrolls.some(as => as.id === s.id));
    const selectedScrolls = scrollPool.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const s of selectedScrolls) {
      let delta = (Math.random() * 0.2 - 0.1); // ±10%
      if (s.tier === 'epic') delta = (Math.random() * 0.24 - 0.12);
      if (s.tier === 'legendary') delta = (Math.random() * 0.3 - 0.15);

      const actualPrice = this.calculatePrice(s.price, floor, delta);
      this.items.push({
        type: 'scroll',
        data: s,
        name: s.name,
        desc: s.desc,
        tier: s.tier,
        color: s.color,
        price: actualPrice,
        bought: false
      });
    }

    // 2. 生成 2 个天工密卷
    // (1) 分支进化卷轴 (基准 140)
    const forgeCandidates = this.game.roguelite.generateForgeOptions();
    if (forgeCandidates.length > 0) {
      const forgeOpt = forgeCandidates[0];
      const delta = (Math.random() * 0.1 - 0.05);
      const forgePrice = this.calculatePrice(140, floor, delta);
      this.items.push({
        type: 'forge',
        data: forgeOpt,
        name: `【天工密卷】${forgeOpt.name}`,
        desc: forgeOpt.desc,
        price: forgePrice,
        bought: false
      });
    }

    // (2) 机关黄金升星 (固定基准 180)
    const starPrice = this.calculatePrice(180, floor, 0);
    this.items.push({
      type: 'gold_star',
      name: '【密卷】黄金升星',
      desc: '指定中枢区 1 座已继承机关升为黄金阶（全属性+30%）。',
      price: starPrice,
      bought: false
    });

    // 3. 生成 1 件墨家信物 (基准 220)
    const relicPool = CONFIG.RELICS.filter(r => !this.game.roguelite.activeRelics.some(ar => ar.id === r.id));
    if (relicPool.length > 0) {
      const relic = relicPool[Math.floor(Math.random() * relicPool.length)];
      const delta = (Math.random() * 0.2 - 0.1);
      const relicPrice = this.calculatePrice(220, floor, delta);
      this.items.push({
        type: 'relic',
        data: relic,
        name: `【信物】${relic.name}`,
        desc: relic.desc,
        price: relicPrice,
        bought: false
      });
    }

    // 随机指定 1 件商品打半价签 (0.5)
    if (this.items.length > 0) {
      this.discountIndex = Math.floor(Math.random() * this.items.length);
      this.items[this.discountIndex].price = Math.round(this.items[this.discountIndex].price * 0.5);
      this.items[this.discountIndex].isHalfPrice = true;
    }

    return this.items;
  }

  // 动态通胀计算公式 (GDD 1.3)
  calculatePrice(basePrice, floor, delta = 0) {
    // P_actual = Round( P0 * (1 + 0.04*(Floor-1) + 0.015*max(0, Floor-24)^2) * (1 + delta) * M_relic )
    const linearTerm = 0.04 * (floor - 1);
    const chaosPenalty = 0.015 * Math.pow(Math.max(0, floor - 24), 2);

    let relicDiscount = 1.0;
    if (this.game.hasRelic('relic_abacus')) {
      relicDiscount = 0.75; // 鬼谷子的算盘打 75 折
    }

    const price = Math.round(basePrice * (1 + linearTerm + chaosPenalty) * (1 + delta) * relicDiscount);
    return Math.max(10, price);
  }

  // 焚简（移除词条）价格: P_remove = 60 + 35 * N_remove
  getRemoveServicePrice() {
    return 60 + 35 * this.removeCountGlobal;
  }

  // 卜卦（刷新货架）价格: P_reroll = 30 + 25 * N_reroll + 10 * max(0, N_reroll - 2)^2
  getRerollServicePrice() {
    const penalty = 10 * Math.pow(Math.max(0, this.rerollCountCurrent - 2), 2);
    return 30 + 25 * this.rerollCountCurrent + penalty;
  }

  // 修缮服务价格：固定 55 刀币
  getRepairServicePrice() {
    return 55;
  }

  // 执行购买商品
  buyItem(index) {
    const item = this.items[index];
    if (!item || item.bought) return { success: false, msg: '商品已售罄' };
    if (this.game.coins < item.price) return { success: false, msg: '先秦刀币不足！' };

    this.game.deductCoins(item.price);
    item.bought = true;

    if (item.type === 'scroll') {
      this.game.roguelite.addScroll(item.data);
    } else if (item.type === 'forge') {
      this.game.applyAutomatonBranch(item.data.autoId, item.data.branch);
    } else if (item.type === 'gold_star') {
      this.game.upgradeCoreAutomatonToGold();
    } else if (item.type === 'relic') {
      this.game.roguelite.activeRelics.push(item.data);
    }

    AudioSys.playCoin();
    return { success: true, msg: `购得【${item.name}】` };
  }

  // 执行刷新货架
  rerollShelves(floor) {
    const cost = this.getRerollServicePrice();
    if (this.game.coins < cost) return { success: false, msg: '先秦刀币不足以卜卦刷新！' };

    this.game.deductCoins(cost);
    this.rerollCountCurrent++;
    this.generateShelves(floor);
    AudioSys.playGearClick();
    return { success: true, msg: '货架已重新占卜排列' };
  }

  // 执行修缮中枢
  repairCore() {
    const cost = this.getRepairServicePrice();
    if (this.game.coins < cost) return { success: false, msg: '先秦刀币不足以修缮！' };

    this.game.deductCoins(cost);
    // 恢复中枢区所有机关 100% 耐久
    for (const item of this.game.roguelite.inheritedGridState) {
      item.currentHp = item.maxHp;
    }
    for (let r = 0; r < this.game.grid.rows; r++) {
      for (const c of this.game.grid.coreCols) {
        const auto = this.game.grid.cells[r][c].automaton;
        if (auto) auto.hp = auto.maxHp;
      }
    }
    AudioSys.playGearClick();
    return { success: true, msg: '中枢机关已彻底重铸修缮！' };
  }
}
