// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a },
  // Each sound is a list of [waveform, startHz, endHz, seconds] steps played back to back.
  sounds: {
    volume: 0.2,
    coin: [['square', 988, 988, 0.07], ['square', 1319, 1319, 0.14]],
    hit: [['sawtooth', 440, 70, 0.6]]
  }
};
