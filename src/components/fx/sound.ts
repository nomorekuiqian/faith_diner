'use client'

// 用 WebAudio 现场合成的小音效，不需要音频文件。默认关闭，用户在顶栏打开。
const KEY = 'faith-recharge:sound'
let ctx: AudioContext | null = null
let enabled = false

try {
  enabled = typeof window !== 'undefined' && localStorage.getItem(KEY) === '1'
} catch {
  enabled = false
}

export function isSoundOn() {
  return enabled
}

export function setSoundOn(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* 忽略 */
  }
  if (on) sfx.coin()
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  coin() {
    if (!enabled) return
    tone(988, 0, 0.08)
    tone(1319, 0.07, 0.3)
  },
  crit() {
    if (!enabled) return
    ;[784, 988, 1319, 1568].forEach((f, i) => tone(f, i * 0.06, 0.22))
  },
  doubt() {
    if (!enabled) return
    tone(220, 0, 0.18, 'sine', 0.09)
    tone(147, 0.1, 0.3, 'sine', 0.07)
  },
  sober() {
    if (!enabled) return
    tone(660, 0, 0.12, 'triangle', 0.06)
    tone(880, 0.08, 0.2, 'triangle', 0.05)
  },
  flip() {
    if (!enabled) return
    tone(520, 0, 0.05, 'triangle', 0.04)
  },
  full() {
    if (!enabled) return
    ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.35, 'square', 0.045))
  },
  ding() {
    if (!enabled) return
    tone(1760, 0, 0.6, 'sine', 0.08)
    tone(2637, 0.02, 0.9, 'sine', 0.05)
  },
  // 热敏打印机走纸的嗡嗡声，返回停止函数
  printer(): () => void {
    if (!enabled) return () => {}
    const c = audio()
    if (!c) return () => {}
    const o = c.createOscillator()
    const g = c.createGain()
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    o.type = 'sawtooth'
    o.frequency.value = 92
    lfo.type = 'square'
    lfo.frequency.value = 26
    lfoGain.gain.value = 0.018
    g.gain.value = 0.02
    lfo.connect(lfoGain).connect(g.gain)
    o.connect(g).connect(c.destination)
    o.start()
    lfo.start()
    return () => {
      const t = c.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      o.stop(t + 0.15)
      lfo.stop(t + 0.15)
    }
  }
}
