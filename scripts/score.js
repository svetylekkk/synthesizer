/* ==========================================================================
   Партитура сада — музыкальный материал инструмента.
   Тональность ре мажор, темп 90 BPM.
   Каждый пэд: notes — что звучит, key — клавиша (физическая, работает
   в любой раскладке), label — подпись.
   ========================================================================== */

const SCORE = {
  bpm: 90,
  // Время суток: солнце плавно переводит сад между этими состояниями.
  // light — яркость (частота общего low-pass), air — сколько общего зала,
  // presence — насколько слышен каждый голос в этот час.
  day: [
    { name: 'рассвет', light: 6000, air: 0.25, presence: { drops: 1, wind: 1, hearts: 0.5, stars: 0.6 } },
    { name: 'полдень', light: 18000, air: 0.1, presence: { drops: 1, wind: 0.8, hearts: 1, stars: 0.7 } },
    { name: 'закат', light: 3500, air: 0.35, presence: { drops: 0.8, wind: 1, hearts: 0.9, stars: 0.8 } },
    { name: 'ночь', light: 1400, air: 0.55, presence: { drops: 0.6, wind: 0.7, hearts: 0.5, stars: 1 } }
  ],
  voices: {
    // A · капли — ноты пентатоники, любая мелодия звучит согласно
    drops: [
      { notes: ['D4'], key: 'a', label: 'D4' },
      { notes: ['E4'], key: 's', label: 'E4' },
      { notes: ['F#4'], key: 'd', label: 'F#4' },
      { notes: ['A4'], key: 'f', label: 'A4' },
      { notes: ['B4'], key: 'g', label: 'B4' },
      { notes: ['D5'], key: 'h', label: 'D5' },
      { notes: ['E5'], key: 'j', label: 'E5' },
      { notes: ['F#5'], key: 'k', label: 'F#5' }
    ],
    // B · ветер — аккорды «времени суток»
    wind: [
      { notes: ['D3', 'A3', 'F#4'], key: 'z', label: 'рассвет' },
      { notes: ['B2', 'F#3', 'D4'], key: 'x', label: 'тень' },
      { notes: ['G2', 'D3', 'B3'], key: 'c', label: 'полдень' },
      { notes: ['A2', 'E3', 'C#4'], key: 'v', label: 'закат' }
    ],
    // C · сердце — бас пульсом «тук-тук» в темпе, корни тех же аккордов
    hearts: [
      { notes: ['D2'], key: '1', label: 'D' },
      { notes: ['B1'], key: '2', label: 'Bm' },
      { notes: ['G1'], key: '3', label: 'G' },
      { notes: ['A1'], key: '4', label: 'A' }
    ],
    // D · звёзды — арпеджио по аккорду, пока держишь
    stars: [
      { notes: ['D5', 'F#5', 'A5', 'D6'], key: '7', label: 'D' },
      { notes: ['B4', 'D5', 'F#5', 'B5'], key: '8', label: 'Bm' },
      { notes: ['G4', 'B4', 'D5', 'G5'], key: '9', label: 'G' },
      { notes: ['A4', 'C#5', 'E5', 'A5'], key: '0', label: 'A' }
    ]
  }
}
