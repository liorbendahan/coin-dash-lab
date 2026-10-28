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
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, homingDrone: 0xb06cff
  },
  // Each sound is a list of [waveform, startHz, endHz, seconds] steps played back to back.
  sounds: {
    volume: 0.2,
    coin: [['square', 988, 988, 0.07], ['square', 1319, 1319, 0.14]],
    hit: [['sawtooth', 440, 70, 0.6]]
  }
};
