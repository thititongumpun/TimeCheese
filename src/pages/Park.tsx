import { useEffect, useRef, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { MSYNC_PARK_URL } from '../lib/msync'
import { fetchVehicles, createVehicle, deleteVehicle, setDefaultVehicle } from '../services/vehicles'
import type { Vehicle } from '../types'

const isTauri = '__TAURI_INTERNALS__' in window

// Text the Msync carpark dropdown shows for each vehicle type.
const MSYNC_TYPE: Record<Vehicle['vehicle_type'], string> = {
  car: 'รถยนต์',
  motorcycle: 'มอเตอร์ไซต์',
}

const TYPE_ICON: Record<Vehicle['vehicle_type'], string> = {
  car: '🚗',
  motorcycle: '🏍️',
}

// One "Send to Msync" run that reached Submit — mirrors the Home fill log.
type ParkRun = { at: string; cardNo: string }

function readParkLog(): ParkRun[] {
  try { return JSON.parse(localStorage.getItem('park_fill_log') ?? '[]') } catch { return [] }
}

export function Park() {
  const [cardNo, setCardNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fillLog, setFillLog] = useState<ParkRun[]>(readParkLog)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [newType, setNewType] = useState<Vehicle['vehicle_type']>('car')
  const [newPlate, setNewPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The vehicle sent to Msync: the default one, else the first.
  const selected = vehicles.find((v) => v.is_default) ?? vehicles[0] ?? null

  async function loadVehicles() {
    const { data, error } = await fetchVehicles()
    if (error) setError(error.message)
    else setVehicles(data ?? [])
  }

  useEffect(() => { loadVehicles() }, [])

  // Registered once for the component's life — Rust emits this when the fill script
  // clicks Submit, seconds-to-minutes after open_park_window returns.
  useEffect(() => {
    if (!isTauri) return
    const unlistening = listen<string>('park-filled', ({ payload: card }) => {
      if (sendTimeout.current) clearTimeout(sendTimeout.current)
      setSending(false)
      const log = [{ at: new Date().toISOString(), cardNo: card }, ...readParkLog()].slice(0, 50)
      localStorage.setItem('park_fill_log', JSON.stringify(log))
      setFillLog(log)
      showToast(`Card ${card} submitted in Msync`)
    })
    return () => { unlistening.then((unlisten) => unlisten()) }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function addVehicle() {
    setSaving(true)
    setError(null)
    const { error } = await createVehicle({
      vehicle_type: newType,
      license_plate: newPlate.trim(),
      is_default: vehicles.length === 0, // first vehicle becomes the default
    })
    setSaving(false)
    if (error) setError(error.message)
    else {
      setNewPlate('')
      loadVehicles()
    }
  }

  async function removeVehicle(id: string) {
    const { error } = await deleteVehicle(id)
    if (error) setError(error.message)
    else loadVehicles()
  }

  async function makeDefault(id: string) {
    const prev = vehicles
    setVehicles((vs) => vs.map((v) => ({ ...v, is_default: v.id === id }))) // optimistic — avoids the radio snapping back while the mutation is in flight
    const { error } = await setDefaultVehicle(id)
    if (error) {
      setError(error.message)
      setVehicles(prev)
    }
  }

  async function sendToMsync() {
    if (!selected) return
    setError(null)
    setSending(true)
    try {
      if (isTauri) {
        await writeText(cardNo) // clipboard fallback in case the autofill misses
        await invoke('open_park_window', {
          url: MSYNC_PARK_URL,
          cardNo,
          carType: MSYNC_TYPE[selected.vehicle_type],
          plate: selected.license_plate,
        })
        showToast('Msync opened — autofilling card ' + cardNo)
        // Stays "sending" until the park-filled listener above fires, or this times out
        // (the window can be closed before the fill script finishes, which never emits).
        sendTimeout.current = setTimeout(() => setSending(false), 120_000)
      } else {
        await navigator.clipboard.writeText(cardNo)
        window.open(MSYNC_PARK_URL)
        showToast('Card no. copied — paste it in Msync')
        setSending(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open Msync')
      setSending(false)
    }
  }

  return (
    <div class="p-6">
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display font-bold text-2xl">Park</h1>
          <p class="text-sm opacity-60 font-mono">
            {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}{selected ? ` · sending as ${selected.license_plate}` : ''}
          </p>
        </div>
      </header>

      {error && (
        <div class="alert alert-error mb-4 max-w-4xl">
          <span>{error}</span>
        </div>
      )}

      <div class="grid gap-6 items-start lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] max-w-4xl">
        {/* PRIMARY — action zone: compact tool, not a hero */}
        <section class="card bg-base-200 border-2 border-base-300">
          <div class="card-body gap-3 p-4">
            <h2 class="card-title text-base">
              <span aria-hidden="true">🎫</span> Send to Msync
            </h2>

            {/* selected vehicle — non-interactive "parking ticket" display; hover-3d zones block clicks so no controls live inside it */}
            {selected ? (
              <div class="hover-3d mx-auto w-fit">
                <div class="flex flex-col items-center gap-1 rounded-box border-2 border-primary bg-base-100 px-6 py-3">
                  <span class="font-mono font-bold text-2xl tracking-widest">{selected.license_plate}</span>
                  <span class="badge badge-ghost badge-sm">
                    <span aria-hidden="true">{TYPE_ICON[selected.vehicle_type]}</span> {MSYNC_TYPE[selected.vehicle_type]}
                  </span>
                </div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            ) : (
              <p class="font-mono text-sm opacity-60">No vehicle selected — add one to enable sending.</p>
            )}

            <fieldset class="fieldset">
              <label class="label" for="park-card-no">Card no.</label>
              <label class="otp otp-lg mx-auto">
                <span></span>
                <span></span>
                <span></span>
                <input
                  id="park-card-no"
                  type="text"
                  inputmode="numeric"
                  maxlength={3}
                  pattern="[0-9]{3}"
                  value={cardNo}
                  onInput={(e) => {
                    const digits = e.currentTarget.value.replace(/\D/g, '')
                    e.currentTarget.value = digits
                    setCardNo(digits)
                  }}
                />
              </label>
            </fieldset>

            <div class="card-actions">
              <div class="aura aura-dual w-full">
              <button
                class="btn btn-primary btn-block"
                onClick={sendToMsync}
                disabled={!cardNo || !selected || sending}
              >
                {sending && <span class="loading loading-spinner loading-xs" />}
                Send to Msync
              </button>
              </div>
            </div>
            <p class="text-xs opacity-60 text-center">
              {selected
                ? `Submits as ${TYPE_ICON[selected.vehicle_type]} ${selected.license_plate}`
                : 'Add a vehicle to enable sending.'}
            </p>
          </div>
        </section>

        {/* SECONDARY — vehicles: quiet outlined surface, no fill so it recedes */}
        <section class="card border-2 border-base-300">
          <div class="card-body gap-3">
            <h2 class="card-title text-base">
              <span aria-hidden="true">🚙</span> Vehicles
              {vehicles.length > 0 && <span class="badge badge-ghost badge-sm">{vehicles.length}</span>}
            </h2>

            {vehicles.length === 0 ? (
              <p class="font-mono text-sm opacity-60">No vehicles yet — add one below.</p>
            ) : (
              <ul>
                {vehicles.map((v) => (
                  <li key={v.id} class="flex items-center gap-3 border-b border-base-300 py-1.5 last:border-none hover:bg-base-200 transition-colors">
                    <input
                      type="radio"
                      name="default-vehicle"
                      class="radio radio-sm radio-accent"
                      checked={selected?.id === v.id}
                      onChange={() => makeDefault(v.id)}
                      aria-label={`Use ${v.license_plate}`}
                    />
                    <span class="text-lg" aria-hidden="true">{TYPE_ICON[v.vehicle_type]}</span>
                    <span class="flex-1 flex items-center gap-2">
                      <span class="font-mono font-medium">{v.license_plate}</span>
                      <span class="badge badge-ghost badge-sm">{MSYNC_TYPE[v.vehicle_type]}</span>
                    </span>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      onClick={() => removeVehicle(v.id)}
                      aria-label={`Remove ${v.license_plate}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div class="join w-full">
              <select
                class="select select-sm join-item w-28"
                value={newType}
                onInput={(e) => setNewType(e.currentTarget.value as Vehicle['vehicle_type'])}
              >
                <option value="car">รถยนต์</option>
                <option value="motorcycle">มอเตอร์ไซต์</option>
              </select>
              <input
                class="input input-sm join-item flex-1 font-mono"
                placeholder="License plate"
                value={newPlate}
                onInput={(e) => setNewPlate(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newPlate.trim() && !saving) addVehicle() }}
              />
              <button
                class="btn btn-sm btn-ghost join-item"
                onClick={addVehicle}
                disabled={!newPlate.trim() || saving}
              >
                {saving && <span class="loading loading-spinner loading-xs" />}
                Add vehicle
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* TERTIARY — fill log: quiet, dense, mono timestamps */}
      {isTauri && fillLog.length > 0 && (
        <section class="mt-6 max-w-4xl border-2 border-base-300 rounded-box p-4">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs uppercase tracking-wide opacity-60 flex items-center gap-2">
              Park fill log
              <span class="badge badge-ghost badge-sm">{fillLog.length}</span>
            </h2>
            <button
              class="btn btn-ghost btn-xs"
              onClick={() => {
                localStorage.removeItem('park_fill_log')
                setFillLog([])
              }}
            >
              Clear log
            </button>
          </div>
          <ul class="text-sm">
            {fillLog.map((run) => (
              <li key={run.at} class="flex justify-between border-b border-base-300 py-1 last:border-none hover:bg-base-200 transition-colors">
                <span class="font-mono">Card {run.cardNo}</span>
                <span class="opacity-60 font-mono">{new Date(run.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
