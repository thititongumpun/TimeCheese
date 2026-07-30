// Thin browser wiring around MediaRecorder, with a ScriptProcessor fallback
// for platforms (WebKitGTK) that don't support MediaRecorder at all. Logic
// is in wav.ts, which is unit-tested; this file is DOM glue only.
import { downsample, encodeWav } from './wav'

export interface Recorder {
  stop(): Promise<Blob>
}

export function startRecording(stream: MediaStream): Recorder {
  if (typeof MediaRecorder !== 'undefined') {
    const recorder = tryCreateMediaRecorder(stream)
    if (recorder) return startMediaRecorder(recorder)
  }
  return startScriptProcessorFallback(stream)
}

function tryCreateMediaRecorder(stream: MediaStream): MediaRecorder | null {
  try {
    return new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
  } catch {
    try {
      return new MediaRecorder(stream)
    } catch {
      return null
    }
  }
}

function startMediaRecorder(recorder: MediaRecorder): Recorder {
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.start()

  return {
    stop() {
      return new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        recorder.stop()
      })
    },
  }
}

function startScriptProcessorFallback(stream: MediaStream): Recorder {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  // ponytail: ScriptProcessorNode is deprecated but universal; swap to AudioWorklet if it's ever removed.
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []

  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  source.connect(proc)
  proc.connect(ctx.destination)

  return {
    async stop() {
      source.disconnect()
      proc.disconnect()
      await ctx.close()

      const total = chunks.reduce((n, c) => n + c.length, 0)
      const all = new Float32Array(total)
      let offset = 0
      for (const c of chunks) {
        all.set(c, offset)
        offset += c.length
      }

      const buf = encodeWav(downsample(all, ctx.sampleRate), 16000)
      return new Blob([buf], { type: 'audio/wav' })
    },
  }
}
