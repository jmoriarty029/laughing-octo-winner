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
const priorityClasses = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
};
const priorityBorder = {
  green: 'border-l-4 border-l-green-400',
  yellow: 'border-l-4 border-l-yellow-400',
  red: 'border-l-4 border-l-red-400',
};

function notify(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-admin-192.png' }); } catch (e) { console.error(e); }
  }
}

export default function Admin() {
  usePageMeta({
    title: '💌 Love Ledger',
    manifest: '/manifest.admin.json',
    themeColor: '#ec4899'
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
              getIsRequest(p) ? '📌 New request from Partner' : '💬 New message from Partner',
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
            notify('🩻 New scans logged', `Partner logged ${s.count} scans`);
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
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-2 text-pink-600">💌 Login</h1>
          <p className="text-sm text-gray-600 mb-4">Please enter your passcode.</p>
          <input
            type="password"
            value={input}
            onChange={e=>{setInput(e.target.value); setLoginError('')}}
            className={`border rounded-xl px-3 py-2 w-full ${loginError ? 'border-red-400' : ''}`}
            placeholder="Passcode"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          {loginError && <p className="text-sm text-red-600 mt-2">{loginError}</p>}
          <button onClick={() => handleLogin()} className="mt-3 w-full px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold">Enter</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 border-b border-white/40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-pink-600">💌 Love Ledger</h1>
          <div className="flex items-center gap-2">
            <button onClick={enableNotifications} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${notifOn ? 'bg-pink-100 text-pink-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {notifOn ? '🔔 On' : '🔕 Enable Notifications'}
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === 'posts' && (
          <>
            <section className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white rounded-2xl shadow p-4">
                <p className="text-xs text-gray-500">Total Posts</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4">
                <p className="text-xs text-gray-500">Requests</p>
                <p className="text-2xl font-bold">{summary.requests}</p>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-3 text-pink-700">New Post</h2>
              <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border rounded-xl px-3 py-2 w-full" placeholder="Title" />
              <textarea value={details} onChange={(e)=>setDetails(e.target.value)} className="border rounded-xl px-3 py-2 w-full mt-3" rows="3" placeholder="Details (optional)" />
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">Priority:</span>
                {['green','yellow','red'].map((p)=> (
                  <button key={p} onClick={()=>setPriority(p)} className={`w-7 h-7 rounded-full border-2 ${priority===p ? 'ring-2 ring-offset-1 ring-pink-500' : ''} ${p==='green'?'bg-green-400 border-green-500':p==='yellow'?'bg-yellow-400 border-yellow-500':'bg-red-400 border-red-500'}`} aria-label={p}></button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isRequest} onChange={(e)=>setIsRequest(e.target.checked)} className="w-4 h-4" />
                This is a request (needs a response) — uncheck for just a message
              </label>
              <button onClick={submitPost} className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold">Post it 💌</button>
            </section>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <select value={fp} onChange={e=>setFp(e.target.value)} className="border rounded-xl px-3 py-2">
                <option value="">All Priorities</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option>
              </select>
              <select value={ft} onChange={e=>setFt(e.target.value)} className="border rounded-xl px-3 py-2">
                <option value="">All Types</option><option value="request">Requests</option><option value="message">Messages</option>
              </select>
              <input value={term} onChange={e=>setTerm(e.target.value)} className="border rounded-xl px-3 py-2 flex-grow" placeholder="Search…" />
            </div>

            {isLoading && <div className="text-center text-gray-500 mb-4">Loading posts...</div>}
            {loadError && <div className="text-center text-red-600 bg-red-100 p-4 rounded-xl mb-4">{loadError}</div>}
            {!isLoading && !loadError && filtered.length === 0 && (
              <div className="text-center text-gray-500 mb-4">No posts found.</div>
            )}

            <section className="space-y-3">
              {filtered.map((g) => {
                const mine = getAuthorRole(g) === MY_ROLE;
                const canReply = !mine;
                const prio = getPriority(g);
                return (
                  <div key={g.id} className={`max-w-[92%] ${mine ? 'ml-auto' : 'mr-auto'}`}>
                    <div className={`bg-white rounded-2xl shadow p-4 ${priorityBorder[prio]}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs font-semibold ${mine ? 'text-pink-600' : 'text-slate-600'}`}>{mine ? 'Me' : 'Partner'}</span>
                        {getIsRequest(g) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-600 text-white font-semibold">📌 Request</span>}
                      </div>
                      <h3 className="text-lg font-semibold text-pink-700">{g.title}</h3>
                      {g.details && <p className="text-sm text-gray-700 mt-1">{g.details}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-sm border ${priorityClasses[prio]}`}>{prio}</span>
                        <span className="px-2 py-0.5 rounded-full text-sm border bg-pink-50 text-pink-600 border-pink-200">🕒 {g.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                      </div>

                      {Array.isArray(g.updates) && g.updates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
                          <ul className="space-y-2">
                            {[...g.updates]
                              .sort((a, b) => (b?.at?.seconds || 0) - (a?.at?.seconds || 0))
                              .map((update, index) => {
                                if (!update || typeof update.text !== 'string') return null;
                                const updateDate = update.at?.toDate ? update.at.toDate() : null;
                                return (
                                  <li key={index} className="text-xs text-gray-800 bg-pink-50 border border-pink-100 p-2 rounded-lg">
                                    <p className="font-medium">💌 "{update.text}"</p>
                                    {updateDate && (
                                      <p className="text-[10px] text-pink-500 mt-1">🕒 {updateDate.toLocaleString()}</p>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}

                      {canReply && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                          <input id={`reply-${g.id}`} onChange={(e)=>{replyDrafts.current[g.id]=e.target.value}} className="border rounded-lg px-2 py-1 flex-grow text-sm" placeholder="Reply…" onKeyPress={(e)=> e.key==='Enter' && addReply(g.id)} />
                          <button onClick={()=>addReply(g.id)} className="px-3 py-1 rounded-lg bg-pink-600 text-white text-sm font-semibold">Send</button>
                        </div>
                      )}
                      <div className="mt-2 text-right">
                        <button onClick={() => deletePost(g.id)} className="text-xs text-red-600 hover:underline">Delete</button>
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
            <div className="rounded-2xl shadow-lg p-6 mb-4 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 border border-cyan-500/30 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%)]"></div>
              <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">🩻 Log Book</h2>
              <p className="text-5xl font-black text-cyan-300 mt-4 tracking-tight">{totalScans}<span className="text-base font-medium text-cyan-100/60 ml-2">total logged</span></p>
            </div>
            {scanEntries.length === 0 && <div className="text-center text-gray-500">No scans logged yet 🩻</div>}
            {scanEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-slate-800 text-cyan-100 rounded-xl px-4 py-3 border border-cyan-500/20">
                <span className="font-semibold">🩻 {e.count} scans <span className="text-xs text-cyan-100/50 ml-1">({(e.authorRole||'user')===MY_ROLE ? 'Me' : 'Partner'})</span></span>
                <span className="text-xs text-cyan-100/50">🕒 {e.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
              </div>
            ))}
          </section>
        )}
      </main>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 backdrop-blur-xl bg-white/40 border border-white/60 shadow-xl rounded-full px-2 py-2">
        <button onClick={() => setActiveTab('posts')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab==='posts' ? 'bg-pink-600 text-white shadow' : 'text-pink-700'}`}>
          💌 Posts · {summary.total}
        </button>
        <button onClick={() => setActiveTab('logbook')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab==='logbook' ? 'bg-slate-900 text-cyan-300 shadow' : 'text-slate-700'}`}>
          🩻 Log Book · {totalScans}
        </button>
      </div>
    </div>
  )
}
