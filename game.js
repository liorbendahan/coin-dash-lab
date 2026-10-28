/* global Phaser, COIN_DASH */
const hex = (color) => '#' + color.toString(16).padStart(6, '0');

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.createTextures();
    this.createBackground();
    this.createHud();
    this.halos = [];

    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player).setDepth(2);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.playerHalo = this.addHalo(this.player, c.colors.player, 1.6);
    this.trail = this.addTrail(this.player, c.colors.player, 0.45).setDepth(1);
    this.trail.emitting = false;

    this.coin = this.add.circle(100, 100, 9, c.colors.coin).setDepth(2);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.tweens.add({ targets: this.addHalo(this.coin, c.colors.coin, 1.3),
      scale: 1.8, alpha: 0.35, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.orbiters = [0, 1].map(() => this.add.image(0, 0, 'spark')
      .setScale(0.6).setBlendMode('ADD').setDepth(3));
    this.placeCoin();

    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone).setDepth(2);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
      this.addHalo(drone, c.colors.drone, 1.5);
      this.addTrail(drone, c.colors.drone, 0.35).setDepth(1);
      // Spinning is purely visual: arcade bodies ignore rotation.
      this.tweens.add({ targets: drone, angle: 360, duration: 1800 + i * 400, repeat: -1 });
    }

    this.coinBurst = this.add.particles(0, 0, 'spark', this.burstConfig(c.effects.coinBurst,
      [c.colors.coin, 0xffffff, 0xffe9a8])).setDepth(3);
    this.hitBurst = this.add.particles(0, 0, 'spark', this.burstConfig(c.effects.hitBurst,
      [c.colors.player, c.colors.drone, 0xffffff])).setDepth(3);

    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.playSound('coin');
      this.celebrateCoin(this.coin.x, this.coin.y);
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.finished) return;
      this.playSound('hit');
      this.explodePlayer();
      this.finish('A drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  // Textures are drawn at runtime, so the effects need no image assets.
  createTextures() {
    if (this.textures.exists('spark')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.clear();
    // Stacked translucent discs give a soft radial falloff for glows.
    for (let r = 32; r > 0; r--) g.fillStyle(0xffffff, 0.035).fillCircle(32, 32, r);
    g.generateTexture('glow', 64, 64);
    g.destroy();
  }

  createBackground() {
    const c = COIN_DASH;
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    [[0.25, 0.4, c.colors.player], [0.75, 0.7, c.colors.nebula]].forEach(([fx, fy, color], i) => {
      const cloud = this.add.image(c.width * fx, c.height * fy, 'glow')
        .setTint(color).setAlpha(0.13).setScale(9).setBlendMode('ADD');
      this.tweens.add({ targets: cloud, x: `+=${i ? -70 : 70}`, y: `+=${i ? 30 : -30}`, scale: 11,
        duration: 7000 + i * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: c.width }, y: { min: 44, max: c.height },
      lifespan: 4000, frequency: 70,
      speedX: { min: -6, max: 6 }, speedY: { min: -22, max: -6 },
      scale: { min: 0.2, max: 0.55 },
      alpha: { onEmit: () => 0, onUpdate: (p, key, t) => Math.sin(t * Math.PI) * 0.7 },
      blendMode: 'ADD'
    }).fastForward(4000);
  }

  createHud() {
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, 22, c.width, 44, 0x0a1120, 0.8).setDepth(10);
    this.add.rectangle(0, 43, c.width, 3, 0x24334b).setOrigin(0, 0.5).setDepth(10);
    this.timeBar = this.add.rectangle(0, 43, c.width, 3, c.colors.player).setOrigin(0, 0.5).setDepth(11);
    this.add.circle(28, 22, 8, c.colors.coin).setDepth(11);
    this.scoreText = this.add.text(44, 22, '0', { font: 'bold 20px monospace', color: hex(c.colors.coin) })
      .setOrigin(0, 0.5).setDepth(11);
    this.timeText = this.add.text(c.width - 18, 22, '', { font: 'bold 20px monospace', color: '#ffffff' })
      .setOrigin(1, 0.5).setDepth(11);
    this.shownSeconds = null;
  }

  addHalo(target, color, scale) {
    const halo = this.add.image(target.x, target.y, 'glow')
      .setTint(color).setScale(scale).setAlpha(0.6).setBlendMode('ADD').setDepth(1);
    this.halos.push([halo, target]);
    return halo;
  }

  addTrail(target, color, scale) {
    return this.add.particles(0, 0, 'glow', {
      follow: target, frequency: 25, lifespan: 350, speed: 0,
      scale: { start: scale, end: 0 }, alpha: { start: 0.45, end: 0 },
      tint: color, blendMode: 'ADD'
    });
  }

  burstConfig({ speed, lifespan, scale }, tint) {
    return {
      emitting: false,
      speed: { min: speed[0], max: speed[1] },
      angle: { min: 0, max: 360 },
      lifespan,
      scale: { start: scale[0], end: scale[1] },
      alpha: { start: 1, end: 0 },
      tint,
      blendMode: 'ADD'
    };
  }

  shockwave(x, y, color, toScale, duration) {
    const ring = this.add.circle(x, y, 12).setStrokeStyle(3, color).setDepth(3);
    this.tweens.add({ targets: ring, scale: toScale, alpha: 0, duration, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy() });
  }

  celebrateCoin(x, y) {
    const c = COIN_DASH;
    this.coinBurst.explode(c.effects.coinBurst.count, x, y);
    this.shockwave(x, y, c.colors.coin, 4, 420);
    const label = this.add.text(x, y - 14, '+1', { font: 'bold 22px monospace', color: hex(c.colors.coin) })
      .setOrigin(0.5).setDepth(3);
    this.tweens.add({ targets: label, y: y - 60, alpha: 0, duration: 750, ease: 'Cubic.easeOut',
      onComplete: () => label.destroy() });
    this.scoreText.setText(String(this.score));
    this.tweens.add({ targets: this.scoreText, scale: 1.35, duration: 90, yoyo: true });
  }

  explodePlayer() {
    const c = COIN_DASH;
    const { x, y } = this.player;
    this.cameras.main.shake(c.effects.hitShake.duration, c.effects.hitShake.intensity);
    this.cameras.main.flash(200, 255, 101, 122);
    this.hitBurst.explode(c.effects.hitBurst.count, x, y);
    this.shockwave(x, y, c.colors.drone, 7, 600);
    this.player.setVisible(false);
    this.playerHalo.setVisible(false);
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
    // A ring collapsing onto the new coin draws the eye to where it appeared.
    const ripple = this.add.circle(x, y, 10).setStrokeStyle(2, c.colors.coin).setScale(3.5).setAlpha(0).setDepth(3);
    this.tweens.add({ targets: ripple, scale: 1, alpha: 1, duration: 280, ease: 'Quad.easeIn',
      onComplete: () => ripple.destroy() });
  }

  // Sounds are synthesised with Web Audio, so the game still ships without audio assets.
  playSound(name) {
    const ctx = this.sound.context;
    if (!ctx) return; // Web Audio unavailable: play silently.
    const { volume } = COIN_DASH.sounds;
    let t = ctx.currentTime;
    for (const [type, from, to, seconds] of COIN_DASH.sounds[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      osc.connect(gain).connect(this.sound.destination);
      osc.start(t);
      osc.stop(t + seconds);
      t += seconds;
    }
  }

  update(time) {
    for (const [halo, target] of this.halos) halo.setPosition(target.x, target.y);
    const spin = time * 0.005;
    this.orbiters.forEach((o, i) => o.setPosition(
      this.coin.x + Math.cos(spin + i * Math.PI) * 17, this.coin.y + Math.sin(spin + i * Math.PI) * 17));
    if (this.finished) return;
    const c = COIN_DASH;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(c.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.trail.emitting = dx !== 0 || dy !== 0;
    const remaining = Math.max(0, this.deadline - this.time.now);
    const seconds = Math.ceil(remaining / 1000);
    this.timeBar.scaleX = remaining / (c.roundSeconds * 1000);
    if (seconds !== this.shownSeconds) {
      this.shownSeconds = seconds;
      this.timeText.setText(`${seconds}s`);
      if (seconds <= c.effects.lowTimeSeconds) {
        this.timeText.setColor(hex(c.colors.drone));
        this.timeBar.setFillStyle(c.colors.drone);
        this.tweens.add({ targets: this.timeText, scale: 1.3, duration: 120, yoyo: true });
      }
    }
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.trail.emitting = false;
    const c = COIN_DASH;
    const caught = this.player.visible === false;
    const accent = caught ? c.colors.drone : c.colors.coin;
    if (!caught) this.coinBurst.explode(60, c.width / 2, c.height / 2);
    const dim = this.add.rectangle(c.width / 2, c.height / 2, c.width, c.height, 0x05080f, 0)
      .setDepth(19);
    // When caught, hold the overlay back so the explosion plays out first.
    const delay = caught ? 350 : 0;
    this.tweens.add({ targets: dim, fillAlpha: 0.5, duration: 400, delay });
    const panel = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 180, 0x0a1120, 0.95).setStrokeStyle(2, accent),
      this.add.text(0, -46, reason, { font: 'bold 28px monospace', color: hex(accent) }).setOrigin(0.5),
      this.add.text(0, 22, `${this.score} coins collected\nPress R to try again`,
        { font: '20px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(20).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 380, delay: delay + 150, ease: 'Back.easeOut' });
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
