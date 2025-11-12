// === FEATURE TOGGLES ===
const ENABLE_AUDIO      = true;
const ENABLE_PARTICLES  = true;
const ENABLE_POWERUPS   = true;
const ENABLE_OBSTACLES  = true;
// ========================

const CELL = 24, COLS = 18, ROWS = 26;
const TICK_START = 120, TICK_MIN = 55, SPEEDUP_EVERY = 4;

const POWERUP_CHANCE = 0.18;
const POWERUP_TIME   = 4000;
const LEVEL_EVERY    = 6;

let score = 0, level = 1;
const loadHigh = () => +localStorage.getItem('snake_high') || 0;
const saveHigh = s => { if (s > loadHigh()) localStorage.setItem('snake_high', s); };

class SnakeScene extends Phaser.Scene {
  constructor(){ super('snake'); }

  create(){
    this.scale.resize(COLS*CELL, ROWS*CELL);
    this.cameras.main.setBackgroundColor('#111');
    this.addGrid();

    // Audio unlock
    this.ac = null; this.userInteracted = false;
    if (ENABLE_AUDIO){
      const unlock = () => {
        if (this.userInteracted) return; this.userInteracted = true;
        try { this.ac = new (window.AudioContext||window.webkitAudioContext)(); this.ac.resume?.(); } catch {}
      };
      this.input.on('pointerdown', unlock);
      this.input.keyboard.on('keydown', unlock);
    }
    this.beep = (f=440, dur=0.08, g=0.07) => {
      if (!ENABLE_AUDIO || !this.ac) return;
      try {
        const o=this.ac.createOscillator(), a=this.ac.createGain();
        o.type='square'; o.frequency.value=f; a.gain.value=g;
        o.connect(a); a.connect(this.ac.destination); o.start();
        setTimeout(()=>{ try{o.stop();}catch{} }, dur*1000);
      } catch {}
    };

    // Simple particle burst
    this.burst = (x,y,t=0xff4444)=>{
      if (!ENABLE_PARTICLES) return;
      for (let i=0;i<10;i++){
        const dx=Phaser.Math.Between(-8,8), dy=Phaser.Math.Between(-8,8);
        const r=this.add.rectangle(x+dx,y+dy,3,3,t).setDepth(10);
        this.tweens.add({targets:r,alpha:0,duration:220,onComplete:()=>r.destroy()});
      }
    };

    // Init state
    this.snake = [];         // define BEFORE any calls that read it
    this.obstacles = [];
    this.power = null;
    this.mod = null; this.modUntil = 0;

    this.resetGame();
    this.initInput();
    this.render();
    this.updateHud();

    // Stable loop
    this.tickDelay = TICK_START;
    this.lastTick = this.time.now;
    this.time.addEvent({
      loop:true, delay:16,
      callback:()=>{
        const now=this.time.now;
        if (now - this.lastTick >= this.tickDelay){
          this.lastTick = now;
          this.tick();
        }
      }
    });
  }

  addGrid(){
    const g=this.add.graphics();
    g.lineStyle(1,0x222222,1);
    for(let x=0;x<=COLS;x++) g.lineBetween(x*CELL,0,x*CELL,ROWS*CELL);
    for(let y=0;y<=ROWS;y++) g.lineBetween(0,y*CELL,COLS*CELL,y*CELL);
  }

  resetGame(){
    const cx=Math.floor(COLS/2), cy=Math.floor(ROWS/2);
    this.snake=[{x:cx+1,y:cy},{x:cx,y:cy},{x:cx-1,y:cy}];
    this.dir={x:1,y:0}; this.nextDir={x:1,y:0};
    this.dead=false; this.eaten=0; score=0; level=1;

    this.obstacles = ENABLE_OBSTACLES ? [] : [];
    this.power     = ENABLE_POWERUPS  ? null : null;
    this.mod = null; this.modUntil = 0;

    this.gfx?.destroy(); this.gfx=this.add.graphics();

    // food AFTER snake exists
    this.food=this.randEmpty();

    this.tickDelay = TICK_START; this.lastTick=this.time.now;
  }

  // Defensive occupied(): tolerate undefined structures
  occupied(p){
    const snake = this.snake || [];
    const food  = this.food  || null;
    const power = (ENABLE_POWERUPS ? this.power : null) || null;
    const obs   = (ENABLE_OBSTACLES ? this.obstacles : []) || [];

    if (snake.find(s=>s.x===p.x&&s.y===p.y)) return true;
    if (food && food.x===p.x && food.y===p.y) return true;
    if (power && power.x===p.x && power.y===p.y) return true;
    if (obs.find(o=>o.x===p.x&&o.y===p.y)) return true;
    return false;
  }

  randEmpty(){
    for (let guard=0; guard<500; guard++){
      const p={x:Phaser.Math.Between(0,COLS-1), y:Phaser.Math.Between(0,ROWS-1)};
      if (!this.occupied(p)) return p;
    }
    // fallback
    return {x:0,y:0};
  }

  initInput(){
    this.input.keyboard.on('keydown', e=>{
      const k=e.key.toLowerCase();
      if ((k==='w'||k==='arrowup')    && this.dir.y!==1)  this.nextDir={x:0,y:-1};
      if ((k==='s'||k==='arrowdown')  && this.dir.y!==-1) this.nextDir={x:0,y:1};
      if ((k==='a'||k==='arrowleft')  && this.dir.x!==1)  this.nextDir={x:-1,y:0};
      if ((k==='d'||k==='arrowright') && this.dir.x!==-1) this.nextDir={x:1,y:0};
      if (k==='r' && this.dead) this.resetAndRedraw();
    });
    let sx=0, sy=0;
    this.input.on('pointerdown', p=>{ sx=p.x; sy=p.y; });
    this.input.on('pointerup', p=>{
      const dx=p.x-sx, dy=p.y-sy;
      if (Math.abs(dx)>Math.abs(dy)) {
        if (dx>0 && this.dir.x!==-1) this.nextDir={x:1,y:0};
        if (dx<0 && this.dir.x!== 1) this.nextDir={x:-1,y:0};
      } else {
        if (dy>0 && this.dir.y!==-1) this.nextDir={x:0,y:1};
        if (dy<0 && this.dir.y!== 1) this.nextDir={x:0,y:-1};
      }
    });
  }

  tick(){
    if (this.dead) return;

    if (ENABLE_POWERUPS && this.mod && this.time.now > this.modUntil){
      this.mod=null; this.tickDelay=this.currentDelay();
    }

    this.dir=this.nextDir;
    const head={
      x:(this.snake[0].x+this.dir.x+COLS)%COLS,
      y:(this.snake[0].y+this.dir.y+ROWS)%ROWS
    };

    const hitSelf = this.snake.find(s=>s.x===head.x&&s.y===head.y);
    const hitObs  = ENABLE_OBSTACLES && this.obstacles.find(o=>o.x===head.x&&o.y===head.y);
    if (hitSelf || hitObs){
      this.dead=true; saveHigh(score);
      this.beep(120,0.2,0.1);
      this.gameOverText(); return;
    }

    this.snake.unshift(head);

    // power-up
    if (ENABLE_POWERUPS && this.power && head.x===this.power.x && head.y===this.power.y){
      this.applyPower(this.power.type);
      this.power=null;
      this.snake.push({...this.snake[this.snake.length-1]});
    }

    // food
    if (head.x===this.food.x && head.y===this.food.y){
      const mult = (ENABLE_POWERUPS && this.mod==='double') ? 2 : 1;
      score += 1*mult; this.eaten++;

      this.burst(head.x*CELL+CELL/2, head.y*CELL+CELL/2, 0xff4444);
      this.beep(880,0.06,0.08);

      if (ENABLE_POWERUPS && Math.random() < POWERUP_CHANCE) this.spawnPower();
      this.food = this.randEmpty();

      if (this.eaten % SPEEDUP_EVERY === 0){ level++; this.tickDelay = this.currentDelay(); }
      if (ENABLE_OBSTACLES && this.eaten % LEVEL_EVERY === 0){ this.addObstacle(); }
    } else {
      this.snake.pop();
    }

    this.render();
    this.updateHud();
  }

  currentDelay(){
    let d = Math.max(TICK_MIN, TICK_START - (level-1)*8);
    if (ENABLE_POWERUPS && this.mod==='fast') d = Math.max(TICK_MIN, d - 25);
    if (ENABLE_POWERUPS && this.mod==='slow') d = d + 40;
    return d;
  }

  addObstacle(){ if (ENABLE_OBSTACLES) this.obstacles.push(this.randEmpty()); }
  spawnPower(){
    const types=['fast','slow','double'];
    this.power={...this.randEmpty(), type: types[Phaser.Math.Between(0,types.length-1)]};
  }
  applyPower(type){
    this.mod=type; this.modUntil=this.time.now + POWERUP_TIME;
    this.tickDelay=this.currentDelay();
    const tint = type==='fast'?0x66ccff : type==='slow'?0xffff66 : 0xff66ff;
    const h=this.snake[0]; this.burst(h.x*CELL+CELL/2, h.y*CELL+CELL/2, tint);
    if (type==='fast')   this.beep(1200,0.07,0.08);
    if (type==='slow')   this.beep(300,0.12,0.06);
    if (type==='double') this.beep(700,0.09,0.09);
  }

  render(){
    this.gfx.clear();
    // food
    this.gfx.fillStyle(0xff4444,1);
    this.gfx.fillRect(this.food.x*CELL, this.food.y*CELL, CELL, CELL);
    // power-up
    if (ENABLE_POWERUPS && this.power){
      const c = this.power.type==='fast'?0x66ccff : this.power.type==='slow'?0xffff66 : 0xff66ff;
      this.gfx.fillStyle(c,1);
      this.gfx.fillRect(this.power.x*CELL, this.power.y*CELL, CELL, CELL);
    }
    // obstacles
    if (ENABLE_OBSTACLES){
      this.gfx.fillStyle(0x888888,1);
      for (const o of this.obstacles) this.gfx.fillRect(o.x*CELL, o.y*CELL, CELL, CELL);
    }
    // snake
    for (let i=0;i<this.snake.length;i++){
      const s=this.snake[i];
      this.gfx.fillStyle(i===0?0x00ffaa:0x00ff88,1);
      this.gfx.fillRect(s.x*CELL, s.y*CELL, CELL, CELL);
    }
  }

  updateHud(){
    const hud=document.getElementById('hud');
    const hi=Math.max(loadHigh(), score);
    hud.textContent = `Score: ${score} | High: ${hi} | Lv: ${level}` +
      (ENABLE_POWERUPS && this.mod ? ` | ${this.mod.toUpperCase()}` : '');
  }

  gameOverText(){
    const w=this.scale.gameSize.width, h=this.scale.gameSize.height;
    const t1=this.add.text(w/2,h/2-12,'GAME OVER',{font:'bold 22px monospace',fill:'#f55'}).setOrigin(0.5);
    const t2=this.add.text(w/2,h/2+16,'Tap/Swipe or press R to restart',{font:'14px monospace',fill:'#ccc'}).setOrigin(0.5);
    this.input.once('pointerdown', ()=>{ t1.destroy(); t2.destroy(); this.resetAndRedraw(); });
  }

  resetAndRedraw(){ this.resetGame(); this.render(); this.updateHud(); }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COLS*CELL,
  height: ROWS*CELL,
  pixelArt: true,
  backgroundColor: '#111',
  scene: [SnakeScene]
});
