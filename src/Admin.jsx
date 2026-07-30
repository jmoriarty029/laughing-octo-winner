import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from './firebase'
import {
  addDoc, collection, onSnapshot, query, updateDoc, doc, arrayUnion, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import usePageMeta from './usePageMeta';

const ADMIN_CODE = 'love-2025'
const ADMIN_KEY = 'gp_admin_ok'
const MY_ROLE = 'admin'
const OTHER_ROLE = 'user'

function getPriority(g) {
  if (g.priority) return g.priority;
  if (g.severity === 'High') return 'red';
  if (g.severity === 'Low') return 'green';
  return 'yellow';
}
function getIsRequest(g) {
  return g.isRequest !== undefined ? g.isRequest : true;
}
function getAuthorRole(g) {
  return g.authorRole || 'user';
}
const priorityDot = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-rose-500' };
const priorityBorder = { green: 'border-l-2 border-l-emerald-400', yellow: 'border-l-2 border-l-amber-400', red: 'border-l-2 border-l-rose-400' };

function notify(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-admin-192.png' }); } catch (e) { console.error(e); }
  }
}

export default function Admin() {
  usePageMeta({
    title: 'Love Ledger',
    manifest: '/manifest.admin.json',
    themeColor: '#f4f4f5'
  });

  const [ok, setOk] = useState(localStorage.getItem(ADMIN_KEY) === 'true')
  const [input, setInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [notifOn, setNotifOn] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [activeTab, setActiveTab] = useState('posts');

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [fp, setFp] = useState('')
  const [ft, setFt] = useState('')
  const [term, setTerm] = useState('')
  const replyDrafts = useRef({});

  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState('yellow')
  const [isRequest, setIsRequest] = useState(true)

  const [scanEntries, setScanEntries] = useState([])
  const seenPostIds = useRef(null);
  const seenScanIds = useRef(null);

  useEffect(() => {
    if (!ok) return
    setIsLoading(true)
    setLoadError(null)
    const q = query(collection(db, 'grievances'))
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

      if (seenPostIds.current === null) {
        seenPostIds.current = new Set(list.map(p => p.id));
      } else {
        list.forEach(p => {
          if (!seenPostIds.current.has(p.id) && getAuthorRole(p) === OTHER_ROLE) {
            notify(
              getIsRequest(p) ? 'New request from Partner' : 'New message from Partner',
              `${p.title} — priority: ${getPriority(p)}`
            );
          }
        });
        seenPostIds.current = new Set(list.map(p => p.id));
      }

      setItems(list)
      setIsLoading(false)
    }, (err) => {
      console.error('Firebase query failed:', err)
      setLoadError(`Could not load posts: ${err.message || err.code || 'unknown error'}`)
      setIsLoading(false)
    })
    return () => unsub()
  }, [ok])

  useEffect(() => {
    if (!ok) return
    const q = query(collection(db, 'scanlog'))
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

      if (seenScanIds.current === null) {
        seenScanIds.current = new Set(list.map(s => s.id));
      } else {
        list.forEach(s => {
          if (!seenScanIds.current.has(s.id) && (s.authorRole || 'user') === OTHER_ROLE) {
            notify('New scans logged', `Partner logged ${s.count} scans`);
          }
        });
        seenScanIds.current = new Set(list.map(s => s.id));
      }

      setScanEntries(list)
    }, (err) => console.error('Scan log query failed:', err))
    return () => unsub()
  }, [ok])

  const filtered = useMemo(() => items.filter((g) => {
    const t = `${g.title||''} ${g.details||''}`.toLowerCase()
    const okText = !term || t.includes(term.toLowerCase())
    const okPrio = !fp || getPriority(g) === fp
    const okType = !ft || (ft === 'request' ? getIsRequest(g) : !getIsRequest(g))
    return okText && okPrio && okType
  }), [items, term, fp, ft])

  const summary = useMemo(() => ({
    total: filtered.length,
    requests: filtered.filter(getIsRequest).length,
  }), [filtered])

  const totalScans = useMemo(
    () => scanEntries.reduce((sum, e) => sum + (Number(e.count) || 0), 0),
    [scanEntries]
  );

  async function submitPost() {
    if (!title.trim()) { alert('Please add a title'); return; }
    await addDoc(collection(db, 'grievances'), {
      title: title.trim(),
      details: details.trim(),
      priority,
      isRequest,
      authorRole: MY_ROLE,
      createdAt: serverTimestamp(),
      updates: [],
    });
    setTitle(''); setDetails(''); setPriority('yellow'); setIsRequest(true);
  }

  async function addReply(id) {
    const text = (replyDrafts.current[id] || '').trim();
    if (!text) return;
    try {
      await updateDoc(doc(db, 'grievances', id), { updates: arrayUnion({ text, at: new Date() }) })
      const el = document.getElementById(`reply-${id}`);
      if (el) el.value = '';
    } catch (err) {
      console.error('Failed to post reply:', err)
      alert('Failed to post reply: ' + (err.message || err.code || 'unknown error'))
    }
  }

  async function deletePost(id) {
    if (confirm('Are you sure you want to delete this post?')) {
        await deleteDoc(doc(db, 'grievances', id));
    }
  }

  function handleLogin() {
    if (input === ADMIN_CODE) {
      localStorage.setItem(ADMIN_KEY, 'true')
      setLoginError('')
      setOk(true)
    } else {
      setLoginError('Incorrect passcode. Please try again.')
    }
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_KEY);
    setOk(false);
  }

  function enableNotifications() {
    if (typeof Notification === 'undefined') { alert('Notifications are not supported in this browser.'); return; }
    Notification.requestPermission().then(p => setNotifOn(p === 'granted'));
  }

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-semibold mb-1 text-zinc-900 flex items-center gap-2"><span className="text-zinc-400">♡</span> Love Ledger</h1>
          <p className="text-sm text-zinc-500 mb-4">Please enter your passcode.</p>
          <input
            type="password"
            value={input}
            onChange={e=>{setInput(e.target.value); setLoginError('')}}
            className={`border rounded-xl px-3 py-2 w-full ${loginError ? 'border-rose-400' : 'border-zinc-300'}`}
            placeholder="Passcode"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          {loginError && <p className="text-sm text-rose-600 mt-2">{loginError}</p>}
          <button onClick={() => handleLogin()} className="mt-3 w-full px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium">Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2"><span className="text-zinc-400">♡</span> Love Ledger</h1>
          <div className="flex items-center gap-2">
            <button onClick={enableNotifications} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${notifOn ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {notifOn ? 'Notifications on' : 'Enable notifications'}
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm font-medium">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === 'posts' && (
          <>
            <section className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs text-zinc-500">Total posts</p>
                <p className="text-2xl font-semibold text-zinc-900">{summary.total}</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs text-zinc-500">Requests</p>
                <p className="text-2xl font-semibold text-zinc-900">{summary.requests}</p>
              </div>
            </section>

            <section className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-base font-semibold mb-3 text-zinc-900">New post</h2>
              <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2 w-full" placeholder="Title" />
              <textarea value={details} onChange={(e)=>setDetails(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2 w-full mt-3" rows="3" placeholder="Details (optional)" />
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-zinc-500">Priority:</span>
                {['green','yellow','red'].map((p)=> (
                  <button key={p} onClick={()=>setPriority(p)} className={`w-5 h-5 rounded-full ${priorityDot[p]} ${priority===p ? 'ring-2 ring-offset-2 ring-zinc-800' : ''}`} aria-label={p}></button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" checked={isRequest} onChange={(e)=>setIsRequest(e.target.checked)} className="w-4 h-4" />
                This is a request (needs a response) — uncheck for just a message
              </label>
              <button onClick={submitPost} className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium">Post</button>
            </section>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <select value={fp} onChange={e=>setFp(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2">
                <option value="">All priorities</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option>
              </select>
              <select value={ft} onChange={e=>setFt(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2">
                <option value="">All types</option><option value="request">Requests</option><option value="message">Messages</option>
              </select>
              <input value={term} onChange={e=>setTerm(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2 flex-grow" placeholder="Search…" />
            </div>

            {isLoading && <div className="text-center text-zinc-500 mb-4">Loading posts...</div>}
            {loadError && <div className="text-center text-rose-600 bg-rose-50 p-4 rounded-xl mb-4">{loadError}</div>}
            {!isLoading && !loadError && filtered.length === 0 && (
              <div className="text-center text-zinc-500 mb-4">No posts found.</div>
            )}

            <section className="space-y-3">
              {filtered.map((g) => {
                const mine = getAuthorRole(g) === MY_ROLE;
                const canReply = !mine;
                const prio = getPriority(g);
                return (
                  <div key={g.id} className={`max-w-[92%] ${mine ? 'ml-auto' : 'mr-auto'}`}>
                    <div className={`border border-zinc-200 rounded-2xl shadow-sm p-4 ${priorityBorder[prio]} ${mine ? 'bg-zinc-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{mine ? 'Me' : 'Partner'}</span>
                        {getIsRequest(g) && <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-300 text-zinc-600 uppercase tracking-wide">Request</span>}
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-900">{g.title}</h3>
                      {g.details && <p className="text-sm text-zinc-600 mt-1">{g.details}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${priorityDot[prio]}`}></span>
                        <span className="text-xs text-zinc-400">{g.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                      </div>

                      {Array.isArray(g.updates) && g.updates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-200 text-sm">
                          <ul className="space-y-2">
                            {[...g.updates]
                              .sort((a, b) => (b?.at?.seconds || 0) - (a?.at?.seconds || 0))
                              .map((update, index) => {
                                if (!update || typeof update.text !== 'string') return null;
                                const updateDate = update.at?.toDate ? update.at.toDate() : null;
                                return (
                                  <li key={index} className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 p-2 rounded-lg">
                                    <p className="font-medium">{update.text}</p>
                                    {updateDate && (
                                      <p className="text-[10px] text-zinc-400 mt-1">{updateDate.toLocaleString()}</p>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}

                      {canReply && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 flex gap-2">
                          <input id={`reply-${g.id}`} onChange={(e)=>{replyDrafts.current[g.id]=e.target.value}} className="border border-zinc-300 rounded-lg px-2 py-1 flex-grow text-sm" placeholder="Reply…" onKeyPress={(e)=> e.key==='Enter' && addReply(g.id)} />
                          <button onClick={()=>addReply(g.id)} className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium">Send</button>
                        </div>
                      )}
                      <div className="mt-2 text-right">
                        <button onClick={() => deletePost(g.id)} className="text-xs text-zinc-400 hover:text-rose-600 hover:underline">Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {activeTab === 'logbook' && (
          <section className="space-y-2">
            <div className="rounded-2xl shadow-sm p-6 mb-4 bg-zinc-900 border border-zinc-700">
              <h2 className="text-base font-semibold text-zinc-100">Log Book</h2>
              <p className="text-5xl font-semibold text-zinc-50 mt-4 tracking-tight">{totalScans}<span className="text-base font-normal text-zinc-500 ml-2">total logged</span></p>
            </div>
            {scanEntries.length === 0 && <div className="text-center text-zinc-500">No scans logged yet</div>}
            {scanEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-zinc-900 text-zinc-100 rounded-xl px-4 py-3 border border-zinc-700">
                <span className="font-medium">{e.count} scans <span className="text-xs text-zinc-500 ml-1">({(e.authorRole||'user')===MY_ROLE ? 'Me' : 'Partner'})</span></span>
                <span className="text-xs text-zinc-500">{e.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
              </div>
            ))}
          </section>
        )}
      </main>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 backdrop-blur-xl bg-white/80 border border-zinc-200 shadow-md rounded-full px-2 py-2">
        <button onClick={() => setActiveTab('posts')} className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab==='posts' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}>
          Posts · {summary.total}
        </button>
        <button onClick={() => setActiveTab('logbook')} className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab==='logbook' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}>
          Log Book · {totalScans}
        </button>
      </div>
    </div>
  )
}
