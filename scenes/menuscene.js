// MenuScene.js
class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // Add retro-style title text
    this.add.text(160, 100, 'SNAKE 8-BIT', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#00ff88'
    }).setOrigin(0.5);

    // Add "Press SPACE to Start"
    this.startText = this.add.text(160, 200, 'Press SPACE to Start', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Add background music
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: 0.5 });
    this.menuMusic.play();

    // Animate the start text (blinking)
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.startText.visible = !this.startText.visible;
      }
    });

    // Space key starts the game
    this.input.keyboard.once('keydown-SPACE', () => {
      this.sound.play('startSfx');
      this.menuMusic.stop();
      this.scene.start('UpgradeScene');
    });
  }
}
// ... your MenuScene class definition ...
window.MenuScene = MenuScene;
