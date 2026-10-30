/* ==========================================================================
   Описание панелей голосов: подпись, сад и какие ручки вынесены у каждого
   эффекта цепочки. prop — имя параметра в Tone.js; commit — применять
   после отпускания (для тяжёлых параметров вроде Reverb.decay).
   ========================================================================== */

const pct = { min: 0, max: 1, format: format.pct }

const VOICE_PANELS = [
  {
    voice: 'drops',
    tag: 'A · капли',
    garden: DropsGarden,
    chain: [
      {
        effect: 'filter',
        name: 'filter',
        knobs: [
          { prop: 'frequency', name: 'частота', min: 400, max: 12000, scale: 'log', format: format.hz },
          { prop: 'Q', name: 'резон.', min: 0.1, max: 10, format: format.q }
        ]
      },
      {
        effect: 'delay',
        name: 'ping-pong',
        knobs: [
          { prop: 'feedback', name: 'повторы', min: 0, max: 0.8, format: format.pct },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      },
      {
        effect: 'reverb',
        name: 'reverb',
        knobs: [
          { prop: 'decay', name: 'хвост', min: 1, max: 10, format: format.sec, commit: true },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      }
    ]
  },
  {
    voice: 'wind',
    tag: 'B · ветер',
    garden: WindGarden,
    chain: [
      {
        effect: 'autoFilter',
        name: 'auto filter',
        knobs: [
          { prop: 'frequency', name: 'порыв', min: 0.05, max: 4, scale: 'log', format: format.rate },
          { prop: 'depth', name: 'глубина', ...pct }
        ]
      },
      {
        effect: 'chorus',
        name: 'chorus',
        knobs: [
          { prop: 'depth', name: 'ширина', ...pct },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      },
      {
        effect: 'reverb',
        name: 'reverb',
        knobs: [
          { prop: 'decay', name: 'хвост', min: 1, max: 12, format: format.sec, commit: true },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      }
    ]
  },
  {
    voice: 'hearts',
    tag: 'C · сердце',
    garden: HeartsGarden,
    chain: [
      {
        effect: 'distortion',
        name: 'distortion',
        knobs: [
          { prop: 'distortion', name: 'тепло', ...pct },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      },
      {
        effect: 'filter',
        name: 'filter',
        knobs: [
          { prop: 'frequency', name: 'частота', min: 100, max: 4000, scale: 'log', format: format.hz },
          { prop: 'Q', name: 'резон.', min: 0.1, max: 10, format: format.q }
        ]
      },
      {
        effect: 'compressor',
        name: 'compressor',
        knobs: [
          { prop: 'threshold', name: 'порог', min: -48, max: 0, format: format.db },
          { prop: 'ratio', name: 'сжатие', min: 1, max: 12, format: (v) => v.toFixed(1) + ':1' }
        ]
      }
    ]
  },
  {
    voice: 'stars',
    tag: 'D · звёзды',
    garden: StarsGarden,
    chain: [
      {
        effect: 'vibrato',
        name: 'vibrato',
        knobs: [
          { prop: 'frequency', name: 'скорость', min: 0.5, max: 12, format: format.rate },
          { prop: 'depth', name: 'глубина', ...pct }
        ]
      },
      {
        effect: 'delay',
        name: 'delay',
        knobs: [
          { prop: 'feedback', name: 'повторы', min: 0, max: 0.8, format: format.pct },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      },
      {
        effect: 'phaser',
        name: 'phaser',
        knobs: [
          { prop: 'frequency', name: 'скорость', min: 0.1, max: 4, scale: 'log', format: format.rate },
          { prop: 'wet', name: 'микс', ...pct }
        ]
      }
    ]
  }
]
