/**
 * 《山海机关录：墨守》阵盘网格与地形系统
 * 5 行 9 列墨家八卦青砖棋盘，包含五行地脉格、中枢区标识、地表灼烧与毒沼效果
 */

class Grid {
  constructor(rows = 5, cols = 9) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = CONFIG.GRID.CELL_WIDTH;
    this.cellHeight = CONFIG.GRID.CELL_HEIGHT;
    this.originX = CONFIG.GRID.ORIGIN_X;
    this.originY = CONFIG.GRID.ORIGIN_Y;

    // 墨家中枢继承区：第 2、3 列 (对应 index 1, 2)
    this.coreCols = [1, 2];

    this.cells = [];
    this.groundEffects = []; // 地表效果：火海、毒沼、炭火
    this.obstacles = [];     // 障碍物：刑天战斧、断碑、机关栅栏

    this.initGrid();
  }

  initGrid() {
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.cells[r][c] = {
          row: r,
          col: c,
          automaton: null,
          vein: null,      // 五行地脉：'fire', 'earth', 'water', 'metal', 'wood', 或 'taiji' (全属性)
          isCore: this.coreCols.includes(c),
          hovered: false,
          selected: false
        };
      }
    }
  }

  // 生成五行地脉格 (3 - 5 个，受天赋影响可至 6 个)
  generateVeins(count = 4) {
    // 先清空已有非太极地脉
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cells[r][c].vein !== 'taiji') {
          this.cells[r][c].vein = null;
        }
      }
    }

    const veinTypes = ['fire', 'earth', 'water', 'metal', 'wood'];
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols - 1; c++) { // 避免最右侧出生列
        if (this.cells[r][c].vein !== 'taiji') {
          candidates.push({ r, c });
        }
      }
    }

    // 洗牌打乱
    candidates.sort(() => Math.random() - 0.5);

    const actualCount = Math.min(count, candidates.length);
    for (let i = 0; i < actualCount; i++) {
      const pos = candidates[i];
      const randomVein = veinTypes[Math.floor(Math.random() * veinTypes.length)];
      this.cells[pos.r][pos.c].vein = randomVein;
    }
  }

  // 获得格子像素边界与中心坐标
  getCellBounds(r, c) {
    const x = this.originX + c * this.cellWidth;
    const y = this.originY + r * this.cellHeight;
    return {
      x,
      y,
      width: this.cellWidth,
      height: this.cellHeight,
      centerX: x + this.cellWidth / 2,
      centerY: y + this.cellHeight / 2
    };
  }

  // 像素坐标转换为网格行列
  getGridPosAt(pixelX, pixelY) {
    const col = Math.floor((pixelX - this.originX) / this.cellWidth);
    const row = Math.floor((pixelY - this.originY) / this.cellHeight);
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return { row, col };
    }
    return null;
  }

  // 添加地表效果
  addGroundEffect(type, row, col, duration, dps = 30) {
    this.groundEffects.push({
      type, // 'fire' | 'poison' | 'charcoal'
      row,
      col,
      duration,
      maxDuration: duration,
      dps,
      timer: 0
    });
  }

  // 添加障碍物
  addObstacle(name, row, col, hp = 800, indestructible = false) {
    this.obstacles.push({
      name,
      row,
      col,
      hp,
      maxHp: hp,
      indestructible
    });
  }

  hasObstacleAt(row, col) {
    return this.obstacles.some(o => o.row === row && o.col === col);
  }

  update(dt) {
    // 更新地表效果
    for (let i = this.groundEffects.length - 1; i >= 0; i--) {
      const eff = this.groundEffects[i];
      eff.duration -= dt;
      eff.timer += dt;

      // 毒沼格对格内机关掉血 40/s
      if (eff.type === 'poison' && eff.timer >= 1.0) {
        eff.timer = 0;
        const auto = this.cells[eff.row][eff.col].automaton;
        if (auto) {
          auto.takeDamage(eff.dps, 'poison');
        }
      }

      if (eff.duration <= 0) {
        this.groundEffects.splice(i, 1);
      }
    }

    // 清理损坏障碍物
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (!this.obstacles[i].indestructible && this.obstacles[i].hp <= 0) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  // 清空阵盘外围机关（用于八阵图过关时结算折算）
  extractInheritedState() {
    const inherited = [];
    let dismantledQiRefund = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const auto = this.cells[r][c].automaton;
        if (auto) {
          if (this.coreCols.includes(c)) {
            // 中枢区继承
            inherited.push({
              row: r,
              col: c,
              id: auto.id,
              branch: auto.branch,
              currentHp: auto.hp,
              maxHp: auto.maxHp,
              isGolden: auto.isGolden
            });
          } else {
            // 外围区折算 50% 灵气
            dismantledQiRefund += Math.floor(auto.cost * 0.5);
            this.cells[r][c].automaton = null;
          }
        }
      }
    }
    return { inherited, dismantledQiRefund };
  }

  // 加载继承的中枢机关
  restoreInheritedState(inheritedList, createAutomatonFn) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.coreCols.includes(c)) {
          this.cells[r][c].automaton = null;
        }
      }
    }
    for (const item of inheritedList) {
      if (this.coreCols.includes(item.col)) {
        const auto = createAutomatonFn(item.id, item.row, item.col);
        if (auto) {
          if (item.branch) auto.setBranch(item.branch);
          auto.hp = Math.min(item.currentHp, auto.maxHp);
          auto.isGolden = !!item.isGolden;
          this.cells[item.row][item.col].automaton = auto;
        }
      }
    }
  }
}
