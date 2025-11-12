// BootScene.js
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Preload audio and any assets needed early
    this.load.audio('menuMusic', 'assets/music/menu_theme.mp3');
    this.load.audio('gameMusic', 'assets/music/game_theme.mp3');
    this.load.audio('startSfx', 'assets/sfx/start.wav');
    this.load.audio('gameoverSfx', 'assets/sfx/gameover.wav');

    // You can add a simple loading text or bar
    const loadingText = this.add.text(200, 200, 'Loading...', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00ff88'
    }).setOrigin(0.5);

    this.load.on('complete', () => {
      loadingText.setText('Ready!');
    });
  }

  create() {
    // Move to the MenuScene after loading
    this.scene.start('MenuScene');
  }
}
// ... your BootScene class definition above ...
window.BootScene = BootScene;
