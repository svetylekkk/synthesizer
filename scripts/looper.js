/* ==========================================================================
   Looper — сад растёт слоями.
   Круг длиной 2/4/8 тактов. Кнопка ● на голосе записывает ровно один круг
   этого голоса, после чего слой повторяется, а играть поверх можно на
   других голосах. Повторная запись того же голоса добавляет новый слой.
   Перед самым первым слоем — отсчёт в один такт.

   Время считается в тиках транспорта: всё подтягивается к сетке
   шестнадцатых, поэтому слои не расходятся и меняют скорость вместе с темпом.
   Слой: { voice, start, end, hits: [{ pos, index, notes, length }], part }
   ========================================================================== */

const Looper = (() => {
  const STEP = Tone.Transport.PPQ / 4 // шестнадцатая в тиках
  const BEAT = Tone.Transport.PPQ // четверть
  const BAR = BEAT * 4 // такт 4/4
  const EARLY = STEP / 2 // нота чуть раньше начала записи тоже считается

  let bars = 4
  let origin = null // тик начала самого первого круга
  let recording = null // слой, который пишется сейчас
  let finishEvent = null
  let metronome = false
  let paused = false
  const layers = []
  let onPlay = () => {}

  const loopTicks = () => bars * BAR
  const now = () => Tone.Transport.ticks
  const wrap = (tick) => (((tick - origin) % loopTicks()) + loopTicks()) % loopTicks()
  const snap = (ticks) => Math.round(ticks / STEP) * STEP

  // Метроном: щелчки идут прямо на выход, мимо мастера, — в запись не попадают
  const click = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -14
  }).toDestination()
  new Tone.Loop((time) => {
    if (origin === null) return
    const tick = Tone.Transport.getTicksAtTime(time)
    const counting = tick < origin
    if (!counting && !metronome) return
    click.triggerAttackRelease(wrap(tick) % BAR === 0 ? 'C6' : 'G5', '32n', time)
  }, '4n').start(0)

  function record(voice) {
    if (recording) {
      const same = recording.voice === voice
      finish(Math.ceil(now() / STEP) * STEP)
      if (same) return
    }
    if (Tone.Transport.state !== 'started') Tone.Transport.start()
    let start = now()
    if (origin === null) {
      // первый слой: такт отсчёта с ближайшей доли, затем запись
      origin = Math.ceil(start / BEAT) * BEAT + BAR
    }
    // во время отсчёта запись любого голоса ждёт начала круга
    start = Math.max(start, origin)
    const layer = { voice, start, end: start + loopTicks(), hits: [], part: null }
    recording = layer
    // конец круга закрывает именно этот слой, даже если таймер сработает поздно
    finishEvent = Tone.Transport.scheduleOnce(() => {
      if (recording === layer) finish(layer.end)
    }, `${layer.end}i`)
  }

  // Запись окончена — слой начинает звучать с этого же места круга
  function finish(at) {
    if (finishEvent !== null) Tone.Transport.clear(finishEvent)
    finishEvent = null
    const layer = recording
    recording = null
    if (!layer) return
    layer.end = Math.min(layer.end, at)
    // слой создаём даже пустым: долгий аккорд, начатый в записи, придёт позже
    layer.part = new Tone.Part(
      (time, hit) => onPlay(layer.voice, hit, time),
      layer.hits.map((hit) => [`${hit.pos}i`, hit])
    )
    layer.part.loop = true
    layer.part.loopEnd = `${loopTicks()}i`
    layer.part.mute = paused
    layer.part.start(`${at}i`, `${wrap(at)}i`)
    layers.push(layer)
  }

  // Нота от движка: попадает в слой, если её начало внутри окна записи.
  // Долгая нота может прийти уже после конца круга — её дописываем в готовый слой.
  function capture(voice, index, notes, time, duration) {
    if (origin === null) return
    const tick = Tone.Transport.getTicksAtTime(time)
    const target =
      recording?.voice === voice && tick >= recording.start - EARLY && tick < recording.end
        ? recording
        : layers.findLast((l) => l.voice === voice && tick >= l.start - EARLY && tick < l.end)
    if (!target) return
    const hit = {
      pos: snap(wrap(tick)) % loopTicks(),
      index,
      notes,
      length: Math.min(loopTicks(), Math.max(STEP, snap(Tone.Time(duration).toTicks())))
    }
    target.hits.push(hit)
    target.part?.add(`${hit.pos}i`, hit)
  }

  function remove(layer) {
    layer.part?.dispose()
    layers.splice(layers.indexOf(layer), 1)
  }

  const voiceLayers = (voice) => layers.filter((l) => l.voice === voice && l.hits.length)

  function undo(voice) {
    if (recording?.voice === voice) return cancel()
    layers.filter((l) => l.voice === voice && !l.hits.length).forEach(remove)
    const last = voiceLayers(voice).at(-1)
    if (last) remove(last)
  }

  function clearVoice(voice) {
    if (recording?.voice === voice) cancel()
    layers.filter((l) => l.voice === voice).forEach(remove)
  }

  function cancel() {
    if (finishEvent !== null) Tone.Transport.clear(finishEvent)
    finishEvent = null
    recording = null
  }

  function clearAll() {
    cancel()
    ;[...layers].forEach(remove)
    origin = null
  }

  function setPaused(value) {
    paused = value
    layers.forEach((l) => (l.part.mute = value))
  }

  function status(voice) {
    const layerCount = voiceLayers(voice).length
    if (recording?.voice !== voice) return { state: 'idle', layers: layerCount, progress: 0 }
    const t = now()
    if (t < recording.start) return { state: 'counting', layers: layerCount, progress: 0 }
    return {
      state: 'recording',
      layers: layerCount,
      progress: (t - recording.start) / (recording.end - recording.start)
    }
  }

  return {
    record,
    capture,
    undo,
    clearVoice,
    clearAll,
    status,
    setPaused,
    setMetronome: (value) => (metronome = value),
    setBars: (value) => {
      if (origin === null) bars = value
    },
    listen: (fn) => (onPlay = fn),
    // положение в круге: доля 0…1 и номер доли; отрицательная доля — отсчёт
    position() {
      if (origin === null) return null
      const t = now()
      const beat = Math.floor((t - origin) / BEAT)
      return { progress: t < origin ? 0 : wrap(t) / loopTicks(), beat, beats: bars * 4 }
    },
    get bars() {
      return bars
    },
    get locked() {
      return origin !== null
    },
    get paused() {
      return paused
    },
    get hasLayers() {
      return layers.some((l) => l.hits.length)
    }
  }
})()
