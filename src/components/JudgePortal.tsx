import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './JudgePortal.css'

type SavedScore = {
  overallScore: number
  comments: string
  updatedAt: string
}

type JudgeTeam = {
  teamCode: string
  teamName: string
  members: string[]
  saved: SavedScore | null
}

type PortalData = {
  ok: boolean
  error?: string
  token: string
  judge: {
    name: string
    type: string
    problemStatement: string
    category: string
  }
  scoreMaximum: number
  teams: JudgeTeam[]
}

type SaveResult = {
  ok: boolean
  error?: string
  teamCode: string
  overallScore: number
  comments: string
  updatedAt: string
}

type Challenge = {
  ok: boolean
  error?: string
  challengeId: string
  nonce: string
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
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('The judging server did not respond. Check your internet connection.'))
    }, 20000)

    function cleanup() {
      window.clearTimeout(timeout)
      script.remove()
      delete callbackWindow[callback]
    }

    callbackWindow[callback] = (result: T) => {
      cleanup()
      if (result?.ok === false) reject(new Error(result.error || 'Request failed.'))
      else resolve(result)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('Could not reach the judging server.'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

async function createPasswordProof(password: string, nonce: string) {
  if (!window.crypto?.subtle) throw new Error('This browser does not support secure judge login.')
  const encoder = new TextEncoder()
  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await window.crypto.subtle.sign('HMAC', key, encoder.encode(nonce))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export default function JudgePortal() {
  const [portal, setPortal] = useState<PortalData | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTeamCode, setActiveTeamCode] = useState('')
  const [score, setScore] = useState('')
  const [comments, setComments] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem('lifehackJudgeToken') || ''
    if (!token) return
    setBusy(true)
    jsonpRequest<PortalData>({ action: 'judgeRefresh', token })
      .then(setPortal)
      .catch(() => sessionStorage.removeItem('lifehackJudgeToken'))
      .finally(() => setBusy(false))
  }, [])

  const activeTeam = portal?.teams.find((team) => team.teamCode === activeTeamCode) || null
  const visibleTeams = useMemo(() => {
    if (!portal) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return portal.teams
    return portal.teams.filter((team) =>
      [team.teamCode, team.teamName, ...team.members].join(' ').toLowerCase().includes(needle),
    )
  }, [portal, query])

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      const normalizedUsername = username.trim().toLowerCase()
      const challenge = await jsonpRequest<Challenge>({
        action: 'judgeChallenge',
        username: normalizedUsername,
      })
      const proof = await createPasswordProof(password, challenge.nonce)
      const data = await jsonpRequest<PortalData>({
        action: 'judgeLogin',
        username: normalizedUsername,
        challengeId: challenge.challengeId,
        proof,
      })
      sessionStorage.setItem('lifehackJudgeToken', data.token)
      setPortal(data)
      setPassword('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  function openTeam(team: JudgeTeam) {
    setActiveTeamCode(team.teamCode)
    setScore(team.saved ? String(team.saved.overallScore) : '')
    setComments(team.saved?.comments || '')
    setSaveMessage('')
  }

  async function saveResult(event: FormEvent) {
    event.preventDefault()
    if (!portal || !activeTeam) return
    setBusy(true)
    setSaveMessage('')
    try {
      const result = await jsonpRequest<SaveResult>({
        action: 'judgeSave',
        token: portal.token,
        teamCode: activeTeam.teamCode,
        overallScore: score,
        comments,
      })
      setPortal({
        ...portal,
        teams: portal.teams.map((team) => team.teamCode === result.teamCode
          ? {
              ...team,
              saved: {
                overallScore: result.overallScore,
                comments: result.comments,
                updatedAt: result.updatedAt,
              },
            }
          : team),
      })
      setSaveMessage('Saved successfully.')
      window.setTimeout(() => setActiveTeamCode(''), 650)
    } catch (failure) {
      setSaveMessage(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    const token = portal?.token || ''
    sessionStorage.removeItem('lifehackJudgeToken')
    setPortal(null)
    setActiveTeamCode('')
    if (token) void jsonpRequest({ action: 'judgeLogout', token }).catch(() => undefined)
  }

  const submitted = portal?.teams.filter((team) => team.saved).length || 0

  return (
    <main className="judge-page">
      <header className="judge-brand">
        <p className="judge-eyebrow">LifeHack 2026</p>
        <h1>Judging Portal</h1>
        <p>Your assigned teams and scoring workspace.</p>
      </header>

      {!portal ? (
        <section className="judge-card judge-login">
          <h2>Judge login</h2>
          <p>Use the username and password issued by the organising committee.</p>
          <form onSubmit={(event) => void login(event)}>
            <label htmlFor="judgeUsername">Username</label>
            <input id="judgeUsername" autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <label htmlFor="judgePassword">Password</label>
            <input id="judgePassword" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button disabled={busy} type="submit">{busy ? 'Logging in...' : 'Log in'}</button>
            {error && <p className="judge-error" role="alert">{error}</p>}
          </form>
        </section>
      ) : (
        <>
          <section className="judge-card judge-profile">
            <div>
              <h2>{portal.judge.name}</h2>
              <p>{portal.judge.type} | {portal.judge.problemStatement} | {portal.judge.category}</p>
            </div>
            <button className="judge-ghost" type="button" onClick={logout}>Log out</button>
          </section>

          <section className="judge-toolbar">
            <label className="judge-sr-only" htmlFor="judgeSearch">Search teams</label>
            <input id="judgeSearch" type="search" placeholder="Search team code, name, or member" value={query} onChange={(event) => setQuery(event.target.value)} />
            <strong>{submitted} of {portal.teams.length} scored</strong>
          </section>

          <section className="judge-team-grid">
            {visibleTeams.map((team) => (
              <article className="judge-card judge-team" key={team.teamCode}>
                <div>
                  <h2>{team.teamCode}</h2>
                  {team.teamName && <h3>{team.teamName}</h3>}
                  <ul>{team.members.map((member) => <li key={member}>{member}</li>)}</ul>
                </div>
                <div className="judge-team-action">
                  {team.saved && <span>Saved | {team.saved.overallScore}/{portal.scoreMaximum}</span>}
                  <button className="judge-secondary" type="button" onClick={() => openTeam(team)}>
                    {team.saved ? 'Edit score' : 'Judge team'}
                  </button>
                </div>
              </article>
            ))}
            {!visibleTeams.length && <div className="judge-card judge-empty">No matching teams.</div>}
          </section>
        </>
      )}

      {portal && activeTeam && (
        <div className="judge-modal-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setActiveTeamCode('')
        }}>
          <section className="judge-card judge-modal" role="dialog" aria-modal="true" aria-labelledby="judgeScoreTitle">
            <h2 id="judgeScoreTitle">Judge team</h2>
            <p>{activeTeam.teamCode}{activeTeam.teamName ? ` | ${activeTeam.teamName}` : ''}</p>
            <form onSubmit={(event) => void saveResult(event)}>
              <label htmlFor="judgeScore">Overall score (0–{portal.scoreMaximum})</label>
              <input id="judgeScore" type="number" min="0" max={portal.scoreMaximum} step="0.01" inputMode="decimal" value={score} onChange={(event) => setScore(event.target.value)} required />
              <label htmlFor="judgeComments">Comments (optional)</label>
              <textarea id="judgeComments" maxLength={2000} value={comments} onChange={(event) => setComments(event.target.value)} />
              {saveMessage && <p className={saveMessage === 'Saved successfully.' ? 'judge-success' : 'judge-error'}>{saveMessage}</p>}
              <div className="judge-modal-actions">
                <button className="judge-ghost" type="button" onClick={() => setActiveTeamCode('')}>Cancel</button>
                <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save result'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
