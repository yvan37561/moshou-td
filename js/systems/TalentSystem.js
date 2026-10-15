/**
 * 《山海机关录：墨守》墨门矩子阁与天赋信物系统
 * 支持三大天赋树升级、局外配装信物、永久本地存盘 (localStorage)
 */

class TalentSystem {
  constructor(game) {
    this.game = game;
    this.ink = 120; // 局外货币：天工墨锭
    this.talentLevels = {
      tg_1: 0,
      tg_2: 0,
      tg_keystone: 0,
      wb_1: 0,
      wb_2: 0,
      wb_keystone: 0,
      qm_1: 0,
      qm_2: 0,
      qm_keystone: 0
    };
    this.equippedRelics = ['relic_mirror', 'relic_abacus']; // 默认携带2件

    this.loadProgress();
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('moshou_td_save');
      if (saved) {
        const data = JSON.parse(saved);
        this.ink = data.ink !== undefined ? data.ink : 120;
        this.talentLevels = Object.assign(this.talentLevels, data.talentLevels || {});
        this.equippedRelics = data.equippedRelics || ['relic_mirror', 'relic_abacus'];
      }
    } catch (e) {
      console.warn('读取存档失败', e);
    }
  }

  saveProgress() {
    try {
      const data = {
        ink: this.ink,
        talentLevels: this.talentLevels,
        equippedRelics: this.equippedRelics
      };
      localStorage.setItem('moshou_td_save', JSON.stringify(data));
    } catch (e) {
      console.warn('保存存档失败', e);
    }
  }

  // 升级某个天赋节点
  upgradeNode(nodeId, cost, maxLevel) {
    const current = this.talentLevels[nodeId] || 0;
    if (current >= maxLevel) return { success: false, msg: '该天赋已达宗师境界！' };
    if (this.ink < cost) return { success: false, msg: '天工墨锭不足！' };

    this.ink -= cost;
    this.talentLevels[nodeId] = current + 1;
    this.saveProgress();
    AudioSys.playGearClick();
    return { success: true, msg: '天赋参悟突破！' };
  }

  // 获取开局初始灵气加成
  getInitialQiBonus() {
    return (this.talentLevels.tg_1 || 0) * 15;
  }

  // 获取拆解返还比例
  getDismantleRefundRatio() {
    const lvl = this.talentLevels.tg_2 || 0;
    return 0.40 + lvl * 0.116; // 40% -> 52% -> 63% -> 75%
  }

  // 是否激活木鸢巡天
  hasKiteAutoCollect() {
    return (this.talentLevels.tg_keystone || 0) > 0;
  }

  // 获取破甲额外伤害加成
  getArmorDamageBonus() {
    return (this.talentLevels.wb_1 || 0) * 0.08;
  }

  // 获取过载击杀充能加成
  getOverloadGainMultiplier() {
    return 1.0 + (this.talentLevels.wb_2 || 0) * 0.10;
  }

  // 是否激活同频共振
  hasResonance() {
    return (this.talentLevels.wb_keystone || 0) > 0;
  }

  // 地脉格子数量加成
  getVeinCount() {
    return 3 + (this.talentLevels.qm_1 || 0);
  }

  // 是否解锁机关滑轨【移形】
  hasSwapSkill() {
    return (this.talentLevels.qm_2 || 0) > 0;
  }

  // 是否解锁点石成金
  hasGoldenTouch() {
    return (this.talentLevels.qm_keystone || 0) > 0;
  }

  // 获得通关墨锭奖励
  addInk(amount) {
    this.ink += amount;
    this.saveProgress();
  }
}
