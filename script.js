/* ============ Компоненты интерфейса (нейминг как в synth-controls) ============ */
const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const liveMeters = [] // [Tone.Meter, элемент-полоска]

function Button({ name, onClick }) {
  const e = el('button', 'Button', name)
  e.onclick = onClick
  return e
}

function ToggleButton({ param, name, value = false, onChange }) {
  const e = el('button', 'ToggleButton', name)
  e.dataset.param = param
  e.setAttribute('aria-pressed', value)
  e.onclick = () => {
    value = !value
    e.setAttribute('aria-pressed', value)
    onChange && onChange(value)
  }
  return e
}

function ToggleButtonSet({ param, name, options, value, onChange }) {
  const e = el('div', 'ToggleButtonSet')
  e.dataset.param = param
  e.append(el('div', 'ToggleButtonSet__Name', name))
  const row = el('div', 'ToggleButtonSet__Buttons')
  e.append(row)
  const btns = options.map((o) => {
    const b = el('button', 'ToggleButton', o.label)
    b.setAttribute('aria-pressed', o.value === value)
    b.onclick = () => {
      btns.forEach((x) => x.setAttribute('aria-pressed', x === b))
      onChange(o.value)
    }
    row.append(b)
    return b
  })
  return e
}

function Slider({
  param,
  name,
  min,
  max,
  value,
  step = 0.1,
  fmt = (v) => v.toFixed(1),
  onChange
}) {
  const e = el(
    'div',
    'Slider',
    `<div class="Slider__Name"><span>${name}</span><span class="Slider__Value"></span></div><input class="Slider__Input" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`
  )
  e.dataset.param = param
  const inp = e.querySelector('input'),
    val = e.querySelector('.Slider__Value')
  inp.oninput = () => {
    val.textContent = fmt(+inp.value)
    onChange && onChange(+inp.value)
  }
  val.textContent = fmt(value)
  return e
}

function Knob({
  param,
  name,
  min,
  max,
  value,
  fmt = (v) => v.toFixed(2),
  onChange,
  onCommit
}) {
  const e = el(
    'div',
    'Knob',
    '<div class="Knob__Dial"><div class="Knob__Pointer"></div></div><div class="Knob__Name"></div><div class="Knob__Value"></div>'
  )
  e.dataset.param = param
  e.querySelector('.Knob__Name').textContent = name
  const dial = e.querySelector('.Knob__Dial'),
    ptr = e.querySelector('.Knob__Pointer'),
    val = e.querySelector('.Knob__Value'),
    def = value
  let y0,
    v0,
    drag = false
  const draw = () => {
    ptr.style.transform = `rotate(${-135 + (270 * (value - min)) / (max - min)}deg)`
    val.textContent = fmt(value)
  }
  const set = (v) => {
    value = clamp(v, min, max)
    draw()
    onChange && onChange(value)
  }
  dial.onpointerdown = (ev) => {
    dial.setPointerCapture(ev.pointerId)
    drag = true
    y0 = ev.clientY
    v0 = value
  }
  dial.onpointermove = (ev) => {
    if (drag) set(v0 + ((y0 - ev.clientY) / 140) * (max - min))
  }
  dial.onpointerup = dial.onpointercancel = () => {
    if (drag) {
      drag = false
      onCommit && onCommit(value)
    }
  }
  dial.ondblclick = () => {
    set(def)
    onCommit && onCommit(def)
  }
  draw()
  return e
}

function Meter({ param, label, meter }) {
  const e = el(
    'div',
    'Meter' + (label ? '' : ' Meter--bare'),
    `${label ? `<span>${label}</span>` : ''}<div class="Meter__Track"><div class="Meter__Bar"></div></div>`
  )
  e.dataset.param = param
  liveMeters.push([meter, e.querySelector('.Meter__Bar')])
  return e
}

function Section(title, bodyClass = 'Grid4') {
  const section = el('div', 'Section')
  section.append(el('div', 'Section__Title', title))
  const body = el('div', bodyClass)
  section.append(body)
  return { section, body }
}

function EffectModule({ param, name, params }) {
  const e = el('div', 'EffectModule')
  e.dataset.param = param
  e.append(el('div', 'EffectModule__Name', name))
  const p = el('div', 'EffectModule__Params')
  params.forEach((x) => p.append(x))
  e.append(p)
  return e
}

function ChannelStrip({ param, channel, gate, voiceKey }) {
  const { section, body } = Section('Канал (Channel)')
  section.dataset.param = param
  const meter = new Tone.Meter({ smoothing: 0.8 })
  gate.connect(meter)
  body.append(
    Slider({
      param: param + '.volume',
      name: 'Громкость',
      min: -36,
      max: 0,
      value: -6,
      fmt: (v) => v.toFixed(0) + ' дБ',
      onChange: (v) => (channel.volume.value = v)
    }),
    Knob({
      param: param + '.pan',
      name: 'Pan',
      min: -1,
      max: 1,
      value: channel.pan.value,
      fmt: (v) =>
        v < -0.05
          ? 'L' + Math.round(-v * 100)
          : v > 0.05
            ? 'R' + Math.round(v * 100)
            : 'C',
      onChange: (v) => (channel.pan.value = v)
    }),
    ToggleButton({
      param: param + '.mute',
      name: 'Mute',
      onChange: (v) => {
        channelState[voiceKey].mute = v
        refreshGates()
      }
    }),
    ToggleButton({
      param: param + '.solo',
      name: 'Solo',
      onChange: (v) => {
        channelState[voiceKey].solo = v
        refreshGates()
      }
    }),
    Meter({ param: param + '.meter', meter })
  )
  return section
}

function PianoKeyboard({ start, count, keyLabels, onDown, onUp }) {
  const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    cols = ['#8ee3ff', '#ffca6e', '#eef1f8', '#d7b8e0', '#ffbcd6', '#fff59a']
  const root = el('div', 'PianoKeyboard'),
    keys = {},
    whites = []
  for (let i = 0; i < count; i++)
    if (!N[(start + i) % 12].includes('#')) whites.push(start + i)
  const W = whites.length
  whites.forEach((m, i) => {
    const k = el(
      'div',
      'PianoKeyboard__WhiteKey',
      `${keyLabels[m - start] || ''}<small>${N[m % 12]}${Math.floor(m / 12) - 1}</small>`
    )
    k.style.background = cols[i % 6]
    k.dataset.m = m
    root.append(k)
    keys[m] = k
  })
  for (let i = 0; i < count; i++) {
    const m = start + i
    if (N[m % 12].includes('#')) {
      const k = el('div', 'PianoKeyboard__BlackKey', keyLabels[i] || '')
      const idx = whites.indexOf(m - 1) + 1 // граница между колонками сетки
      k.style.left = `calc(${idx} * (100% + var(--key-gap)) / ${W} - var(--key-gap) / 2)`
      k.style.width = `calc((100% - ${W - 1} * var(--key-gap)) / ${W} * .62)`
      k.dataset.m = m
      root.append(k)
      keys[m] = k
    }
  }
  const held = {}
  root.onpointerdown = (e) => {
    const t = e.target.closest('[data-m]')
    if (!t) return
    root.setPointerCapture(e.pointerId)
    held[e.pointerId] = +t.dataset.m
    onDown(+t.dataset.m)
  }
  root.onpointermove = (e) => {
    if (held[e.pointerId] == null) return
    const t = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('[data-m]')
    if (t && +t.dataset.m !== held[e.pointerId]) {
      onUp(held[e.pointerId])
      held[e.pointerId] = +t.dataset.m
      onDown(+t.dataset.m)
    }
  }
  root.onpointerup = root.onpointercancel = (e) => {
    if (held[e.pointerId] != null) {
      onUp(held[e.pointerId])
      delete held[e.pointerId]
    }
  }
  return {
    root,
    keys,
    setActive: (m, on) => keys[m] && keys[m].classList.toggle('is-active', on),
    setSplit: (p) => {
      root.classList.toggle('PianoKeyboard--split', p != null)
      Object.entries(keys).forEach(([m, k]) => {
        k.classList.toggle('is-voiceA', p != null && m < p)
        k.classList.toggle('is-voiceB', p != null && m >= p)
      })
    }
  }
}

function ComputerKeyboard({ map, onDown, onUp }) {
  addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return
    const i = map.indexOf(e.key.toLowerCase())
    if (i > -1) onDown(i)
  })
  addEventListener('keyup', (e) => {
    const i = map.indexOf(e.key.toLowerCase())
    if (i > -1) onUp(i)
  })
}

/* ============ Звук: два голоса, у каждого своя цепочка эффектов и свой канал ============ */
// Голос A «Кристалл»: Synth → Filter → Chorus → PingPongDelay → Channel (pan влево)
const synthA = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.35, release: 1.2 },
  volume: -8
})
const filterA = new Tone.Filter({ type: 'lowpass', frequency: 6000, Q: 1 })
const chorusA = new Tone.Chorus({
  frequency: 3,
  delayTime: 3,
  depth: 0.5,
  wet: 0.5
}).start()
const delayA = new Tone.PingPongDelay({
  delayTime: '8n',
  feedback: 0.35,
  wet: 0.3
})
const channelA = new Tone.Channel({ volume: -6, pan: -0.7 })
synthA.chain(filterA, chorusA, delayA, channelA)
// Голос B «Облако»: Synth → Filter → Phaser → Reverb → Channel (pan вправо)
const synthB = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.25, decay: 0.4, sustain: 0.6, release: 1.8 },
  volume: -12
})
const filterB = new Tone.Filter({ type: 'lowpass', frequency: 2200, Q: 1 })
const phaserB = new Tone.Phaser({
  frequency: 0.6,
  octaves: 3,
  baseFrequency: 500,
  wet: 0.4
})
const reverbB = new Tone.Reverb({ decay: 3.5, wet: 0.45 })
const channelB = new Tone.Channel({ volume: -6, pan: 0.7 })
synthB.chain(filterB, phaserB, reverbB, channelB)
// Мастер: Channel A + Channel B → Master Channel → осциллограф, L/R-метры, выход
const master = new Tone.Channel({ volume: -3 }).toDestination()
// Mute/Solo сделаны отдельными Gain-узлами: Tone.Channel.solo глушит ВСЕ каналы контекста, включая мастер
const gateA = new Tone.Gain(1),
  gateB = new Tone.Gain(1)
const channelState = {
  A: { mute: false, solo: false, gate: gateA },
  B: { mute: false, solo: false, gate: gateB }
}
function refreshGates() {
  const anySolo = Object.values(channelState).some((c) => c.solo)
  Object.entries(channelState).forEach(([k, c]) => {
    const audible = !c.mute && (!anySolo || c.solo)
    c.gate.gain.rampTo(audible ? 1 : 0, 0.03)
    const panel = document.querySelector(`[data-param="voice${k}"]`)
    panel && panel.classList.toggle('is-silent', !audible)
  })
}
channelA.connect(gateA)
channelB.connect(gateB)
gateA.connect(master)
gateB.connect(master)
const waveform = new Tone.Waveform(1024)
master.connect(waveform)
const split = new Tone.Split(),
  meterL = new Tone.Meter({ smoothing: 0.8 }),
  meterR = new Tone.Meter({ smoothing: 0.8 })
master.connect(split)
split.connect(meterL, 0, 0)
split.connect(meterR, 1, 0)

/* ============ Сборка интерфейса ============ */
const App = document.getElementById('App')
const pct = (v) => Math.round(v * 100) + '%',
  hz = (v) => Math.round(v) + ' Гц',
  sec = (v) => v.toFixed(1) + ' с'
const waveOpts = [
  ['sine', 'Sine'],
  ['triangle', 'Tri'],
  ['square', 'Sq'],
  ['sawtooth', 'Saw']
].map(([value, label]) => ({ value, label }))
const iconA =
  '<svg viewBox="0 0 100 100"><g fill="#4cc3ee" stroke="#2a9acb" stroke-width="3"><polygon points="50,6 66,30 50,54 34,30"/><polygon points="24,50 40,74 24,98 8,74" transform="translate(8 -4)"/><polygon points="74,40 90,64 74,88 58,64" transform="translate(-4 4)"/></g></svg>'
const iconB =
  '<svg viewBox="0 0 100 100"><polygon points="30,40 52,40 42,62 56,62 24,98 32,68 20,68" fill="#ff9a3c"/><g fill="#fff"><circle cx="52" cy="26" r="13"/><circle cx="68" cy="22" r="11"/><circle cx="60" cy="38" r="11"/><circle cx="44" cy="36" r="9"/></g></svg>'

function FilterModule(id, filter) {
  return EffectModule({
    param: id + '.fx.filter',
    name: '1 · Filter',
    params: [
      Knob({
        param: id + '.fx.filter.frequency',
        name: 'Cutoff',
        min: 200,
        max: 8000,
        value: filter.frequency.value,
        fmt: hz,
        onChange: (v) => (filter.frequency.value = v)
      }),
      Knob({
        param: id + '.fx.filter.q',
        name: 'Reso',
        min: 0.1,
        max: 12,
        value: 1,
        fmt: (v) => v.toFixed(1),
        onChange: (v) => (filter.Q.value = v)
      })
    ]
  })
}

function VoicePanel({
  id,
  title,
  icon,
  color,
  synth,
  channel,
  gate,
  voiceKey,
  wave,
  attack,
  release,
  level,
  effects
}) {
  const p = el('section', 'Panel VoicePanel ' + color)
  p.dataset.param = id
  p.append(el('h2', 'Panel__Title', icon + title))
  const o = Section('Генератор (Synth)')
  o.body.append(
    ToggleButtonSet({
      param: id + '.osc.type',
      name: 'Волна',
      options: waveOpts,
      value: wave,
      onChange: (v) => synth.set({ oscillator: { type: v } })
    }),
    Knob({
      param: id + '.env.attack',
      name: 'Attack',
      min: 0.005,
      max: 2,
      value: attack,
      fmt: (v) => v.toFixed(2) + ' с',
      onChange: (v) => synth.set({ envelope: { attack: v } })
    }),
    Knob({
      param: id + '.env.release',
      name: 'Release',
      min: 0.1,
      max: 4,
      value: release,
      fmt: sec,
      onChange: (v) => synth.set({ envelope: { release: v } })
    }),
    Knob({
      param: id + '.osc.level',
      name: 'Level',
      min: -30,
      max: 0,
      value: level,
      fmt: (v) => v.toFixed(0) + ' дБ',
      onChange: (v) => (synth.volume.value = v)
    }),
    Knob({
      param: id + '.osc.detune',
      name: 'Detune',
      min: -50,
      max: 50,
      value: 0,
      fmt: (v) => Math.round(v) + ' ct',
      onChange: (v) => synth.set({ detune: v })
    })
  )
  const f = Section('Цепочка эффектов', 'Chain')
  f.body.append(...effects)
  p.append(
    o.section,
    f.section,
    ChannelStrip({ param: id + '.channel', channel, gate, voiceKey })
  )
  return p
}

const kb = PianoKeyboard({
  start: 60,
  count: 18,
  keyLabels: [
    'A',
    'W',
    'S',
    'E',
    'D',
    'F',
    'T',
    'G',
    'Y',
    'H',
    'U',
    'J',
    'K',
    'O',
    'L',
    'P',
    ';',
    "'"
  ],
  onDown: noteOn,
  onUp: noteOff
})
const playing = { A: true, B: true } // какие голоса откликаются на клавиши

const ModePanel = el('section', 'Panel c2')
ModePanel.dataset.param = 'voices'
const modeGrid = el('div', 'Grid12')
const toggleA = ToggleButton({
  param: 'voices.voiceA',
  name: 'Голос A',
  value: true,
  onChange: (v) => (playing.A = v)
})
toggleA.classList.add('Span6')
const toggleB = ToggleButton({
  param: 'voices.voiceB',
  name: 'Голос B',
  value: true,
  onChange: (v) => (playing.B = v)
})
toggleB.classList.add('Span6')
modeGrid.append(toggleA, toggleB)
ModePanel.append(modeGrid)

const VoiceA = VoicePanel({
  id: 'voiceA',
  title: 'Голос A · Кристалл',
  icon: iconA,
  color: 'c1',
  synth: synthA,
  channel: channelA,
  gate: gateA,
  voiceKey: 'A',
  wave: 'sine',
  attack: 0.01,
  release: 1.2,
  level: -8,
  effects: [
    FilterModule('voiceA', filterA),
    EffectModule({
      param: 'voiceA.fx.chorus',
      name: '2 · Chorus',
      params: [
        Knob({
          param: 'voiceA.fx.chorus.depth',
          name: 'Depth',
          min: 0,
          max: 1,
          value: 0.5,
          fmt: pct,
          onChange: (v) => (chorusA.depth = v)
        }),
        Knob({
          param: 'voiceA.fx.chorus.rate',
          name: 'Rate',
          min: 0.5,
          max: 8,
          value: 3,
          fmt: (v) => v.toFixed(1) + ' Гц',
          onChange: (v) => (chorusA.frequency.value = v)
        }),
        Knob({
          param: 'voiceA.fx.chorus.wet',
          name: 'Wet',
          min: 0,
          max: 1,
          value: 0.5,
          fmt: pct,
          onChange: (v) => (chorusA.wet.value = v)
        })
      ]
    }),
    EffectModule({
      param: 'voiceA.fx.pingPongDelay',
      name: '3 · Ping Pong Delay',
      params: [
        ToggleButtonSet({
          param: 'voiceA.fx.pingPongDelay.time',
          name: 'Время',
          options: [
            { value: '16n', label: '1/16' },
            { value: '8n', label: '1/8' },
            { value: '4n', label: '1/4' }
          ],
          value: '8n',
          onChange: (v) => (delayA.delayTime.value = Tone.Time(v).toSeconds())
        }),
        Knob({
          param: 'voiceA.fx.pingPongDelay.feedback',
          name: 'Feedback',
          min: 0,
          max: 0.85,
          value: 0.35,
          fmt: pct,
          onChange: (v) => (delayA.feedback.value = v)
        }),
        Knob({
          param: 'voiceA.fx.pingPongDelay.wet',
          name: 'Wet',
          min: 0,
          max: 1,
          value: 0.3,
          fmt: pct,
          onChange: (v) => (delayA.wet.value = v)
        })
      ]
    })
  ]
})

const VoiceB = VoicePanel({
  id: 'voiceB',
  title: 'Голос B · Облако',
  icon: iconB,
  color: 'c5',
  synth: synthB,
  channel: channelB,
  gate: gateB,
  voiceKey: 'B',
  wave: 'sawtooth',
  attack: 0.25,
  release: 1.8,
  level: -12,
  effects: [
    FilterModule('voiceB', filterB),
    EffectModule({
      param: 'voiceB.fx.phaser',
      name: '2 · Phaser',
      params: [
        Knob({
          param: 'voiceB.fx.phaser.frequency',
          name: 'Rate',
          min: 0.1,
          max: 8,
          value: 0.6,
          fmt: (v) => v.toFixed(1) + ' Гц',
          onChange: (v) => (phaserB.frequency.value = v)
        }),
        Knob({
          param: 'voiceB.fx.phaser.octaves',
          name: 'Octaves',
          min: 1,
          max: 6,
          value: 3,
          fmt: (v) => v.toFixed(1),
          onChange: (v) => (phaserB.octaves = v)
        }),
        Knob({
          param: 'voiceB.fx.phaser.wet',
          name: 'Wet',
          min: 0,
          max: 1,
          value: 0.4,
          fmt: pct,
          onChange: (v) => (phaserB.wet.value = v)
        })
      ]
    }),
    EffectModule({
      param: 'voiceB.fx.reverb',
      name: '3 · Reverb',
      params: [
        Knob({
          param: 'voiceB.fx.reverb.decay',
          name: 'Decay',
          min: 0.5,
          max: 8,
          value: 3.5,
          fmt: sec,
          onCommit: (v) => (reverbB.decay = v)
        }),
        Knob({
          param: 'voiceB.fx.reverb.preDelay',
          name: 'PreDelay',
          min: 0,
          max: 0.1,
          value: 0.01,
          fmt: (v) => Math.round(v * 1000) + ' мс',
          onCommit: (v) => (reverbB.preDelay = v)
        }),
        Knob({
          param: 'voiceB.fx.reverb.wet',
          name: 'Wet',
          min: 0,
          max: 1,
          value: 0.45,
          fmt: pct,
          onChange: (v) => (reverbB.wet.value = v)
        })
      ]
    })
  ]
})

const Voices = el('div', 'Voices')
Voices.append(VoiceA, VoiceB)

const MasterPanel = el('section', 'Panel c6')
MasterPanel.dataset.param = 'master'
MasterPanel.append(el('h2', 'Panel__Title', 'Мастер'))
const mg = el('div', 'Grid12')
mg.style.marginTop = '8px'
mg.style.alignItems = 'center'
const mvol = Slider({
  param: 'master.volume',
  name: 'Громкость',
  min: -36,
  max: 0,
  value: -3,
  fmt: (v) => v.toFixed(0) + ' дБ',
  onChange: (v) => (master.volume.value = v)
})
mvol.classList.add('Span6')
const Meters = el('div', 'Meters Span6')
Meters.append(
  Meter({ param: 'master.meter.left', label: 'L', meter: meterL }),
  Meter({ param: 'master.meter.right', label: 'R', meter: meterR })
)
mg.append(mvol, Meters)
MasterPanel.append(mg)

const Scope = el(
  'div',
  'Scope',
  '<canvas id="ScopeCanvas" width="900" height="192"></canvas><div class="Scope__Stripes"></div>'
)
App.append(ModePanel, Voices, MasterPanel, Scope, kb.root)

/* ============ Игра нотами ============ */
const held = {}
function spark(m) {
  const k = kb.keys[m]
  if (!k) return
  const r = k.getBoundingClientRect(),
    cs = ['#ff5fa2', '#ffb02e', '#3aa0ff', '#9a6bff', '#4cc96b']
  for (let i = 0; i < 4; i++) {
    const e = el(
      'span',
      'Spark',
      `<svg viewBox="0 0 20 20"><polygon points="10,0 12.5,7.5 20,10 12.5,12.5 10,20 7.5,12.5 0,10 7.5,7.5" fill="${cs[(Math.random() * 5) | 0]}"/></svg>`
    )
    e.style.left = r.left + r.width / 2 + 'px'
    e.style.top = r.top + 8 + 'px'
    e.style.setProperty('--dx', Math.random() * 110 - 55 + 'px')
    e.style.setProperty('--dy', -(40 + Math.random() * 90) + 'px')
    document.body.append(e)
    setTimeout(() => e.remove(), 800)
  }
}
function noteOn(m) {
  if (held[m]) return
  Tone.start()
  const t = [playing.A && synthA, playing.B && synthB].filter(Boolean)
  if (!t.length) return
  held[m] = t
  const f = Tone.Frequency(m, 'midi').toFrequency()
  t.forEach((x) => x.triggerAttack(f, undefined, 0.8))
  kb.setActive(m, true)
  spark(m)
}
function noteOff(m) {
  const t = held[m]
  if (!t) return
  delete held[m]
  const f = Tone.Frequency(m, 'midi').toFrequency()
  t.forEach((x) => x.triggerRelease(f))
  kb.setActive(m, false)
}
ComputerKeyboard({
  map: [
    'a',
    'w',
    's',
    'e',
    'd',
    'f',
    't',
    'g',
    'y',
    'h',
    'u',
    'j',
    'k',
    'o',
    'l',
    'p',
    ';',
    "'"
  ],
  onDown: (i) => noteOn(60 + i),
  onUp: (i) => noteOff(60 + i)
})

/* ============ Анимация: осциллограф и метры ============ */
const cv = document.getElementById('ScopeCanvas'),
  cx = cv.getContext('2d')
const lvl = (db) =>
  clamp(((typeof db === 'number' ? db : -60) + 60) / 60, 0, 1) * 100 + '%'
;(function draw() {
  requestAnimationFrame(draw)
  const g = cx.createLinearGradient(0, 0, cv.width, 0)
  ;['#ff7aa8', '#ffb02e', '#fff59a', '#6fd89a', '#8ee3ff', '#d7b8e0'].forEach(
    (c, i) => g.addColorStop(i / 5, c)
  )
  cx.clearRect(0, 0, cv.width, cv.height)
  cx.lineWidth = 5
  cx.lineCap = cx.lineJoin = 'round'
  cx.strokeStyle = g
  cx.beginPath()
  const d = waveform.getValue()
  for (let i = 0; i < d.length; i++) {
    const x = (i / d.length) * cv.width,
      y = cv.height / 2 - d[i] * cv.height * 0.45
    i ? cx.lineTo(x, y) : cx.moveTo(x, y)
  }
  cx.stroke()
  liveMeters.forEach(([m, bar]) => (bar.style.width = lvl(m.getValue())))
})()
document.getElementById('StartButton').onclick = async () => {
  await Tone.start()
  document.getElementById('Start').remove()
}
