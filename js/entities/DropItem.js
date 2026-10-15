/**
 * 《山海机关录：墨守》掉落物系统
 * 包括天地灵气团、天工齿轮、紫金齿轮、先秦刀币
 * 支持物理抛落、漂浮动画、鼠标点击/划过拾取、贪婪发条价值递增、木鸢自动巡天吸附
 */

class DropItem {
  constructor(type, x, y, value = 25, config = {}) {
    this.type = type; // 'qi' | 'gear' | 'purple_gear' | 'coin'
    this.x = x;
    this.y = y;
    this.value = value;
    this.baseValue = value;
    this.config = config;

    // 抛物线落地参数
    this.isFalling = config.isFalling !== undefined ? config.isFalling : true;
    this.groundY = y + (config.dropOffsetY || (Math.random() * 40 - 20));
    this.vy = -180;
    this.gravity = 400;

    this.timer = 0;
    this.maxLifetime = config.greedyClock ? 5.0 : 15.0; // 贪婪发条 5s 消失
    this.isDead = false;
    this.isCollected = false;

    // 吸附飞行状态
    this.isAttracting = false;
    this.targetX = 60;
    this.targetY = 25;
    this.attractSpeed = 600;
  }

  update(dt, game) {
    if (this.isDead) return;

    if (this.isAttracting) {
      // 正在飞向资源栏
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 25) {
        this.finishCollection(game);
        this.isDead = true;
        return;
      }
      this.x += (dx / dist) * this.attractSpeed * dt;
      this.y += (dy / dist) * this.attractSpeed * dt;
      return;
    }

    if (this.isFalling) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.isFalling = false;
      }
    } else {
      // 漂浮微动
      this.timer += dt;
      this.y += Math.sin(this.timer * 4) * 0.3;

      // 贪婪发条词条：每停1秒价值+5(最高50)
      if (game.hasScroll('scroll_greedy') && (this.type === 'qi' || this.type === 'gear')) {
        const bonus = Math.floor(this.timer) * 5;
        this.value = Math.min(50, this.baseValue + bonus);
      }

      if (this.timer >= this.maxLifetime) {
        this.isDead = true;
      }
    }
  }

  collect(game) {
    if (this.isCollected || this.isDead) return;
    this.isCollected = true;
    this.isAttracting = true;

    if (this.type === 'coin') {
      this.targetX = 220;
      this.targetY = 25;
      AudioSys.playCoin();
    } else {
      this.targetX = 70;
      this.targetY = 25;
      AudioSys.playCollectQi();
    }
  }

  finishCollection(game) {
    if (this.type === 'coin') {
      game.addCoins(this.value);
    } else {
      game.addQi(this.value);
      // 招财貔貅信物检查
      if (game.hasRelic('relic_pixiu') && this.value >= 25) {
        game.triggerPixiuBonus();
      }
    }
    game.renderer.addFloatingText(`+${this.value}`, this.targetX, this.targetY + 15, this.type === 'coin' ? '#f1c40f' : '#2ecc71');
  }

  // 判定鼠标划过或点击
  checkHover(mouseX, mouseY) {
    if (this.isAttracting || this.isDead) return false;
    const dist = Math.hypot(this.x - mouseX, this.y - mouseY);
    return dist < 32;
  }
}
