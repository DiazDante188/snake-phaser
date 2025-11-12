// scenes/MenuScene.js
class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.menuMusic = null;
  }

  create() {
    const { width, height } = this.scale;

    // Grid-ish backdrop
    this.add.grid(width/2, height/2, width, height, 32, 32, 0x0a0a0a, 0.6, 0x111111, 0.6);

    // Title
    this.add.text(width/2, 60, 'SNAKE 8-BIT', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#00ff88',
      stroke: '#003322',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Neon “S”
    this.add.text(width/2, 115, 'S', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ccff00',
      stroke: '#00ffff',
      strokeThickness: 8,
      shadow: { blur: 12, fill: true, color: '#00ffff' }
    }).setOrigin(0.5);

    // Tap-to-start hint
    const hint = this.add.text(width/2, height - 46, 'Tap / Press ENTER to Start', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#bbbbbb'
    }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.25, yoyo: true, repeat: -1, duration: 700 });

    // Buttons
    const startBtn = this._button(width/2, height/2 + 10, 'START');
    const upgradeBtn = this._button(width/2, height/2 + 48, 'UPGRADES');

    startBtn.on('pointerup', () => this._startGame());
    upgradeBtn.on('pointerup', () => this._openUpgrades());

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-ENTER', () => this._startGame());
    this.input.keyboard.on('keydown-U', () => this._openUpgrades());

    // Menu music (loop)
    if (!this.sound.locked) {
      this._playMenuMusic();
    } else {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => this._playMenuMusic());
    }
  }

  _button(x, y, label) {
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00110a',
      backgroundColor: '#00ff88',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#00e67a' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#00ff88' }));
    return btn;
  }

  _playMenuMusic() {
    if (this.menuMusic) return;
    if (this.cache.audio.exists('menuMusic')) {
      this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: 0.4 });
      this.menuMusic.play();
    }
  }

  _startGame() {
    // tiny start SFX if present
    if (this.cache.audio.exists('startSFX')) {
      this.sound.play('startSFX', { volume: 0.6 });
    }
    // fade menu music out
    if (this.menuMusic) {
      this.tweens.add({
        targets: this.menuMusic,
        volume: 0,
        duration: 400,
        onComplete: () => { this.menuMusic.stop(); this.menuMusic.destroy(); }
      });
    }
    const upgrades = this._getUpgrades();
    this.scene.start('GameScene', { upgrades });
  }

  _openUpgrades() {
    this.scene.start('UpgradeScene', { from: 'menu' });
  }

  _getUpgrades() {
    // default baseline
    const defaults = {
      scoreMult: 1,  // 1x, 2x, 3x, 4x, 5x, 10x cap handled in UpgradeScene
      speedBoost: 0, // extra cells / tick added gradually
      shield: 0,     // hits you can ignore
      slowMo: 0,     // temporary slow-mo charges
      magnet: 0      // fruit attractor level
    };
    try {
      const raw = localStorage.getItem('snakeUpgrades');
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }
}
