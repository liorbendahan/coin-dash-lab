/* global Phaser, COIN_DASH */
const hex = (color) => '#' + color.toString(16).padStart(6, '0');

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.beatHighScore = false;
    this.finished = false;
    this.paused = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.createTextures();
    this.createBackground();
    this.createHud();
    this.halos = [];
    this.droneTrails = [];

    // The shield halo sits behind the player and is only shown while the shield is active.
    this.shieldHalo = this.add.circle(c.width / 2, c.height / 2, 24, c.colors.shield, 0.35)
      .setStrokeStyle(3, c.colors.shield).setVisible(false).setDepth(1);
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player).setDepth(2);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.addHalo(this.player, c.colors.player, 1.6);
    this.trail = this.addTrail(this.player, c.colors.player, 0.45);
    this.trail.emitting = false;

    this.coin = this.add.circle(100, 100, 9, c.colors.coin).setDepth(2);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.tweens.add({ targets: this.addHalo(this.coin, c.colors.coin, 1.3),
      scale: 1.8, alpha: 0.35, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.orbiters = [0, 1].map(() => this.add.image(0, 0, 'spark')
      .setScale(0.6).setBlendMode('ADD').setDepth(3));
    this.placeCoin();

    this.shield = this.add.circle(0, 0, 11, c.colors.shield).setStrokeStyle(3, 0xffffff, 0.8).setDepth(2);
    this.physics.add.existing(this.shield);
    this.shield.body.setCircle(11);
    this.addHalo(this.shield, c.colors.shield, 1.4);
    this.hideShield();
    this.shieldUntil = 0; // Time when the player's invincibility runs out.

    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone).setDepth(2);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
      this.decorateDrone(drone, c.colors.drone, 1.5);
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
      this.updateHighScore();
      this.playSound('coin');
      this.celebrateCoin(this.coin.x, this.coin.y);
      this.placeCoin();
      this.speedUpDrones();
    });
    this.physics.add.overlap(this.player, this.shield, () => {
      if (this.finished || !this.shield.visible) return;
      this.shieldUntil = this.time.now + c.shield.durationSeconds * 1000;
      this.playSound('shield');
      this.shockwave(this.shield.x, this.shield.y, c.colors.shield, 4, 420);
      this.hideShield();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.finished || this.isShielded()) return;
      this.playSound('hit');
      this.explodePlayer();
      this.finish('A drone caught you!');
    });
    this.homingDrones = this.physics.add.group();
    this.homingTimer = this.time.addEvent({
      delay: c.homingSpawnSeconds * 1000, loop: true, callback: () => this.spawnHomingDrone()
    });
    this.physics.add.overlap(this.player, this.homingDrones, () => {
      if (this.finished || this.isShielded()) return;
      this.playSound('hit');
      this.explodePlayer();
      this.finish('A homing drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 150, 0x0a1120, 0.95).setStrokeStyle(2, c.colors.player),
      this.add.text(0, 0, 'Paused\nPress P or ESC to resume',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(20).setVisible(false);
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
      this.tweens.pauseAll();
      this.trail.emitting = false;
    } else {
      // Push the deadline back so time spent paused does not count against the round.
      const pausedFor = this.time.now - this.pausedAt;
      this.deadline += pausedFor;
      // Shield timers freeze while paused too.
      this.nextShieldAt += pausedFor;
      this.shieldExpiresAt += pausedFor;
      if (this.shieldUntil > this.pausedAt) this.shieldUntil += pausedFor;
      this.physics.resume();
      this.tweens.resumeAll();
    }
    // Stationary drones would pile their trail into a bright blob, so stop it while paused.
    this.droneTrails.forEach(trail => { trail.emitting = !this.paused; });
    this.homingTimer.paused = this.paused;
    this.pauseOverlay.setVisible(this.paused);
  }

  spawnHomingDrone() {
    const c = COIN_DASH;
    if (this.finished || this.homingDrones.countActive() >= c.homingMaxCount) return;
    // Spawn far enough from the player to give them a moment to react.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < c.homingSpawnMinDistance);
    const drone = this.add.rectangle(x, y, 22, 22, c.colors.homingDrone).setAngle(45).setDepth(2);
    this.homingDrones.add(drone);
    drone.body.setCollideWorldBounds(true);
    this.decorateDrone(drone, c.colors.homingDrone, 1.4);
    this.shockwave(x, y, c.colors.homingDrone, 4, 500);
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
    this.bestText = this.add.text(96, 22, `Best ${this.highScore}`, { font: '16px monospace', color: '#9fb0c8' })
      .setOrigin(0, 0.5).setDepth(11);
    this.shieldText = this.add.text(c.width / 2, 22, '', { font: 'bold 18px monospace', color: hex(c.colors.shield) })
      .setOrigin(0.5).setDepth(11);
    this.timeText = this.add.text(c.width - 18, 22, '', { font: 'bold 20px monospace', color: '#ffffff' })
      .setOrigin(1, 0.5).setDepth(11);
    this.shownSeconds = null;
  }

  // Halos follow their target and are hidden whenever it is.
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
    }).setDepth(1);
  }

  decorateDrone(drone, color, haloScale) {
    this.addHalo(drone, color, haloScale);
    this.droneTrails.push(this.addTrail(drone, color, 0.35));
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
    this.shieldHalo.setVisible(false);
  }

  // localStorage can throw (private mode, blocked storage), so fall back to 0 / skip saving.
  loadHighScore() {
    try {
      return Number(localStorage.getItem(COIN_DASH.highScoreKey)) || 0;
    } catch (e) {
      return 0;
    }
  }

  updateHighScore() {
    if (this.score <= this.highScore) return;
    this.highScore = this.score;
    this.beatHighScore = true;
    this.bestText.setText(`Best ${this.highScore}`).setColor(hex(COIN_DASH.colors.coin));
    try {
      localStorage.setItem(COIN_DASH.highScoreKey, String(this.highScore));
    } catch (e) { /* Storage unavailable: keep the high score for this session only. */ }
  }

  placeCoin() {
    this.placeAwayFromPlayer(this.coin);
    // A ring collapsing onto the new coin draws the eye to where it appeared.
    const ripple = this.add.circle(this.coin.x, this.coin.y, 10).setStrokeStyle(2, COIN_DASH.colors.coin)
      .setScale(3.5).setAlpha(0).setDepth(3);
    this.tweens.add({ targets: ripple, scale: 1, alpha: 1, duration: 280, ease: 'Quad.easeIn',
      onComplete: () => ripple.destroy() });
  }

  // Avoid spawning items directly underneath the player.
  placeAwayFromPlayer(item) {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    item.setPosition(x, y);
    item.body.reset(x, y);
  }

  showShield() {
    this.placeAwayFromPlayer(this.shield);
    this.shield.setVisible(true);
    this.shield.body.enable = true;
    this.shieldExpiresAt = this.time.now + COIN_DASH.shield.lifetimeSeconds * 1000;
  }

  // Removes the shield item from the map and schedules the next one.
  hideShield() {
    const { spawnMinSeconds, spawnMaxSeconds } = COIN_DASH.shield;
    this.shield.setVisible(false);
    this.shield.body.enable = false;
    this.shieldExpiresAt = Infinity;
    this.nextShieldAt = this.time.now + Phaser.Math.Between(spawnMinSeconds * 1000, spawnMaxSeconds * 1000);
  }

  isShielded() {
    return this.time.now < this.shieldUntil;
  }

  // Shows the shield pickup pulsing and the player glowing while invincible.
  updateShield() {
    const c = COIN_DASH;
    const now = this.time.now;
    if (this.shield.visible) {
      if (now >= this.shieldExpiresAt) this.hideShield();
      else this.shield.setScale(1 + 0.15 * Math.sin(now / 120));
    } else if (now >= this.nextShieldAt) {
      this.showShield();
    }
    const shielded = this.isShielded();
    // Blink during the last second so the player knows the shield is about to drop.
    const fading = shielded && this.shieldUntil - now < 1000 && Math.floor(now / 100) % 2 === 0;
    this.player.setFillStyle(shielded && !fading ? c.colors.shieldedPlayer : c.colors.player);
    this.shieldHalo.setVisible(shielded && !fading)
      .setPosition(this.player.x, this.player.y)
      .setScale(1 + 0.12 * Math.sin(now / 90));
    this.shieldText.setText(shielded ? `Shield ${Math.ceil((this.shieldUntil - now) / 1000)}s` : '');
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

  speedUpDrones() {
    const c = COIN_DASH;
    // Each coin makes the drones a little faster, keeping their current heading.
    const speed = Math.min(c.droneSpeed + this.score * c.droneSpeedPerCoin, c.droneMaxSpeed);
    this.drones.getChildren().forEach(drone => drone.body.velocity.setLength(speed));
  }

  update(time) {
    for (const [halo, target] of this.halos) halo.setPosition(target.x, target.y).setVisible(target.visible);
    const spin = time * 0.005;
    this.orbiters.forEach((o, i) => o.setPosition(
      this.coin.x + Math.cos(spin + i * Math.PI) * 17, this.coin.y + Math.sin(spin + i * Math.PI) * 17));
    if (this.finished || this.paused) return;
    const c = COIN_DASH;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(c.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.trail.emitting = dx !== 0 || dy !== 0;
    this.homingDrones.getChildren().forEach(drone =>
      this.physics.moveToObject(drone, this.player, c.homingSpeed));
    this.updateShield();
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
    this.homingTimer.remove();
    this.trail.emitting = false;
    this.droneTrails.forEach(trail => { trail.emitting = false; });
    this.shieldText.setText('');
    const c = COIN_DASH;
    const caught = this.player.visible === false;
    const accent = caught ? c.colors.drone : c.colors.coin;
    if (!caught) this.coinBurst.explode(60, c.width / 2, c.height / 2);
    const dim = this.add.rectangle(c.width / 2, c.height / 2, c.width, c.height, 0x05080f, 0)
      .setDepth(19);
    // When caught, hold the overlay back so the explosion plays out first.
    const delay = caught ? 350 : 0;
    this.tweens.add({ targets: dim, fillAlpha: 0.5, duration: 400, delay });
    const highScoreText = this.beatHighScore ? 'New high score!' : `High score: ${this.highScore}`;
    const body = { font: '20px monospace', color: '#ffffff' };
    const panel = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 210, 0x0a1120, 0.95).setStrokeStyle(2, accent),
      this.add.text(0, -62, reason, { font: 'bold 28px monospace', color: hex(accent) }).setOrigin(0.5),
      this.add.text(0, -14, `${this.score} coins collected`, body).setOrigin(0.5),
      this.add.text(0, 18, highScoreText, { font: 'bold 20px monospace',
        color: this.beatHighScore ? hex(c.colors.coin) : '#9fb0c8' }).setOrigin(0.5),
      this.add.text(0, 60, 'Press R to try again', body).setOrigin(0.5)
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
