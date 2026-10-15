/**
 * 《山海机关录：墨守》墨家机关兽核心状态机
 * 包含 8 种机关、双分支进化形态、机巧过载形态、九宫动力链光环、五行地脉赋能
 */

class Automaton {
  constructor(id, row, col, game) {
    this.id = id;
    this.row = row;
    this.col = col;
    this.cfg = CONFIG.AUTOMATA[id];

    this.name = this.cfg.name;
    this.cost = this.cfg.cost;
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.icon = this.cfg.icon;

    // 状态与定时器
    this.timer = 0;
    this.attackTimer = 0;
    this.produceTimer = 0;
    this.isDead = false;
    this.isGolden = false; // 是否升为黄金星级（全属性+30%）

    // 分支进化
    this.branch = null; // null | 'A' | 'B'

    // 机巧过载状态
    this.isOverloaded = false;
    this.overloadTimer = 0;

    // 动态光环增益 (九宫动力链)
    this.buffLayers = 0; // 最多2层，每层+10%攻速与攻击

    // 专属机关特殊状态
    this.shootCount = 0;      // 连弩/方士攻击计数
    this.isArmed = false;      // 地雷出土状态
    this.armTimer = 0;         // 地雷装填发条计时
    this.swallowedFiends = []; // 饕餮吞下的敌人
    this.digestTimer = 0;      // 饕餮炼化计时
    this.damageTakenRecent = 0;// 磁暴巨阙累计承受伤害

    // 计算世界像素中心坐标
    const bounds = game.grid.getCellBounds(row, col);
    this.x = bounds.centerX;
    this.y = bounds.centerY;

    // 应用五行地脉加成
    this.applyVeinBuff(game);
  }

  applyVeinBuff(game) {
    const vein = game.grid.cells[this.row][this.col].vein;
    this.vein = vein;
  }

  setBranch(branch) {
    this.branch = branch;
    const branchCfg = this.cfg.branches ? this.cfg.branches[branch] : null;
    if (branchCfg) {
      this.name = branchCfg.name;
    }
  }

  // 释放机巧过载
  activateOverload() {
    this.isOverloaded = true;
    this.overloadTimer = CONFIG.RESOURCE.OVERLOAD_DURATION;
    AudioSys.playOverload();

    // 烘炉过载：立即喷出 75 灵气
    if (this.id === 'furnace') {
      window.gameInstance.spawnDropItem('gear', this.x, this.y - 30, 75);
    }
    // 地雷过载：立即就绪装填完毕
    if (this.id === 'landmine') {
      this.isArmed = true;
      this.armTimer = this.cfg.armTime;
    }
    // 饕餮过载：立刻吞噬前方敌人并清空炼化
    if (this.id === 'taotie') {
      this.digestTimer = 0;
      this.swallowedFiends = [];
    }
  }

  // 获取当前攻速与攻击力倍率
  getBuffMultiplier() {
    let mul = 1.0 + this.buffLayers * 0.10;
    if (this.isGolden) mul += 0.30;
    if (this.vein === 'fire' || this.vein === 'taij') mul += 0.20;
    return mul;
  }

  update(dt, game) {
    if (this.isDead) return;

    this.timer += dt;

    // 土脉格：每秒恢复 1% 最大耐久
    if ((this.vein === 'earth' || this.vein === 'taiji') && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.01 * dt);
    }

    // 机巧过载计时
    if (this.isOverloaded) {
      this.overloadTimer -= dt;
      if (this.overloadTimer <= 0) {
        this.isOverloaded = false;
      }
    }

    const buffMul = this.getBuffMultiplier();

    // 执行各机关专属行为
    switch (this.id) {
      case 'furnace':
        this.updateFurnace(dt, game, buffMul);
        break;
      case 'crossbow':
        this.updateCrossbow(dt, game, buffMul);
        break;
      case 'landmine':
        this.updateLandmine(dt, game);
        break;
      case 'shield':
        this.updateShield(dt, game);
        break;
      case 'taotie':
        this.updateTaotie(dt, game);
        break;
      case 'frost_mage':
        this.updateFrostMage(dt, game, buffMul);
        break;
      case 'pear_blossom':
        this.updatePearBlossom(dt, game, buffMul);
        break;
      case 'fire_crow':
        this.updateFireCrow(dt, game);
        break;
    }
  }

  // 1. 聚灵烘炉
  updateFurnace(dt, game, buffMul) {
    let interval = this.cfg.produceInterval;
    if (this.isOverloaded) interval /= 4; // 过载提速4倍
    if (this.vein === 'water' || this.vein === 'taiji') interval *= 0.75;

    this.produceTimer += dt;
    if (this.produceTimer >= interval) {
      this.produceTimer = 0;
      let amount = this.cfg.produceAmount;
      let isPurple = false;

      // 分支B：乾坤聚宝盆，35%概率产出50灵气紫金齿轮
      if (this.branch === 'B') {
        if (Math.random() < 0.35) {
          amount = 50;
          isPurple = true;
        }
      }

      game.spawnDropItem(isPurple ? 'purple_gear' : 'gear', this.x, this.y - 20, amount);

      // 分支A：烈阳金乌炉，向全屏随机3个敌人发射60伤害追踪阳炎弹
      if (this.branch === 'A') {
        const liveFiends = game.fiends.filter(f => !f.isDead);
        const targets = liveFiends.sort(() => Math.random() - 0.5).slice(0, 3);
        for (const target of targets) {
          game.projectiles.push(new Projectile('sun_orb', this.x, this.y, this.row, this.row, {
            speed: 500,
            damage: 60,
            target
          }));
        }
      }
    }

    // 乾坤聚宝盆自动吸附周围掉落物
    if (this.branch === 'B') {
      for (const item of game.dropItems) {
        if (!item.isAttracting && !item.isDead) {
          const dist = Math.hypot(item.x - this.x, item.y - this.y);
          if (dist < 220) {
            item.collect(game);
          }
        }
      }
    }
  }

  // 2. 诸葛连弩
  updateCrossbow(dt, game, buffMul) {
    // 只有本行有敌人时才射击（或者过载期间持续倾泻）
    const hasEnemyInRow = this.isOverloaded || game.fiends.some(f => !f.isDead && (f.row === this.row || (f.coversRow && f.coversRow(this.row))));
    if (!hasEnemyInRow) return;

    let baseInterval = this.cfg.attackInterval;
    if (this.branch === 'B') baseInterval *= 1.25; // 毒焰重弩攻速 -20%
    if (this.isOverloaded) baseInterval *= 0.3;     // 过载极大加快射速

    const finalInterval = baseInterval / buffMul;
    this.attackTimer += dt;

    if (this.attackTimer >= finalInterval) {
      this.attackTimer = 0;
      this.shootCount++;

      let bulletType = 'arrow';
      let dmg = this.cfg.damage * (this.isGolden ? 1.3 : 1.0);
      let penetrate = false;

      if (this.vein === 'metal' || this.vein === 'taiji') {
        // 金脉破甲
      }

      if (this.branch === 'A') bulletType = 'lightning_arrow';
      if (this.branch === 'B') bulletType = 'poison_arrow';
      if (this.isOverloaded) {
        penetrate = true;
        dmg *= 1.5;
      }

      AudioSys.playShootArrow();
      game.projectiles.push(new Projectile(bulletType, this.x + 30, this.y, this.row, this.row, {
        damage: dmg,
        penetrate,
        ignoreArmor: this.vein === 'metal' || this.vein === 'taiji'
      }));

      // 每第4次射击必定触发双发连射
      if (this.shootCount % 4 === 0) {
        setTimeout(() => {
          if (!this.isDead) {
            AudioSys.playShootArrow();
            game.projectiles.push(new Projectile(bulletType, this.x + 30, this.y, this.row, this.row, {
              damage: dmg,
              penetrate,
              ignoreArmor: this.vein === 'metal' || this.vein === 'taiji'
            }));
          }
        }, 120);
      }
    }
  }

  // 3. 震天埋雷
  updateLandmine(dt, game) {
    if (!this.isArmed) {
      this.armTimer += dt;
      if (this.armTimer >= this.cfg.armTime) {
        this.isArmed = true;
        AudioSys.playGearClick();
      }
      return;
    }

    // 已出土：检测本行进入 1.2 格范围内的敌人
    const rangePx = this.cfg.blastRadius * game.grid.cellWidth;
    for (const fiend of game.fiends) {
      if (!fiend.isDead && (fiend.row === this.row || (fiend.coversRow && fiend.coversRow(this.row)))) {
        const dist = Math.abs(fiend.x - this.x);
        if (dist <= rangePx) {
          // 触碰即爆！
          this.explode(game);
          break;
        }
      }
    }
  }

  explode(game) {
    AudioSys.playExplosion();
    const blastDmg = this.cfg.damage * (this.isGolden ? 1.3 : 1.0) * (this.isOverloaded ? 2.0 : 1.0);
    const radiusPx = (this.isOverloaded ? 2.5 : 1.2) * game.grid.cellWidth;

    for (const f of game.fiends) {
      if (!f.isDead && Math.hypot(f.x - this.x, f.y - this.y) <= radiusPx) {
        f.takeDamage(blastDmg, { isExplosion: true, ignoreArmor: true }, game);
        // 击退后方敌人 1 格
        if (!f.immuneKnockback) {
          f.x = Math.min(game.grid.originX + game.grid.cols * game.grid.cellWidth + 50, f.x + game.grid.cellWidth);
        }
      }
    }

    // 焦土法则羁绊：留下炭火
    if (game.hasScroll('scroll_jiaotu')) {
      game.grid.addGroundEffect('charcoal', this.row, this.col, 4, 30);
    }

    game.renderer.addExplosionEffect(this.x, this.y, radiusPx);
    this.takeDamage(99999, 'self_destruct');
  }

  // 4. 玄武重盾
  updateShield(dt, game) {
    // 熔岩玄武：周身散发烈焰，每秒对前方 1 格造成 40 点灼烧伤害
    if (this.branch === 'A') {
      this.attackTimer += dt;
      if (this.attackTimer >= 1.0) {
        this.attackTimer = 0;
        const targetCol = this.col + 1;
        if (targetCol < game.grid.cols) {
          for (const f of game.fiends) {
            if (!f.isDead && f.row === this.row && Math.abs(f.x - (this.x + game.grid.cellWidth)) < 40) {
              f.takeDamage(40, { isFire: true }, game);
              game.renderer.addHitSparks(f.x, f.y, '#e74c3c');
            }
          }
        }
      }
    }
  }

  // 5. 吞天饕餮
  updateTaotie(dt, game) {
    // 若在炼化状态中
    if (this.swallowedFiends.length > 0) {
      let digestLimit = this.cfg.digestTime;
      if (this.branch === 'B') digestLimit -= 10; // 炼妖吞天兽炼化缩短10s
      this.digestTimer += dt;
      if (this.digestTimer >= digestLimit) {
        this.digestTimer = 0;
        this.swallowedFiends = [];
        const reward = this.branch === 'B' ? 50 : 25;
        game.spawnDropItem('gear', this.x, this.y - 20, reward);
      }
      return;
    }

    // 未在炼化：寻找前方 1.5 格内的非首领怪
    const maxCapacity = this.branch === 'B' ? 2 : 1;
    const rangePx = this.cfg.range * game.grid.cellWidth;

    for (const fiend of game.fiends) {
      if (!fiend.isDead && fiend.row === this.row && !fiend.isBoss && fiend.x > this.x && fiend.x - this.x <= rangePx) {
        // 分支A：腐骨饕餮直接撕咬800流血并喷酸液池
        if (this.branch === 'A') {
          fiend.takeDamage(800, { isAcid: true }, game);
          game.grid.addGroundEffect('poison', this.row, Math.min(game.grid.cols - 1, this.col + 1), 8, 30);
          AudioSys.playHit();
          break;
        } else {
          // 吞噬秒杀
          this.swallowedFiends.push(fiend);
          fiend.takeDamage(999999, { isSwallowed: true }, game);
          AudioSys.playLionRoar();
          game.renderer.addFloatingText('吞噬！', this.x, this.y - 30, '#9b59b6');
          if (this.swallowedFiends.length >= maxCapacity) {
            break;
          }
        }
      }
    }
  }

  // 6. 寒霜方士
  updateFrostMage(dt, game, buffMul) {
    const hasEnemyInRow = game.fiends.some(f => !f.isDead && (f.row === this.row || (f.coversRow && f.coversRow(this.row))));
    if (!hasEnemyInRow) return;

    let baseInterval = this.cfg.attackInterval;
    if (this.isOverloaded) baseInterval = 0.3;
    const finalInterval = baseInterval / buffMul;

    this.attackTimer += dt;
    if (this.attackTimer >= finalInterval) {
      this.attackTimer = 0;
      this.shootCount++;

      // 迷魂蛊师：每第6次使一名非首领敌人倒戈
      if (this.branch === 'B' && this.shootCount % 6 === 0) {
        const candidate = game.fiends.find(f => !f.isDead && f.row === this.row && !f.isBoss && !f.isCharmed);
        if (candidate) {
          candidate.isCharmed = true;
          candidate.charmTimer = 6.0;
          game.renderer.addFloatingText('蛊惑倒戈！', candidate.x, candidate.y - 20, '#e74c3c');
          return;
        }
      }

      let freezeDur = 1.5;
      let killThreshold = 0;
      if (this.branch === 'A') {
        freezeDur = 3.0;
        killThreshold = 0.15; // 玄冥冰魄：<15%触发碎冰斩杀
      }

      game.projectiles.push(new Projectile('frost_orb', this.x + 25, this.y, this.row, this.row, {
        damage: this.cfg.damage,
        freezeDuration: freezeDur,
        killThreshold
      }));
    }
  }

  // 7. 暴雨梨花
  updatePearBlossom(dt, game, buffMul) {
    const hasEnemyInRow = this.isOverloaded || game.fiends.some(f => !f.isDead);
    if (!hasEnemyInRow) return;

    let baseInterval = this.cfg.attackInterval;
    if (this.isOverloaded) baseInterval = 0.5;
    const finalInterval = baseInterval / buffMul;

    this.attackTimer += dt;
    if (this.attackTimer >= finalInterval) {
      this.attackTimer = 0;

      if (this.isOverloaded) {
        // 过载向所有方向散射针雨
        for (let r = 0; r < game.grid.rows; r++) {
          const splitY = game.grid.originY + r * game.grid.cellHeight + game.grid.cellHeight / 2;
          game.projectiles.push(new Projectile('split_arrow', this.x + 20, splitY, r, r, {
            speed: 550,
            damage: 35
          }));
        }
      } else {
        // 双枚重箭
        game.projectiles.push(new Projectile('pear_blossom', this.x + 20, this.y - 8, this.row, this.row, {
          damage: this.cfg.damage,
          splitDamage: this.cfg.splitDamage
        }));
        setTimeout(() => {
          if (!this.isDead) {
            game.projectiles.push(new Projectile('pear_blossom', this.x + 20, this.y + 8, this.row, this.row, {
              damage: this.cfg.damage,
              splitDamage: this.cfg.splitDamage
            }));
          }
        }, 100);
      }
    }
  }

  // 8. 神火飞鸦
  updateFireCrow(dt, game) {
    // 部署后立即释放烈焰木鸢掠过全行
    if (!this.hasLaunched) {
      this.hasLaunched = true;
      AudioSys.playShootArrow();
      game.projectiles.push(new Projectile('fire_crow', this.x, this.y, this.row, this.row, {
        speed: 700,
        damage: this.cfg.damage,
        penetrate: true,
        fireGroundDuration: this.cfg.fireGroundDuration,
        fireGroundDps: this.cfg.fireGroundDps
      }));

      // 过载形态：召唤金乌，横扫相邻三行！
      if (this.isOverloaded) {
        if (this.row > 0) {
          game.projectiles.push(new Projectile('fire_crow', this.x, this.y - game.grid.cellHeight, this.row - 1, this.row - 1, {
            speed: 700,
            damage: this.cfg.damage,
            penetrate: true
          }));
        }
        if (this.row < game.grid.rows - 1) {
          game.projectiles.push(new Projectile('fire_crow', this.x, this.y + game.grid.cellHeight, this.row + 1, this.row + 1, {
            speed: 700,
            damage: this.cfg.damage,
            penetrate: true
          }));
        }
      }

      // 释放完成后自毁归位
      setTimeout(() => {
        this.takeDamage(999999, 'launched');
      }, 300);
    }
  }

  // 受到伤害
  takeDamage(amount, type = 'normal') {
    if (this.isDead) return;

    // 过载状态玄武盾无敌
    if (this.isOverloaded && this.id === 'shield') {
      return;
    }

    this.hp -= amount;

    // 玄武重盾近战反伤
    if (this.id === 'shield' && type === 'melee') {
      let reflect = this.cfg.reflectDamage;
      if (this.branch === 'B') reflect = 30; // 磁暴巨阙反伤30
      if (window.gameInstance) {
        window.gameInstance.reflectMeleeDamage(this.row, this.col, reflect);
      }

      // 磁暴巨阙：每承受800伤害释放电磁波击退整行1.5格
      if (this.branch === 'B') {
        this.damageTakenRecent += amount;
        if (this.damageTakenRecent >= 800) {
          this.damageTakenRecent = 0;
          if (window.gameInstance) {
            window.gameInstance.knockbackRow(this.row, 1.5);
          }
        }
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.onDestroyed();
    }
  }

  onDestroyed() {
    // 木脉格：返还 100% 建造灵气
    if (this.vein === 'wood' || this.vein === 'taiji') {
      if (window.gameInstance) {
        window.gameInstance.addQi(this.cost);
        window.gameInstance.renderer.addFloatingText(`木脉返还 +${this.cost}`, this.x, this.y - 20, '#2ecc71');
      }
    }
  }
}
