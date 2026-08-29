import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAnalytics } from './lib/analytics'

initializeAnalytics()

const query = new URLSearchParams(window.location.search)
const showCheckIn = query.get('page') === 'checkin' || window.location.pathname === '/checkin'
const showJudge = query.get('page') === 'judge' || window.location.pathname === '/judge'

// This lazy route keeps the QR camera library out of the public landing-page bundle.
// eslint-disable-next-line react-refresh/only-export-components
const CheckInScanner = lazy(() => import('./components/CheckInScanner.tsx'))
// eslint-disable-next-line react-refresh/only-export-components
const JudgePortal = lazy(() => import('./components/JudgePortal.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showJudge ? (
      <Suspense fallback={<div>Loading judging portal...</div>}>
        <JudgePortal />
      </Suspense>
    ) : showCheckIn ? (
      <Suspense fallback={<div>Loading staff scanner…</div>}>
        <CheckInScanner />
      </Suspense>
    ) : <App />}
  </StrictMode>,
)
