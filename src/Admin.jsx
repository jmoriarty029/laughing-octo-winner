import { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import {
  collection, onSnapshot, orderBy, query, updateDoc, doc, arrayUnion, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import usePageMeta from './usePageMeta';

const ADMIN_CODE = 'love-2025';
const ADMIN_KEY = 'gp_admin_ok';

export default function Admin() {
  usePageMeta({
    title: '🛠️ Admin Dashboard',
    manifest: '/manifest.admin.json',
    themeColor: '#475569'
  });

  const [ok, setOk] = useState(localStorage.getItem(ADMIN_KEY) === 'true');
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);
  const [fs, setFs] = useState('');
  const [fv, setFv] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (!ok) return;
    const q = query(collection(db, 'grievances'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setItems(list);
    });
    return () => unsub();
  }, [ok]);

  const filtered = useMemo(() => items.filter((g) => {
    const t = `${g.title||''} ${g.details||''}`.toLowerCase();
    const okText = !term || t.includes(term.toLowerCase());
    const okStatus = !fs || g.status === fs;
    const okSev = !fv || g.severity === fv;
    return okText && okStatus && okSev;
  }), [items, term, fs, fv]);

  const summary = useMemo(() => ({
    total: filtered.length,
    working: filtered.filter(g=>g.status==='Working').length,
    resolved: filtered.filter(g=>g.status==='Resolved').length,
  }), [filtered]);

  async function setStatus(id, status) {
    try {
      await updateDoc(doc(db, 'grievances', id), { status });
    } catch (error) {
      console.error("Error updating status:", error);
      // In a real app, show an error toast/modal
    }
  }

  async function addNote(id, text) {
    const noteInput = document.getElementById(`note-${id}`);
    const postButton = document.getElementById(`post-btn-${id}`);
    
    if (!text.trim() || !postButton) return;

    const originalButtonText = postButton.innerText;
    postButton.innerText = 'Posting...';
    postButton.disabled = true;

    try {
      await updateDoc(doc(db, 'grievances', id), { 
          updates: arrayUnion({ text: text.trim(), at: serverTimestamp() }) 
      });
      if (noteInput) noteInput.value = ''; // Clear input on success
      postButton.innerText = 'Posted!';
      setTimeout(() => {
        postButton.innerText = originalButtonText;
        postButton.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error adding note: ", error);
      postButton.innerText = 'Error!';
      // In a real app, show a more user-friendly error message
      setTimeout(() => {
        postButton.innerText = originalButtonText;
        postButton.disabled = false;
      }, 3000);
    }
  }
  
  async function deleteGrievance(id) {
    // In a real app, you'd use a custom modal here instead of window.confirm
    if (confirm('Are you sure you want to delete this grievance?')) {
        await deleteDoc(doc(db, 'grievances', id));
    }
  }

  function handleLogin() {
    if (input === ADMIN_CODE) {
      localStorage.setItem(ADMIN_KEY, 'true');
      setOk(true);
    }
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_KEY);
    setOk(false);
  }

  if (!ok) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold mb-2">🛠️ Admin Login</h1>
          <p className="text-sm text-gray-600 mb-4">Enter your passcode.</p>
          <input 
            type="password" 
            value={input} 
            onChange={e=>setInput(e.target.value)} 
            className="border rounded-xl px-3 py-2 w-full" 
            placeholder="Passcode"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={() => handleLogin()} className="mt-3 px-4 py-2 rounded-xl bg-slate-800 text-white">Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex flex-col sm:flex-row items-center gap-4 justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-extrabold text-slate-800">🛠️ Admin Dashboard</h1>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold">Logout</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select value={fs} onChange={e=>setFs(e.target.value)} className="border rounded-xl px-3 py-2"><option value="">All Statuses</option><option>Filed</option><option>Working</option><option>Resolved</option></select>
          <select value={fv} onChange={e=>setFv(e.target.value)} className="border rounded-xl px-3 py-2"><option value="">All Severities</option><option>Low</option><option>Medium</option><option>High</option></select>
          <input value={term} onChange={e=>setTerm(e.target.value)} className="border rounded-xl px-3 py-2" placeholder="Search…" />
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl shadow p-4"><p className="text-xs text-gray-500">Total</p><p className="text-2xl font-bold">{summary.total}</p></div>
        <div className="bg-white rounded-2xl shadow p-4"><p className="text-xs text-gray-500">Working</p><p className="text-2xl font-bold">{summary.working}</p></div>
        <div className="bg-white rounded-2xl shadow p-4"><p className="text-xs text-gray-500">Resolved</p><p className="text-2xl font-bold">{summary.resolved}</p></div>
      </section>

      <section className="space-y-3">
        {filtered.map((g)=> (
          <div key={g.id} className="bg-white rounded-2xl shadow p-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="w-full">
                <h3 className="text-lg font-semibold text-slate-800">{g.title}</h3>
                {g.details && <p className="text-sm text-gray-700 mt-1">{g.details}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-sm border ${g.severity==='High'?'bg-red-100 text-red-700 border-red-200': g.severity==='Medium'?'bg-yellow-100 text-yellow-700 border-yellow-200':'bg-green-100 text-green-700 border-green-200'}`}>{g.severity||'Medium'}</span>
                  <span className="px-2 py-0.5 rounded-full text-sm border bg-indigo-100 text-indigo-700 border-indigo-200">{g.category||'Other'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-sm border ${g.status==='Resolved'?'bg-emerald-100 text-emerald-700 border-emerald-200': g.status==='Working'?'bg-amber-100 text-amber-700 border-amber-200':'bg-rose-100 text-rose-700 border-rose-200'}`}>{g.status}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2 border-t pt-2">
                  <p>Filed: {g.createdAt?.toDate?.().toLocaleString() || 'N/A'}</p>
                  <p>User ID: <code className="text-gray-500">{g.uid || g.clientId || 'N/A'}</code></p>
                </div>

                {Array.isArray(g.updates) && g.updates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">Posted Updates</h4>
                    <ul className="space-y-1.5">
                      {[...g.updates]
                        .sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0))
                        .map((update, index) => (
                          <li key={index} className="text-xs text-gray-800 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p>"{update.text}"</p>
                            <p className="text-right text-gray-500 mt-1">
                              {update.at?.toDate?.().toLocaleString() || ''}
                            </p>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-52">
                <select value={g.status} onChange={e=>setStatus(g.id, e.target.value)} className="border rounded-lg px-2 py-1">
                  {['Filed','Working','Resolved'].map(s=> <option key={s}>{s}</option>)}
                </select>
                <textarea id={`note-${g.id}`} rows={2} placeholder="Add update…" className="border rounded-lg px-2 py-1"></textarea>
                <div className="flex gap-2">
                    <button id={`post-btn-${g.id}`} onClick={()=>{
                      const t = document.getElementById(`note-${g.id}`).value;
                      addNote(g.id, t);
                    }} className="flex-grow px-3 py-1 rounded-lg bg-slate-800 text-white text-sm transition-colors duration-200 disabled:bg-slate-400">Post Update</button>
                    <button onClick={() => deleteGrievance(g.id)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
