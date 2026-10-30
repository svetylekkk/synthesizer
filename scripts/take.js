/* ==========================================================================
   Take — запись сыгранного произведения.
   События: { time, voice, index, type: 'on' | 'off' } для пэдов и
   { time, voice: 'day', type: 'set', value } — движение солнца.
   Параллельно мастер-шина пишется в аудиофайл (Tone.Recorder).
   Воспроизведение проигрывает события заново через инструмент —
   поэтому крутилки эффектов влияют и на повтор.
   ========================================================================== */

const Take = (() => {
  let state = 'idle' // 'idle' | 'recording' | 'playing'
  let events = []
  let duration = 0
  let startedAt = 0
  let timers = []
  let audio = null

  const clock = () => (performance.now() - startedAt) / 1000

  function record() {
    events = []
    duration = 0
    audio = null
    startedAt = performance.now()
    Engine.recorder.start()
    state = 'recording'
  }

  function log(voice, index, type, extra) {
    if (state === 'recording') events.push({ time: clock(), voice, index, type, ...extra })
  }

  function play({ onEvent, onEnd }) {
    if (!events.length || state !== 'idle') return
    startedAt = performance.now()
    state = 'playing'
    timers = events.map((e) => setTimeout(() => onEvent(e), e.time * 1000))
    timers.push(
      setTimeout(() => {
        timers = []
        state = 'idle'
        onEnd()
      }, duration * 1000 + 50)
    )
  }

  async function stop() {
    if (state === 'recording') {
      duration = clock()
      state = 'idle'
      audio = await Engine.recorder.stop()
    } else if (state === 'playing') {
      timers.forEach(clearTimeout)
      timers = []
      state = 'idle'
    }
  }

  function clear() {
    events = []
    duration = 0
    audio = null
  }

  // Пары on/off → отрезки нот для ленты; незакрытые тянутся до конца
  function notes() {
    const open = {}
    const bars = []
    for (const e of events) {
      const id = e.voice + e.index
      if (e.type === 'on') {
        open[id] = { voice: e.voice, index: e.index, start: e.time, end: null }
        bars.push(open[id])
      } else if (e.type === 'off' && open[id]) {
        open[id].end = e.time
        delete open[id]
      }
    }
    const end = length()
    bars.forEach((b) => (b.end ??= end))
    return bars
  }

  const dayChanges = () => events.filter((e) => e.voice === 'day')

  function length() {
    return state === 'recording' ? clock() : duration
  }

  function download() {
    if (!audio) return
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(audio)
    link.download = `sad-zvukov.${ext}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return {
    get state() {
      return state
    },
    position: () => (state === 'idle' ? 0 : clock()),
    length,
    hasNotes: () => events.length > 0,
    hasAudio: () => audio !== null,
    record,
    log,
    play,
    stop,
    clear,
    notes,
    dayChanges,
    download
  }
})()
