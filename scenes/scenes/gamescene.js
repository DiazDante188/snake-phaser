// scenes/GameScene.js
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    // game state
    this.grid = 20;          // pixel size of a cell
    this.cols = 0;           // computed
    this.rows = 0;           // computed
    this.snake = [];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.food = null;

    // pacing
    this.tick = 0;
    this.stepMs = 140;       // lower = faster
    this.minStepMs = 70;
    this.stepDecay = 2;      // speed up every fruit by this many ms (capped)

    // score/coins
    this.score = 0;
    this.high  = Number(localStorage.getItem('snakeHigh') || '0');
    this.runCoins = 0;       // coins earned this run
    this.hud = {};

    // upgrades (populated in create)
    this.up = {
      scoreMult: 1,   // 1,2,3,4,5,10
      speedBoost: 0,  // 0..3
      shield: 0,      // 0..3 (extra life on crash)
      slowMo: 0,      // 0..3 (charges)
      magnet: 0       // 0..3 (radius)
    };

    // slow-mo runtime
    this.slowMoActive = false;
    this.slowMoCharges = 0;
    this.slowMoCooldown = false;

    // shield runtime
    this.shieldLeft = 0;

    // chiptune metronome
    this.beatTimer = null;
    this.tempoBpm = 110;
  }

  // ---------- utilities ----------

  _loadUpgrades() {
    try {
      const s = localStorage.getItem('snakeUpgrades');
      if (!s) return;
      Object.assign(this.up, JSON.parse(s));
    } catch {}
  }

  _bankCoins() {
    const bank = Number(localStorage.getItem('snakeCoins') || '0');
    localStorage.setItem('snakeCoins', String(bank + this.runCoins));
  }

  _saveHigh() {
    if (this.score > this.high) {
      this.high = this.score;
      localStorage.setItem('snakeHigh', String(this.high));
    }
  }

  // tiny “beep” using WebAudio; used for ready/set/go and metronome ticks
  _beep(freq = 440, dur = 80, vol = 0.08) {
    const ctx = this.sound.context;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur / 1000);
  }

  // metronome that speeds up with gameplay
  _startMusic() {
    const beat = () => {
      // simple “kick + hat” twin beep
      this._beep(160, 50, 0.05);
      this.time.delayedCall(60, () => this._beep(640, 25, 0.03));
    };
    const restart = () => {
      if (this.beatTimer) this.beatTimer.remove(false);
      const interval = (60_000 / this.tempoBpm);
      this.beatTimer = this.time.addEvent({ delay: interval, loop: true, callback: beat });
    };
    this._musicRestart = restart;
    restart();
  }

  _setTempoForSpeed() {
    // map stepMs -> bpm (faster steps => higher bpm)
    const t = Phaser.Math.Linear(180, 110, Phaser.Math.Clamp((this.stepMs - this.minStepMs) / 100, 0, 1));
    this.tempoBpm = Math.round(t);
    if (this._musicRestart) this._musicRestart();
  }

  // ---------- life-cycle ----------

  create() {
    const { width, height } = this.scale;
    this.cols = Math.floor(width / this.grid);
    this.rows = Math.floor(height / this.grid);

    // upgrades
    this._loadUpgrades();

    // apply speed boost (each level trims ~8ms from step)
    this.stepMs = 140 - (this.up.speedBoost * 8);
    this.minStepMs = 70 - (this.up.speedBoost * 4);
    this.stepDecay = 2 + this.up.speedBoost; // accelerates a bit faster

    this.shieldLeft = this.up.shield;
    this.slowMoCharges = this.up.slowMo;

    // snake start
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);
    this.snake = [
      { x: startX,     y: startY     },
      { x: startX - 1, y: startY     },
      { x: startX - 2, y: startY     }
    ];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this._spawnFood();

    // HUD
    this.hud.score = this.add.text(8, 6, '', { fontFamily: 'monospace', fontSize: '18px', color: '#00ff88' });
    this.hud.meta  = this.add.text(8, 28, '', { fontFamily: 'monospace', fontSize: '14px', color: '#9cffd6' });
    this._updateHud();

    // input
    this._setInput();

    // “Ready – Set – GO!” with beeps, then start loop + music
    this._readySequence().then(() => {
      this._setTempoForSpeed();
      this._startMusic();
      this._scheduleNextStep();
    });
  }

  _setInput() {
    const cursors = this.input.keyboard.createCursorKeys();
    const W = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const A = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const S = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const D = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const SPACE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const turn = (x, y) => {
      // prevent reversing on same axis
      if (this.dir.x !== 0 && x !== 0) return;
      if (this.dir.y !== 0 && y !== 0) return;
      this.nextDir = { x, y };
    };

    this.input.keyboard.on('keydown', (ev) => {
      switch (ev.code) {
        case 'ArrowUp': case 'KeyW': turn(0,-1); break;
        case 'ArrowDown': case 'KeyS': turn(0, 1); break;
        case 'ArrowLeft': case 'KeyA': turn(-1,0); break;
        case 'ArrowRight': case 'KeyD': turn(1, 0); break;
      }
    });

    // slow-mo
    SPACE.on('down', () => this._trySlowMo());
  }

  async _readySequence() {
    const { width, height } = this.scale;
    const mid = this.add.text(width/2, height/2, 'READY', this._bannerStyle()).setOrigin(0.5);
    this._beep(330, 120);
    await this._wait(550);

    mid.setText('SET');      this._beep(380, 120);
    await this._wait(550);

    mid.setText('GO!');      this._beep(520, 160);
    this.tweens.add({ targets: mid, y: mid.y - 20, alpha: 0, duration: 350, onComplete: () => mid.destroy() });
    await this._wait(350);
  }

  _bannerStyle() {
    return { fontFamily: 'monospace', fontSize: '38px', color: '#00ff88', stroke: '#003322', strokeThickness: 4 };
  }

  _wait(ms) { return new Promise(res => this.time.delayedCall(ms, res)); }

  // ---------- step loop ----------

  _scheduleNextStep() {
    const d = this.slowMoActive ? this.stepMs * 1.9 : this.stepMs;
    this.time.delayedCall(d, () => {
      this._step();
      this._scheduleNextStep();
    });
  }

  _step() {
    // apply buffered direction
    this.dir = this.nextDir;

    // new head
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

    // wall wrap (classic) OR end with shield
    if (head.x < 0 || head.x >= this.cols || head.y < 0 || head.y >= this.rows) {
      if (this.shieldLeft > 0) {
        this.shieldLeft--;
        this._pulseShield();
        // clamp into bounds to keep going
        head.x = Phaser.Math.Clamp(head.x, 0, this.cols - 1);
        head.y = Phaser.Math.Clamp(head.y, 0, this.rows - 1);
      } else {
        return this._gameOver();
      }
    }

    // self-hit?
    for (let i=0;i<this.snake.length;i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        if (this.shieldLeft > 0) {
          this.shieldLeft--;
          this._pulseShield();
          break; // allow move; we will “clip” tail later
        } else {
          return this._gameOver();
        }
      }
    }

    // push head
    this.snake.unshift(head);

    // eat?
    if (head.x === this.food.x && head.y === this.food.y) {
      const mult = this.up.scoreMult || 1;
      this.score += 1 * mult;
      this.runCoins += 1;        // 1 coin per fruit
      this._updateHud();

      // speed up a touch
      this.stepMs = Math.max(this.minStepMs, this.stepMs - this.stepDecay);
      this._setTempoForSpeed();

      this._spawnFood();
      this._beep(660, 60, 0.05);
    } else {
      // move forward (remove tail)
      this.snake.pop();
    }

    // magnet effect: gently pull food toward head if close
    this._magnetPull();

    // draw everything
    this._render();
  }

  _magnetPull() {
    if (!this.up.magnet) return;
    const radiusCells = [0, 2, 3, 4][this.up.magnet]; // levels 1..3
    const head = this.snake[0];
    const dx = this.food.x - head.x;
    const dy = this.food.y - head.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= radiusCells && dist > 0) {
      // lerp food toward head
      const nx = head.x + Math.sign(this.food.x - head.x);
      const ny = head.y + Math.sign(this.food.y - head.y);
      this.food.x = nx;
      this.food.y = ny;
    }
  }

  _pulseShield() {
    // quick flash cue
    this.cameras.main.flash(100, 0, 255, 255);
    this._beep(220, 80, 0.06);
  }

  _trySlowMo() {
    if (!this.slowMoCharges || this.slowMoCooldown) return;
    this.slowMoCharges--;
    this.slowMoActive = true;
    this.slowMoCooldown = true;

    // screen tint
    const cam = this.cameras.main;
    cam.setTint(0x88ffdd);
    this._beep(300, 120, 0.04);

    // 2s slow, 5s cooldown
    this.time.delayedCall(2000, () => {
      this.slowMoActive = false;
      cam.clearTint();
      this.time.delayedCall(5000, () => { this.slowMoCooldown = false; });
    });
  }

  // ---------- world helpers ----------

  _spawnFood() {
    let x, y;
    do {
      x = Phaser.Math.Between(0, this.cols - 1);
      y = Phaser.Math.Between(0, this.rows - 1);
    } while (this.snake.some(s => s.x === x && s.y === y));

    this.food = { x, y };
  }

  _updateHud() {
    this.hud.score.setText(`Score: ${this.score * 1}   High: ${this.high}   Lv: ${Math.max(1, Math.round((140 - this.stepMs) / 5))}`);
    this.hud.meta.setText(
      `x${this.up.scoreMult}  |  Shield:${this.shieldLeft}  SlowMo:${this.slowMoCharges}  Coins:${this.runCoins}`
    );
  }

  _render() {
    const g = this.add.graphics();
    g.clear();

    // grid bg faint
    g.fillStyle(0x0b0b0b, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);
    g.lineStyle(1, 0x161616, 0.5);
    for (let c = 0; c <= this.cols; c++) {
      g.beginPath(); g.moveTo(c*this.grid, 0); g.lineTo(c*this.grid, this.scale.height); g.strokePath();
    }
    for (let r = 0; r <= this.rows; r++) {
      g.beginPath(); g.moveTo(0, r*this.grid); g.lineTo(this.scale.width, r*this.grid); g.strokePath();
    }

    // food (cyan glow)
    g.fillStyle(0x00ff88, 1);
    g.fillRect(this.food.x * this.grid + 2, this.food.y * this.grid + 2, this.grid - 4, this.grid - 4);

    // snake
    g.fillStyle(0x222222, 1);
    for (let i = 0; i < this.snake.length; i++) {
      const s = this.snake[i];
      const color = i === 0 ? 0xccff00 : 0x99cc00;
      g.fillStyle(color, 1);
      g.fillRect(s.x * this.grid + 1, s.y * this.grid + 1, this.grid - 2, this.grid - 2);
    }

    // replace previous graphics display list entry
    if (this._layer) this._layer.destroy();
    this._layer = g;

    this._updateHud();
  }

  _gameOver() {
    this._saveHigh();
    this._bankCoins();
    if (this.beatTimer) this.beatTimer.remove(false);
    this.scene.start('GameOverScene', {
      score: this.score,
      coins: this.runCoins
    });
  }
}
