// scenes/BootScene.js
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Add a simple loading text while assets load
    this.loadText = this.add.text(160, 120, 'Loading...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00ff88'
    }).setOrigin(0.5);

    // Load music and assets for menu and upgrades
    this.load.audio('menuMusic', 'assets/music/menu_theme.mp3');
    this.load.audio('gameMusic', 'assets/music/game_theme.mp3');
    this.load.audio('startSFX', 'assets/sfx/start.wav');

    // Load example sprites (you’ll later add your own)
    this.load.image('logo', 'assets/logo.png');
    this.load.image('snake', 'assets/snake.png');
    this.load.image('fruit', 'assets/fruit.png');
  }

  create() {
    // After loading, go to the main menu
    this.scene.start('MenuScene');
  }
}
