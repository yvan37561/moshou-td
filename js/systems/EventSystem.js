/**
 * 《山海机关录：墨守》凶地·天机赌局 15 大叙事事件库系统
 * 严格按照 GDD v2.1 设计，保证不重复触发保底机制与等价交换博弈
 */

class EventSystem {
  constructor(game) {
    this.game = game;
    this.events = this.initEvents();
  }

  // 获取一个未触发过的随机事件
  getRandomEvent() {
    const available = this.events.filter(e => !this.game.roguelite.visitedEventIds.has(e.id));
    if (available.length === 0) {
      // 若全部遍历完则重置随机池
      this.game.roguelite.visitedEventIds.clear();
      return this.events[Math.floor(Math.random() * this.events.length)];
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    this.game.roguelite.visitedEventIds.add(pick.id);
    return pick;
  }

  initEvents() {
    return [
      // 01. 公输班的残影
      {
        id: 'event_01',
        name: '公输班的残影',
        story: '迷雾中浮现一座废弃的鲁班木人桩，一道苍老的机关残影向你伸出手，似要与你比试拆解之术……',
        options: [
          {
            text: '【献艺·以一换二】牺牲中枢区1座机关，使其他中枢机关耐久+50%，并获紫金竹简',
            action: (game) => {
              const state = game.roguelite.inheritedGridState;
              if (state.length > 0) state.splice(0, 1);
              for (const s of state) s.maxHp = Math.round(s.maxHp * 1.5);
              const epicScroll = CONFIG.SCROLLS.find(s => s.tier === 'epic');
              if (epicScroll) game.roguelite.addScroll(epicScroll);
              return '已献祭机关换取古之传承，余下中枢大幅固化！';
            }
          },
          {
            text: '【偷师·强夺图纸】扣除中枢机关60%当前耐久，自选1份天工锻造密卷',
            action: (game) => {
              for (const s of game.roguelite.inheritedGridState) {
                s.currentHp = Math.max(10, Math.round(s.currentHp * 0.4));
              }
              game.pendingForgeSelection = true;
              return '强夺密卷图纸，中枢机关遭受反冲受损！';
            }
          },
          {
            text: '【拱手礼退】无事发生，拾取地上的25枚刀币离开',
            action: (game) => {
              game.addCoins(25);
              return '礼敬先贤，拾得古钱而去。';
            }
          }
        ]
      },
      // 02. 饕餮祭坛
      {
        id: 'event_02',
        name: '饕餮祭坛',
        story: '一座满是铜绿的青铜巨鼎立于道旁，鼎内散发着诱人的灵气波动，但鼎口形如恶兽之吻。',
        options: [
          {
            text: '【投喂机关】献祭中枢1座昂贵机关，换取220先秦刀币与下局+150初始灵气',
            action: (game) => {
              if (game.roguelite.inheritedGridState.length > 0) {
                game.roguelite.inheritedGridState.pop();
              }
              game.addCoins(220);
              game.nextBattleExtraQi = 150;
              return '祭坛吞噬机关，吐出巨额刀币与纯正灵气！';
            }
          },
          {
            text: '【滴血认主】扣除2尊阵眼石狮，获得传世信物【饕餮吞天印】(击杀回复5%耐久)',
            action: (game) => {
              game.sacrificedLionsCount += 2;
              game.hasTaotieSeal = true;
              return '防线石狮化为血祭，机关获饕餮吞天治愈神能！';
            }
          },
          {
            text: '【敲碎铜鼎】获得1张随机竹简，但下场第1波刷2只重锤力士',
            action: (game) => {
              const s = CONFIG.SCROLLS[Math.floor(Math.random() * CONFIG.SCROLLS.length)];
              game.roguelite.addScroll(s);
              game.nextBattleSpawnHeavy = true;
              return '铜鼎碎裂，凶兆弥漫，获得竹简！';
            }
          }
        ]
      },
      // 03. 阴阳熔炉
      {
        id: 'event_03',
        name: '阴阳熔炉',
        story: '两座相生相克的古炉正在剧烈共鸣，你可以将手中的造物投入其中重新锻打。',
        options: [
          {
            text: '【逆转乾坤】重铸洗点一个机关分支，并永久+20%基础伤害',
            action: (game) => {
              game.globalDamageMultiplier += 0.20;
              return '阴阳倒转，乾坤再塑，伤害全面蜕变！';
            }
          },
          {
            text: '【双生共鸣】支付100刀币，接下来的3场战斗该机关同时拥有A、B双分支特性',
            action: (game) => {
              if (game.coins >= 100) {
                game.deductCoins(100);
                game.dualBranchBuffBattles = 3;
                return '双生合璧，威力冠绝古今！';
              }
              return '刀币不足，未能开启双生。';
            }
          },
          {
            text: '【汲取余温】中枢区所有机关耐久全满，离开',
            action: (game) => {
              for (const s of game.roguelite.inheritedGridState) s.currentHp = s.maxHp;
              return '炉温沐浴，中枢机关完好如初。';
            }
          }
        ]
      },
      // 04. 偃师的傀儡戏
      {
        id: 'event_04',
        name: '偃师的傀儡戏',
        story: '一名披着黑袍的叛逃偃师拦住去路：“墨家的小子，敢不敢让你的死物沾染一点山海妖气？”',
        options: [
          {
            text: '【妖化改造】机关消耗-25灵气，攻击+35%，但每秒扣3点生命',
            action: (game) => {
              game.fiendCostReduction = 25;
              game.fiendDamageBonus = 0.35;
              game.fiendSelfBleed = 3;
              return '机关妖化入魔，攻势凶厉异常！';
            }
          },
          {
            text: '【严词拒绝】获得重装词条【正道铁壁】(所有肉盾耐久+15%)',
            action: (game) => {
              game.tankHpBonus = 0.15;
              return '恪守墨道，兼爱非攻，正气长存！';
            }
          }
        ]
      },
      // 05. 点睛画壁
      {
        id: 'event_05',
        name: '点睛画壁',
        story: '石壁上绘着栩栩如生的神火飞鸦与玄武巨兽，只需注入灵气便可拓印其神韵。',
        options: [
          {
            text: '【拓印·飞鸦之怒】下场战斗开局全屏5行同时释放神火飞鸦洗地',
            action: (game) => {
              game.nextBattleFullFireCrow = true;
              return '画中金乌振翅欲飞，烈焰遮天蔽日！';
            }
          },
          {
            text: '【拓印·玄武之壳】中枢区第3列所有格子永久镀上800耐久玄武护盾',
            action: (game) => {
              game.hasTurtleShieldLayer = true;
              return '玄武镇岳，神壳庇佑中枢！';
            }
          },
          {
            text: '【刮取石粉】获得60先秦刀币',
            action: (game) => {
              game.addCoins(60);
              return '刮得神石朱砂，换取古钱。';
            }
          }
        ]
      },
      // 06. 失控的罗盘
      {
        id: 'event_06',
        name: '失控的罗盘',
        story: '脚下的八卦石阵突然疯狂旋转，地脉灵气喷涌而出，你可以趁机钉死阵眼！',
        options: [
          {
            text: '【烈火烹油】后3场战斗所有地脉强制转化为【火脉格】且数量+3',
            action: (game) => {
              game.forceFireVeins = 3;
              return '八卦化为熔岩火海，天火焚天！';
            }
          },
          {
            text: '【厚土载物】后3场战斗第6列交战线整列全部锁定为【土脉格】',
            action: (game) => {
              game.forceEarthLine = 3;
              return '九地之下，厚土成峦，稳如磐石！';
            }
          },
          {
            text: '【顺应天命】获得50刀币与青铜词条',
            action: (game) => {
              game.addCoins(50);
              const bronze = CONFIG.SCROLLS.find(s => s.tier === 'common');
              if (bronze) game.roguelite.addScroll(bronze);
              return '道法自然，顺应天道。';
            }
          }
        ]
      },
      // 07. 不周山断碑
      {
        id: 'event_07',
        name: '不周山断碑',
        story: '一块散发着重力威压的太古断碑砸在阵盘中央，似乎能用它堵死魇魔的去路。',
        options: [
          {
            text: '【搬运断碑】在第3行第7列永久立起不可摧毁断碑，魇魔必须绕道！',
            action: (game) => {
              game.hasBuzhouStone = true;
              return '太古断碑横亘要道，魇魔见之避走！';
            }
          },
          {
            text: '【参悟碑文】获得史诗词条【重力泥沼】(敌踏入7、8列移速-30%)',
            action: (game) => {
              game.hasGravitySwamp = true;
              return '通晓重力之秘，阵前如陷泥淖！';
            }
          }
        ]
      },
      // 08. 奇门遁甲·移星换斗
      {
        id: 'event_08',
        name: '奇门遁甲·移星换斗',
        story: '偶遇隐世的风水先生，他提出帮你将中枢阵眼向战场前方推移。',
        options: [
          {
            text: '【阵眼2前移】中枢继承区改至第4、5列，机关全属性+25%',
            action: (game) => {
              game.grid.coreCols = [3, 4];
              game.globalDamageMultiplier += 0.25;
              return '阵盘突进，天工神威爆发！';
            }
          },
          {
            text: '【稳守后方】第1列聚灵烘炉光环扩大为 5x5',
            action: (game) => {
              game.furnaceAuraLarge = true;
              return '稳健扎根，灵炉润养八方！';
            }
          }
        ]
      },
      // 09. 血月古井
      {
        id: 'event_09',
        name: '血月古井',
        story: '井水映照出一轮妖异的血月，饮下井水可激发天工炉的潜能，但也会引来凶煞。',
        options: [
          {
            text: '【痛饮井水】开局天工炉满100过载能量，但每场第1波敌人移速+35%',
            action: (game) => {
              game.fullEnergyStart = true;
              return '饮尽血泉，开局即可连放大招！';
            }
          },
          {
            text: '【投币祈福】投50刀币，70%概率浮出墨家信物',
            action: (game) => {
              if (game.coins >= 50) {
                game.deductCoins(50);
                if (Math.random() < 0.70) {
                  const relic = CONFIG.RELICS[Math.floor(Math.random() * CONFIG.RELICS.length)];
                  game.roguelite.activeRelics.push(relic);
                  return `井中浮出法宝：【${relic.name}】！`;
                }
                return '水漂打空，井水沉寂无波。';
              }
              return '钱币不足。';
            }
          }
        ]
      },
      // 10. 墨子手稿残页
      {
        id: 'event_10',
        name: '墨子手稿残页',
        story: '在骸骨旁发现半卷竹简，上面记载着禁忌的“兼爱·非攻”极端阵法。',
        options: [
          {
            text: '【领悟·非攻】攻击型伤害-15%，防御陷阱型伤害与反伤+100%',
            action: (game) => {
              game.feigongBuff = true;
              return '领悟非攻之意，以守为攻反伤翻倍！';
            }
          },
          {
            text: '【领悟·兼爱】伤害由同列同行均摊，全屏每秒回5点生命',
            action: (game) => {
              game.jianaiBuff = true;
              return '兼爱天下，气血相连，回生不息！';
            }
          },
          {
            text: '【变卖孤本】获得130先秦刀币',
            action: (game) => {
              game.addCoins(130);
              return '孤本售出，得大笔刀币。';
            }
          }
        ]
      },
      // 11. 鬼谷子的三枚铜钱
      {
        id: 'event_11',
        name: '鬼谷子的三枚铜钱',
        story: '盲眼的卦师摇晃着龟甲：“一掷定乾坤，敢押上你的全部身家吗？”',
        options: [
          {
            text: '【孤注一掷】全押刀币：50%翻倍，50%归零但补偿传世赤玉竹简',
            action: (game) => {
              if (Math.random() < 0.5) {
                game.coins *= 2;
                return `大吉！铜钱翻倍，当前持有 ${game.coins} 刀币！`;
              } else {
                game.coins = 0;
                const legendary = CONFIG.SCROLLS.find(s => s.tier === 'legendary');
                if (legendary) game.roguelite.addScroll(legendary);
                return '大凶！刀币虽散尽，卦师却赠与【赤玉竹简】！';
              }
            }
          },
          {
            text: '【不信命数】抢走40刀币离开',
            action: (game) => {
              game.addCoins(40);
              return '顺手牵羊，带铜钱离去。';
            }
          }
        ]
      },
      // 12. 山海百妖夜行
      {
        id: 'event_12',
        name: '山海百妖夜行',
        story: '前方峡谷妖气冲天，百妖正在迁徙。若能撑过三息而不退，遍地皆是遗落的宝物！',
        options: [
          {
            text: '【横刀立马】迎战狂暴妖群，直接获得200刀币与信物',
            action: (game) => {
              game.addCoins(200);
              const relic = CONFIG.RELICS[0];
              game.roguelite.activeRelics.push(relic);
              return '机关轰鸣，威慑群妖，斩获至宝！';
            }
          },
          {
            text: '【绕道隐匿】花费30刀币隐蔽前进，下层敌人血量-10%',
            action: (game) => {
              game.deductCoins(30);
              game.nextBattleEnemyHpReduction = 0.10;
              return '隐去行踪，避开锋芒。';
            }
          }
        ]
      },
      // 13. 贪婪的貔貅雕像
      {
        id: 'event_13',
        name: '贪婪的貔貅雕像',
        story: '雕像口中含着一颗紫金宝珠，只要往它肚子里塞满铜钱，机关便会松动。',
        options: [
          {
            text: '【塞入120刀币】换取传世信物【招财貔貅】(拾齿轮产刀币)',
            action: (game) => {
              if (game.coins >= 120) {
                game.deductCoins(120);
                const pixiu = CONFIG.RELICS.find(r => r.id === 'relic_pixiu');
                if (pixiu) game.roguelite.activeRelics.push(pixiu);
                return '求得招财貔貅，财源滚滚！';
              }
              return '刀币不足，貔貅毫无动静。';
            }
          },
          {
            text: '【摸摸貔貅头】获得20刀币离开',
            action: (game) => {
              game.addCoins(20);
              return '轻抚祥瑞，捡得碎钱。';
            }
          }
        ]
      },
      // 14. 迷途的木牛流马
      {
        id: 'event_14',
        name: '迷途的木牛流马',
        story: '一辆满载军资的墨家运输车陷入泥潭，四周已有零星魇魔围拢过来。',
        options: [
          {
            text: '【拆车取件】立即拆解，获得2张青铜竹简 + 80刀币',
            action: (game) => {
              game.addCoins(80);
              const bronzes = CONFIG.SCROLLS.filter(s => s.tier === 'common').slice(0, 2);
              for (const b of bronzes) game.roguelite.addScroll(b);
              return '拆卸辎重，满载归阵！';
            }
          },
          {
            text: '【护送修车】接下来的3场战斗，每场开局赠送1座高级【乾坤聚宝盆】',
            action: (game) => {
              game.giftFurnaceBattles = 3;
              return '护车有功，获赠顶级灵盆增援！';
            }
          }
        ]
      },
      // 15. 时空裂隙·未来借贷
      {
        id: 'event_15',
        name: '时空裂隙·未来借贷',
        story: '一道扭曲的时空裂缝中伸出一只机械手臂，递给你一张写满未来文字的契约。',
        options: [
          {
            text: '【签署契约·透支未来】立刻凭空获得350刀币，但后4场战斗赏金为0',
            action: (game) => {
              game.addCoins(350);
              game.zeroRewardBattles = 4;
              return '契约达成！凭空暴富，但也抵押了未来之财！';
            }
          },
          {
            text: '【粉碎契约】机械手留下精铁，使全场机关破甲+15%',
            action: (game) => {
              game.globalArmorPenetration += 0.15;
              return '不贪外物，精纯破甲之刃！';
            }
          }
        ]
      }
    ];
  }
}
