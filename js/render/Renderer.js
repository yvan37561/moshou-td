/**
 * 《山海机关录：墨守》国风水墨与青铜机关高品质渲染引擎
 * 纯原生 Canvas 2D 绘制，包含齿轮机械、符文光阵、水墨粒子、动态震屏与浮空飘字
 */

class GameRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;

    this.particles = [];
    this.floatingTexts = [];
    this.lightningArcs = [];

    this.shakeIntensity = 0;
    this.shakeDuration = 0;

    // 高品质美术资产加载器
    this.images = {};
    const assetList = {
      background: 'assets/background.jpg',
      crossbow: 'assets/crossbow.jpg',
      furnace: 'assets/furnace.jpg',
      shield: 'assets/shield.jpg',
      taotie: 'assets/taotie.jpg',
      frost_mage: 'assets/frost_mage.jpg',
      fire_crow: 'assets/fire_crow.jpg',
      landmine: 'assets/landmine.jpg',
      pear_blossom: 'assets/pear_blossom.jpg',
      guardian_lion: 'assets/guardian_lion.jpg',
      soldier: 'assets/soldier.jpg'
    };
    for (const [key, path] of Object.entries(assetList)) {
      const img = new Image();
      img.src = path;
      this.images[key] = img;
    }
  }

  triggerScreenShake(intensity = 6, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  addHitSparks(x, y, color = '#f1c40f', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 2.5,
        alpha: 1.0,
        life: 0.25 + Math.random() * 0.2
      });
    }
  }

  addExplosionEffect(x, y, radius = 50) {
    this.triggerScreenShake(8, 0.3);
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? '#e74c3c' : '#f39c12',
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        life: 0.4 + Math.random() * 0.3
      });
    }
  }

  addDeathPuff(x, y, fiendId) {
    // 陶俑碎裂与黑烟
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#7f8c8d' : '#2c3e50',
        size: 4 + Math.random() * 4,
        alpha: 0.9,
        life: 0.5 + Math.random() * 0.3
      });
    }
  }

  addChainLightning(x1, y1, x2, y2) {
    this.lightningArcs.push({
      x1, y1, x2, y2,
      alpha: 1.0,
      life: 0.18
    });
  }

  addFloatingText(text, x, y, color = '#f1c40f', fontSize = 16) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      fontSize,
      alpha: 1.0,
      life: 0.9
    });
  }

  updateEffects(dt) {
    // 屏幕震动
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) this.shakeIntensity = 0;
    }

    // 粒子更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt / p.life;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 闪电弧线
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      const arc = this.lightningArcs[i];
      arc.alpha -= dt / arc.life;
      if (arc.alpha <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }

    // 飘字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 35 * dt;
      ft.alpha -= dt / ft.life;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // 主渲染流程
  render(dt) {
    this.updateEffects(dt);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    // 应用震屏偏移
    if (this.shakeIntensity > 0) {
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(ox, oy);
    }

    // 1. 绘制背景与山海结界边框
    this.renderBoardBackground(ctx);

    // 2. 绘制阵盘网格 (青砖棋盘、五行地脉格、中枢继承区)
    this.renderGrid(ctx);

    // 3. 绘制地表效果 (火海、毒沼、炭火)
    this.renderGroundEffects(ctx);

    // 4. 绘制障碍物
    this.renderObstacles(ctx);

    // 5. 绘制阵眼石狮
    this.renderGuardianLions(ctx);

    // 6. 绘制墨家机关兽
    this.renderAutomata(ctx);

    // 7. 绘制山海巨兽 Boss & 魇魔敌人
    this.renderBoss(ctx);
    this.renderFiends(ctx);

    // 8. 绘制投射物
    this.renderProjectiles(ctx);

    // 9. 绘制掉落物 (灵气、齿轮、铜钱)
    this.renderDropItems(ctx);

    // 10. 绘制闪电链与粒子特效
    this.renderParticlesAndArcs(ctx);

    // 11. 绘制交互指示器 (拖拽放置预览、拆解高亮、过载选择)
    this.renderInteractionOverlay(ctx);

    // 12. 绘制飘字
    this.renderFloatingTexts(ctx);

    ctx.restore();
  }

  // 1. 棋盘背景
  renderBoardBackground(ctx) {
    const grid = this.game.grid;
    const totalW = grid.cols * grid.cellWidth;
    const totalH = grid.rows * grid.cellHeight;

    // 先绘制山海暗黑玄幻背景图
    if (this.images.background && this.images.background.complete) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.images.background, 0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    // 暗色青石地盘背景
    const grad = ctx.createLinearGradient(grid.originX, grid.originY, grid.originX + totalW, grid.originY + totalH);
    grad.addColorStop(0, 'rgba(26, 37, 47, 0.92)');
    grad.addColorStop(1, 'rgba(14, 22, 28, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(grid.originX, grid.originY, totalW, totalH);

    // 阵盘外框铜纹与墨家暗金边框
    ctx.strokeStyle = '#c69c3a';
    ctx.lineWidth = 4;
    ctx.strokeRect(grid.originX - 2, grid.originY - 2, totalW + 4, totalH + 4);

    ctx.strokeStyle = '#8e793e';
    ctx.lineWidth = 1;
    ctx.strokeRect(grid.originX - 6, grid.originY - 6, totalW + 12, totalH + 12);
  }

  // 2. 棋盘网格
  renderGrid(ctx) {
    const grid = this.game.grid;

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        const b = grid.getCellBounds(r, c);

        // 青石砖块交替材质色
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(38, 54, 70, 0.75)' : 'rgba(28, 42, 54, 0.75)';
        ctx.fillRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);

        // 墨家中枢继承区（第2、3列）立体青铜微光标记
        if (cell.isCore) {
          ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x + 3, b.y + 3, b.width - 6, b.height - 6);
          ctx.fillStyle = 'rgba(241, 196, 15, 0.08)';
          ctx.fillRect(b.x + 3, b.y + 3, b.width - 6, b.height - 6);

          ctx.fillStyle = 'rgba(241, 196, 15, 0.35)';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('中枢', b.x + 6, b.y + b.height - 6);
        }

        // 五行地脉格光晕
        if (cell.vein) {
          this.renderVeinCell(ctx, b, cell.vein);
        }

        // 网格分割铜线
        ctx.strokeStyle = 'rgba(142, 121, 62, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, b.width, b.height);
      }
    }
  }

  renderVeinCell(ctx, b, veinKey) {
    let color = '#f1c40f';
    let label = '金';
    if (veinKey === 'fire') { color = '#e74c3c'; label = '火'; }
    else if (veinKey === 'earth') { color = '#f39c12'; label = '土'; }
    else if (veinKey === 'water') { color = '#3498db'; label = '水'; }
    else if (veinKey === 'metal') { color = '#f1c40f'; label = '金'; }
    else if (veinKey === 'wood') { color = '#2ecc71'; label = '木'; }
    else if (veinKey === 'taiji') { color = '#9b59b6'; label = '极'; }

    ctx.save();
    // 脉格微光与符文呼吸
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);

    // 脉格八角阵线
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x + 4, b.y + 4, b.width - 8, b.height - 8);

    // 角标印记
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.fillText(`【${label}脉】`, b.x + 6, b.y + 16);
    ctx.restore();
  }

  // 3. 地表效果 (火海/毒沼/炭火)
  renderGroundEffects(ctx) {
    const grid = this.game.grid;
    for (const eff of grid.groundEffects) {
      const b = grid.getCellBounds(eff.row, eff.col);
      ctx.save();
      if (eff.type === 'fire') {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.55)';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        // 火焰跳跃粒子
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(b.centerX + Math.sin(Date.now() * 0.01 + eff.col) * 15, b.centerY + 10, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === 'poison') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.45)';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        // 毒气泡
        ctx.strokeStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(b.centerX, b.centerY, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === 'charcoal') {
        ctx.fillStyle = 'rgba(192, 57, 43, 0.45)';
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }
      ctx.restore();
    }
  }

  // 4. 障碍物
  renderObstacles(ctx) {
    const grid = this.game.grid;
    for (const obs of grid.obstacles) {
      const b = grid.getCellBounds(obs.row, obs.col);
      ctx.save();
      ctx.fillStyle = '#34495e';
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 2;
      ctx.fillRect(b.centerX - 24, b.centerY - 28, 48, 56);
      ctx.strokeRect(b.centerX - 24, b.centerY - 28, 48, 56);

      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obs.name === '刑天战斧' ? '🪓' : '🪨', b.centerX, b.centerY - 2);

      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#f1c40f';
      ctx.fillText(obs.name, b.centerX, b.centerY + 18);
      ctx.restore();
    }
  }

  // 5. 阵眼石狮
  renderGuardianLions(ctx) {
    const lionImg = this.images.guardian_lion;
    for (const lion of this.game.guardianLions) {
      if (!lion.active) continue;
      ctx.save();
      if (lion.isTriggered) {
        // 咆哮吐出贯穿全行的烈焰剑气波
        const grad = ctx.createLinearGradient(lion.flameX - 100, lion.y, lion.flameX + 60, lion.y);
        grad.addColorStop(0, 'rgba(231, 76, 60, 0)');
        grad.addColorStop(0.7, '#e74c3c');
        grad.addColorStop(1, '#f1c40f');
        ctx.fillStyle = grad;
        ctx.fillRect(lion.flameX - 80, lion.y - 25, 140, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('🔥⚔️', lion.flameX, lion.y + 7);
      } else {
        // 绘制精美石狮立绘
        if (lionImg && lionImg.complete) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(lion.x, lion.y, 26, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(lionImg, lion.x - 26, lion.y - 26, 52, 52);
          ctx.restore();

          // 青铜金边框
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(lion.x, lion.y, 26, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#16a085';
          ctx.beginPath();
          ctx.arc(lion.x, lion.y, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // 6. 墨家机关兽
  renderAutomata(ctx) {
    for (let r = 0; r < this.game.grid.rows; r++) {
      for (let c = 0; c < this.game.grid.cols; c++) {
        const auto = this.game.grid.cells[r][c].automaton;
        if (!auto || auto.isDead) continue;

        ctx.save();
        // 机巧过载金色爆发光柱
        if (auto.isOverloaded) {
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#f39c12';
          ctx.shadowBlur = 18;
          ctx.strokeRect(auto.x - 38, auto.y - 38, 76, 76);
        }

        // 九宫动力链光环微光
        if (auto.buffLayers > 0) {
          ctx.fillStyle = 'rgba(241, 196, 15, 0.25)';
          ctx.beginPath();
          ctx.arc(auto.x, auto.y, 40, 0, Math.PI * 2);
          ctx.fill();
        }

        // 机关青铜八卦底座
        ctx.save();
        ctx.translate(auto.x, auto.y);
        ctx.rotate(auto.timer * 0.4);
        ctx.strokeStyle = '#c69c3a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-32, -32, 64, 64);
        ctx.rotate(-auto.timer * 0.4);
        ctx.restore();

        // 绘制高品质立绘贴图
        const autoImg = this.images[auto.id];
        if (autoImg && autoImg.complete) {
          ctx.save();
          // 圆形立绘裁剪
          ctx.beginPath();
          ctx.arc(auto.x, auto.y - 2, 30, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(autoImg, auto.x - 30, auto.y - 32, 60, 60);
          ctx.restore();

          // 暗金圆形外框
          ctx.strokeStyle = auto.isGolden ? '#f1c40f' : '#8e793e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(auto.x, auto.y - 2, 30, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 备用文字图标
          ctx.fillStyle = '#ffffff';
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(auto.icon, auto.x, auto.y - 4);
        }

        // 机关名称小标
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(auto.name.slice(0, 4), auto.x, auto.y + 24);

        // 黄金阶星标
        if (auto.isGolden) {
          ctx.fillStyle = '#f1c40f';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('★金', auto.x + 20, auto.y - 20);
        }

        // 血条绘制
        const hpPercent = Math.max(0, auto.hp / auto.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(auto.x - 26, auto.y + 30, 52, 5);
        ctx.fillStyle = hpPercent > 0.5 ? '#2ecc71' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillRect(auto.x - 25, auto.y + 31, 50 * hpPercent, 3);

        ctx.restore();
      }
    }
  }

  // 7. 山海魇魔
  renderFiends(ctx) {
    const soldierImg = this.images.soldier;

    for (const fiend of this.game.fiends) {
      if (fiend.isDead) continue;

      ctx.save();
      ctx.translate(fiend.x, fiend.y);

      // 脚底瘴气阴影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 24, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 冰冻特效包裹
      if (fiend.isFrozen) {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.55)';
        ctx.fillRect(-26, -30, 52, 60);
      }

      // 狂暴符鬼霸体红光
      if (fiend.isBerserk) {
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 16;
      }

      // 若为兵俑且素材已就绪
      if (fiend.id === 'soldier' && soldierImg && soldierImg.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, -4, 26, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(soldierImg, -26, -30, 52, 52);
        ctx.restore();

        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 26, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 其他怪物的强化绘制
        ctx.fillStyle = '#ffffff';
        ctx.font = fiend.id === 'chariot' ? '38px sans-serif' : '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fiend.icon, 0, -4);
      }

      // 怪物名称
      ctx.fillStyle = '#f5b7b1';
      ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fiend.name, 0, -32);

      // 护盾与血条
      const hpPercent = Math.max(0, fiend.hp / fiend.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-22, 24, 44, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-21, 25, 42 * hpPercent, 3);

      if (fiend.armor > 0 && fiend.maxArmor > 0) {
        const armorPercent = fiend.armor / fiend.maxArmor;
        ctx.fillStyle = '#3498db';
        ctx.fillRect(-21, 21, 42 * armorPercent, 3);
      }

      ctx.restore();
    }
  }

  // Boss 战渲染
  renderBoss(ctx) {
    const boss = this.game.currentBoss;
    if (!boss || boss.isDead) return;

    ctx.save();
    if (boss.id === 'xiangliu') {
      // 绘制相柳本体与 5 个蛇首
      ctx.fillStyle = 'rgba(22, 160, 133, 0.3)';
      ctx.fillRect(boss.x - 30, this.game.grid.originY, 140, this.game.grid.rows * this.game.grid.cellHeight);

      // 绘制 5 蛇首
      for (const head of boss.heads) {
        const rowY = this.game.grid.getCellBounds(head.row, 7).centerY;
        ctx.save();
        if (head.state === 'severed') {
          ctx.fillStyle = '#7f8c8d';
          ctx.font = '12px sans-serif';
          ctx.fillText(`重塑倒计时: ${Math.ceil(head.severTimer)}s`, boss.x - 60, rowY);
        } else {
          // 蛇头蓄力光圈
          if (head.state === 'charging') {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
            ctx.beginPath();
            ctx.arc(boss.x - 30, rowY, 25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.font = '28px sans-serif';
          ctx.fillText('🐍', boss.x - 40, rowY + 8);

          // 蛇首血条
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(boss.x - 60, rowY + 18, 50, 4);
          ctx.fillStyle = '#2ecc71';
          ctx.fillRect(boss.x - 60, rowY + 18, 50 * (head.hp / head.maxHp), 4);
        }
        ctx.restore();
      }
    } else if (boss.id === 'xingtian') {
      // 刑天 2x2 绘制
      ctx.translate(boss.x, boss.y);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-50, -50, 100, 100);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👹', 0, -10);

      if (boss.isShieldRaised) {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-55, -45, 16, 90);
        ctx.fillText('🛡️', -48, 0);
      } else {
        // 弱点胸口
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('👁️👄👁️', 0, 20);
      }

      // 飞斧裂地预警圈
      if (boss.axeWarning) {
        const wb = this.game.grid.getCellBounds(boss.axeWarning.row, boss.axeWarning.col);
        ctx.save();
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wb.centerX, wb.centerY, 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`斧落: ${boss.axeWarning.timer.toFixed(1)}s`, wb.centerX, wb.centerY);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 8. 投射物
  renderProjectiles(ctx) {
    for (const p of this.game.projectiles) {
      if (p.isDead) continue;
      ctx.save();
      ctx.translate(p.x, p.y);

      // 飞行流光拖尾粒子 (提升战斗视觉华丽感)
      if (Math.random() < 0.4) {
        let trailColor = '#f39c12';
        if (p.type === 'lightning_arrow') trailColor = '#f1c40f';
        else if (p.type === 'poison_arrow') trailColor = '#2ecc71';
        else if (p.type === 'frost_orb') trailColor = '#3498db';
        else if (p.type === 'fire_crow') trailColor = '#e74c3c';

        this.particles.push({
          x: p.x - 12 + (Math.random() - 0.5) * 6,
          y: p.y + (Math.random() - 0.5) * 6,
          vx: -40,
          vy: (Math.random() - 0.5) * 15,
          color: trailColor,
          size: 1.5 + Math.random() * 2,
          alpha: 0.7,
          life: 0.18
        });
      }

      if (p.type === 'arrow' || p.type === 'split_arrow') {
        ctx.fillStyle = '#f39c12';
        ctx.shadowColor = '#e67e22';
        ctx.shadowBlur = 6;
        ctx.fillRect(-10, -2, 20, 4);
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -4);
        ctx.lineTo(4, 4);
        ctx.fill();
      } else if (p.type === 'lightning_arrow') {
        ctx.fillStyle = '#f1c40f';
        ctx.shadowColor = '#f39c12';
        ctx.shadowBlur = 10;
        ctx.fillRect(-12, -3, 24, 6);
      } else if (p.type === 'poison_arrow') {
        ctx.fillStyle = '#2ecc71';
        ctx.shadowColor = '#27ae60';
        ctx.shadowBlur = 8;
        ctx.fillRect(-10, -2, 20, 4);
      } else if (p.type === 'frost_orb') {
        ctx.fillStyle = '#3498db';
        ctx.shadowColor = '#2980b9';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fire_crow') {
        ctx.font = '34px sans-serif';
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 15;
        ctx.fillText('🦅🔥', -20, 10);
      } else if (p.type === 'sun_orb' || p.type === 'catapult_fire') {
        ctx.fillStyle = '#e74c3c';
        ctx.shadowColor = '#c0392b';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-8, -2, 16, 4);
      }
      ctx.restore();
    }
  }

  // 9. 掉落物
  renderDropItems(ctx) {
    for (const item of this.game.dropItems) {
      if (item.isDead) continue;
      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.type === 'coin') {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b7950b';
        ctx.stroke();
        ctx.fillStyle = '#7d6608';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('刀', 0, 0);
      } else if (item.type === 'purple_gear') {
        ctx.font = '22px sans-serif';
        ctx.fillText('⚙️', -11, 8);
      } else {
        // 灵气齿轮 / 灵气团
        ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '18px sans-serif';
        ctx.fillText('✨', -9, 6);
      }
      ctx.restore();
    }
  }

  // 10. 粒子与弧线
  renderParticlesAndArcs(ctx) {
    // 闪电弧线
    for (const arc of this.lightningArcs) {
      ctx.save();
      ctx.strokeStyle = `rgba(241, 196, 15, ${arc.alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const mx = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 20;
      const my = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 20;
      ctx.lineTo(mx, my);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 粒子
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 11. 交互遮罩与拖拽预览
  renderInteractionOverlay(ctx) {
    // 拖拽放置卡牌预览
    if (this.game.dragCard && this.game.mousePos) {
      const pos = this.game.grid.getGridPosAt(this.game.mousePos.x, this.game.mousePos.y);
      if (pos) {
        const b = this.game.grid.getCellBounds(pos.row, pos.col);
        const canBuild = !this.game.grid.cells[pos.row][pos.col].automaton;
        ctx.save();
        ctx.fillStyle = canBuild ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.font = '28px sans-serif';
        ctx.fillText(CONFIG.AUTOMATA[this.game.dragCard].icon, b.centerX - 14, b.centerY + 10);
        ctx.restore();
      }
    }

    // 拆解钳模式
    if (this.game.isDismantleMode && this.game.mousePos) {
      const pos = this.game.grid.getGridPosAt(this.game.mousePos.x, this.game.mousePos.y);
      if (pos && this.game.grid.cells[pos.row][pos.col].automaton) {
        const b = this.game.grid.getCellBounds(pos.row, pos.col);
        ctx.save();
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
        ctx.restore();
      }
    }
  }

  // 12. 飘字
  renderFloatingTexts(ctx) {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.font = `bold ${ft.fontSize}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
