import { useEffect, useRef, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { MSYNC_PARK_URL } from '../lib/msync'
import { extractCardNo } from '../lib/cardno'

const isTauri = '__TAURI_INTERNALS__' in window

export function Park() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cardNo, setCardNo] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((e) => setError(`Camera unavailable: ${e.message} — type the card no. below instead.`))
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  async function scan() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setScanning(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      // ponytail: tesseract lazy-loaded on first scan; wasm/traineddata come from its CDN — pin langPath if offline ever matters
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      await worker.setParameters({ tessedit_char_whitelist: '0123456789' })
      const { data } = await worker.recognize(canvas)
      await worker.terminate()
      const no = extractCardNo(data.text)
      if (!no) setError('No digits found — hold the card closer and try again, or type it below.')
      setCardNo(no)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed')
    } finally {
      setScanning(false)
    }
  }

  async function sendToMsync() {
    setError(null)
    try {
      if (isTauri) {
        await writeText(cardNo)
        await invoke('open_park_window', { url: MSYNC_PARK_URL })
      } else {
        await navigator.clipboard.writeText(cardNo)
        window.open(MSYNC_PARK_URL)
      }
      setToast('Card no. copied — paste it in Msync')
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open Msync')
    }
  }

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Park</h1>

      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div class="max-w-xl space-y-4">
        <video ref={videoRef} autoplay muted playsinline class="w-full rounded-box bg-base-300" />

        <button class="btn btn-primary" onClick={scan} disabled={scanning}>
          {scanning && <span class="loading loading-spinner loading-xs" />}
          Scan card
        </button>

        <fieldset class="fieldset">
          <label class="label" for="park-card-no">Card no.</label>
          <input
            id="park-card-no"
            class="input w-full"
            inputmode="numeric"
            placeholder="Scan or type the card number"
            value={cardNo}
            onInput={(e) => {
              const digits = e.currentTarget.value.replace(/\D/g, '')
              e.currentTarget.value = digits
              setCardNo(digits)
            }}
          />
        </fieldset>

        <button class="btn btn-accent" onClick={sendToMsync} disabled={!cardNo}>
          Send to Msync
        </button>
      </div>

      {toast && (
        <div class="toast toast-end toast-bottom">
          <div class="alert alert-success" role="status">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  )
}
