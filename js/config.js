/**
 * 《山海机关录：墨守》核心数值与全量配置字典
 * 严格对应 GDD v2.0 & GDD v2.1 策划案规范
 */

const CONFIG = {
  // 阵盘网格规范：5 行 9 列
  GRID: {
    ROWS: 5,
    COLS: 9,
    CELL_WIDTH: 88,
    CELL_HEIGHT: 88,
    ORIGIN_X: 110, // 棋盘在画布中的起始绘制 X
    ORIGIN_Y: 80,  // 棋盘在画布中的起始绘制 Y
    CORE_COLS: [2, 3], // 墨家中枢继承区（第2、3列，0-indexed即为col 1与2？策划案写“第1-9列”，这里以1-indexed 2,3列对应0-indexed 1,2）
  },

  // 数值锚点
  BASE_ARROW_DAMAGE: 25,
  BASE_FIEND_HP: 250,

  // 资源与过载
  RESOURCE: {
    INITIAL_QI: 125,       // 初始灵气
    MAX_OVERLOAD: 100,     // 天工炉过载上限
    OVERLOAD_COST: 50,     // 释放一次过载消耗能量
    OVERLOAD_DURATION: 8,  // 过载持续 8 秒
    DISMANTLE_REFUND: 0.40,// 拆解默认回收 40%
  },

  // 五行地脉格
  ELEMENT_VEINS: {
    FIRE: {
      id: 'fire',
      name: '火脉格',
      color: '#e74c3c',
      glow: 'rgba(231, 76, 60, 0.4)',
      desc: '攻速+20%，攻击附带灼烧'
    },
    EARTH: {
      id: 'earth',
      name: '土脉格',
      color: '#f39c12',
      glow: 'rgba(243, 156, 18, 0.4)',
      desc: '每秒回复1%最大耐久，免疫击退与眩晕'
    },
    WATER: {
      id: 'water',
      name: '水脉格',
      color: '#3498db',
      glow: 'rgba(52, 152, 219, 0.4)',
      desc: '冷却缩减25%'
    },
    METAL: {
      id: 'metal',
      name: '金脉格',
      color: '#f1c40f',
      glow: 'rgba(241, 196, 15, 0.4)',
      desc: '无视目标30%护甲，破甲强化'
    },
    WOOD: {
      id: 'wood',
      name: '木脉格',
      color: '#2ecc71',
      glow: 'rgba(46, 204, 113, 0.4)',
      desc: '损毁或拆解时100%返还灵气'
    }
  },

  // 8张墨家机关卡
  AUTOMATA: {
    furnace: {
      id: 'furnace',
      name: '聚灵烘炉',
      cost: 50,
      cooldown: 7,
      hp: 300,
      tags: ['经济', '光环'],
      desc: '周期产出25灵气/20s；为周围九宫格友方提供10%攻速与攻击光环（最多2层）。',
      icon: '🔥',
      produceInterval: 20,
      produceAmount: 25,
      branches: {
        A: { id: 'furnace_A', name: '烈阳金乌炉', desc: '产出灵气时向全屏随机3个敌人发射60伤害追踪阳炎弹。' },
        B: { id: 'furnace_B', name: '乾坤聚宝盆', desc: '移除光环，35%概率产出50灵气紫金齿轮，自动吸附掉落物。' }
      }
    },
    crossbow: {
      id: 'crossbow',
      name: '诸葛连弩',
      cost: 100,
      cooldown: 6,
      hp: 300,
      tags: ['远程', '连射'],
      desc: '直线射击本行敌人(25伤/1.5s)；每第4次射击必定触发双发连射。',
      icon: '🏹',
      attackInterval: 1.5,
      damage: 25,
      branches: {
        A: { id: 'crossbow_A', name: '雷公连弩', desc: '箭矢附带闪电链，弹射周围2名敌人(50%雷伤)，破甲翻倍。' },
        B: { id: 'crossbow_B', name: '毒焰重弩', desc: '攻速-20%，箭矢叠加毒蚀(15/s，最高5层，死亡毒爆)。' }
      }
    },
    landmine: {
      id: 'landmine',
      name: '震天埋雷',
      cost: 25,
      cooldown: 25,
      hp: 250,
      tags: ['陷阱', '爆发'],
      desc: '需12s旋紧发条出土；触碰即爆造成1500范围爆破，并击退后方敌人1格。',
      icon: '💣',
      armTime: 12,
      damage: 1500,
      blastRadius: 1.2
    },
    shield: {
      id: 'shield',
      name: '玄武重盾',
      cost: 75,
      cooldown: 25,
      hp: 3500,
      tags: ['重装', '反伤'],
      desc: '前排高耐久肉盾；每次受到近战攻击反弹10点震荡伤害。',
      icon: '🛡️',
      reflectDamage: 10,
      branches: {
        A: { id: 'shield_A', name: '熔岩玄武', desc: '耐久-15%，周身散发烈焰，每秒对前方1格造成40灼烧伤害。' },
        B: { id: 'shield_B', name: '磁暴巨阙', desc: '反伤增至30；每承受800伤害释放电磁波击退整行1.5格。' }
      }
    },
    taotie: {
      id: 'taotie',
      name: '吞天饕餮',
      cost: 150,
      cooldown: 10,
      hp: 400,
      tags: ['近战', '吞噬'],
      desc: '秒杀前方1.5格非首领敌人；进入30s炼化状态，完成后吐出25灵气。',
      icon: '👹',
      digestTime: 30,
      digestReward: 25,
      range: 1.5,
      branches: {
        A: { id: 'taotie_A', name: '腐骨饕餮', desc: '改为直接撕咬800流血伤害，喷涂8秒减速破甲酸液池。' },
        B: { id: 'taotie_B', name: '炼妖吞天兽', desc: '可同时吞下2名敌人，炼化时间减10s，吐出50灵气。' }
      }
    },
    frost_mage: {
      id: 'frost_mage',
      name: '寒霜方士',
      cost: 175,
      cooldown: 8,
      hp: 300,
      tags: ['控制', '冰霜'],
      desc: '命中叠1层霜冻(减速35%)；叠满4层触发1.5s冰封禁锢。伤害20/1.5s。',
      icon: '❄️',
      attackInterval: 1.5,
      damage: 20,
      branches: {
        A: { id: 'frost_mage_A', name: '玄冥冰魄', desc: '冰封增至3秒；被冰封敌人血量<15%直接触发碎冰斩杀。' },
        B: { id: 'frost_mage_B', name: '迷魂蛊师', desc: '放弃减速，每第6次攻击令非首领魇魔倒戈攻击同类。' }
      }
    },
    pear_blossom: {
      id: 'pear_blossom',
      name: '暴雨梨花',
      cost: 225,
      cooldown: 10,
      hp: 350,
      tags: ['远程', '散射'],
      desc: '发射2枚重箭(25x2/1.5s)；命中后向上下相邻行分裂2枚15伤害袖箭。',
      icon: '🌸',
      attackInterval: 1.5,
      damage: 25,
      splitDamage: 15
    },
    fire_crow: {
      id: 'fire_crow',
      name: '神火飞鸦',
      cost: 150,
      cooldown: 45,
      hp: 999999, // 释放期间无敌
      tags: ['全行', '火器'],
      desc: '释放烈焰木鸢掠过整行，造成1200巨额全行伤害并留下5s火海。',
      icon: '🦅',
      damage: 1200,
      fireGroundDuration: 5,
      fireGroundDps: 60
    }
  },

  // 6种山海魇魔
  FIENDS: {
    soldier: {
      id: 'soldier',
      name: '残破兵俑',
      hp: 250,
      armor: 0,
      speed: 0.20,
      dps: 80,
      icon: '🗿',
      desc: '基础杂兵，半血破裂，碎为陶片'
    },
    rattan: {
      id: 'rattan',
      name: '藤甲尸兵',
      hp: 250,
      armor: 350, // 古藤甲
      speed: 0.20,
      dps: 80,
      icon: '🎋',
      desc: '藤甲减免30%物理箭伤；火属性伤害200%倍率引燃'
    },
    heavy: {
      id: 'heavy',
      name: '重锤力士',
      hp: 300,
      armor: 900, // 青铜盾
      speed: 0.18,
      dps: 120,
      icon: '🔨',
      desc: '免疫击退，需吞噬或地雷炸毁'
    },
    mandrill: {
      id: 'mandrill',
      name: '飞爪山魈',
      hp: 350,
      armor: 0,
      speed: 0.42,
      dps: 90,
      icon: '🐒',
      desc: '遇到首个机关飞爪荡过1格；撞上土脉格机关则晕眩落地'
    },
    berserk_ghost: {
      id: 'berserk_ghost',
      name: '狂暴符鬼',
      hp: 250,
      armor: 180, // 镇魂符
      speed: 0.20,
      dps: 80,
      icon: '👻',
      desc: '镇魂符碎后原地怒吼1s进入霸体，移速0.55，攻速翻倍'
    },
    chariot: {
      id: 'chariot',
      name: '偃师战车',
      hp: 1600,
      armor: 0,
      speed: 0.12,
      dps: 9999, // 碾压秒杀普通机关
      icon: '🚜',
      desc: '免控重型机械，碾碎普通机关，每8s向后排投掷火弹'
    }
  },

  // 2大山海巨兽 Boss
  BOSSES: {
    xiangliu: {
      id: 'xiangliu',
      name: '九首凶神 · 相柳',
      hp: 18000,
      headHp: 1500,
      heads: 5,
      desc: '占据8-9列全5行；蛇首蓄力喷吐毒沼，断首12秒再生，需同气连枝击破！'
    },
    xingtian: {
      id: 'xingtian',
      name: '断首战神 · 刑天',
      hp: 25000,
      shieldArmor: 6000,
      desc: '2x2巨型游走；正面减免80%箭伤，飞斧裂地QTE考验拆解空地！'
    }
  },

  // 墨家竹简全局词条
  SCROLLS: [
    {
      id: 'scroll_caomu',
      name: '草木皆兵',
      tier: 'epic',
      color: '#9b59b6',
      price: 160,
      desc: '拆解机关不再返还灵气，改为原地引发800伤害震天雷爆破。'
    },
    {
      id: 'scroll_beishui',
      name: '背水一战',
      tier: 'legendary',
      color: '#e74c3c',
      price: 260,
      desc: '开局献祭每行石狮，每尊使全场机关最终伤害永久+12%(最多+60%)。'
    },
    {
      id: 'scroll_greedy',
      name: '贪婪发条',
      tier: 'epic',
      color: '#9b59b6',
      price: 160,
      desc: '灵气齿轮在地面每停1秒价值+5(最高50)，但消失时间缩短至5秒。'
    },
    {
      id: 'scroll_jiaotu',
      name: '焦土法则 (火器)',
      tier: 'rare',
      color: '#3498db',
      price: 95,
      tag: 'fire',
      desc: '3火器羁绊：所有火焰爆炸在地面留下4s炭火，每秒30真实伤害。'
    },
    {
      id: 'scroll_tiewall',
      name: '铁壁防线 (重装)',
      tier: 'rare',
      color: '#3498db',
      price: 95,
      tag: 'heavy',
      desc: '3重装羁绊：每波开战时第6列升起一排500耐久机关木栅栏。'
    },
    {
      id: 'scroll_tongling',
      name: '通灵共振 (符箓)',
      tier: 'rare',
      color: '#3498db',
      price: 95,
      tag: 'talisman',
      desc: '3符箓羁绊：释放机巧过载时全屏机关立即刷新攻击间隔并回复15%耐久。'
    },
    {
      id: 'scroll_quick_gear',
      name: '轻灵轴承',
      tier: 'common',
      color: '#bdc3c7',
      price: 50,
      desc: '所有机关冷却时间缩短15%。'
    },
    {
      id: 'scroll_pure_bronze',
      name: '百炼青铜',
      tier: 'common',
      color: '#bdc3c7',
      price: 50,
      desc: '所有机关生命值上限提升20%。'
    },
    {
      id: 'scroll_sharp_edge',
      name: '破罡金矢',
      tier: 'rare',
      color: '#3498db',
      price: 95,
      desc: '全员直射攻击护甲穿透+25%。'
    }
  ],

  // 墨家信物
  RELICS: [
    {
      id: 'relic_ruler',
      name: '公输班的青铜尺',
      price: 220,
      desc: '仅允许在奇数行(1,3,5)部署攻击机关，但这些行的机关伤害永久+45%。'
    },
    {
      id: 'relic_rings',
      name: '阴阳子母环',
      price: 220,
      desc: '当同列相邻两行部署相同机关时，生成持续电击网(40伤/s)。'
    },
    {
      id: 'relic_mirror',
      name: '山海镇妖镜',
      price: 220,
      desc: '每波第1只进场魇魔受伤害+100%，击杀必爆25灵气齿轮。'
    },
    {
      id: 'relic_abacus',
      name: '鬼谷子的算盘',
      price: 220,
      desc: '鬼谷商铺所有商品永久享有75折优惠。'
    },
    {
      id: 'relic_pixiu',
      name: '招财貔貅',
      price: 220,
      desc: '拾取25灵气齿轮时额外获得2枚刀币(单场上限40)。'
    }
  ],

  // 矩子阁三大天赋树
  TALENTS: {
    tiangong: {
      name: '天工院 (经济与容错)',
      nodes: [
        { id: 'tg_1', name: '墨守成规', maxLevel: 5, cost: 30, desc: '开局初始灵气+15/级 (最高+75)' },
        { id: 'tg_2', name: '巧夺天工', maxLevel: 3, cost: 50, desc: '拆解钳返还从40%升至55%/65%/75%' },
        { id: 'tg_keystone', name: '木鸢巡天 (基石)', maxLevel: 1, cost: 150, desc: '场边常驻木鸢，每4秒自动吸附掉落灵气' }
      ]
    },
    wubei: {
      name: '武备堂 (火力与过载)',
      nodes: [
        { id: 'wb_1', name: '淬火利刃', maxLevel: 5, cost: 30, desc: '机关对护甲/护盾伤害提升8%/级' },
        { id: 'wb_2', name: '蓄势待发', maxLevel: 3, cost: 50, desc: '击杀获取过载能量+10%/级，过载时间+1s/级' },
        { id: 'wb_keystone', name: '同频共振 (基石)', maxLevel: 1, cost: 150, desc: '释放过载时同行同名机关50%概率同步次级过载4秒' }
      ]
    },
    qimen: {
      name: '奇门局 (棋盘规则)',
      nodes: [
        { id: 'qm_1', name: '地脉寻龙', maxLevel: 3, cost: 40, desc: '每局五行地脉格数量从3增加至4/5/6个' },
        { id: 'qm_2', name: '机关滑轨', maxLevel: 1, cost: 80, desc: '解锁移形指令(CD 20s)，战斗中对调两座机关位置' },
        { id: 'qm_keystone', name: '点石成金 (基石)', maxLevel: 1, cost: 150, desc: '每局允许将1个普通格转化为全属性加成的太极阵眼格' }
      ]
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
