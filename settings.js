// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneSpeedPerCoin: 9,
  droneMaxSpeed: 260,
  droneCount: 3,
  // Homing drones appear every few seconds and steer straight at the player.
  homingSpeed: 85,
  homingSpawnSeconds: 9,
  homingMaxCount: 3,
  homingSpawnMinDistance: 250,
  // A shield appears every spawnMin..spawnMax seconds, stays for lifetime seconds,
  // and makes the player immune to drones for duration seconds once collected.
  shield: { spawnMinSeconds: 6, spawnMaxSeconds: 12, lifetimeSeconds: 6, durationSeconds: 5 },
  // localStorage key for the best score, so it survives page reloads.
  highScoreKey: 'coinDash.highScore',
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, homingDrone: 0xb06cff,
    shield: 0x4da3ff, shieldedPlayer: 0xbfe0ff, nebula: 0x8a5cff
  },
  // Each sound is a list of [waveform, startHz, endHz, seconds] steps played back to back.
  sounds: {
    volume: 0.2,
    coin: [['square', 988, 988, 0.07], ['square', 1319, 1319, 0.14]],
    hit: [['sawtooth', 440, 70, 0.6]],
    shield: [['triangle', 523, 1047, 0.12], ['triangle', 784, 1568, 0.18]]
  },
  effects: {
    // Sparkle burst when a coin is collected.
    coinBurst: { count: 28, speed: [70, 260], lifespan: 600, scale: [1.3, 0] },
    // Camera shake, red flash and explosion when a drone catches the player.
    hitShake: { duration: 250, intensity: 0.02 },
    hitBurst: { count: 45, speed: [80, 380], lifespan: 800, scale: [1.4, 0] },
    // The timer turns red and pulses for the final seconds.
    lowTimeSeconds: 10
  }
};
