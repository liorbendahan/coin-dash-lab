/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.paused = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    // The halo sits behind the player and is only shown while the shield is active.
    this.halo = this.add.circle(c.width / 2, c.height / 2, 24, c.colors.shield, 0.35)
      .setStrokeStyle(3, c.colors.shield).setVisible(false);
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.shield = this.add.circle(0, 0, 11, c.colors.shield).setStrokeStyle(3, 0xffffff, 0.8);
    this.physics.add.existing(this.shield);
    this.shield.body.setCircle(11);
    this.hideShield();
    this.shieldUntil = 0; // Time when the player's invincibility runs out.
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.playSound('coin');
      this.placeCoin();
      this.speedUpDrones();
    });
    this.physics.add.overlap(this.player, this.shield, () => {
      if (this.finished || !this.shield.visible) return;
      this.shieldUntil = this.time.now + c.shield.durationSeconds * 1000;
      this.playSound('shield');
      this.hideShield();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.finished || this.isShielded()) return;
      this.playSound('hit');
      this.finish('A drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 150, 0x0a1120, 0.95),
      this.add.text(0, 0, 'Paused\nPress P or ESC to resume',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(10).setVisible(false);
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
    } else {
      // Push the deadline back so time spent paused does not count against the round.
      const pausedFor = this.time.now - this.pausedAt;
      this.deadline += pausedFor;
      // Shield timers freeze while paused too.
      this.nextShieldAt += pausedFor;
      this.shieldExpiresAt += pausedFor;
      if (this.shieldUntil > this.pausedAt) this.shieldUntil += pausedFor;
      this.physics.resume();
    }
    this.pauseOverlay.setVisible(this.paused);
  }

  placeCoin() {
    this.placeAwayFromPlayer(this.coin);
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
    this.halo.setVisible(shielded && !fading)
      .setPosition(this.player.x, this.player.y)
      .setScale(1 + 0.12 * Math.sin(now / 90));
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

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.updateShield();
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const shieldLeft = Math.ceil((this.shieldUntil - this.time.now) / 1000);
    const shieldText = this.isShielded() ? `   Shield: ${shieldLeft}s` : '';
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s${shieldText}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
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
