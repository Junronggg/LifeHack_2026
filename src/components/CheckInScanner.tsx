import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import './CheckInScanner.css'

type CheckInResult = {
  ok?: boolean
  error?: string
  status?: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'INVALID_QR'
  name?: string
  track?: string
  university?: string
  teamName?: string
  role?: string
  checkedInAt?: string
  checkedInBy?: string
}

function jsonpRequest(params: Record<string, string>): Promise<CheckInResult> {
  const endpoint = import.meta.env.VITE_CHECKIN_SCRIPT_URL
  if (!endpoint) {
    return Promise.reject(new Error('VITE_CHECKIN_SCRIPT_URL is not configured.'))
  }

  return new Promise((resolve, reject) => {
    const callback = `lifehackCheckIn_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const url = new URL(endpoint)
    Object.entries({ ...params, callback }).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const script = document.createElement('script')
    const callbackWindow = window as typeof window & Record<string, unknown>
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('The check-in server did not respond. Check the internet connection.'))
    }, 20000)

    function cleanup() {
      window.clearTimeout(timeout)
      script.remove()
      delete callbackWindow[callback]
    }

    callbackWindow[callback] = (result: CheckInResult) => {
      cleanup()
      if (result?.ok === false) reject(new Error(result.error || 'Check-in failed.'))
      else resolve(result)
    }

    script.onerror = () => {
      cleanup()
      reject(new Error('Could not reach the check-in server.'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

export default function CheckInScanner() {
  const [staffName, setStaffName] = useState(() => sessionStorage.getItem('lifehackCheckInStaff') || '')
  const [pin, setPin] = useState('')
  const [manualQr, setManualQr] = useState('')
  const [accessGranted, setAccessGranted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scanLockedRef = useRef(false)

  useEffect(() => {
    if (!accessGranted) return

    let cancelled = false
    const start = async () => {
      try {
        setCameraError('')
        const scanner = scannerRef.current || new Html5Qrcode('checkin-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!scanLockedRef.current) void submitCheckIn(decodedText)
          },
          () => undefined,
        )
      } catch (error) {
        if (!cancelled) setCameraError(error instanceof Error ? error.message : String(error))
      }
    }

    void start()
    return () => {
      cancelled = true
      const scanner = scannerRef.current
      if (scanner && scanner.getState() !== Html5QrcodeScannerState.NOT_STARTED) {
        void scanner.stop().catch(() => undefined)
      }
    }
  // submitCheckIn intentionally uses the current staff session values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessGranted])

  async function unlockScanner() {
    if (!staffName.trim() || !pin.trim()) return
    setBusy(true)
    setCameraError('')
    try {
      await jsonpRequest({ action: 'verify', pin: pin.trim(), staffName: staffName.trim() })
      sessionStorage.setItem('lifehackCheckInStaff', staffName.trim())
      setAccessGranted(true)
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitCheckIn(qrId: string) {
    if (!qrId.trim() || scanLockedRef.current) return
    scanLockedRef.current = true
    setBusy(true)
    setResult(null)

    const scanner = scannerRef.current
    if (scanner?.getState() === Html5QrcodeScannerState.SCANNING) scanner.pause(true)

    try {
      const response = await jsonpRequest({
        action: 'checkin',
        qrId: qrId.trim(),
        pin: pin.trim(),
        staffName: staffName.trim(),
      })
      setResult(response)
      if (response.status === 'CHECKED_IN') navigator.vibrate?.(180)
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  function scanNext() {
    setResult(null)
    setManualQr('')
    scanLockedRef.current = false
    const scanner = scannerRef.current
    if (scanner?.getState() === Html5QrcodeScannerState.PAUSED) scanner.resume()
  }

  const resultClass = result?.status === 'CHECKED_IN'
    ? 'success'
    : result?.status === 'ALREADY_CHECKED_IN'
      ? 'warning'
      : 'error'

  return (
    <main className="checkin-page">
      <h1>LifeHack 2026 Check-in</h1>
      <p className="checkin-subtitle">Staff scanner — do not share this page or PIN.</p>

      {!accessGranted && (
        <section className="checkin-card">
          <label htmlFor="staffName">Your name / desk</label>
          <input id="staffName" value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Example: Alice – Desk 1" />
          <label htmlFor="staffPin">Staff PIN</label>
          <input id="staffPin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} />
          <button disabled={busy || !staffName.trim() || !pin.trim()} onClick={() => void unlockScanner()}>
            {busy ? 'Checking access…' : 'Open scanner'}
          </button>
          {cameraError && <p className="checkin-error">{cameraError}</p>}
        </section>
      )}

      {accessGranted && !result && (
        <section className="checkin-card">
          <div id="checkin-reader" />
          {cameraError && <p className="checkin-error">Camera error: {cameraError}. Check this site’s camera permission and reload.</p>}
          {busy && <p className="checkin-status">Checking participant…</p>}
          <div className="checkin-manual">
            <label htmlFor="manualQr">Manual QR ID</label>
            <input id="manualQr" value={manualQr} onChange={(event) => setManualQr(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <button className="secondary" disabled={busy || !manualQr.trim()} onClick={() => void submitCheckIn(manualQr)}>Check in manually</button>
          </div>
        </section>
      )}

      {result && (
        <section className={`checkin-card checkin-result ${resultClass}`} aria-live="assertive">
          <h2>{result.status === 'CHECKED_IN' ? 'CHECKED IN' : result.status === 'ALREADY_CHECKED_IN' ? 'ALREADY CHECKED IN' : 'CHECK-IN FAILED'}</h2>
          {result.name && <h3>{result.name}</h3>}
          {result.status === 'INVALID_QR' && <p>QR not recognised. Use the problem-desk lookup.</p>}
          {result.error && <p>{result.error}</p>}
          {result.track && <p>{result.track}</p>}
          {result.university && <p>{result.university}</p>}
          {result.teamName && <p>Team: {result.teamName}</p>}
          {result.role && <p>Role: {result.role}</p>}
          {result.checkedInAt && <p>Time: {result.checkedInAt}</p>}
          {result.checkedInBy && <p>By: {result.checkedInBy}</p>}
          <button onClick={scanNext}>Scan next participant</button>
        </section>
      )}
    </main>
  )
}
