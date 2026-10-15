/**
 * 《山海机关录：墨守》山海巨兽 Boss 系统
 * 包含第一章【九首凶神 · 相柳】与第二章【断首战神 · 刑天】
 * 具备部位破坏、蓄力打断、断首再生倒计时、2x2跨行游走与飞斧QTE拆招机制
 */

// 1. 相柳蛇首部件
class XiangliuHead {
  constructor(boss, row) {
    this.boss = boss;
    this.row = row;
    this.maxHp = 1500;
    this.hp = this.maxHp;

    this.state = 'idle'; // 'idle' | 'charging' | 'stunned' | 'severed'
    this.chargeTimer = 0;
    this.chargeDamageTaken = 0; // 蓄力期间承受的伤害（达到300打断）
    this.stunTimer = 0;
    this.severTimer = 0; // 断首再生倒计时（12秒）
  }

  update(dt, game) {
    if (this.state === 'severed') {
      this.severTimer -= dt;
      if (this.severTimer <= 0) {
        // 未能达成3首同断，满血复活并增强
        this.state = 'idle';
        this.hp = this.maxHp;
        game.renderer.addFloatingText('蛇首重塑复生！', this.boss.x, game.grid.getCellBounds(this.row, 7).centerY, '#2ecc71');
      }
      return;
    }

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.state = 'idle';
      }
      return;
    }

    if (this.state === 'charging') {
      this.chargeTimer += dt;
      // 达到 2 秒，蓄力完成喷出毒液
      if (this.chargeTimer >= 2.0) {
        this.spitPoison(game);
        this.state = 'idle';
        this.chargeTimer = 0;
      }
    }
  }

  startCharge() {
    if (this.state !== 'idle') return;
    this.state = 'charging';
    this.chargeTimer = 0;
    this.chargeDamageTaken = 0;
  }

  spitPoison(game) {
    AudioSys.playShootArrow();
    // 覆盖该行随机 2 个格子生成持续 10 秒毒沼格
    const cols = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const c of cols) {
      game.grid.addGroundEffect('poison', this.row, c, 10, 40);
    }
    game.renderer.addFloatingText('五毒吐息！', this.boss.x - 60, game.grid.getCellBounds(this.row, 7).centerY, '#2ecc71');
  }

  takeDamage(amount, info, game) {
    if (this.state === 'severed') return;

    this.hp -= amount;

    // 蓄力期间受 300 伤害打断
    if (this.state === 'charging') {
      this.chargeDamageTaken += amount;
      if (this.chargeDamageTaken >= 300) {
        this.state = 'stunned';
        this.stunTimer = 4.0;
        this.chargeTimer = 0;
        AudioSys.playExplosion();
        game.renderer.addFloatingText('吐息被打断！晕眩 4s', this.boss.x - 80, game.grid.getCellBounds(this.row, 7).centerY, '#f1c40f');
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'severed';
      this.severTimer = 12.0;
      AudioSys.playLionRoar();
      game.renderer.addFloatingText('蛇首斩断！', this.boss.x - 80, game.grid.getCellBounds(this.row, 7).centerY, '#e74c3c');
      this.boss.checkSimultaneousSever(game);
    }
  }
}

// 7.1 相柳 Boss
class XiangliuBoss {
  constructor(game) {
    this.id = 'xiangliu';
    this.name = '九首凶神 · 相柳';
    this.isBoss = true;
    this.maxHp = 18000;
    this.hp = this.maxHp;
    this.isDead = false;

    // 盘踞在第 8-9 列
    this.x = game.grid.originX + 7.5 * game.grid.cellWidth;
    this.y = game.grid.originY + 2.5 * game.grid.cellHeight;

    // 5 行对应的 5 个蛇首
    this.heads = [];
    for (let r = 0; r < 5; r++) {
      this.heads.push(new XiangliuHead(this, r));
    }

    this.breathCycleTimer = 0;
    this.isEnraged = false; // 狂暴蛇蜕
    this.shedSkinTimer = 0;
    this.paralyzeTimer = 0; // 瘫痪倒计时
  }

  coversRow(row) {
    return true; // 跨越全 5 行
  }

  update(dt, game) {
    if (this.isDead) return;

    // 瘫痪状态
    if (this.paralyzeTimer > 0) {
      this.paralyzeTimer -= dt;
      return;
    }

    // 更新各个蛇首
    for (const head of this.heads) {
      head.update(dt, game);
    }

    // 吐息循环：每 6 秒蓄力 2 个蛇首
    this.breathCycleTimer += dt;
    if (this.breathCycleTimer >= 6.0) {
      this.breathCycleTimer = 0;
      const idleHeads = this.heads.filter(h => h.state === 'idle');
      const pick = idleHeads.sort(() => Math.random() - 0.5).slice(0, 2);
      for (const h of pick) {
        h.startCharge();
      }
    }

    // 狂暴蛇蜕化魔（生命值低于 40%）
    if (this.hp <= this.maxHp * 0.4) {
      if (!this.isEnraged) {
        this.isEnraged = true;
        game.renderer.addFloatingText('相柳狂暴！蛇蜕化魔！', this.x - 100, this.y, '#e74c3c');
      }
      this.shedSkinTimer += dt;
      if (this.shedSkinTimer >= 15.0) {
        this.shedSkinTimer = 0;
        // 5行各召唤一只狂暴兵俑
        for (let r = 0; r < 5; r++) {
          game.spawnFiend('berserk_ghost', r);
        }
      }
    }
  }

  // 检查是否同时斩断 3 个以上蛇首
  checkSimultaneousSever(game) {
    const severedCount = this.heads.filter(h => h.state === 'severed').length;
    if (severedCount >= 3) {
      // 重创相柳本体，扣除 4500 血量并瘫痪 8 秒
      this.takeDamage(4500, { ignoreArmor: true }, game);
      this.paralyzeTimer = 8.0;
      AudioSys.playExplosion();
      game.renderer.addFloatingText('重创相柳！瘫痪 8 秒！', this.x - 100, this.y, '#f1c40f');
    }
  }

  takeDamage(amount, info = {}, game) {
    if (this.isDead) return;
    this.hp -= amount;

    // 若受到攻击且有对应行，传递给该行的蛇首
    if (info.attacker && info.attacker.row !== undefined) {
      const targetHead = this.heads[info.attacker.row];
      if (targetHead) {
        targetHead.takeDamage(amount, info, game);
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      AudioSys.playLionRoar();
      game.onBossDefeated(this);
    }
  }
}

// 7.2 刑天 Boss
class XingtianBoss {
  constructor(game) {
    this.id = 'xingtian';
    this.name = '断首战神 · 刑天';
    this.isBoss = true;
    this.maxHp = 25000;
    this.hp = this.maxHp;
    this.isDead = false;

    // 2x2 体型
    this.row = 1; // 占据 row 1 与 row 2
    this.col = 6;
    this.x = game.grid.originX + 6.5 * game.grid.cellWidth;
    this.y = game.grid.originY + 1.5 * game.grid.cellHeight;

    this.shieldArmor = 6000;
    this.isShieldRaised = true; // 架盾防御状态
    this.weaknessTimer = 0;     // 弱点大露计时
    this.moveTimer = 0;

    // 飞斧裂地 QTE
    this.axeTimer = 0;
    this.axeWarning = null; // { row, col, timer: 3.0 }
  }

  coversRow(r) {
    return r === this.row || r === this.row + 1;
  }

  update(dt, game) {
    if (this.isDead) return;

    // 游走移动（在 5-8 列、0-3 行之间游走）
    this.moveTimer += dt;
    if (this.moveTimer >= 5.0) {
      this.moveTimer = 0;
      this.row = Math.max(0, Math.min(3, this.row + (Math.random() > 0.5 ? 1 : -1)));
      this.y = game.grid.originY + (this.row + 0.5) * game.grid.cellHeight;
    }

    // 挥斧弱点与架盾交替
    if (this.isShieldRaised) {
      this.weaknessTimer += dt;
      if (this.weaknessTimer >= 10.0) {
        this.isShieldRaised = false; // 护盾移开 2.5 秒
        this.weaknessTimer = 0;
        game.renderer.addFloatingText('胸口弱点暴露！暴击x200%！', this.x - 100, this.y, '#e74c3c');
      }
    } else {
      this.weaknessTimer += dt;
      if (this.weaknessTimer >= 2.5) {
        this.isShieldRaised = true;
        this.weaknessTimer = 0;
      }
    }

    // 飞斧裂地技能
    this.axeTimer += dt;
    if (this.axeTimer >= 14.0 && !this.axeWarning) {
      this.axeTimer = 0;
      this.initiateAxeThrow(game);
    }

    // 处理飞斧预警倒计时
    if (this.axeWarning) {
      this.axeWarning.timer -= dt;
      if (this.axeWarning.timer <= 0) {
        this.resolveAxeImpact(game);
        this.axeWarning = null;
      }
    }
  }

  initiateAxeThrow(game) {
    // 锁定我方机关最密集的一格
    let targetRow = 2;
    let targetCol = 2;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (game.grid.cells[r][c].automaton) {
          targetRow = r;
          targetCol = c;
          break;
        }
      }
    }
    this.axeWarning = {
      row: targetRow,
      col: targetCol,
      timer: 3.0
    };
    AudioSys.playGearClick();
    game.renderer.addFloatingText('巨斧掷出！3秒后裂地！', this.x - 80, this.y, '#f39c12');
  }

  resolveAxeImpact(game) {
    const { row, col } = this.axeWarning;
    const cell = game.grid.cells[row][col];
    AudioSys.playExplosion();

    if (cell.automaton && !cell.automaton.isDead) {
      // 砸中机关：机关瞬间粉碎并波及十字格！
      cell.automaton.takeDamage(999999, 'axe_slam');
      game.renderer.addExplosionEffect(cell.automaton.x, cell.automaton.y, 80);
      game.renderer.addFloatingText('机关粉碎！', cell.automaton.x, cell.automaton.y, '#e74c3c');

      // 十字波及
      const cross = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
      for (const [cr, cc] of cross) {
        if (cr >= 0 && cr < 5 && cc >= 0 && cc < 9) {
          const adj = game.grid.cells[cr][cc].automaton;
          if (adj) adj.takeDamage(400, 'cross_splash');
        }
      }
    } else {
      // 砸在空地上：巨斧化为 800 血量的中立障碍物【刑天战斧】！
      game.grid.addObstacle('刑天战斧', row, col, 800, false);
      game.renderer.addFloatingText('战斧卡入青砖化为障碍！', game.grid.originX + col * game.grid.cellWidth, game.grid.originY + row * game.grid.cellHeight, '#3498db');
    }
  }

  takeDamage(amount, info = {}, game) {
    if (this.isDead) return;

    let finalDamage = amount;

    // 正面架盾减免 80% 直射伤害（地雷与神火飞鸦绕过）
    if (this.isShieldRaised && !info.ignoreArmor && !info.isExplosion && !info.isFire) {
      finalDamage *= 0.2; // 减免 80%
    }

    // 弱点大露暴击 200%
    if (!this.isShieldRaised) {
      finalDamage *= 2.0;
      game.renderer.addFloatingText('弱点暴击！', this.x, this.y - 40, '#f1c40f');
    }

    this.hp -= finalDamage;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      AudioSys.playLionRoar();
      game.onBossDefeated(this);
    }
  }
}
