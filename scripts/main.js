/* ==========================================================================
   Сборка инструмента: сцена ← UI-кит, звук ← Engine, слои ← Looper,
   запись пьесы ← Take. Здесь же — ввод: мышь/тач по пэдам и клавиатура.
   ========================================================================== */

/* ---------- Игра ---------- */

const pads = SCORE.voices
const held = new Set() // 'drops:3', 'stars:0' — что звучит сейчас

function press(voice, index, { fromTake = false } = {}) {
  const id = `${voice}:${index}`
  if (held.has(id)) return
  held.add(id)
  Tone.start()
  Engine.attack(voice, index, pads[voice][index].notes)
  gardens[voice].setActive(index, true)
  if (!fromTake) Take.log(voice, index, 'on')
}

function lift(voice, index, { fromTake = false } = {}) {
  const id = `${voice}:${index}`
  if (!held.has(id)) return
  held.delete(id)
  Engine.release(voice, index, pads[voice][index].notes)
  gardens[voice].setActive(index, false)
  if (!fromTake) Take.log(voice, index, 'off')
}

function releaseAll() {
  held.forEach((id) => {
    const [voice, index] = id.split(':')
    lift(voice, +index, { fromTake: true })
  })
}

/* ---------- Время суток ---------- */

let dayPhase = 0 // 0 рассвет · .25 полдень · .5 закат · .75 ночь
let dayName = SCORE.day[0].name
let glide = null

function setDay(phase, { fromTake = false } = {}) {
  dayPhase = phase
  dayName = Engine.setDay(phase).name
  if (!fromTake) Take.log('day', 0, 'set', { value: phase })
}

// Плавный переход солнца к нужному часу по короткой дуге
function glideDay(to) {
  cancelAnimationFrame(glide)
  const from = dayPhase
  const delta = ((to - from + 1.5) % 1) - 0.5
  const start = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1200)
    const eased = t * t * (3 - 2 * t)
    setDay((from + delta * eased + 1) % 1)
    if (t < 1) glide = requestAnimationFrame(step)
  }
  glide = requestAnimationFrame(step)
}

/* ---------- Лупер ---------- */

// Движок сообщает о каждой ноте — лупер забирает её в записываемый слой
Engine.listen(Looper.capture)

// Нота из слоя: звучит, отзывается в саду и попадает в запись пьесы
function playHit(voice, hit, time) {
  const duration = Tone.Ticks(hit.length).toSeconds()
  Engine.play(voice, hit.notes, duration, time)
  Take.log(voice, hit.index, 'hit', { notes: hit.notes, duration }, time - Tone.now())
  Tone.Draw.schedule(() => gardens[voice].echo(hit.index, duration * 1000), time)
}
Looper.listen(playHit)

async function recordLayer(voice) {
  await Tone.start()
  Looper.record(voice)
}

/* ---------- Запись пьесы ---------- */

// Пока звучит запись пьесы, лупы молчат — они уже есть внутри неё
let loopsWerePaused = false

async function stopTake() {
  const wasPlaying = Take.state === 'playing'
  await Take.stop()
  if (wasPlaying) endPlayback()
}

function endPlayback() {
  releaseAll()
  Looper.setPaused(loopsWerePaused)
}

async function toggleRecord() {
  if (Take.state === 'recording') return stopTake()
  await stopTake()
  await Tone.start()
  Take.record()
  // запись помнит, в каком часу суток она началась
  Take.log('day', 0, 'set', { value: dayPhase })
}

async function togglePlay() {
  if (Take.state === 'playing') return stopTake()
  if (Take.state === 'recording') await stopTake()
  await Tone.start()
  cancelAnimationFrame(glide)
  loopsWerePaused = Looper.paused
  Looper.setPaused(true)
  Take.play({
    onEvent: (e) => {
      if (e.voice === 'day') return setDay(e.value, { fromTake: true })
      if (e.type === 'hit') {
        Engine.play(e.voice, e.notes, e.duration)
        return gardens[e.voice].echo(e.index, e.duration * 1000)
      }
      ;(e.type === 'on' ? press : lift)(e.voice, e.index, { fromTake: true })
    },
    onEnd: endPlayback
  })
}

/* ---------- Сцена ---------- */

const gardens = {}
const layerControls = {}
const panels = VOICE_PANELS.map(({ voice, tag, garden, chain }) => {
  gardens[voice] = garden(pads[voice])
  layerControls[voice] = LayerControls({
    voice,
    onRecord: () => recordLayer(voice),
    onUndo: () => Looper.undo(voice),
    onClear: () => Looper.clearVoice(voice)
  })
  return VoicePanel({ voice, tag, garden: gardens[voice].root, chain, layers: layerControls[voice].root })
})

const loopStrip = LoopStrip({
  onBars: Looper.setBars,
  onMetronome: Looper.setMetronome,
  onPause: () => Looper.setPaused(!Looper.paused),
  onClear: Looper.clearAll
})

const sun = Sun({
  waveform: Engine.waveform,
  onChange: (phase) => {
    cancelAnimationFrame(glide)
    setDay(phase)
  }
})
const dayStrip = DayStrip({ phases: SCORE.day, onSelect: glideDay })
const transport = Transport({
  onRecord: toggleRecord,
  onPlay: togglePlay,
  onStop: stopTake,
  onDownload: Take.download,
  onClear: Take.clear
})
const timeline = Timeline({
  take: Take,
  lanes: [
    { voice: 'drops', name: 'капли', rows: pads.drops.length, height: 25, color: '#e2295a' },
    { voice: 'wind', name: 'ветер', rows: pads.wind.length, height: 25, color: '#5f72e4' },
    { voice: 'hearts', name: 'сердце', rows: pads.hearts.length, height: 25, color: '#f06bb4' },
    { voice: 'stars', name: 'звёзды', rows: pads.stars.length, height: 25, color: '#8b6cf0' }
  ]
})

const stage = document.getElementById('Stage')

const header = el('header', 'StageHeader')
header.append(
  loopStrip.root,
  transport.root,
  // темп — общий для ритмических голосов (сердце, звёзды)
  Stepper({
    param: 'transport.bpm',
    name: 'темп',
    value: SCORE.bpm,
    min: 60,
    max: 160,
    onChange: (bpm) => {
      Tone.Transport.bpm.value = bpm
      stage.style.setProperty('--beat', `${60 / bpm}s`)
    }
  })
)

const center = el('div', 'StageCenter')
center.append(
  sun.root,
  dayStrip.root,
  MasterStrip({ master: Engine.master, meters: Engine.meters })
)

// Сетка 2×2 вокруг центра: A · солнце · B / C · солнце · D
const main = el('div', 'StageMain')
main.append(panels[0], center, panels[1], panels[2], panels[3])

stage.append(header, main, timeline.root)

/* ---------- Ввод ---------- */

Object.keys(gardens).forEach((voice) =>
  bindPadInput(gardens[voice].root, {
    onDown: (i) => press(voice, i),
    onUp: (i) => lift(voice, i)
  })
)

// e.code — физическая клавиша, поэтому работает и в русской раскладке.
// Shift + клавиша голоса включает запись его слоя (см. keydown ниже).
const keyCode = (key) => (/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`)
const keymap = new Map(
  Object.entries(pads).flatMap(([voice, list]) => list.map((pad, i) => [keyCode(pad.key), [voice, i]]))
)

addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.code === 'Space' && !e.target.closest?.('button')) {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'KeyR') {
    toggleRecord()
  } else if (keymap.has(e.code)) {
    const [voice, index] = keymap.get(e.code)
    // Shift + клавиша голоса — записать круг этого голоса
    e.shiftKey ? recordLayer(voice) : press(voice, index)
  }
})
addEventListener('keyup', (e) => {
  if (keymap.has(e.code)) lift(...keymap.get(e.code))
})

/* ---------- Масштаб сцены и анимация ---------- */

function fitStage() {
  const scale = Math.min(innerWidth / 1440, innerHeight / 810)
  stage.style.setProperty('--scale', scale)
}
addEventListener('resize', fitStage)
fitStage()
setDay(dayPhase, { fromTake: true })

;(function frame() {
  requestAnimationFrame(frame)
  sun.draw(dayPhase, dayName)
  loopStrip.update(Looper)
  for (const voice in layerControls) layerControls[voice].update(Looper.status(voice))
  dayStrip.update(SCORE.day.findIndex((d) => d.name === dayName))
  timeline.draw()
  updateMeters()
  transport.update(Take)
})()
