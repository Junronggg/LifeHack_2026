import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAnalytics } from './lib/analytics'

initializeAnalytics()

const query = new URLSearchParams(window.location.search)
const showCheckIn = query.get('page') === 'checkin' || window.location.pathname === '/checkin'
const showJudge = query.get('page') === 'judge' || window.location.pathname === '/judge'

if (showJudge) {
  const judgePortalUrl = import.meta.env.VITE_JUDGE_PORTAL_URL
  if (judgePortalUrl) window.location.replace(judgePortalUrl)
}
// This lazy route keeps the QR camera library out of the public landing-page bundle.
// eslint-disable-next-line react-refresh/only-export-components
const CheckInScanner = lazy(() => import('./components/CheckInScanner.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showCheckIn ? (
      <Suspense fallback={<div>Loading staff scanner…</div>}>
        <CheckInScanner />
      </Suspense>
    ) : <App />}
  </StrictMode>,
)
