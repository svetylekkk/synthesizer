/* ==========================================================================
   UI-кит инструмента — базовые элементы управления.
   Нейминг: функция-компонент в PascalCase возвращает DOM-узел с
   одноимённым CSS-классом (BEM: Component__Element, Component--modifier).
   data-param хранит путь к параметру звука: «голос.эффект.параметр».
   ========================================================================== */

function el(tag, className, html) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (html != null) node.innerHTML = html
  return node
}

// cls('Pill', 'light') → 'Pill Pill--light'
const cls = (base, ...modifiers) =>
  [base, ...modifiers.filter(Boolean).map((m) => `${base}--${m}`)].join(' ')

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function Pill({ text, modifier }) {
  return el('span', cls('Pill', modifier), text)
}

function Button({ name, icon, modifier, onClick }) {
  const node = el(
    'button',
    cls('Button', modifier),
    `<span class="Button__Icon" aria-hidden="true">${icon}</span><span class="Button__Name">${name}</span>`
  )
  node.type = 'button'
  node.onclick = onClick
  return node
}

function ToggleButton({ param, name, value = false, onChange }) {
  const node = el('button', 'ToggleButton', name)
  node.type = 'button'
  node.dataset.param = param
  node.setAttribute('aria-pressed', value)
  node.onclick = () => {
    value = !value
    node.setAttribute('aria-pressed', value)
    onChange(value)
  }
  return node
}

/* Knob — крутилка: тянуть вверх/вниз, стрелки клавиатуры, двойной клик — сброс.
   scale: 'log' для частот, чтобы ход был равномерным на слух.
   Подпись показывает имя, а при наведении и вращении — значение. */
function Knob({ param, name, min, max, value, scale = 'linear', format, onChange, onCommit }) {
  const R = 17
  const C = 2 * Math.PI * R
  const ARC = 0.75 * C
  const node = el(
    'div',
    'Knob',
    `<svg class="Knob__Dial" viewBox="0 0 44 44" tabindex="0" role="slider" aria-label="${name}">
      <circle class="Knob__Track" cx="22" cy="22" r="${R}" stroke-dasharray="${ARC} ${C}" transform="rotate(135 22 22)"/>
      <circle class="Knob__Arc" cx="22" cy="22" r="${R}" transform="rotate(135 22 22)"/>
      <circle class="Knob__Cap" cx="22" cy="22" r="11"/>
      <g class="Knob__Pointer"><circle cx="22" cy="14.5" r="2.2"/></g>
    </svg>
    <span class="Knob__Name">${name}</span>
    <span class="Knob__Value"></span>`
  )
  node.dataset.param = param
  const dial = node.querySelector('.Knob__Dial')
  const arc = node.querySelector('.Knob__Arc')
  const pointer = node.querySelector('.Knob__Pointer')
  const label = node.querySelector('.Knob__Value')
  const initial = value

  const toNorm = (v) =>
    scale === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const fromNorm = (n) =>
    scale === 'log' ? min * Math.pow(max / min, n) : min + n * (max - min)

  function render() {
    const n = toNorm(value)
    arc.setAttribute('stroke-dasharray', `${ARC * n} ${C}`)
    pointer.setAttribute('transform', `rotate(${-135 + 270 * n} 22 22)`)
    label.textContent = format(value)
    dial.setAttribute('aria-valuetext', format(value))
  }
  function set(n) {
    value = fromNorm(clamp(n, 0, 1))
    render()
    onChange?.(value)
  }
  const commit = () => onCommit?.(value)

  let startY = 0
  let startN = 0
  dial.onpointerdown = (e) => {
    dial.setPointerCapture(e.pointerId)
    node.classList.add('is-dragging')
    startY = e.clientY
    startN = toNorm(value)
  }
  dial.onpointermove = (e) => {
    if (dial.hasPointerCapture(e.pointerId)) set(startN + (startY - e.clientY) / 160)
  }
  dial.onpointerup = () => {
    node.classList.remove('is-dragging')
    commit()
  }
  dial.ondblclick = () => {
    set(toNorm(initial))
    commit()
  }
  dial.onkeydown = (e) => {
    const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key]
    if (!step) return
    e.preventDefault()
    set(toNorm(value) + step)
  }
  dial.onkeyup = commit

  render()
  return node
}

/* Meter — вертикальный индикатор уровня. Все метры обновляются одним
   циклом анимации через updateMeters(). */
const meterRegistry = []

function Meter({ param, name, meter }) {
  const node = el(
    'div',
    'Meter',
    `<div class="Meter__Track"><div class="Meter__Fill"></div></div><span class="Meter__Name">${name}</span>`
  )
  node.dataset.param = param
  meterRegistry.push({ meter, fill: node.querySelector('.Meter__Fill') })
  return node
}

function updateMeters() {
  meterRegistry.forEach(({ meter, fill }) => {
    const db = meter.getValue()
    const level = clamp(((Number.isFinite(db) ? db : -60) + 60) / 60, 0, 1)
    fill.style.transform = `scaleY(${level})`
  })
}

/* EffectModule — одно звено цепочки: номер, имя эффекта, его крутилки */
function EffectModule({ param, index, name, controls, aside }) {
  const node = el(
    'div',
    'EffectModule',
    `<div class="EffectModule__Header">
      <span class="EffectModule__Index">${index}</span>
      <span class="EffectModule__Name">${name}</span>
    </div>
    <div class="EffectModule__Controls"></div>`
  )
  node.dataset.param = param
  if (aside) node.querySelector('.EffectModule__Header').append(aside)
  node.querySelector('.EffectModule__Controls').append(...controls)
  return node
}

/* Segmented — выбор одного из нескольких значений */
function Segmented({ param, title, options, value, onChange }) {
  const node = el('div', 'Segmented')
  node.dataset.param = param
  if (title) node.title = title
  const buttons = options.map((option) => {
    const button = el('button', 'Segmented__Option', option.label)
    button.type = 'button'
    button.onclick = () => {
      value = option.value
      render()
      onChange(value)
    }
    return button
  })
  const render = () =>
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', options[i].value === value))
  node.append(...buttons)
  render()
  return {
    root: node,
    setDisabled: (disabled) => buttons.forEach((b) => (b.disabled = disabled))
  }
}

/* Stepper — число со стрелками −/+ (темп) */
function Stepper({ param, name, value, min, max, step = 1, onChange }) {
  const node = el(
    'div',
    'Stepper',
    `<span class="Stepper__Name">${name}</span>
    <button class="Stepper__Button" type="button" aria-label="меньше">−</button>
    <span class="Stepper__Value"></span>
    <button class="Stepper__Button" type="button" aria-label="больше">+</button>`
  )
  node.dataset.param = param
  const [down, up] = node.querySelectorAll('button')
  const label = node.querySelector('.Stepper__Value')
  const set = (v) => {
    value = clamp(v, min, max)
    label.textContent = value
    onChange(value)
  }
  down.onclick = () => set(value - step)
  up.onclick = () => set(value + step)
  set(value)
  return node
}

/* EffectChain — звенья по порядку прохождения сигнала (сверху вниз) */
function EffectChain({ param, modules }) {
  const node = el('div', 'EffectChain')
  node.dataset.param = param
  node.append(...modules)
  return node
}

/* ChannelStrip — последнее звено голоса: громкость, панорама, mute */
function ChannelStrip({ param, index, channel, onMute }) {
  return EffectModule({
    param,
    index,
    name: 'channel',
    aside: ToggleButton({
      param: `${param}.mute`,
      name: 'M',
      onChange: (muted) => {
        channel.mute = muted
        onMute(muted)
      }
    }),
    controls: [
      Knob({
        param: `${param}.volume`,
        name: 'громк.',
        min: -30,
        max: 0,
        value: channel.volume.value,
        format: format.db,
        onChange: (v) => (channel.volume.value = v)
      }),
      Knob({
        param: `${param}.pan`,
        name: 'пан',
        min: -1,
        max: 1,
        value: channel.pan.value,
        format: format.pan,
        onChange: (v) => (channel.pan.value = v)
      })
    ]
  })
}

/* Форматтеры значений для подписей крутилок */
const format = {
  hz: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' кГц' : Math.round(v) + ' Гц'),
  rate: (v) => v.toFixed(2) + ' Гц',
  pct: (v) => Math.round(v * 100) + '%',
  sec: (v) => v.toFixed(1) + ' с',
  db: (v) => Math.round(v) + ' дБ',
  q: (v) => v.toFixed(1),
  pan: (v) => (v < -0.05 ? 'L' + Math.round(-v * 100) : v > 0.05 ? 'R' + Math.round(v * 100) : 'C'),
  time: (s) => {
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
  }
}

/* bindParam — единый доступ к параметру эффекта: у Tone.Signal/Param
   значение лежит в .value, у обычных свойств (decay, depth) — напрямую */
function bindParam(target, prop) {
  const isSignal = target[prop] instanceof Tone.Param || target[prop] instanceof Tone.Signal
  return {
    get: () => (isSignal ? target[prop].value : target[prop]),
    set: (v) => (isSignal ? (target[prop].value = v) : (target[prop] = v))
  }
}

/* bindPadInput — нажатие на элементы с data-index внутри root.
   Можно провести пальцем/мышью по нескольким — как глиссандо. */
function bindPadInput(root, { onDown, onUp }) {
  const held = {}
  const padAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-index]')

  root.addEventListener('pointerdown', (e) => {
    const pad = e.target.closest('[data-index]')
    if (!pad) return
    root.setPointerCapture(e.pointerId)
    held[e.pointerId] = +pad.dataset.index
    onDown(held[e.pointerId])
  })
  root.addEventListener('pointermove', (e) => {
    if (held[e.pointerId] == null) return
    const pad = padAt(e.clientX, e.clientY)
    if (pad && root.contains(pad) && +pad.dataset.index !== held[e.pointerId]) {
      onUp(held[e.pointerId])
      held[e.pointerId] = +pad.dataset.index
      onDown(held[e.pointerId])
    }
  })
  const end = (e) => {
    if (held[e.pointerId] == null) return
    onUp(held[e.pointerId])
    delete held[e.pointerId]
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
}
