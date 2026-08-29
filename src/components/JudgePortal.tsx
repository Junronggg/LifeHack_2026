import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './JudgePortal.css'

type Criterion = { key: string; label: string; description: string }
type SavedScore = {
  criterionScores: Record<string, number>
  overallScore: number
  comments: string
  updatedAt: string
}
type JudgeTeam = { teamCode: string; teamName: string; members: string[]; saved: SavedScore | null }
type PortalData = {
  ok: boolean
  error?: string
  token: string
  judge: { name: string; type: string; problemStatement: string; category: string }
  scoreMaximum: number
  criteria: Criterion[]
  teams: JudgeTeam[]
}
type SaveResult = SavedScore & { ok: boolean; error?: string; teamCode: string }
type Challenge = { ok: boolean; error?: string; challengeId: string; nonce: string }

const rubricPreview = ['Innovation', 'User Experience', 'Technical Feasibility', 'Scalability', 'Trust & Safety']

function validatePortalData(data: PortalData) {
  if (!data?.judge || !Array.isArray(data.teams) ||
      !Array.isArray(data.criteria) || data.criteria.length !== 5) {
    throw new Error(
      'The judging server is still using an older version. Refresh after the latest Apps Script deployment is published.',
    )
  }
  return data
}

function jsonpRequest<T extends { ok?: boolean; error?: string }>(params: Record<string, string>): Promise<T> {
  const endpoint = import.meta.env.VITE_JUDGE_SCRIPT_URL
  if (!endpoint) return Promise.reject(new Error('VITE_JUDGE_SCRIPT_URL is not configured.'))
  return new Promise((resolve, reject) => {
    const callback = `lifehackJudge_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const url = new URL(endpoint)
    Object.entries({ ...params, callback }).forEach(([key, value]) => url.searchParams.set(key, value))
    const script = document.createElement('script')
    const callbackWindow = window as typeof window & Record<string, unknown>
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('The judging server did not respond. Check your internet connection.')) }, 20000)
    function cleanup() { window.clearTimeout(timeout); script.remove(); delete callbackWindow[callback] }
    callbackWindow[callback] = (result: T) => {
      cleanup()
      if (result?.ok === false) reject(new Error(result.error || 'Request failed.'))
      else resolve(result)
    }
    script.onerror = () => { cleanup(); reject(new Error('Could not reach the judging server.')) }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

async function createPasswordProof(password: string, nonce: string) {
  if (!window.crypto?.subtle) throw new Error('This browser does not support secure judge login.')
  const encoder = new TextEncoder()
  const key = await window.crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await window.crypto.subtle.sign('HMAC', key, encoder.encode(nonce))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function JudgePortal() {
  const [portal, setPortal] = useState<PortalData | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTeamCode, setActiveTeamCode] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [comments, setComments] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem('lifehackJudgeToken') || ''
    if (!token) return
    jsonpRequest<PortalData>({ action: 'judgeRefresh', token })
      .then((data) => setPortal(validatePortalData(data)))
      .catch((failure) => {
        sessionStorage.removeItem('lifehackJudgeToken')
        setError(failure instanceof Error ? failure.message : String(failure))
      })
  }, [])

  const activeTeam = portal?.teams.find((team) => team.teamCode === activeTeamCode) || null
  const visibleTeams = useMemo(() => {
    if (!portal) return []
    const needle = query.trim().toLowerCase()
    return needle ? portal.teams.filter((team) => [team.teamCode, team.teamName, ...team.members].join(' ').toLowerCase().includes(needle)) : portal.teams
  }, [portal, query])
  const overallPreview = useMemo(() => {
    if (!portal || portal.criteria.some((criterion) => !scores[criterion.key])) return null
    const values = portal.criteria.map((criterion) => Number(scores[criterion.key]))
    return values.some((value) => !Number.isFinite(value)) ? null : values.reduce((sum, value) => sum + value, 0) / values.length
  }, [portal, scores])

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true); setError('')
    try {
      const normalizedUsername = username.trim().toLowerCase()
      const challenge = await jsonpRequest<Challenge>({ action: 'judgeChallenge', username: normalizedUsername })
      const proof = await createPasswordProof(password, challenge.nonce)
      const data = validatePortalData(await jsonpRequest<PortalData>({ action: 'judgeLogin', username: normalizedUsername, challengeId: challenge.challengeId, proof }))
      sessionStorage.setItem('lifehackJudgeToken', data.token)
      setPortal(data); setPassword('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }

  function openTeam(team: JudgeTeam) {
    const nextScores: Record<string, string> = {}
    portal?.criteria.forEach((criterion) => {
      const savedValue = team.saved?.criterionScores?.[criterion.key]
      nextScores[criterion.key] = savedValue == null ? '' : String(savedValue)
    })
    setActiveTeamCode(team.teamCode); setScores(nextScores); setComments(team.saved?.comments || ''); setSaveMessage('')
  }

  async function saveResult(event: FormEvent) {
    event.preventDefault()
    if (!portal || !activeTeam) return
    setBusy(true); setSaveMessage('')
    try {
      const scoreParams: Record<string, string> = {}
      portal.criteria.forEach((criterion) => { scoreParams[criterion.key] = scores[criterion.key] || '' })
      const result = await jsonpRequest<SaveResult>({ action: 'judgeSave', token: portal.token, teamCode: activeTeam.teamCode, ...scoreParams, comments })
      setPortal({ ...portal, teams: portal.teams.map((team) => team.teamCode === result.teamCode ? { ...team, saved: { criterionScores: result.criterionScores, overallScore: result.overallScore, comments: result.comments, updatedAt: result.updatedAt } } : team) })
      setSaveMessage('Saved successfully.'); window.setTimeout(() => setActiveTeamCode(''), 700)
    } catch (failure) { setSaveMessage(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }

  function logout() {
    const token = portal?.token || ''
    sessionStorage.removeItem('lifehackJudgeToken'); setPortal(null); setActiveTeamCode('')
    if (token) void jsonpRequest({ action: 'judgeLogout', token }).catch(() => undefined)
  }

  const submitted = portal?.teams.filter((team) => team.saved).length || 0
  const completion = portal?.teams.length ? Math.round((submitted / portal.teams.length) * 100) : 0

  return <main className="judge-page">
    <div className="judge-orb judge-orb-one" /><div className="judge-orb judge-orb-two" />
    <header className="judge-brand">
      <div className="judge-brandmark" aria-hidden="true"><span>LH</span><small>26</small></div>
      <div><p className="judge-eyebrow">LifeHack 2026 · Official judging</p><h1>Judging Portal</h1><p>Evaluate bold ideas shaping tomorrow’s digital experiences.</p></div>
    </header>

    {!portal ? <section className="judge-card judge-login-shell">
      <div className="judge-login-intro">
        <span className="judge-kicker">Welcome, judges</span><h2>Your expertise helps great ideas rise.</h2>
        <p>Score each assigned team against the five official criteria. Your work is saved securely to the organising committee’s judging sheet.</p>
        <div className="judge-rubric-preview">{rubricPreview.map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</div>
      </div>
      <div className="judge-login-form">
        <p className="judge-lock">Secure judge access</p><h2>Sign in</h2><p>Use the credentials issued by the organising committee.</p>
        <form onSubmit={(event) => void login(event)}>
          <label htmlFor="judgeUsername">Username</label><input id="judgeUsername" autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter username" required />
          <label htmlFor="judgePassword">Password</label><input id="judgePassword" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
          <button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Enter judging portal'}</button>{error && <p className="judge-error" role="alert">{error}</p>}
        </form>
      </div>
    </section> : <>
      <section className="judge-card judge-profile">
        <div className="judge-avatar" aria-hidden="true">{portal.judge.name.charAt(0)}</div>
        <div className="judge-profile-copy"><span>Signed in as</span><h2>{portal.judge.name}</h2><p>{portal.judge.type} · {portal.judge.problemStatement}</p></div>
        <span className="judge-track-pill">{portal.judge.category}</span><button className="judge-ghost" type="button" onClick={logout}>Log out</button>
      </section>
      <section className="judge-progress-panel"><div><span>Judging progress</span><strong>{submitted} of {portal.teams.length} teams completed</strong></div><b>{completion}%</b><div className="judge-progress-track"><span style={{ width: `${completion}%` }} /></div></section>
      <section className="judge-toolbar"><div><label className="judge-sr-only" htmlFor="judgeSearch">Search teams</label><input id="judgeSearch" type="search" placeholder="Search team code, name, or member…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span>{visibleTeams.length} team{visibleTeams.length === 1 ? '' : 's'}</span></section>
      <section className="judge-team-grid">
        {visibleTeams.map((team, index) => <article className={`judge-card judge-team ${team.saved ? 'is-complete' : ''}`} key={team.teamCode}>
          <div className="judge-team-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="judge-team-copy"><div className="judge-team-heading"><h2>{team.teamCode}</h2>{team.teamName && <span>{team.teamName}</span>}</div><p>{team.members.join(' · ')}</p></div>
          <div className="judge-team-action">{team.saved && <span className="judge-score-pill">{team.saved.overallScore.toFixed(1)}<small>/10</small></span>}<button className="judge-secondary" type="button" onClick={() => openTeam(team)}>{team.saved ? 'Review score' : 'Start scoring'}</button></div>
        </article>)}
        {!visibleTeams.length && <div className="judge-card judge-empty">No teams match your search.</div>}
      </section>
    </>}

    {portal && activeTeam && <div className="judge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setActiveTeamCode('') }}>
      <section className="judge-card judge-modal" role="dialog" aria-modal="true" aria-labelledby="judgeScoreTitle">
        <div className="judge-modal-header"><div><span>Official scorecard</span><h2 id="judgeScoreTitle">{activeTeam.teamCode}</h2><p>{activeTeam.teamName || 'Team submission'} · {activeTeam.members.join(', ')}</p></div><button className="judge-close" type="button" aria-label="Close scorecard" onClick={() => setActiveTeamCode('')}>×</button></div>
        <form onSubmit={(event) => void saveResult(event)}>
          <div className="judge-rubric-grid">{portal.criteria.map((criterion, index) => <div className="judge-rubric-item" key={criterion.key}>
            <span className="judge-rubric-number">0{index + 1}</span><div><label htmlFor={`judge-${criterion.key}`}>{criterion.label}</label><p id={`judge-${criterion.key}-help`}>{criterion.description}</p></div>
            <div className="judge-score-input"><input id={`judge-${criterion.key}`} aria-describedby={`judge-${criterion.key}-help`} type="number" min="0" max={portal.scoreMaximum} step="0.5" inputMode="decimal" value={scores[criterion.key] || ''} onChange={(event) => setScores({ ...scores, [criterion.key]: event.target.value })} required /><span>/ {portal.scoreMaximum}</span></div>
          </div>)}</div>
          <div className="judge-overall"><div><span>Overall score</span><small>Average of all five criteria</small></div><strong>{overallPreview == null ? '—' : overallPreview.toFixed(1)}<small>/10</small></strong></div>
          <label htmlFor="judgeComments">Comments <span>(optional)</span></label><textarea id="judgeComments" maxLength={2000} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Add concise notes for the organising committee…" />
          {saveMessage && <p className={saveMessage === 'Saved successfully.' ? 'judge-success' : 'judge-error'}>{saveMessage}</p>}
          <div className="judge-modal-actions"><button className="judge-ghost" type="button" onClick={() => setActiveTeamCode('')}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving…' : activeTeam.saved ? 'Update scorecard' : 'Submit scorecard'}</button></div>
        </form>
      </section>
    </div>}
  </main>
}
