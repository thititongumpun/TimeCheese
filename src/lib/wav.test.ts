import { describe, it, expect } from 'vitest'
import { downsample, encodeWav } from './wav'

describe('encodeWav', () => {
  it('writes header magics', () => {
    const buf = encodeWav(new Float32Array([0]), 16000)
    const bytes = new Uint8Array(buf)
    const str = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
    expect(str(0, 4)).toBe('RIFF')
    expect(str(8, 12)).toBe('WAVE')
    expect(str(12, 16)).toBe('fmt ')
    expect(str(36, 40)).toBe('data')
  })

  it('writes sampleRate and dataSize, and sizes the buffer', () => {
    const samples = new Float32Array([0, 0.5, -0.5])
    const buf = encodeWav(samples, 16000)
    const view = new DataView(buf)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
    expect(buf.byteLength).toBe(44 + samples.length * 2)
  })

  it('encodes samples as clamped 16-bit PCM', () => {
    const buf = encodeWav(new Float32Array([0.5, 1.0, -1.0, 2.0, -2.0]), 16000)
    const view = new DataView(buf)
    expect(view.getInt16(44, true)).toBe(16383)
    expect(view.getInt16(46, true)).toBe(32767)
    expect(view.getInt16(48, true)).toBe(-32768)
    expect(view.getInt16(50, true)).toBe(32767)
    expect(view.getInt16(52, true)).toBe(-32768)
  })
})

describe('downsample', () => {
  it('downsamples 48000 to 16000', () => {
    const samples = new Float32Array(4800)
    expect(downsample(samples, 48000, 16000).length).toBe(1600)
  })

  it('returns the identical array when fromRate === toRate', () => {
    const samples = new Float32Array([1, 2, 3])
    expect(downsample(samples, 16000, 16000)).toBe(samples)
  })

  it('averages windows for a ratio of 3', () => {
    const samples = new Float32Array([1, 1, 1, 0, 0, 0])
    expect(Array.from(downsample(samples, 3, 1))).toEqual([1, 0])
  })
})
