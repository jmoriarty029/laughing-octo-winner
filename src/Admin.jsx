import { useEffect, useMemo, useRef, useState } from 'react'
import { db, auth } from './firebase'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import {
  addDoc, collection, onSnapshot, query, updateDoc, doc, arrayUnion, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import usePageMeta from './usePageMeta';

const ADMIN_EMAIL = 'partner@love-ledger.app'
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
const priorityLabel = { green: 'Low', yellow: 'Medium', red: 'High' };
const priorityBadge = {
  green: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  yellow: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  red: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
};
const priorityDot = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-rose-500' };

const SCAN_TYPES = ['X-ray', 'USG', 'MRI', 'CT Scan', 'Fluoroscopy', 'Others'];

function scanTypeLabel(e) {
  const t = e.scanType || 'Unspecified';
  if (t === 'Others' && e.otherSpecify) return `Other (${e.otherSpecify})`;
  return t;
}
function scanTypeBucket(e) {
  return e.scanType || 'Unspecified';
}
function pluralScans(n) {
  return `${n} scan${n === 1 ? '' : 's'}`;
}
const scanTypeColors = {
  'X-ray': { bg: 'bg-sky-100 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300' },
  'USG': { bg: 'bg-teal-100 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300' },
  'MRI': { bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300' },
  'CT Scan': { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' },
  'Fluoroscopy': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
  'Others': { bg: 'bg-stone-200 dark:bg-stone-800', text: 'text-stone-700 dark:text-stone-300' },
  'Unspecified': { bg: 'bg-stone-200 dark:bg-stone-800', text: 'text-stone-700 dark:text-stone-300' },
};
function scanTypeColor(t) {
  return scanTypeColors[t] || scanTypeColors['Unspecified'];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function IconSun(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
}
function IconMoon(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}

function notify(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-admin-192.png' }); } catch (e) { console.error(e); }
  }
}

function IconChat(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
}
function IconActivity(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconPlus(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}

export default function Admin() {
  const [ok, setOk] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [input, setInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [notifOn, setNotifOn] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('gp_dark_mode') === 'true');

  usePageMeta({
    title: 'Love Ledger',
    manifest: '/manifest.admin.json',
    themeColor: darkMode ? '#0c0a09' : '#fafaf9'
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('gp_dark_mode', darkMode ? 'true' : 'false');
  }, [darkMode]);
  const [activeTab, setActiveTab] = useState('posts');
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setOk(!!user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

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
              `${p.title} — priority: ${priorityLabel[getPriority(p)]}`
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

  const summary = useMemo(() => {
    const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
    return {
      answered: filtered.filter(p => getIsRequest(p) && getAuthorRole(p) === OTHER_ROLE && Array.isArray(p.updates) && p.updates.length > 0).length,
      thisWeek: filtered.filter(p => (p.createdAt?.seconds || 0) >= weekAgo).length,
      pending: filtered.filter(p => getIsRequest(p) && getAuthorRole(p) === OTHER_ROLE && (!Array.isArray(p.updates) || p.updates.length === 0)).length,
    };
  }, [filtered])

  const totalScans = useMemo(
    () => scanEntries.reduce((sum, e) => sum + (Number(e.count) || 0), 0),
    [scanEntries]
  );

  const scansThisWeek = useMemo(() => {
    const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
    return scanEntries
      .filter(e => (e.createdAt?.seconds || 0) >= weekAgo)
      .reduce((sum, e) => sum + (Number(e.count) || 0), 0);
  }, [scanEntries]);

  const scanBreakdown = useMemo(() => {
    const map = {};
    scanEntries.forEach(e => {
      const key = scanTypeBucket(e);
      map[key] = (map[key] || 0) + (Number(e.count) || 0);
    });
    return map;
  }, [scanEntries]);

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
    setComposeOpen(false);
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

  const [pendingDelete, setPendingDelete] = useState(null); // { id, type, timerId }

  function commitPendingDelete(pd) {
    if (!pd) return;
    const collectionName = pd.type === 'post' ? 'grievances' : 'scanlog';
    deleteDoc(doc(db, collectionName, pd.id)).catch(err => console.error('Delete failed:', err));
  }

  function requestDelete(id, type) {
    setPendingDelete(prev => {
      if (prev) commitPendingDelete(prev);
      const timerId = setTimeout(() => {
        commitPendingDelete({ id, type });
        setPendingDelete(cur => (cur && cur.id === id ? null : cur));
      }, 5000);
      return { id, type, timerId };
    });
  }

  function undoDelete() {
    setPendingDelete(prev => {
      if (prev) clearTimeout(prev.timerId);
      return null;
    });
  }

  function deletePost(id) { requestDelete(id, 'post'); }
  function deleteScan(id) { requestDelete(id, 'scan'); }

  async function handleLogin() {
    setLoginError('')
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, input);
      setInput('');
    } catch (err) {
      console.error('Sign-in failed:', err);
      setLoginError('Incorrect passcode. Please try again.')
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function enableNotifications() {
    if (typeof Notification === 'undefined') { alert('Notifications are not supported in this browser.'); return; }
    Notification.requestPermission().then(p => setNotifOn(p === 'granted'));
  }

  function openCompose() {
    setActiveTab('posts');
    setComposeOpen(true);
  }

  if (!authChecked) {
    return <div className="min-h-screen bg-stone-50"></div>;
  }

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-stone-50 dark:bg-stone-950">
        <button
          onClick={() => setDarkMode(d => !d)}
          className="fixed top-4 right-4 w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
        </button>
        <div className="max-w-sm w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-sm p-6">
          <h1 className="text-xl font-bold mb-1 text-stone-900 dark:text-stone-100 flex items-center gap-2"><span className="text-stone-400">♡</span> Love Ledger</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Please enter your passcode.</p>
          <input
            type="password"
            value={input}
            onChange={e=>{setInput(e.target.value); setLoginError('')}}
            className={`border rounded-xl px-3 py-2 w-full bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 ${loginError ? 'border-rose-400' : 'border-stone-300 dark:border-stone-700'}`}
            placeholder="Passcode"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          {loginError && <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">{loginError}</p>}
          <button onClick={() => handleLogin()} className="mt-3 w-full px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-semibold">Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28 font-sans bg-stone-50 dark:bg-stone-950">
      {pendingDelete && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full shadow-lg px-4 py-2 flex items-center gap-3 text-sm">
          <span>{pendingDelete.type === 'post' ? 'Post' : 'Entry'} deleted</span>
          <button onClick={undoDelete} className="font-semibold underline">Undo</button>
        </div>
      )}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 dark:bg-stone-950/80 border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><span className="text-stone-400">♡</span> Love Ledger</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(d => !d)}
              className="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>
            <button onClick={enableNotifications} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${notifOn ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}>
              {notifOn ? 'Notifications on' : 'Enable notifications'}
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === 'posts' && (
          <>
            <div className="mb-6">
              <h2 className="text-[28px] leading-tight font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">{getGreeting()}</h2>
              <p className="text-stone-500 dark:text-stone-400 mt-1">Let's catch up</p>
            </div>

            <section className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-stone-100 dark:bg-stone-900 rounded-3xl shadow-sm p-4">
                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Answered</p>
                <p className="text-2xl font-extrabold text-stone-900 dark:text-stone-100">{summary.answered}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 rounded-3xl shadow-sm p-4">
                <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">This week</p>
                <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">{summary.thisWeek}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-3xl shadow-sm p-4">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</p>
                <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{summary.pending}</p>
              </div>
            </section>

            <div className="mb-4">
              <input value={term} onChange={e=>setTerm(e.target.value)} className="border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 w-full" placeholder="Search…" />
            </div>

            {isLoading && <div className="text-center text-stone-500 dark:text-stone-400 mb-4">Loading posts...</div>}
            {loadError && <div className="text-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-4 rounded-2xl mb-4">{loadError}</div>}
            {!isLoading && !loadError && filtered.length === 0 && (
              <div className="text-center text-stone-500 dark:text-stone-400 mb-4">No posts found.</div>
            )}

            <section className="space-y-3">
              {filtered.filter(g => !(pendingDelete && pendingDelete.type==='post' && pendingDelete.id===g.id)).map((g) => {
                const mine = getAuthorRole(g) === MY_ROLE;
                const canReply = !mine;
                const prio = getPriority(g);
                return (
                  <div key={g.id} className="flex gap-2 items-start">
                    <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${mine ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300'}`}>
                      {mine ? 'M' : 'P'}
                    </div>
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-sm p-4 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{mine ? 'Me' : 'Partner'}</span>
                        {getIsRequest(g) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 uppercase tracking-wide font-semibold">Request</span>}
                      </div>
                      <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{g.title}</h3>
                      {g.details && <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{g.details}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${priorityBadge[prio]}`}>{priorityLabel[prio]}</span>
                        <span className="text-xs text-stone-400 dark:text-stone-500">{g.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                      </div>

                      {Array.isArray(g.updates) && g.updates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 text-sm">
                          <ul className="space-y-2">
                            {[...g.updates]
                              .sort((a, b) => (b?.at?.seconds || 0) - (a?.at?.seconds || 0))
                              .map((update, index) => {
                                if (!update || typeof update.text !== 'string') return null;
                                const updateDate = update.at?.toDate ? update.at.toDate() : null;
                                return (
                                  <li key={index} className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-2 rounded-xl">
                                    <p className="font-medium">{update.text}</p>
                                    {updateDate && (
                                      <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">{updateDate.toLocaleString()}</p>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}

                      {canReply && (
                        <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 flex gap-2">
                          <input id={`reply-${g.id}`} onChange={(e)=>{replyDrafts.current[g.id]=e.target.value}} className="border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl px-2 py-1 flex-grow text-sm" placeholder="Reply…" onKeyPress={(e)=> e.key==='Enter' && addReply(g.id)} />
                          <button onClick={()=>addReply(g.id)} className="px-3 py-1 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 text-sm font-semibold">Send</button>
                        </div>
                      )}
                      <div className="mt-2 text-right">
                        <button onClick={() => deletePost(g.id)} className="text-xs text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline">Delete</button>
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
            <img src="/log-book-banner.jpg" alt="" className="w-full h-auto rounded-3xl shadow-sm mb-2 object-cover" />
            <div className="rounded-3xl shadow-sm p-6 mb-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
              <h2 className="text-base font-bold text-indigo-900 dark:text-indigo-200">Log Book</h2>
              <p className="text-5xl font-extrabold text-indigo-900 dark:text-indigo-200 mt-4 mb-2 tracking-tight">{totalScans}<span className="text-base font-medium text-indigo-400 ml-2">total logged</span></p>
              <p className="text-sm text-indigo-500 dark:text-indigo-400 mb-4">{scansThisWeek} this week</p>
              {Object.keys(scanBreakdown).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {SCAN_TYPES.concat(scanBreakdown['Unspecified'] ? ['Unspecified'] : []).map(t => (
                    scanBreakdown[t] ? (
                      <div key={t} className={`rounded-2xl p-3 ${scanTypeColor(t).bg}`}>
                        <p className={`text-[10px] font-medium ${scanTypeColor(t).text}`}>{t}</p>
                        <p className={`text-lg font-extrabold ${scanTypeColor(t).text}`}>{scanBreakdown[t]}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              )}
            </div>
            {scanEntries.length === 0 && <div className="text-center text-stone-500 dark:text-stone-400">No scans logged yet</div>}
            {scanEntries.filter(e => !(pendingDelete && pendingDelete.type==='scan' && pendingDelete.id===e.id)).map((e) => (
              <div key={e.id} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800 dark:text-stone-200">{pluralScans(e.count)} <span className="text-xs text-stone-400 dark:text-stone-500 ml-1 font-normal">({(e.authorRole||'user')===MY_ROLE ? 'Me' : 'Partner'})</span></span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">{e.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scanTypeColor(scanTypeBucket(e)).bg} ${scanTypeColor(scanTypeBucket(e)).text}`}>{scanTypeLabel(e)}</span>
                </div>
                {e.note && <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">{e.note}</p>}
                <div className="mt-2 text-right">
                  <button onClick={() => deleteScan(e.id)} className="text-xs text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      {composeOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setComposeOpen(false)}>
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">New post</h2>
              <button onClick={() => setComposeOpen(false)} className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 text-xl leading-none">✕</button>
            </div>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 w-full" placeholder="Title" />
            <textarea value={details} onChange={(e)=>setDetails(e.target.value)} className="border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 w-full mt-3" rows="3" placeholder="Details (optional)" />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-stone-500 dark:text-stone-400">Priority:</span>
              {['green','yellow','red'].map((p)=> (
                <button key={p} onClick={()=>setPriority(p)} className={`w-5 h-5 rounded-full ${priorityDot[p]} ${priority===p ? 'ring-2 ring-offset-2 dark:ring-offset-stone-900 ring-stone-800 dark:ring-stone-200' : ''}`} aria-label={p}></button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
              <input type="checkbox" checked={isRequest} onChange={(e)=>setIsRequest(e.target.checked)} className="w-4 h-4" />
              This is a request (needs a response) — uncheck for just a message
            </label>
            <button onClick={submitPost} className="mt-4 w-full px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-semibold">Post</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="relative flex items-center gap-6 bg-stone-900 shadow-xl rounded-full pl-6 pr-6 py-3">
          <button onClick={() => setActiveTab('posts')} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${activeTab==='posts' ? 'text-white' : 'text-stone-500'}`}>
            <IconChat className="w-5 h-5" />
            Posts
          </button>
          <div className="w-10"></div>
          <button onClick={() => setActiveTab('logbook')} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${activeTab==='logbook' ? 'text-white' : 'text-stone-500'}`}>
            <IconActivity className="w-5 h-5" />
            Log Book
          </button>
          <button
            onClick={openCompose}
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-12 h-12 rounded-full bg-white text-stone-900 shadow-lg flex items-center justify-center border border-stone-200"
            aria-label="New post"
          >
            <IconPlus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
