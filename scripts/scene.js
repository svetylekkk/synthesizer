/* ==========================================================================
   Сцена сада — крупные элементы инструмента, собранные из UI-кита.
   Пэды голосов: Flower (капли), Cloud (ветер), Heart (сердце), Star (звёзды).
   *Garden — площадка пэдов голоса; VoicePanel — голос целиком
   (сад + цепочка эффектов + канал); Sun, DayStrip, MasterStrip,
   Transport, Timeline — общие узлы.
   ========================================================================== */

const GARDEN_SIZE = { width: 344, height: 222 }

/* Пэд: обёртка с формой (svg), подписью и клавишей */
function Pad({ type, index, shape, label, title, keyHint, x, y, size, turn = 0 }) {
  const node = el(
    'div',
    `Pad ${type}`,
    `<svg class="${type}__Shape" viewBox="-50 -50 100 100">${shape}</svg>
    <span class="Pad__Label">${label}<kbd class="Pad__Key">${keyHint}</kbd></span>`
  )
  node.dataset.index = index
  node.title = node.ariaLabel = title
  node.style.cssText = `left:${x}px; top:${y}px; --size:${size}px; --turn:${turn}deg`
  return node
}

/* Площадка пэдов: позиции задаёт layout(i) → { x, y, size, turn };
   compact — под пэдом только клавиша, подпись уходит в подсказку */
function Garden({ voice, pads, type, shape, layout, decor = '', compact = false, onActive }) {
  const { width, height } = GARDEN_SIZE
  const root = el(
    'div',
    cls('Garden', voice),
    `<svg class="Garden__Decor" viewBox="0 0 ${width} ${height}">${decor}</svg>`
  )
  const nodes = pads.map((pad, i) =>
    Pad({
      type,
      index: i,
      shape: shape(i),
      label: compact ? '' : pad.label,
      title: `${pad.label} · ${pad.key.toUpperCase()}`,
      keyHint: pad.key.toUpperCase(),
      ...layout(i, pads.length)
    })
  )
  root.append(...nodes)
  return {
    root,
    setActive(index, on) {
      nodes[index].classList.toggle('is-active', on)
      root.classList.toggle('is-playing', nodes.some((n) => n.classList.contains('is-active')))
      if (on) onActive?.(root, nodes[index])
    }
  }
}

/* ---------- A · Капли: цветы-звёздочки на дуге ---------- */

const arcPoint = (t) => ({ x: 32 + t * 280, y: 78 + Math.sin(Math.PI * t) * 84 })
const stemPath = Array.from({ length: 41 }, (_, i) => arcPoint(-0.04 + (i / 40) * 1.08))
  .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
  .join(' ')

const flowerShape =
  [0, 60, 120, 180, 240, 300]
    .map((a) => `<rect x="-11" y="-48" width="22" height="50" rx="11" transform="rotate(${a})"/>`)
    .join('') + '<circle class="Flower__Core" r="12"/>'

const DropsGarden = (pads) =>
  Garden({
    voice: 'drops',
    pads,
    type: 'Flower',
    compact: true,
    decor: `<path class="Garden__Stem" d="${stemPath}"/>`,
    shape: () => flowerShape,
    layout: (i, n) => ({ ...arcPoint(i / (n - 1)), size: 48 }),
    onActive: scatterPetals
  })

// Лепестки разлетаются от цветка при каждом ударе
function scatterPetals(garden, flower) {
  for (let i = 0; i < 5; i++) {
    const petal = el('span', 'Petal')
    petal.style.left = flower.style.left
    petal.style.top = flower.style.top
    petal.style.setProperty('--dx', Math.random() * 100 - 50 + 'px')
    petal.style.setProperty('--dy', -(24 + Math.random() * 56) + 'px')
    petal.style.setProperty('--spin', Math.random() * 360 + 'deg')
    garden.append(petal)
    setTimeout(() => petal.remove(), 900)
  }
}

/* ---------- B · Ветер: облака-аккорды ---------- */

const cloudShape =
  [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const r = (a * Math.PI) / 180
      return `<circle cx="${(Math.cos(r) * 24).toFixed(1)}" cy="${(Math.sin(r) * 24).toFixed(1)}" r="22"/>`
    })
    .join('') + '<circle r="28"/>'

const WindGarden = (pads) =>
  Garden({
    voice: 'wind',
    pads,
    type: 'Cloud',
    decor: `<path class="Garden__Breeze" d="M-10 196 q 22 -20 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0"/>`,
    shape: () => cloudShape,
    layout: (i) => ({ x: 56 + i * 77, y: i % 2 ? 152 : 100, size: 96 })
  })

/* ---------- C · Сердце: контурные сердца, бьются пульсом ---------- */

const heartShape =
  '<path d="M0 34 C -46 6 -40 -34 -18 -34 C -8 -34 -2 -28 0 -20 C 2 -28 8 -34 18 -34 C 40 -34 46 6 0 34 Z"/>'

const HeartsGarden = (pads) =>
  Garden({
    voice: 'hearts',
    pads,
    type: 'Heart',
    shape: () => heartShape,
    layout: (i) => ({ x: 56 + i * 77, y: i % 2 ? 140 : 100, size: 92, turn: i % 2 ? 12 : -12 })
  })

/* ---------- D · Звёзды: четырёхлучевые, мерцают арпеджио ---------- */

const starShape = '<path d="M0 -46 Q 8 -8 46 0 Q 8 8 0 46 Q -8 8 -46 0 Q -8 -8 0 -46 Z"/>'

const StarsGarden = (pads) =>
  Garden({
    voice: 'stars',
    pads,
    type: 'Star',
    decor: `<ellipse class="Garden__Orbit" cx="172" cy="124" rx="150" ry="62"/>`,
    shape: () => starShape,
    layout: (i) => ({ x: 56 + i * 77, y: i % 2 ? 96 : 146, size: 88, turn: i * 10 })
  })

/* ---------- Голос целиком ---------- */

/* VoicePanel: сад + цепочка эффектов. chain — описание звеньев:
   [{ effect, name, knobs: [{ prop, name, min, max, scale, format, commit }] }] */
function VoicePanel({ voice, tag, garden, chain }) {
  const { effects, channel } = Engine.voices[voice]
  const node = el('section', cls('VoicePanel', voice))
  node.dataset.param = voice

  const modules = chain.map(({ effect, name, knobs }, i) =>
    EffectModule({
      param: `${voice}.${effect}`,
      index: i + 1,
      name,
      controls: knobs.map(({ prop, commit, ...knob }) => {
        const param = bindParam(effects[effect], prop)
        return Knob({
          ...knob,
          param: `${voice}.${effect}.${prop}`,
          value: param.get(),
          [commit ? 'onCommit' : 'onChange']: param.set
        })
      })
    })
  )
  modules.push(
    ChannelStrip({
      param: `${voice}.channel`,
      index: chain.length + 1,
      channel,
      onMute: (muted) => node.classList.toggle('is-muted', muted)
    })
  )

  const header = el('header', 'VoicePanel__Header')
  header.append(Pill({ text: tag }))
  node.append(header, garden, EffectChain({ param: `${voice}.chain`, modules }))
  return node
}

/* ---------- Время суток ---------- */

// Цвет неба для фазы суток 0…1 (рассвет → полдень → закат → ночь)
const SKY = ['#ffb3c6', '#ffe6ee', '#f25a7e', '#6b6fd8']

function skyColor(phase) {
  const p = (((phase % 1) + 1) % 1) * SKY.length
  const i = Math.floor(p)
  const t = p - i
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
  const [a, b] = [rgb(SKY[i]), rgb(SKY[(i + 1) % SKY.length])]
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`
}

/* Sun — солнце на орбите суток. Тянешь его по кругу (или стрелками) —
   и весь сад переходит от рассвета к ночи. Внутри — волна мастер-шины. */
function Sun({ waveform, onChange }) {
  const SIZE = 220
  const ORBIT = 92
  const root = el('div', 'Sun', `<canvas class="Sun__Canvas"></canvas>`)
  root.tabIndex = 0
  root.setAttribute('role', 'slider')
  root.setAttribute('aria-label', 'Время суток')
  root.dataset.param = 'day.phase'

  const canvas = root.querySelector('canvas')
  canvas.width = canvas.height = SIZE * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  const c = SIZE / 2

  // угол → фаза: слева рассвет, сверху полдень, справа закат, снизу ночь
  function phaseAt(e) {
    const r = root.getBoundingClientRect()
    const angle = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2)
    return (((angle - Math.PI) / (Math.PI * 2)) % 1 + 1) % 1
  }
  root.onpointerdown = (e) => {
    root.setPointerCapture(e.pointerId)
    onChange(phaseAt(e))
  }
  root.onpointermove = (e) => {
    if (root.hasPointerCapture(e.pointerId)) onChange(phaseAt(e))
  }
  root.onkeydown = (e) => {
    const step = { ArrowRight: 0.01, ArrowUp: 0.01, ArrowLeft: -0.01, ArrowDown: -0.01 }[e.key]
    if (!step) return
    e.preventDefault()
    onChange((Number(root.dataset.value) + step + 1) % 1)
  }

  function draw(phase, name) {
    root.dataset.value = phase
    root.setAttribute('aria-valuetext', name)
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.lineCap = ctx.lineJoin = 'round'

    // небо текущего часа
    const sky = ctx.createRadialGradient(c * 0.7, c * 0.6, 10, c, c, c)
    sky.addColorStop(0, '#fff')
    sky.addColorStop(0.35, skyColor(phase))
    sky.addColorStop(1, skyColor(phase + 0.12))
    ctx.fillStyle = sky
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()

    // орбита с четырьмя отметками времени суток
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(c, c, ORBIT, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    for (let k = 0; k < 4; k++) {
      const a = Math.PI + (k * Math.PI) / 2
      ctx.beginPath()
      ctx.arc(c + Math.cos(a) * ORBIT, c + Math.sin(a) * ORBIT, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // волна мастер-шины
    const data = waveform.getValue()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    ctx.beginPath()
    for (let i = 0; i <= data.length; i++) {
      const a = (i / data.length) * Math.PI * 2 - Math.PI / 2
      const r = 50 + data[i % data.length] * 30
      const x = c + Math.cos(a) * r
      const y = c + Math.sin(a) * r
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()

    // само солнце на орбите
    const a = Math.PI + phase * Math.PI * 2
    const sx = c + Math.cos(a) * ORBIT
    const sy = c + Math.sin(a) * ORBIT
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    ctx.beginPath()
    ctx.arc(sx, sy, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx, sy, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  return { root, draw }
}

/* DayStrip — быстрый переход к часу суток: солнце плавно доезжает туда */
function DayStrip({ phases, onSelect }) {
  const node = el('section', 'DayStrip')
  node.dataset.param = 'day'
  const buttons = phases.map((phase, i) => {
    const button = el('button', 'DayStrip__Button', phase.name)
    button.type = 'button'
    button.style.setProperty('--sky', skyColor(i / phases.length))
    button.onclick = () => onSelect(i / phases.length)
    return button
  })
  const list = el('div', 'DayStrip__Buttons')
  list.append(...buttons)
  node.append(Pill({ text: 'время суток', modifier: 'light' }), list)

  function update(index) {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', i === index))
  }
  return { root: node, update }
}

/* ---------- Мастер, транспорт, лента ---------- */

function MasterStrip({ master, meters }) {
  const node = el('section', 'MasterStrip')
  node.dataset.param = 'master'
  const levels = el('div', 'MasterStrip__Meters')
  levels.append(
    Meter({ param: 'master.meter.left', name: 'L', meter: meters.left }),
    Meter({ param: 'master.meter.right', name: 'R', meter: meters.right })
  )
  node.append(
    Pill({ text: 'master', modifier: 'light' }),
    Knob({
      param: 'master.volume',
      name: 'громк.',
      min: -30,
      max: 0,
      value: master.volume.value,
      format: format.db,
      onChange: (v) => (master.volume.value = v)
    }),
    levels
  )
  return node
}

function Transport({ onRecord, onPlay, onStop, onDownload, onClear }) {
  const buttons = {
    record: Button({ name: 'запись', icon: '●', modifier: 'record', onClick: onRecord }),
    play: Button({ name: 'слушать', icon: '▶', onClick: onPlay }),
    stop: Button({ name: 'стоп', icon: '■', onClick: onStop }),
    download: Button({ name: 'аудио', icon: '↓', onClick: onDownload }),
    clear: Button({ name: 'заново', icon: '↺', onClick: onClear })
  }
  const time = el('span', 'Transport__Time', format.time(0))
  const root = el('nav', 'Transport')
  root.setAttribute('aria-label', 'Запись и воспроизведение')
  root.append(buttons.record, buttons.play, buttons.stop, time, buttons.download, buttons.clear)

  function update(take) {
    const { state } = take
    buttons.record.classList.toggle('is-active', state === 'recording')
    buttons.play.classList.toggle('is-active', state === 'playing')
    buttons.play.disabled = !take.hasNotes() || state === 'recording'
    buttons.stop.disabled = state === 'idle'
    buttons.download.disabled = !take.hasAudio()
    buttons.clear.disabled = !take.hasNotes() || state !== 'idle'
    time.textContent = format.time(state === 'playing' ? take.position() : take.length())
  }
  return { root, update }
}

// Лента произведения: каждая нота — отрезок, у каждого голоса своя дорожка,
// подложка окрашена в цвет неба — видно, как в пьесе шло время суток
function Timeline({ take, lanes }) {
  const WIDTH = 1250
  const HEIGHT = 112
  const GAP = 4
  const total = lanes.reduce((sum, l) => sum + l.height, 0) + GAP * (lanes.length - 1)
  let top = (HEIGHT - total) / 2
  const geometry = {}
  lanes.forEach((lane) => {
    geometry[lane.voice] = { ...lane, top }
    top += lane.height + GAP
  })

  const root = el(
    'section',
    'Timeline',
    `<div class="Timeline__Lanes"></div><canvas class="Timeline__Canvas"></canvas>`
  )
  const names = root.querySelector('.Timeline__Lanes')
  names.style.gridTemplateRows = lanes.map((l) => l.height + 'px').join(' ')
  names.append(...lanes.map((l) => Pill({ text: l.name, modifier: l.voice })))

  const canvas = root.querySelector('canvas')
  canvas.width = WIDTH * 2
  canvas.height = HEIGHT * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    const length = take.length()
    const span = Math.max(20, length * 1.05)
    const x = (t) => (t / span) * WIDTH

    const step = span > 90 ? 10 : span > 40 ? 5 : 2
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    for (let s = 0; s < span; s += step) ctx.fillRect(x(s), 0, 1, HEIGHT)

    if (!take.hasNotes() && take.state !== 'recording') {
      ctx.fillStyle = 'rgba(42,37,96,.55)'
      ctx.font = '600 14px Manrope, sans-serif'
      ctx.fillText('нажми «● запись» и сыграй — здесь вырастет твоё произведение', 16, HEIGHT / 2 + 5)
      return
    }

    ctx.globalAlpha = 0.35
    take.dayChanges().forEach((change, i, list) => {
      const end = list[i + 1]?.time ?? length
      ctx.fillStyle = skyColor(change.value)
      ctx.fillRect(x(change.time), 0, x(end - change.time) + 1, HEIGHT)
    })
    ctx.globalAlpha = 1

    // высота ноты — положение внутри дорожки: выше нота — выше отрезок
    const BAR = 6
    for (const note of take.notes()) {
      const lane = geometry[note.voice]
      const pitch = (lane.rows - 1 - note.index) / (lane.rows - 1)
      ctx.fillStyle = lane.color
      ctx.beginPath()
      ctx.roundRect(
        x(note.start),
        lane.top + pitch * (lane.height - BAR),
        Math.max(BAR, x(note.end - note.start)),
        BAR,
        BAR / 2
      )
      ctx.fill()
    }

    const head = take.state === 'playing' ? take.position() : length
    ctx.fillStyle = take.state === 'recording' ? '#e2295a' : '#2a2560'
    ctx.fillRect(x(head) - 1, 0, 2, HEIGHT)
  }
  return { root, draw }
}
