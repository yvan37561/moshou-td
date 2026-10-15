/**
 * 《山海机关录：墨守》阵眼石狮系统
 * 每行最左侧蹲伏一尊青铜石狮，防线被破时吐出贯穿全行的烈焰剑气，秒杀整行敌人
 */

class GuardianLion {
  constructor(row, game) {
    this.row = row;
    this.cellBounds = game.grid.getCellBounds(row, 0);
    this.x = game.grid.originX - 55; // 棋盘左侧
    this.y = this.cellBounds.centerY;
    this.active = true;
    this.isTriggered = false;
    this.flameX = this.x;
    this.flameSpeed = 900; // 烈焰剑气贯穿速度
    this.hasSacrificed = false; // 是否被【背水一战】献祭
  }

  update(dt, game) {
    if (!this.active) return;

    if (this.isTriggered) {
      this.flameX += this.flameSpeed * dt;

      // 对本行所有碰触到的敌人造成秒杀级伤害
      for (const fiend of game.fiends) {
        if (!fiend.isDead && (fiend.row === this.row || (fiend.coversRow && fiend.coversRow(this.row)))) {
          if (fiend.x <= this.flameX + 50) {
            fiend.takeDamage(5000, { isFire: true, ignoreArmor: true }, game);
            game.renderer.addHitSparks(fiend.x, fiend.y, '#e74c3c', 20);
          }
        }
      }

      // 飞出屏幕右侧后彻底完成使命
      if (this.flameX > game.grid.originX + game.grid.cols * game.grid.cellWidth + 100) {
        this.active = false;
      }
      return;
    }

    // 检测是否有敌人突破防线（到达最左侧第0列左边缘）
    for (const fiend of game.fiends) {
      if (!fiend.isDead && fiend.row === this.row) {
        if (fiend.x <= game.grid.originX + 20) {
          this.trigger();
          break;
        }
      }
    }
  }

  trigger() {
    if (this.isTriggered || !this.active) return;
    this.isTriggered = true;
    this.flameX = this.x;
    AudioSys.playLionRoar();
  }

  sacrifice() {
    this.active = false;
    this.hasSacrificed = true;
  }
}
