/**
 * 《山海机关录：墨守》投射物系统
 * 支持常规箭矢、雷电链、毒焰箭、寒霜冰弹、梨花散射袖箭、神火飞鸦木鸢、追踪阳炎弹与投石火弹
 */

class Projectile {
  constructor(type, x, y, row, targetRow = row, config = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.row = row;
    this.targetRow = targetRow;
    this.speed = config.speed || 480; // 像素/秒
    this.damage = config.damage || 25;
    this.penetrate = config.penetrate || false; // 是否贯穿
    this.isDead = false;
    this.config = config;

    // 抛物线或者追踪参数
    this.target = config.target || null;
    this.arc = config.arc || false;
    this.startX = x;
    this.startY = y;
    this.targetX = config.targetX || x;
    this.targetY = config.targetY || y;
    this.progress = 0;
  }

  update(dt, game) {
    if (this.isDead) return;

    if (this.arc) {
      // 抛物线运动（如战车投掷火弹）
      const totalDist = Math.hypot(this.targetX - this.startX, this.targetY - this.startY);
      const moveStep = (this.speed * dt) / Math.max(1, totalDist);
      this.progress += moveStep;
      if (this.progress >= 1.0) {
        this.progress = 1.0;
        this.onHitGround(game);
        this.isDead = true;
      }
      this.x = this.startX + (this.targetX - this.startX) * this.progress;
      // 抛物线高度计算
      const arcHeight = Math.sin(this.progress * Math.PI) * 90;
      this.y = this.startY + (this.targetY - this.startY) * this.progress - arcHeight;
      return;
    }

    if (this.type === 'sun_orb' && this.target) {
      // 追踪阳炎弹
      if (this.target.isDead) {
        this.target = game.fiends.find(f => !f.isDead) || null;
      }
      if (this.target) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 15) {
          this.hitTarget(this.target, game);
          this.isDead = true;
          return;
        }
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      } else {
        this.x += this.speed * dt;
      }
      return;
    }

    // 神火飞鸦：全行横扫
    if (this.type === 'fire_crow') {
      this.x += this.speed * dt;
      // 检测整行内的敌人
      for (const fiend of game.fiends) {
        if (!fiend.isDead && fiend.row === this.row && Math.abs(fiend.x - this.x) < 40) {
          if (!this.hitList) this.hitList = new Set();
          if (!this.hitList.has(fiend)) {
            this.hitList.add(fiend);
            this.hitTarget(fiend, game);
          }
        }
      }
      // 飞出屏幕右侧，并在本行铺设5s火海
      if (this.x > game.grid.originX + game.grid.cols * game.grid.cellWidth + 100) {
        for (let c = 0; c < game.grid.cols; c++) {
          game.grid.addGroundEffect('fire', this.row, c, this.config.fireGroundDuration || 5, this.config.fireGroundDps || 60);
        }
        this.isDead = true;
      }
      return;
    }

    // 常规向右飞行直射弹道
    this.x += this.speed * dt;

    // 碰撞检测：检查当前行最近的敌人
    for (const fiend of game.fiends) {
      if (fiend.isDead) continue;
      // Boss 相柳可能覆盖多行
      const fiendCoversRow = fiend.coversRow ? fiend.coversRow(this.row) : (fiend.row === this.row);
      if (fiendCoversRow && Math.abs(fiend.x - this.x) < 25) {
        this.hitTarget(fiend, game);
        if (!this.penetrate) {
          this.isDead = true;
          break;
        }
      }
    }

    // 超出屏幕右边界
    if (this.x > 1200) {
      this.isDead = true;
    }
  }

  hitTarget(fiend, game) {
    let finalDmg = this.damage;
    const isFire = this.type === 'fire_arrow' || this.type === 'fire_crow' || this.type === 'sun_orb';
    const ignoreArmor = this.config.ignoreArmor || false;

    // 结算伤害
    fiend.takeDamage(finalDmg, {
      isFire,
      ignoreArmor,
      attacker: this,
      sourceType: this.type
    }, game);

    // 特殊弹药效果
    if (this.type === 'lightning_arrow') {
      // 雷公连弩：弹射周围 2 名敌人
      AudioSys.playShootArrow();
      const nearby = game.fiends.filter(f => !f.isDead && f !== fiend && Math.hypot(f.x - fiend.x, f.y - fiend.y) < 180);
      const targets = nearby.slice(0, 2);
      for (const t of targets) {
        t.takeDamage(finalDmg * 0.5, { isLightning: true, ignoreArmor: true }, game);
        game.renderer.addChainLightning(fiend.x, fiend.y, t.x, t.y);
      }
    } else if (this.type === 'poison_arrow') {
      // 毒焰重弩：叠加毒蚀
      fiend.addPoison(15, 5); // 15伤害/s，最多5层
    } else if (this.type === 'frost_orb') {
      // 寒霜方士：叠霜冻，4层冰封
      AudioSys.playFreeze();
      const freezeDuration = this.config.freezeDuration || 1.5;
      const killThreshold = this.config.killThreshold || 0;
      fiend.addFrost(freezeDuration, killThreshold);
    } else if (this.type === 'pear_blossom') {
      // 暴雨梨花：向上下相邻行分裂 2 枚 15 伤害散射袖箭
      if (this.row > 0) {
        const splitY = game.grid.originY + (this.row - 1) * game.grid.cellHeight + game.grid.cellHeight / 2;
        game.projectiles.push(new Projectile('split_arrow', this.x, splitY, this.row - 1, this.row - 1, {
          speed: 520,
          damage: this.config.splitDamage || 15
        }));
      }
      if (this.row < game.grid.rows - 1) {
        const splitY = game.grid.originY + (this.row + 1) * game.grid.cellHeight + game.grid.cellHeight / 2;
        game.projectiles.push(new Projectile('split_arrow', this.x, splitY, this.row + 1, this.row + 1, {
          speed: 520,
          damage: this.config.splitDamage || 15
        }));
      }
    }

    // 命中音效与粒子
    AudioSys.playHit();
    game.renderer.addHitSparks(this.x, this.y, isFire ? '#e74c3c' : '#f1c40f');
  }

  onHitGround(game) {
    // 战车投掷火弹落地爆炸
    AudioSys.playExplosion();
    const pos = game.grid.getGridPosAt(this.targetX, this.targetY);
    if (pos) {
      game.grid.addGroundEffect('fire', pos.row, pos.col, 4, 35);
      const auto = game.grid.cells[pos.row][pos.col].automaton;
      if (auto) {
        auto.takeDamage(120, 'catapult');
      }
    }
    game.renderer.addHitSparks(this.targetX, this.targetY, '#e67e22', 18);
  }
}
