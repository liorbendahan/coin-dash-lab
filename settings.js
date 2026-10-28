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
  // Spacebar multiplies the player's speed for duration seconds; the cooldown starts when the dash ends.
  dash: { speedMultiplier: 2.5, durationSeconds: 0.5, cooldownSeconds: 3 },
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, homingDrone: 0xb06cff,
    shield: 0x4da3ff, shieldedPlayer: 0xbfe0ff
  },
  // Each sound is a list of [waveform, startHz, endHz, seconds] steps played back to back.
  sounds: {
    volume: 0.2,
    coin: [['square', 988, 988, 0.07], ['square', 1319, 1319, 0.14]],
    hit: [['sawtooth', 440, 70, 0.6]],
    shield: [['triangle', 523, 1047, 0.12], ['triangle', 784, 1568, 0.18]]
  }
};
