import { useEffect, useMemo, useRef, useState } from 'react'
import InstallPrompt from './InstallPrompt'
import { db } from './firebase'
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, doc, arrayUnion
} from 'firebase/firestore'
import usePageMeta from './usePageMeta';

const clientKey = 'gp_client_id'
let clientId = localStorage.getItem(clientKey)
if (!clientId) { clientId = 'c_' + Math.random().toString(36).slice(2); localStorage.setItem(clientKey, clientId) }

const USER_CODE = 'my-love-2025'
const USER_KEY = 'gp_user_ok'
const MY_ROLE = 'user'
const OTHER_ROLE = 'admin'
const MY_NAME = 'Puchu'

const DRAFT_TITLE_KEY = 'gp_draft_title';
const DRAFT_DETAILS_KEY = 'gp_draft_details';
const DRAFT_PRIORITY_KEY = 'gp_draft_priority';

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
const priorityLabel = { green: 'Low', yellow: 'Medium', red: 'High' };
const priorityBadge = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
};
const priorityDot = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-rose-500' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function notify(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-192.png' }); } catch (e) { console.error(e); }
  }
}

export default function App() {
  usePageMeta({
    title: 'Love Ledger',
    manifest: '/manifest.json',
    themeColor: '#fafaf9'
  });

  const [loggedIn, setLoggedIn] = useState(localStorage.getItem(USER_KEY) === 'true');
  const [input, setInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [notifOn, setNotifOn] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [composeOpen, setComposeOpen] = useState(false);

  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState(localStorage.getItem(DRAFT_TITLE_KEY) || '')
  const [details, setDetails] = useState(localStorage.getItem(DRAFT_DETAILS_KEY) || '')
  const [priority, setPriority] = useState(localStorage.getItem(DRAFT_PRIORITY_KEY) || 'yellow')
  const [isRequest, setIsRequest] = useState(true)
  const replyDrafts = useRef({});

  const [scanEntries, setScanEntries] = useState([]);
  const [scanLoading, setScanLoading] = useState(true);
  const [scanCount, setScanCount] = useState('');

  const seenPostIds = useRef(null);
  const seenScanIds = useRef(null);

  useEffect(() => { localStorage.setItem(DRAFT_TITLE_KEY, title) }, [title])
  useEffect(() => { localStorage.setItem(DRAFT_DETAILS_KEY, details) }, [details])
  useEffect(() => { localStorage.setItem(DRAFT_PRIORITY_KEY, priority) }, [priority])

  useEffect(() => {
    if (!loggedIn) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    const q = query(collection(db, 'grievances'));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (seenPostIds.current === null) {
        seenPostIds.current = new Set(list.map(p => p.id));
      } else {
        list.forEach(p => {
          if (!seenPostIds.current.has(p.id) && getAuthorRole(p) === OTHER_ROLE) {
            notify(
              getIsRequest(p) ? 'New request from Partner' : 'New message from Partner',
              `${p.title} — priority: ${priorityLabel[getPriority(p)]}`
            );
          }
        });
        seenPostIds.current = new Set(list.map(p => p.id));
      }

      setPosts(list);
      setIsLoading(false);
    }, (err) => {
      console.error("Firebase query failed:", err);
      setError("Could not load posts. Please check your connection and Firestore Rules.");
      setIsLoading(false);
    });

    return () => unsub();
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) { setScanLoading(false); return; }
    setScanLoading(true);
    const q = query(collection(db, 'scanlog'));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

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

      setScanEntries(list);
      setScanLoading(false);
    }, (err) => console.error('Scan log query failed:', err));
    return () => unsub();
  }, [loggedIn]);

  const stats = useMemo(() => ({
    total: posts.length,
    requests: posts.filter(getIsRequest).length,
    pending: posts.filter(p => getIsRequest(p) && getAuthorRole(p) === OTHER_ROLE).length,
  }), [posts])

  const totalScans = useMemo(
    () => scanEntries.reduce((sum, e) => sum + (Number(e.count) || 0), 0),
    [scanEntries]
  );

  async function submit() {
    if (!title.trim()) { alert('Please add a title'); return; }
    await addDoc(collection(db, 'grievances'), {
      title: title.trim(),
      details: details.trim(),
      priority,
      isRequest,
      authorRole: MY_ROLE,
      createdAt: serverTimestamp(),
      updates: [],
    })
    setTitle(''); setDetails(''); setPriority('yellow'); setIsRequest(true);
    localStorage.removeItem(DRAFT_TITLE_KEY);
    localStorage.removeItem(DRAFT_DETAILS_KEY);
    localStorage.removeItem(DRAFT_PRIORITY_KEY);
    setComposeOpen(false);
  }

  async function addReply(id) {
    const text = (replyDrafts.current[id] || '').trim();
    if (!text) return;
    try {
      await updateDoc(doc(db, 'grievances', id), { updates: arrayUnion({ text, at: new Date() }) });
      const el = document.getElementById(`reply-${id}`);
      if (el) el.value = '';
    } catch (err) {
      console.error('Failed to post reply:', err);
      alert('Failed to post reply: ' + (err.message || err.code || 'unknown error'));
    }
  }

  async function logScan() {
    const n = Number(scanCount);
    if (!n || n <= 0) { alert('Enter how many scans to log'); return; }
    await addDoc(collection(db, 'scanlog'), { count: n, authorRole: MY_ROLE, createdAt: serverTimestamp() });
    setScanCount('');
  }

  function handleLogin() {
    if (input === USER_CODE) {
      localStorage.setItem(USER_KEY, 'true');
      setLoginError('');
      setLoggedIn(true);
    } else {
      setLoginError('Incorrect passcode. Please try again.');
    }
  }

  function handleLogout() {
    localStorage.removeItem(USER_KEY);
    setLoggedIn(false);
    setPosts([]);
    setScanEntries([]);
    setError(null);
  }

  function enableNotifications() {
    if (typeof Notification === 'undefined') { alert('Notifications are not supported in this browser.'); return; }
    Notification.requestPermission().then(p => setNotifOn(p === 'granted'));
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-semibold mb-1 text-stone-900 flex items-center gap-2"><span className="text-stone-400">♡</span> Love Ledger</h1>
          <p className="text-sm text-stone-500 mb-4">Please enter your passcode.</p>
          <input
            type="password"
            value={input}
            onChange={e => {setInput(e.target.value); setLoginError('')}}
            className={`border rounded-xl px-3 py-2 w-full ${loginError ? 'border-rose-400' : 'border-stone-300'}`}
            placeholder="Passcode"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          {loginError && <p className="text-sm text-rose-600 mt-2">{loginError}</p>}
          <button onClick={() => handleLogin()} className="mt-3 w-full px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium">Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-stone-900 flex items-center gap-2"><span className="text-stone-400">♡</span> Love Ledger</h1>
          <div className="flex items-center gap-2">
            <button onClick={enableNotifications} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${notifOn ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {notifOn ? 'Notifications on' : 'Enable notifications'}
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === 'posts' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-stone-900">{getGreeting()}, {MY_NAME}</h2>
              <p className="text-stone-500 mt-1">Let's catch up</p>
            </div>

            <section className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs text-stone-500">Total</p>
                <p className="text-2xl font-semibold text-stone-900">{stats.total}</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs text-stone-500">Requests</p>
                <p className="text-2xl font-semibold text-stone-900">{stats.requests}</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs text-stone-500">Pending</p>
                <p className="text-2xl font-semibold text-stone-900">{stats.pending}</p>
              </div>
            </section>

            <section className="space-y-3">
              {isLoading && <div className="text-center text-stone-500">Loading posts...</div>}
              {error && <div className="text-center text-rose-600 bg-rose-50 p-4 rounded-xl">{error}</div>}
              {!isLoading && !error && posts.length === 0 && (
                <div className="text-center text-stone-500">No posts yet</div>
              )}

              {!isLoading && !error && posts.map((g) => {
                const mine = getAuthorRole(g) === MY_ROLE;
                const canReply = !mine;
                const prio = getPriority(g);
                return (
                  <div key={g.id} className="flex gap-2 items-start">
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${mine ? 'bg-stone-900 text-white' : 'bg-amber-200 text-amber-900'}`}>
                      {mine ? 'M' : 'P'}
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{mine ? 'Me' : 'Partner'}</span>
                        {getIsRequest(g) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 uppercase tracking-wide font-medium">Request</span>}
                      </div>
                      <h3 className="text-lg font-semibold text-stone-900">{g.title}</h3>
                      {g.details && <p className="text-sm text-stone-600 mt-1">{g.details}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[prio]}`}>{priorityLabel[prio]}</span>
                        <span className="text-xs text-stone-400">{g.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                      </div>

                      {Array.isArray(g.updates) && g.updates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-stone-200 text-sm">
                          <ul className="space-y-2">
                            {[...g.updates]
                              .sort((a, b) => (b?.at?.seconds || 0) - (a?.at?.seconds || 0))
                              .map((update, index) => {
                                if (!update || typeof update.text !== 'string') return null;
                                const updateDate = update.at?.toDate ? update.at.toDate() : null;
                                return (
                                  <li key={index} className="text-xs text-stone-700 bg-stone-50 border border-stone-200 p-2 rounded-lg">
                                    <p className="font-medium">{update.text}</p>
                                    {updateDate && (
                                      <p className="text-[10px] text-stone-400 mt-1">{updateDate.toLocaleString()}</p>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}

                      {canReply && (
                        <div className="mt-3 pt-3 border-t border-stone-200 flex gap-2">
                          <input id={`reply-${g.id}`} onChange={(e)=>{replyDrafts.current[g.id]=e.target.value}} className="border border-stone-300 rounded-lg px-2 py-1 flex-grow text-sm" placeholder="Reply…" onKeyPress={(e)=> e.key==='Enter' && addReply(g.id)} />
                          <button onClick={()=>addReply(g.id)} className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium">Send</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {activeTab === 'logbook' && (
          <>
            <section className="rounded-2xl shadow-sm p-6 mb-6 bg-stone-900 border border-stone-700">
              <h2 className="text-base font-semibold text-stone-100">Log Book</h2>
              <p className="text-sm text-stone-400 mt-1">How many scans did you knock out?</p>
              <p className="text-5xl font-semibold text-stone-50 mt-4 mb-4 tracking-tight">{totalScans}<span className="text-base font-normal text-stone-500 ml-2">total logged</span></p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={scanCount}
                  onChange={(e)=>setScanCount(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && logScan()}
                  placeholder="e.g. 12"
                  className="border border-stone-700 bg-stone-800 text-stone-100 placeholder-stone-500 rounded-xl px-3 py-2 flex-grow"
                />
                <button onClick={logScan} className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-white text-stone-900 font-medium whitespace-nowrap">Log it</button>
              </div>
            </section>

            <section className="space-y-2">
              {scanLoading && <div className="text-center text-stone-500">Loading log book...</div>}
              {!scanLoading && scanEntries.length === 0 && (
                <div className="text-center text-stone-500">No scans logged yet</div>
              )}
              {!scanLoading && scanEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between bg-stone-900 text-stone-100 rounded-xl px-4 py-3 border border-stone-700">
                  <span className="font-medium">{e.count} scans <span className="text-xs text-stone-500 ml-1">({(e.authorRole||'user')===MY_ROLE ? 'Me' : 'Partner'})</span></span>
                  <span className="text-xs text-stone-500">{e.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      {activeTab === 'posts' && (
        <button
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-2xl font-light shadow-lg flex items-center justify-center"
          aria-label="New post"
        >
          +
        </button>
      )}

      {composeOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setComposeOpen(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-900">New post</h2>
              <button onClick={() => setComposeOpen(false)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">✕</button>
            </div>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 w-full" placeholder="Title" />
            <textarea value={details} onChange={(e)=>setDetails(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 w-full mt-3" rows="3" placeholder="Details (optional)" />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-stone-500">Priority:</span>
              {['green','yellow','red'].map((p)=> (
                <button key={p} onClick={()=>setPriority(p)} className={`w-5 h-5 rounded-full ${priorityDot[p]} ${priority===p ? 'ring-2 ring-offset-2 ring-stone-800' : ''}`} aria-label={p}></button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={isRequest} onChange={(e)=>setIsRequest(e.target.checked)} className="w-4 h-4" />
              This is a request (needs a response) — uncheck for just a message
            </label>
            <button onClick={submit} className="mt-4 w-full px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium">Post</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 backdrop-blur-xl bg-white/80 border border-stone-200 shadow-md rounded-full px-2 py-2">
        <button onClick={() => setActiveTab('posts')} className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab==='posts' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>
          Posts · {stats.total}
        </button>
        <button onClick={() => setActiveTab('logbook')} className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab==='logbook' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>
          Log Book · {totalScans}
        </button>
      </div>

      <InstallPrompt/>
    </div>
  )
}
