/* ==========================================================================
   Звуковой движок.
   Каждый голос: Synth → своя цепочка эффектов → свой Channel (громкость,
   панорама, mute) → Presence (громкость голоса в этот час суток).
   Голоса разведены по стерео.

   drops  (A) Капли   FMSynth   → Filter → PingPongDelay → Reverb     → L 60
   wind   (B) Ветер   Synth     → AutoFilter → Chorus → Reverb        → R 60
   hearts (C) Сердце  MonoSynth → Distortion → Filter → Compressor    → L 15
   stars  (D) Звёзды  Synth     → Vibrato → FeedbackDelay → Phaser    → R 30
   Все голоса → Day: Light (low-pass) → Air (reverb) → Master →
   выход + осциллограф + L/R-метры + Recorder

   Способ игры (play): 'hold' — звучит, пока держишь;
   'loop' — пока держишь, повторяется ритмический рисунок в темпе.
   ========================================================================== */

const Engine = (() => {
  Tone.Transport.bpm.value = SCORE.bpm

  const master = new Tone.Channel({ volume: -4 }).toDestination()
  const waveform = new Tone.Waveform(512)
  const recorder = new Tone.Recorder()
  const split = new Tone.Split()
  const meters = {
    left: new Tone.Meter({ smoothing: 0.85 }),
    right: new Tone.Meter({ smoothing: 0.85 })
  }
  master.fan(waveform, recorder, split)
  split.connect(meters.left, 0, 0)
  split.connect(meters.right, 1, 0)

  // Слой времени суток — общий для всех голосов
  const day = {
    light: new Tone.Filter({ type: 'lowpass', frequency: 18000, rolloff: -12 }),
    air: new Tone.Reverb({ decay: 5, wet: 0.1 })
  }
  day.light.chain(day.air, master)

  function createVoice({ synth, effects, pan, play = 'hold', loop }) {
    const channel = new Tone.Channel({ volume: -6, pan })
    const presence = new Tone.Gain(1)
    synth.chain(...Object.values(effects), channel, presence, day.light)
    return { synth, effects, channel, presence, play, loop }
  }

  const voices = {
    drops: createVoice({
      pan: -0.6,
      synth: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 8,
        envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
        volume: -8
      }),
      effects: {
        filter: new Tone.Filter({ type: 'lowpass', frequency: 5000, Q: 0.7 }),
        delay: new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 }),
        reverb: new Tone.Reverb({ decay: 4, wet: 0.35 })
      }
    }),

    wind: createVoice({
      pan: 0.6,
      synth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
        envelope: { attack: 0.35, decay: 0.5, sustain: 0.8, release: 2 },
        volume: -5
      }),
      effects: {
        autoFilter: new Tone.AutoFilter({
          frequency: 0.2,
          baseFrequency: 500,
          octaves: 2.5,
          depth: 0.6
        }).start(),
        chorus: new Tone.Chorus({ frequency: 0.8, delayTime: 4, depth: 0.6, wet: 0.5 }).start(),
        reverb: new Tone.Reverb({ decay: 6, wet: 0.45 })
      }
    }),

    hearts: createVoice({
      pan: -0.15,
      play: 'loop',
      // «тук-тук» на каждую четверть
      loop: { steps: ([note]) => [note, note, null, null], subdivision: '16n', length: '16n' },
      synth: new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 2, rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.4 },
        filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.4, baseFrequency: 80, octaves: 3 },
        volume: -14
      }),
      effects: {
        distortion: new Tone.Distortion({ distortion: 0.3, wet: 0.4 }),
        filter: new Tone.Filter({ type: 'lowpass', frequency: 900, Q: 1 }),
        compressor: new Tone.Compressor({ threshold: -24, ratio: 4 })
      }
    }),

    stars: createVoice({
      pan: 0.3,
      play: 'loop',
      // арпеджио вверх-вниз шестнадцатыми
      loop: { steps: (notes) => [...notes, ...notes.slice(1, -1).reverse()], subdivision: '16n', length: '32n' },
      synth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.2 },
        volume: -13
      }),
      effects: {
        vibrato: new Tone.Vibrato({ frequency: 5, depth: 0.1 }),
        delay: new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 0.35 }),
        phaser: new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 800, wet: 0.4 })
      }
    })
  }

  // Фаза суток 0…1 → плавное смешивание двух соседних состояний из SCORE.day
  function setDay(phase) {
    const n = SCORE.day.length
    const p = (((phase % 1) + 1) % 1) * n
    const from = SCORE.day[Math.floor(p)]
    const to = SCORE.day[(Math.floor(p) + 1) % n]
    const t = p - Math.floor(p)
    const mix = (a, b) => a + (b - a) * t
    day.light.frequency.rampTo(Math.exp(mix(Math.log(from.light), Math.log(to.light))), 0.05)
    day.air.wet.rampTo(mix(from.air, to.air), 0.05)
    for (const voice in voices) {
      voices[voice].presence.gain.rampTo(mix(from.presence[voice], to.presence[voice]), 0.05)
    }
    return SCORE.day[Math.round(p) % n]
  }

  /* Каждая прозвучавшая нота сообщается слушателю (лупер её записывает):
     onHit(voice, index, notes, time, duration). Ноты «держащих» голосов
     сообщаются при отпускании, ноты циклов — на каждом шаге. */
  let onHit = () => {}
  const heldSince = {} // 'drops:3' → время нажатия

  // Цикл стартует с ближайшей доли сетки — первой нотой рисунка, поэтому
  // даже короткое касание звучит, а рисунок остаётся в темпе.
  const loops = {} // 'stars:2' → { sequence, startTick }

  function attack(voice, index, notes) {
    const v = voices[voice]
    const id = `${voice}:${index}`
    if (v.play === 'hold') {
      heldSince[id] = Tone.now()
      return v.synth.triggerAttack(notes)
    }
    if (Tone.Transport.state !== 'started') Tone.Transport.start()
    const { steps, subdivision, length } = v.loop
    const startTick = Tone.Transport.getTicksAtTime(Tone.Transport.nextSubdivision(subdivision))
    const sequence = new Tone.Sequence(
      (time, note) => {
        if (!note) return
        v.synth.triggerAttackRelease(note, length, time)
        onHit(voice, index, [note], time, Tone.Time(length).toSeconds())
      },
      steps(notes),
      subdivision
    ).start(`${startTick}i`)
    loops[id] = { sequence, startTick }
  }

  function release(voice, index, notes) {
    const v = voices[voice]
    const id = `${voice}:${index}`
    if (v.play === 'hold') {
      v.synth.triggerRelease(notes)
      onHit(voice, index, notes, heldSince[id], Tone.now() - heldSince[id])
      delete heldSince[id]
      return
    }
    if (!loops[id]) return
    const { sequence, startTick } = loops[id]
    delete loops[id]
    // не обрываем раньше первой ноты
    sequence.stop(`${Math.max(Tone.Transport.ticks, startTick + 1)}i`)
    setTimeout(() => sequence.dispose(), 1000)
  }

  // Сыграть готовую ноту в заданное время — так звучат лупы и повтор записи
  const play = (voice, notes, duration, time) =>
    voices[voice].synth.triggerAttackRelease(notes, duration, time)

  return {
    master,
    voices,
    waveform,
    recorder,
    meters,
    attack,
    release,
    play,
    setDay,
    listen: (fn) => (onHit = fn)
  }
})()
