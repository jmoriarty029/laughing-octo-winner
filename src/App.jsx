import { useEffect, useMemo, useState } from 'react';
import InstallPrompt from './InstallPrompt';
import NotificationButton from './NotificationButton'; // 1. Import the new component
import { db } from './firebase';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where
} from 'firebase/firestore';
import usePageMeta from './usePageMeta';

// Keys for saving form drafts
const DRAFT_TITLE_KEY = 'gp_draft_title';
const DRAFT_DETAILS_KEY = 'gp_draft_details';
const DRAFT_CATEGORY_KEY = 'gp_draft_category';
const DRAFT_SEVERITY_KEY = 'gp_draft_severity';

export default function App() {
  usePageMeta({
    title: '💌 Grievance Portal',
    manifest: '/manifest.json',
    themeColor: '#ec4899'
  });

  // State for Firebase Authentication
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // State for the login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State for app data
  const [grievances, setGrievances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the new grievance form, synced with localStorage
  const [title, setTitle] = useState(localStorage.getItem(DRAFT_TITLE_KEY) || '');
  const [details, setDetails] = useState(localStorage.getItem(DRAFT_DETAILS_KEY) || '');
  const [category, setCategory] = useState(localStorage.getItem(DRAFT_CATEGORY_KEY) || 'Attention');
  const [severity, setSeverity] = useState(localStorage.getItem(DRAFT_SEVERITY_KEY) || 'Medium');

  // Save draft to localStorage whenever form fields change
  useEffect(() => { localStorage.setItem(DRAFT_TITLE_KEY, title) }, [title]);
  useEffect(() => { localStorage.setItem(DRAFT_DETAILS_KEY, details) }, [details]);
  useEffect(() => { localStorage.setItem(DRAFT_CATEGORY_KEY, category) }, [category]);
  useEffect(() => { localStorage.setItem(DRAFT_SEVERITY_KEY, severity) }, [severity]);

  // Effect to handle the user's authentication state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
         setUser(currentUser);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Effect to fetch grievances from Firestore when the user is logged in
  useEffect(() => {
    if (!user) {
        setGrievances([]);
        return;
    };

    setIsLoading(true);
    setError(null);
    
    const q = query(
      collection(db, 'grievances'),
      where('uid', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGrievances(list);
      setIsLoading(false);
    }, (err) => {
        console.error("Firestore query failed:", err);
        setError("Could not load grievances.");
        setIsLoading(false);
    });

    return () => unsub();
  }, [user]);

  const stats = useMemo(() => ({
    total: grievances.length,
    resolved: grievances.filter((g) => g.status === 'Resolved').length,
  }), [grievances]);

  async function submit() {
    if (!title.trim() || !user) return;
    
    await addDoc(collection(db, 'grievances'), {
      title: title.trim(),
      details: details.trim(),
      category,
      severity,
      status: 'Filed',
      uid: user.uid,
      createdAt: serverTimestamp(),
      updates: [],
    });

    setTitle(''); setDetails(''); setCategory('Attention'); setSeverity('Medium');
    localStorage.removeItem(DRAFT_TITLE_KEY);
    localStorage.removeItem(DRAFT_DETAILS_KEY);
    localStorage.removeItem(DRAFT_CATEGORY_KEY);
    localStorage.removeItem(DRAFT_SEVERITY_KEY);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("User login failed:", error.message);
      setLoginError('Login failed. Please check your email and password.');
    }
  }

  async function handleLogout() {
    const auth = getAuth();
    await signOut(auth);
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setLoginError('');
    setResetMessage('');
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage(`Password reset link sent to ${email}.`);
    } catch (error) {
      console.error("Password reset failed:", error.message);
      setLoginError("Could not send reset email. Please check the address.");
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        {showPasswordReset ? (
          <form onSubmit={handlePasswordReset} className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-2 text-pink-600">Reset Password</h1>
            <p className="text-sm text-gray-600 mb-4">Enter your email to receive a reset link.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded-xl px-3 py-2 w-full" placeholder="Email" required />
            {resetMessage && <p className="text-green-600 text-sm mt-3">{resetMessage}</p>}
            {loginError && <p className="text-red-500 text-sm mt-3">{loginError}</p>}
            <button type="submit" className="mt-3 w-full px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold">Send Reset Link</button>
            <button type="button" onClick={() => { setShowPasswordReset(false); setLoginError(''); setResetMessage(''); }} className="mt-2 w-full text-sm text-center text-gray-600 hover:text-pink-600">Back to Login</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-2 text-pink-600">💌 Grievance Portal</h1>
            <p className="text-sm text-gray-600 mb-4">Please sign in to continue.</p>
            <div className="space-y-3">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded-xl px-3 py-2 w-full" placeholder="Email" required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border rounded-xl px-3 py-2 w-full" placeholder="Password" required />
            </div>
            {loginError && <p className="text-red-500 text-sm mt-3">{loginError}</p>}
            <button type="submit" className="mt-3 w-full px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold">Sign In</button>
            <button type="button" onClick={() => { setShowPasswordReset(true); setLoginError(''); }} className="mt-2 w-full text-sm text-center text-gray-600 hover:text-pink-600">Forgot Password?</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 border-b border-white/40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-pink-600">💌 Grievance Portal</h1>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold">Logout</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 2. Render the new component */}
        <NotificationButton user={user} />

        <section className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-2xl shadow p-4"><p className="text-xs text-gray-500">My Grievances</p><p className="text-2xl font-bold">{stats.total}</p></div>
          <div className="bg-white rounded-2xl shadow p-4"><p className="text-xs text-gray-500">Resolved</p><p className="text-2xl font-bold">{stats.resolved}</p></div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-pink-700">File a New Grievance</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border rounded-xl px-3 py-2" placeholder="Title" />
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="border rounded-xl px-3 py-2">
              <option>Attention</option><option>Communication</option><option>Forgetfulness</option><option>Time Management</option><option>Other</option>
            </select>
          </div>
          <textarea value={details} onChange={(e)=>setDetails(e.target.value)} className="border rounded-xl px-3 py-2 w-full mt-3" rows="3" placeholder="Details (optional)" />
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Severity:</span>
            {['Low','Medium','High'].map((s)=> (
              <button key={s} onClick={()=>setSeverity(s)} className={`px-3 py-1 rounded-full text-sm border ${severity===s? 'bg-gray-100':''} ${s==='Low'?'border-green-300 text-green-700': s==='Medium'?'border-yellow-300 text-yellow-700':'border-red-300 text-red-700'}`}>{s}</button>
            ))}
          </div>
          <button onClick={submit} className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold">Submit Grievance</button>
        </section>

        <section className="space-y-3">
          {isLoading && <div className="text-center text-gray-500">Loading grievances...</div>}
          {error && <div className="text-center text-red-500 bg-red-100 p-4 rounded-xl">{error}</div>}
          {!isLoading && !error && grievances.length === 0 && <div className="text-center text-gray-500">No grievances yet 🎉</div>}

          {!isLoading && !error && grievances.map((g)=> (
            <div key={g.id} className="bg-white rounded-2xl shadow p-4">
              <div>
                <h3 className="text-lg font-semibold text-pink-700">{g.title}</h3>
                {g.details && <p className="text-sm text-gray-700 mt-1">{g.details}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-sm border ${g.severity==='High'?'bg-red-100 text-red-700 border-red-200': g.severity==='Medium'?'bg-yellow-100 text-yellow-700 border-yellow-200':'bg-green-100 text-green-700 border-green-200'}`}>{g.severity}</span>
                  <span className="px-2 py-0.5 rounded-full text-sm border bg-indigo-100 text-indigo-700 border-indigo-200">{g.category||'Other'}</span>
                  <span className="px-2 py-0.5 rounded-full text-sm border bg-gray-100 text-gray-700 border-gray-200">{g.createdAt?.toDate?.().toLocaleString?.() || ''}</span>
                  <span className={`px-2 py-0.5 rounded-full text-sm border ${g.status==='Resolved'?'bg-emerald-100 text-emerald-700 border-emerald-200': g.status==='Working'?'bg-amber-100 text-amber-700 border-amber-200':'bg-rose-100 text-rose-700 border-rose-200'}`}>{g.status}</span>
                </div>
                
                {Array.isArray(g.updates) && g.updates.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">Updates from Admin</h4>
                    <ul className="space-y-2">
                      {[...g.updates]
                        .sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0))
                        .map((update, index) => {
                          if (!update || typeof update.text !== 'string' || !update.text.trim()) return null;
                          const updateDate = update.at?.toDate ? update.at.toDate() : null;
                          return (
                            <li key={index} className="text-sm text-gray-800 bg-pink-50/50 p-3 rounded-lg border border-pink-100">
                              <p className="font-medium text-gray-900">"{update.text}"</p>
                              {updateDate && <p className="text-xs text-gray-500 mt-1 text-right">{updateDate.toLocaleString()}</p>}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

      <InstallPrompt/>
    </div>
  );
}
