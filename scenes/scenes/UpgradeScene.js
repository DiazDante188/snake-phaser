// scenes/UpgradeScene.js
class UpgradeScene extends Phaser.Scene {
  constructor() {
    super('UpgradeScene');
    this.coins = 0;
    this.up = null;
    this.ui = {};
  }

  create(data) {
    const { width, height } = this.scale;

    // backdrop
    this.add.rectangle(width/2, height/2, width, height, 0x0a0a0a).setAlpha(0.9);
    this.add.grid(width/2, height/2, width, height, 32, 32, 0x0a0a0a, 0, 0x161616, 0.6);

    this.add.text(width/2, 40, 'UPGRADES', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#00ff88'
    }).setOrigin(0.5);

    // load state
    this.up = this._loadUpgrades();
    this.coins = this._loadCoins();

    this.ui.coinsText = this.add.text(width/2, 70, `Coins: ${this.coins}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ccff00'
    }).setOrigin(0.5);

    // rows
    const startY = 110;
    const rowH = 52;
    const rows = [
      this._rowScoreMult(width/2, startY + rowH*0),
      this._rowLinear('Speed Boost', 'speedBoost', 0, 3, [120, 280, 600], width/2, startY + rowH*1,
        'Slightly increases top speed curve.'),
      this._rowLinear('Shield', 'shield', 0, 3, [150, 300, 700], width/2, startY + rowH*2,
        'Ignore a crash once per run.'),
      this._rowLinear('Slow-Mo', 'slowMo', 0, 3, [120, 260, 520], width/2, startY + rowH*3,
        'Tap SPACE to slow time briefly.'),
      this._rowLinear('Magnet', 'magnet', 0, 3, [150, 320, 660], width/2, startY + rowH*4,
        'Attracts fruit within a small radius.')
    ];

    // back button
    const back = this._button(width/2, height - 38, 'BACK');
    back.on('pointerup', () => {
      this._save();
      this.scene.start('MenuScene');
    });

    // hotkeys
    this.input.keyboard.on('keydown-ESC', () => back.emit('pointerup'));
    this.input.keyboard.on('keydown-M',   () => back.emit('pointerup'));
  }

  // ---------- UI helpers ----------

  _rowScoreMult(x, y) {
    const levels = [1, 2, 3, 4, 5, 10];
    const costs  = [0, 100, 250, 600, 1200, 3000]; // coin costs to reach each step
    const idx = Math.max(0, levels.indexOf(this.up.scoreMult));
    const label = this.add.text(x - 130, y, 'Score Multiplier', this._labelStyle()).setOrigin(0, 0.5);
    const state = this.add.text(x + 10, y, '', this._stateStyle()).setOrigin(0, 0.5);
    const btn = this._button(x + 160, y, 'BUY');

    const refresh = () => {
      const curIdx = Math.max(0, levels.indexOf(this.up.scoreMult));
      const nextIdx = Math.min(curIdx + 1, levels.length - 1);
      const maxed = curIdx === levels.length - 1;
      const cost = costs[nextIdx];

      state.setText(`Now: x${levels[curIdx]}  ${maxed ? '(MAX)' : 'Next: x' + levels[nextIdx] + '  Cost: ' + cost}`);

      btn.setText(maxed ? 'MAX' : 'BUY')
         .setAlpha(maxed ? 0.6 : 1)
         .disableInteractive();
      if (!maxed) btn.setInteractive({ useHandCursor: true });
      btn.removeAllListeners('pointerup');
      if (!maxed) {
        btn.on('pointerup', () => {
          const targetIdx = Math.max(1, nextIdx); // skip the free 1x step
          const price = costs[targetIdx];
          if (this._spend(price)) {
            this.up.scoreMult = levels[targetIdx];
            this._save();
            refresh();
          } else {
            this._flashCoins();
          }
        });
      }
    };

    refresh();
    return { label, state, btn, refresh };
  }

  _rowLinear(title, key, min, max, costs, x, y, help='') {
    const label = this.add.text(x - 130, y, title, this._labelStyle()).setOrigin(0, 0.5);
    const state = this.add.text(x + 10, y, '', this._stateStyle()).setOrigin(0, 0.5);
    const btn   = this._button(x + 160, y, 'BUY');

    if (help) {
      this.add.text(x - 130, y + 18, help, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#888'
      }).setOrigin(0,0.5);
    }

    const refresh = () => {
      const lvl = Phaser.Math.Clamp(this.up[key] ?? min, min, max);
      const maxed = lvl >= max;
      const next = Math.min(lvl + 1, max);
      const price = costs[Math.max(0, next - 1)] ?? 0;

      state.setText(`Level: ${lvl}/${max}  ${maxed ? '(MAX)' : 'Next Cost: ' + price}`);

      btn.setText(maxed ? 'MAX' : 'BUY')
         .setAlpha(maxed ? 0.6 : 1)
         .disableInteractive();
      if (!maxed) btn.setInteractive({ useHandCursor: true });

      btn.removeAllListeners('pointerup');
      if (!maxed) {
        btn.on('pointerup', () => {
          if (this._spend(price)) {
            this.up[key] = next;
            this._save();
            refresh();
          } else {
            this._flashCoins();
          }
        });
      }
    };

    refresh();
    return { label, state, btn, refresh };
  }

  _labelStyle() {
    return { fontFamily: 'monospace', fontSize: '16px', color: '#dddddd' };
  }
  _stateStyle() {
    return { fontFamily: 'monospace', fontSize: '14px', color: '#00ff88' };
  }

  _button(x, y, text) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00110a',
      backgroundColor: '#00ff88',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#00e67a' }));
    t.on('pointerout',  () => t.setStyle({ backgroundColor: '#00ff88' }));
    return t;
  }

  _flashCoins() {
    this.tweens.add({
      targets: this.ui.coinsText,
      color: { from: '#ccff00', to: '#ff6666' },
      yoyo: true, repeat: 1, duration: 120
    });
  }

  // ---------- persistence / currency ----------

  _loadUpgrades() {
    const defaults = { scoreMult: 1, speedBoost: 0, shield: 0, slowMo: 0, magnet: 0 };
    try {
      const raw = localStorage.getItem('snakeUpgrades');
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch { return defaults; }
  }

  _loadCoins() {
    const v = Number(localStorage.getItem('snakeCoins') || '0');
    return Number.isFinite(v) ? v : 0;
  }

  _save() {
    localStorage.setItem('snakeUpgrades', JSON.stringify(this.up));
    localStorage.setItem('snakeCoins', String(this.coins));
    if (this.ui.coinsText) this.ui.coinsText.setText(`Coins: ${this.coins}`);
  }

  _spend(amount) {
    if (this.coins >= amount) {
      this.coins -= amount;
      this._save();
      return true;
    }
    return false;
  }
}
