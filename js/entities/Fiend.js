/**
 * 《山海机关录：墨守》山海魇魔实体系统
 * 包含残破兵俑、藤甲尸兵、重锤力士、飞爪山魈、狂暴符鬼、偃师战车等 6 种常规怪
 */

class Fiend {
  constructor(id, row, game) {
    this.id = id;
    this.row = row;
    this.cfg = CONFIG.FIENDS[id];

    this.name = this.cfg.name;
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.armor = this.cfg.armor || 0;
    this.maxArmor = this.armor;

    this.baseSpeed = this.cfg.speed; // 格/秒
    this.speed = this.baseSpeed;
    this.dps = this.cfg.dps;
    this.icon = this.cfg.icon;

    // 像素坐标（初始在棋盘最右侧外部）
    this.x = game.grid.originX + game.grid.cols * game.grid.cellWidth + 30;
    this.y = game.grid.getCellBounds(row, 0).centerY;

    this.isDead = false;
    this.isEating = false; // 是否正在啃噬前方机关
    this.targetAutomaton = null;

    // 状态效果
    this.frostLayers = 0;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.poisonLayers = 0;
    this.poisonTimer = 0;
    this.burnTimer = 0;

    // 特殊怪机制属性
    this.immuneKnockback = this.id === 'heavy' || this.id === 'chariot';
    this.isBerserk = false;        // 狂暴符鬼
    this.hasRoared = false;
    this.roarTimer = 0;
    this.hasHookSwung = false;     // 飞爪山魈是否已飞荡过
    this.isHookSwinging = false;
    this.hookProgress = 0;
    this.hookStartX = 0;
    this.hookTargetX = 0;
    this.isStunned = false;        // 眩晕
    this.stunTimer = 0;
    this.catapultTimer = 0;        // 偃师战车投石计时
    this.isCharmed = false;        // 迷魂蛊师倒戈
    this.charmTimer = 0;
  }

  update(dt, game) {
    if (this.isDead) return;

    // 倒戈状态：撕咬同伴
    if (this.isCharmed) {
      this.charmTimer -= dt;
      if (this.charmTimer <= 0) {
        this.isCharmed = false;
      } else {
        // 向右移动并攻击其他魇魔
        this.x += this.baseSpeed * game.grid.cellWidth * dt;
        for (const other of game.fiends) {
          if (!other.isDead && other !== this && other.row === this.row && Math.abs(other.x - this.x) < 30) {
            other.takeDamage(this.dps * dt, { isNormal: true }, game);
          }
        }
        return;
      }
    }

    // 毒蚀结算
    if (this.poisonLayers > 0) {
      this.poisonTimer += dt;
      if (this.poisonTimer >= 1.0) {
        this.poisonTimer = 0;
        this.takeDamage(15 * this.poisonLayers, { isPoison: true, ignoreArmor: true }, game);
      }
    }

    // 冰封与眩晕结算
    if (this.isFrozen) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
        this.frostLayers = 0;
      }
      return; // 冰封期间无法行动
    }

    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
      }
      return;
    }

    // 狂暴符鬼怒吼判定
    if (this.id === 'berserk_ghost' && this.armor <= 0 && !this.hasRoared) {
      this.roarTimer += dt;
      if (this.roarTimer < 1.0) {
        return; // 原地怒吼 1s
      }
      this.hasRoared = true;
      this.isBerserk = true;
      this.baseSpeed = 0.55;
      this.dps = 200;
      this.immuneKnockback = true;
      game.renderer.addFloatingText('狂暴！', this.x, this.y - 20, '#e74c3c');
    }

    // 飞爪山魈荡跃判定
    if (this.isHookSwinging) {
      this.hookProgress += dt * 2.0;
      if (this.hookProgress >= 1.0) {
        this.hookProgress = 1.0;
        this.isHookSwinging = false;
        this.x = this.hookTargetX;
      } else {
        this.x = this.hookStartX + (this.hookTargetX - this.hookStartX) * this.hookProgress;
        this.y = game.grid.getCellBounds(this.row, 0).centerY - Math.sin(this.hookProgress * Math.PI) * 45;
      }
      return;
    }

    // 偃师战车投掷火弹
    if (this.id === 'chariot') {
      this.catapultTimer += dt;
      if (this.catapultTimer >= 8.0) {
        this.catapultTimer = 0;
        this.launchCatapult(game);
      }
    }

    // 移动与碰撞检测
    this.handleMovementAndAttack(dt, game);
  }

  handleMovementAndAttack(dt, game) {
    // 移速计算（减速效果）
    let currentSpeed = this.baseSpeed;
    if (this.frostLayers > 0) {
      currentSpeed *= 0.65; // 减速 35%
    }
    const speedPx = currentSpeed * game.grid.cellWidth;

    // 检测当前所在的网格列
    const col = Math.floor((this.x - game.grid.originX) / game.grid.cellWidth);
    let frontAuto = null;

    if (col >= 0 && col < game.grid.cols) {
      frontAuto = game.grid.cells[this.row][col].automaton;
    }

    // 飞爪山魈遇首个机关甩出钩爪荡过 1 格
    if (this.id === 'mandrill' && !this.hasHookSwung && frontAuto && !frontAuto.isDead) {
      this.hasHookSwung = true;
      this.isHookSwinging = true;
      this.hookProgress = 0;
      this.hookStartX = this.x;
      this.hookTargetX = this.x - game.grid.cellWidth * 1.5;

      // 若落点撞上土脉格机关，撞晕落地
      const targetCol = col - 1;
      if (targetCol >= 0) {
        const landingVein = game.grid.cells[this.row][targetCol].vein;
        if (landingVein === 'earth' || landingVein === 'taiji') {
          setTimeout(() => {
            this.isStunned = true;
            this.stunTimer = 3.0;
            game.renderer.addFloatingText('撞晕落地！', this.x, this.y - 20, '#f39c12');
          }, 500);
        }
      }
      return;
    }

    // 偃师战车碾碎普通机关
    if (this.id === 'chariot' && frontAuto && !frontAuto.isDead) {
      frontAuto.takeDamage(99999, 'crush');
      AudioSys.playExplosion();
      game.renderer.addExplosionEffect(frontAuto.x, frontAuto.y, 40);
    }

    // 攻击前方机关
    if (frontAuto && !frontAuto.isDead && Math.abs(this.x - frontAuto.x) < 30) {
      this.isEating = true;
      this.targetAutomaton = frontAuto;
      frontAuto.takeDamage(this.dps * dt, 'melee');
      return;
    }

    // 攻击障碍物（如刑天战斧、断碑）
    const obstacle = game.grid.obstacles.find(o => o.row === this.row && Math.abs(this.x - (game.grid.originX + o.col * game.grid.cellWidth + game.grid.cellWidth / 2)) < 30);
    if (obstacle) {
      this.isEating = true;
      if (!obstacle.indestructible) {
        obstacle.hp -= this.dps * dt;
      }
      return;
    }

    // 持续向左前进
    this.isEating = false;
    this.targetAutomaton = null;
    this.x -= speedPx * dt;
  }

  // 偃师战车投掷火弹
  launchCatapult(game) {
    const candidates = [];
    for (let r = 0; r < game.grid.rows; r++) {
      for (let c = 0; c < 3; c++) {
        if (game.grid.cells[r][c].automaton) {
          candidates.push(game.grid.cells[r][c]);
        }
      }
    }
    const targetCell = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : { row: this.row, col: 1 };
    const bounds = game.grid.getCellBounds(targetCell.row, targetCell.col);

    game.projectiles.push(new Projectile('catapult_fire', this.x, this.y - 20, this.row, targetCell.row, {
      speed: 350,
      arc: true,
      targetX: bounds.centerX,
      targetY: bounds.centerY
    }));
  }

  // 承受伤害
  takeDamage(amount, info = {}, game) {
    if (this.isDead) return;

    let finalDamage = amount;

    // 藤甲尸兵减免30%直射物理箭伤，受火伤200%倍率引燃
    if (this.id === 'rattan') {
      if (info.isFire) {
        finalDamage *= 2.0;
        game.renderer.addFloatingText('引燃 200%！', this.x, this.y - 25, '#e74c3c');
      } else if (!info.ignoreArmor && !info.isExplosion) {
        finalDamage *= 0.7; // 减免30%
      }
    }

    // 护甲优先扣除
    if (this.armor > 0 && !info.ignoreArmor) {
      if (this.armor >= finalDamage) {
        this.armor -= finalDamage;
        finalDamage = 0;
      } else {
        finalDamage -= this.armor;
        this.armor = 0;
      }
    }

    this.hp -= finalDamage;

    // 玄冥冰魄斩杀检测（血量低于15%直接碎冰斩杀）
    if (info.killThreshold && this.hp > 0 && this.hp / this.maxHp <= info.killThreshold) {
      this.hp = 0;
      game.renderer.addFloatingText('碎冰斩杀！', this.x, this.y - 25, '#3498db');
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    }
  }

  addFrost(freezeDuration = 1.5, killThreshold = 0) {
    this.frostLayers++;
    if (this.frostLayers >= 4) {
      this.isFrozen = true;
      this.freezeTimer = freezeDuration;
      if (killThreshold > 0 && this.hp / this.maxHp <= killThreshold) {
        this.hp = 0;
        this.die(window.gameInstance);
      }
    }
  }

  addPoison(dps = 15, maxLayers = 5) {
    this.poisonLayers = Math.min(maxLayers, this.poisonLayers + 1);
  }

  die(game) {
    if (this.isDead) return;
    this.isDead = true;

    // 天工炉过载充能 +5
    game.addOverloadEnergy(5);

    // 掉落灵气齿轮
    if (Math.random() < 0.35) {
      game.spawnDropItem('gear', this.x, this.y, 25);
    }

    // 毒蚀死亡传染毒爆
    if (this.poisonLayers > 0) {
      for (const other of game.fiends) {
        if (!other.isDead && other !== this && Math.hypot(other.x - this.x, other.y - this.y) < 90) {
          other.addPoison(15, 5);
        }
      }
    }

    game.renderer.addDeathPuff(this.x, this.y, this.id);
  }
}
