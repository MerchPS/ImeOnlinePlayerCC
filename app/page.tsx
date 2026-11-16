'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ══════════════ Types ══════════════ */
type Player = { id: number; name: string; ping: number };
type AiMsg = { role: 'user' | 'assistant'; content: string };
type ApiData = { ok: boolean; gate: string; online: number; max: number; players: Player[]; updatedAt: string; error?: string; };
type AuthStatus = 'LOADING' | 'UNAUTHORIZED' | 'PENDING' | 'APPROVED' | 'ADMIN' | 'BANNED' | 'TIMEOUT';
type AccessRequest = { id: string; ipAddress: string; deviceId: string; status: string; timeoutUntil: string | null; reason: string | null; lastActive: string; createdAt: string; };
type AuditLog = { id: string; adminName: string; action: string; targetDeviceId: string; details: string; createdAt: string; };
type FactionDef = { id: string; label: string; short: string; matchType: string; badge: string; dot: string; };

const WARGA: FactionDef = { id: 'WARGA', short: 'Untagged', label: 'Untagged', matchType: 'NONE', badge: 'bg-hover text-muted border-line', dot: 'bg-muted' };

/* ══════════════ Utils ══════════════ */
const PAGE_SIZE = 25;
const fmt = (n: number) => n.toLocaleString('id-ID');
function pingClass(p: number) { if (p < 80) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'; if (p < 150) return 'bg-amber-500/10 text-amber-500 border-amber-500/20'; return 'bg-red-500/10 text-red-500 border-red-500/20'; }
function formatTime(ms: number) { const totalSecs = Math.floor(ms / 1000); const h = Math.floor(totalSecs / 3600); const m = Math.floor((totalSecs % 3600) / 60); const s = totalSecs % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function formatDate(iso: string) { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }

// PERBAIKAN: Mendukung Multiple Aliases (RCMC,RC1) & Mengurutkan dari yang terpanjang (HTH sebelum HT)
function detectFaction(name: string, factions: FactionDef[]): string {
  const prefix = name.split(' - ')[0].trim();
  
  // Bersihkan semua simbol aneh seperti % atau spasi
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanFullName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Urutkan dari yang paling panjang
  const sortedFactions = [...factions].sort((a, b) => b.short.length - a.short.length);

  for (const f of sortedFactions) {
    // Pisahkan alias berdasarkan koma (misal: "RCMC,RC1")
    const aliases = f.short.split(',').map(s => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    
    for (const alias of aliases) {
      if (!alias) continue;

      if (f.matchType === 'STARTS_WITH') {
        if (cleanPrefix.startsWith(alias)) return f.id;
        if (!name.includes(' - ') && cleanFullName.startsWith(alias)) return f.id;
      }
      if (f.matchType === 'INCLUDES') {
        if (cleanPrefix.includes(alias)) return f.id;
        if (!name.includes(' - ') && cleanFullName.includes(alias)) return f.id;
      }
    }
  }
  return 'WARGA';
}

function renderMarkdown(text: string) {
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return cleanText.split('\n').map((line, i) => {
    const parseBold = (str: string) => str.split(/(\*\*.*?\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold text-accent">{part.slice(2, -2)}</strong> : part);
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) { const level = line.match(/^#+/)?.[0].length || 1; return <div key={i} className={`font-semibold text-main mt-3 mb-1 ${level === 1 ? 'text-base' : 'text-sm'}`}>{line.replace(/^#+\s+/, '')}</div>; }
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-subtle">•</span><span>{parseBold(line.replace(/^[-*]\s+/, ''))}</span></div>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i} className="my-0.5">{parseBold(line)}</div>;
  });
}

/* ══════════════ Main App Component ══════════════ */
export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('LOADING');
  const [deviceId, setDeviceId] = useState<string>('');
  const [authMeta, setAuthMeta] = useState<{ timeoutUntil?: string; reason?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Anti-Screenshot State
  const [isBlurred, setIsBlurred] = useState(false);

  // Theme & Settings State (Lifted to App)
  const [theme, setTheme] = useState<'dark' | 'light' | 'glass' | 'cyberpunk' | 'nord'>('dark');
  const [refreshMs, setRefreshMs] = useState(60000);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem('ime-device-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ime-device-id', id); }
    setDeviceId(id);

    const savedTheme = localStorage.getItem('ime-theme') as any;
    if (savedTheme) setTheme(savedTheme);
    const savedRefresh = localStorage.getItem('ime-refresh');
    if (savedRefresh) setRefreshMs(Number(savedRefresh));
    const savedCompact = localStorage.getItem('ime-compact');
    if (savedCompact) setCompactMode(savedCompact === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('ime-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleSaveSettings = (newTheme: any, newRefresh: number, newCompact: boolean) => {
    setTheme(newTheme);
    setRefreshMs(newRefresh);
    setCompactMode(newCompact);
    localStorage.setItem('ime-refresh', String(newRefresh));
    localStorage.setItem('ime-compact', String(newCompact));
    setSettingsOpen(false);
  };

  useEffect(() => {
    if (!deviceId) return;
    const checkAuth = async () => {
      try {
        const res = await fetch(`/api/auth/status?deviceId=${deviceId}`);
        const json = await res.json();
        setAuthStatus(json.status);
        setAuthMeta({ timeoutUntil: json.timeoutUntil, reason: json.reason });
      } catch { setAuthStatus('UNAUTHORIZED'); }
    };
    checkAuth();
    const interval = setInterval(checkAuth, 10000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // ══════════ ANTI-SCREENSHOT LOGIC ══════════
  useEffect(() => {
    const handleVisibilityChange = () => { if (document.hidden) setIsBlurred(true); else setTimeout(() => setIsBlurred(false), 300); };
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setTimeout(() => setIsBlurred(false), 300);
    const handlePageHide = () => setIsBlurred(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('⚠️ Screenshot dilarang!');
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 2000);
      }
    };
    const handleTouchStart = () => setIsBlurred(true);
    const handleTouchEnd = () => setTimeout(() => setIsBlurred(false), 800);
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  if (authStatus === 'LOADING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app text-main">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm font-mono text-muted">Memeriksa akses...</span>
        </div>
      </div>
    );
  }

  if (['UNAUTHORIZED', 'PENDING', 'BANNED', 'TIMEOUT'].includes(authStatus)) {
    return <LockScreen deviceId={deviceId} status={authStatus} meta={authMeta} onRefresh={() => window.location.reload()} />;
  }

  return (
    <div className="relative min-h-screen bg-app text-main overflow-hidden">
      
      {/* Konten Utama (Akan Terkena Blur saat Screenshot) */}
      <div className={`transition-all duration-300 ease-out ${isBlurred ? 'blur-[30px] scale-[0.95] opacity-10 pointer-events-none' : ''}`}>
        <Home 
          isAdmin={authStatus === 'ADMIN'} 
          refreshMs={refreshMs} 
          compactMode={compactMode}
          onOpenSettings={() => setSettingsOpen(true)} 
          onOpenAdmin={() => setAdminOpen(true)} 
        />
        {authStatus === 'ADMIN' && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
      </div>

      <SettingsModal 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        currentTheme={theme}
        currentRefresh={refreshMs}
        currentCompact={compactMode}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

/* ══════════════ Lock Screen ══════════════ */
function LockScreen({ deviceId, status, meta, onRefresh }: { deviceId: string, status: string, meta: any, onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const requestAccess = async () => {
    setLoading(true); setErrorMsg('');
    const res = await fetch('/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
    if (res.status === 429) { const data = await res.json(); setErrorMsg(data.error); } 
    else { onRefresh(); }
    setLoading(false); 
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4 text-main">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-2xl">
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${status === 'BANNED' || status === 'TIMEOUT' ? 'bg-red-500/15 text-red-500' : 'bg-accent/15 text-accent'}`}>
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {status === 'BANNED' || status === 'TIMEOUT' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
          </svg>
        </div>
        
        <h1 className="text-xl font-bold">
          {status === 'BANNED' ? 'Akses Diblokir' : status === 'TIMEOUT' ? 'Akses Ditangguhkan' : 'Akses Terkunci'}
        </h1>
        
        <p className="mt-2 text-sm text-muted">
          {status === 'BANNED' ? 'Kamu telah melanggar aturan dan dilarang mengakses web ini.' :
           status === 'TIMEOUT' ? 'Akses kamu ditangguhkan sementara.' :
           status === 'PENDING' ? '⏳ Menunggu Hans (Admin) menyetujui permintaan akses kamu.' :
           'Website ini bersifat privat. Kamu harus meminta izin akses dari Admin Hans terlebih dahulu.'}
        </p>

        {(status === 'BANNED' || status === 'TIMEOUT') && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-left">
            <div className="text-xs font-semibold uppercase text-red-400">Alasan:</div>
            <div className="mt-1 text-sm text-red-200">{meta?.reason || 'Tidak ada alasan spesifik.'}</div>
            {status === 'TIMEOUT' && meta?.timeoutUntil && (
              <div className="mt-3 text-xs text-red-300">Dibuka kembali pada: <br/><span className="font-mono font-bold text-red-200">{new Date(meta.timeoutUntil).toLocaleString('id-ID')}</span></div>
            )}
          </div>
        )}

        {errorMsg && <div className="mt-4 text-xs font-semibold text-orange-500">{errorMsg}</div>}
        {status === 'UNAUTHORIZED' && (
          <button onClick={requestAccess} disabled={loading} className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-text transition hover:bg-accent-hover disabled:opacity-50">
            {loading ? 'Memproses...' : 'Minta Akses Sekarang'}
          </button>
        )}
        <div className="mt-6 text-[10px] text-subtle font-mono bg-hover py-2 rounded-lg">Device ID: {deviceId}</div>
      </div>
    </div>
  );
}

/* ══════════════ Admin Panel ══════════════ */
function AdminPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'requests' | 'factions' | 'audit'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{ type: 'BAN' | 'TIMEOUT', id?: string } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [durationInput, setDurationInput] = useState('60');
  const [factions, setFactions] = useState<FactionDef[]>([]);
  const [newFaction, setNewFaction] = useState({ label: '', short: '', matchType: 'INCLUDES', badge: 'bg-gray-500/10 text-gray-500 border-gray-500/20', dot: 'bg-gray-500' });
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchData = useCallback(async () => {
    if (activeTab === 'requests') { const res = await fetch('/api/admin/requests'); if (res.ok) setRequests(await res.json()); } 
    else if (activeTab === 'audit') { const res = await fetch('/api/admin/audit'); if (res.ok) setLogs(await res.json()); } 
    else if (activeTab === 'factions') { const res = await fetch('/api/factions'); if (res.ok) setFactions(await res.json()); }
  }, [activeTab]);

  useEffect(() => { 
    if (open) { fetchData(); const int = setInterval(fetchData, 5000); return () => clearInterval(int); } 
  }, [open, fetchData]);

  const executeAction = async (id: string, action: string, reason?: string, durationMinutes?: number) => {
    await fetch('/api/admin/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reason, durationMinutes }) });
    fetchData(); setActionModal(null); setReasonInput('');
  };

  const executeBulk = async (action: string) => {
    if (selected.size === 0) return;
    if (action === 'BAN' && !confirm(`Yakin ingin mem-ban ${selected.size} user sekaligus?`)) return;
    await fetch('/api/admin/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected), action }) });
    setSelected(new Set()); fetchData();
  };

  const addFaction = async () => {
    if (!newFaction.label || !newFaction.short) return;
    await fetch('/api/factions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFaction) });
    setNewFaction({ label: '', short: '', matchType: 'INCLUDES', badge: 'bg-gray-500/10 text-gray-500 border-gray-500/20', dot: 'bg-gray-500' });
    fetchData();
  };

  const deleteFaction = async (id: string) => {
    if (!confirm('Hapus faction ini?')) return;
    await fetch(`/api/factions?id=${id}`, { method: 'DELETE' }); fetchData();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const filtered = requests.filter(r => {
    const matchSearch = r.ipAddress.includes(search) || r.deviceId.includes(search);
    const matchFilter = filter === 'ALL' ? true : r.status === filter;
    return matchSearch && matchFilter;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-app">
      <header className="flex flex-col border-b border-line bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 sm:text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </span>Admin Center
          </h1>
        </div>
        <div className="mt-4 flex items-center gap-2 sm:mt-0">
          <div className="flex rounded-lg border border-line bg-app p-1">
            <button onClick={() => setActiveTab('requests')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${activeTab === 'requests' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>Users</button>
            <button onClick={() => setActiveTab('factions')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${activeTab === 'factions' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>Factions</button>
            <button onClick={() => setActiveTab('audit')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${activeTab === 'audit' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>Logs</button>
          </div>
          <button onClick={onClose} className="rounded-lg bg-hover px-4 py-2 text-sm font-medium hover:bg-line transition">Tutup</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {activeTab === 'requests' && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {['ALL', 'PENDING', 'APPROVED', 'BANNED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-xs font-medium transition sm:text-sm ${filter === f ? 'bg-accent text-accent-text' : 'bg-card border border-line text-muted hover:text-main'}`}>{f}</button>
                  ))}
                  <div className="h-6 w-px bg-line mx-1" />
                  <button onClick={() => executeBulk('APPROVE')} disabled={selected.size === 0} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-30">ACC Selected ({selected.size})</button>
                  <button onClick={() => executeBulk('BAN')} disabled={selected.size === 0} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-30">Ban Selected ({selected.size})</button>
                </div>
                <input type="text" placeholder="Cari IP / Device ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-line bg-card px-4 py-2 text-sm outline-none focus:border-accent sm:w-64" />
              </div>

              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                      <tr>
                        <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={(e) => e.target.checked ? setSelected(new Set(filtered.map(r => r.id))) : setSelected(new Set())} className="cursor-pointer accent-accent" /></th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">User Info</th>
                        <th className="px-4 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => {
                        const isOnline = new Date(r.lastActive).getTime() > Date.now() - 60000;
                        const isTimeout = r.timeoutUntil && new Date(r.timeoutUntil) > new Date();
                        return (
                          <tr key={r.id} className="border-t border-line hover:bg-hover/50 transition">
                            <td className="px-4 py-4"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer accent-accent" /></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-line'}`} />
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' : r.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : r.status === 'BANNED' ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/20 text-gray-500'}`}>{r.status}</span>
                                {isTimeout && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-500">TO</span>}
                              </div>
                              {r.reason && <div className="mt-1 text-[10px] text-muted max-w-[120px] truncate" title={r.reason}>Ket: {r.reason}</div>}
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium text-main">{r.ipAddress}</div>
                              <div className="font-mono text-[11px] text-subtle mt-0.5">{r.deviceId}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {r.status === 'BANNED' ? <button onClick={() => executeAction(r.id, 'REVOKE')} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded text-[11px] font-medium">Unban</button>
                                : isTimeout ? <button onClick={() => executeAction(r.id, 'CLEAR_TIMEOUT')} className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-2 py-1 rounded text-[11px] font-medium">Hapus TO</button>
                                : (
                                  <>
                                    {r.status !== 'APPROVED' && <button onClick={() => executeAction(r.id, 'APPROVE')} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded text-[11px] font-medium">ACC</button>}
                                    {r.status === 'APPROVED' && <button onClick={() => executeAction(r.id, 'REVOKE')} className="bg-hover text-muted hover:text-main px-2 py-1 rounded text-[11px] font-medium">Revoke</button>}
                                    <button onClick={() => { setActionModal({ type: 'TIMEOUT', id: r.id }); setReasonInput(''); setDurationInput('60'); }} className="text-orange-500 hover:bg-orange-500/10 px-2 py-1 rounded text-[11px] font-medium border border-transparent">Timeout</button>
                                    <button onClick={() => { setActionModal({ type: 'BAN', id: r.id }); setReasonInput(''); }} className="text-red-500 hover:bg-red-500/10 px-2 py-1 rounded text-[11px] font-medium border border-transparent">Ban</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'factions' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-card p-5">
                <h3 className="text-sm font-bold mb-4">Tambah Faction Baru</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Label (Nama Lengkap)</label><input type="text" value={newFaction.label} onChange={e => setNewFaction({...newFaction, label: e.target.value})} placeholder="FBI" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Short (Prefix in-game)</label><input type="text" value={newFaction.short} onChange={e => setNewFaction({...newFaction, short: e.target.value.toUpperCase()})} placeholder="FBI" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted mb-1 block">Match Type</label>
                    <select value={newFaction.matchType} onChange={e => setNewFaction({...newFaction, matchType: e.target.value})} className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent">
                      <option value="INCLUDES">INCLUDES (Mengandung)</option><option value="STARTS_WITH">STARTS_WITH (Diawali)</option>
                    </select>
                  </div>
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Badge Tailwind</label><input type="text" value={newFaction.badge} onChange={e => setNewFaction({...newFaction, badge: e.target.value})} placeholder="bg-blue-500/10 text-blue-500 border-blue-500/20" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Dot Tailwind</label><input type="text" value={newFaction.dot} onChange={e => setNewFaction({...newFaction, dot: e.target.value})} placeholder="bg-blue-500" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div className="flex items-end"><button onClick={addFaction} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover transition">Tambah Faction</button></div>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                    <tr><th className="px-4 py-3">Label</th><th className="px-4 py-3">Short</th><th className="px-4 py-3">Match Type</th><th className="px-4 py-3">Preview</th><th className="px-4 py-3 text-right">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {factions.map(f => (
                      <tr key={f.id} className="border-t border-line hover:bg-hover/50 transition">
                        <td className="px-4 py-3 font-medium text-main">{f.label}</td>
                        <td className="px-4 py-3 font-mono text-muted">{f.short}</td>
                        <td className="px-4 py-3 text-xs text-subtle">{f.matchType}</td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${f.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                            {f.short.split(',')[0]}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"><button onClick={() => deleteFaction(f.id)} className="text-red-500 hover:bg-red-500/10 px-2 py-1 rounded text-xs font-medium transition">Hapus</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="rounded-xl border border-line bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                    <tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Aksi</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Detail</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} className="border-t border-line hover:bg-hover/50 transition">
                        <td className="px-4 py-3 text-muted text-xs">{formatDate(l.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-main">{l.adminName}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-hover text-main border border-line">{l.action}</span></td>
                        <td className="px-4 py-3 font-mono text-[11px] text-subtle">{l.targetDeviceId}</td>
                        <td className="px-4 py-3 text-muted text-xs">{l.details || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-main mb-4">{actionModal.type === 'BAN' ? 'Blokir Permanen (Ban)' : 'Beri Jeda (Timeout)'}</h3>
            <label className="text-xs font-semibold text-muted mb-1 block">Alasan</label>
            <input type="text" value={reasonInput} onChange={e => setReasonInput(e.target.value)} placeholder="Contoh: Spam request..." className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent mb-3" />
            {actionModal.type === 'TIMEOUT' && (
              <>
                <label className="text-xs font-semibold text-muted mb-1 block">Durasi (Menit)</label>
                <select value={durationInput} onChange={e => setDurationInput(e.target.value)} className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent mb-4">
                  <option value="15">15 Menit</option><option value="60">1 Jam</option><option value="360">6 Jam</option><option value="1440">24 Jam</option>
                </select>
              </>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setActionModal(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-main">Batal</button>
              <button onClick={() => executeAction(actionModal.id!, actionModal.type, reasonInput, Number(durationInput))} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${actionModal.type === 'BAN' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ Main Home (Player Monitor) ══════════════ */
function Home({ isAdmin, refreshMs, compactMode, onOpenSettings, onOpenAdmin }: { isAdmin: boolean, refreshMs: number, compactMode: boolean, onOpenSettings: () => void, onOpenAdmin: () => void }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('SEMUA');
  const [page, setPage] = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const [factions, setFactions] = useState<FactionDef[]>([]);
  const [countdown, setCountdown] = useState<{ diffMs: number, target: Date } | null>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => { if (!navRef.current) return; setIsDragging(true); setStartX(e.pageX - navRef.current.offsetLeft); setScrollLeft(navRef.current.scrollLeft); };
  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => { if (!isDragging || !navRef.current) return; e.preventDefault(); const x = e.pageX - navRef.current.offsetLeft; const walk = (x - startX) * 2; navRef.current.scrollLeft = scrollLeft - walk; };
  const onWheel = (e: React.WheelEvent) => { if (navRef.current) navRef.current.scrollLeft += e.deltaY; };

  useEffect(() => {
    const activeEl = navRef.current?.querySelector('[data-active="true"]') as HTMLElement;
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCat]);

  useEffect(() => { fetch('/api/factions').then(res => res.json()).then(setFactions); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      const res = await fetch('/api/admin/requests');
      if (res.ok) { const reqs = await res.json(); setPendingCount(reqs.filter((r: any) => r.status === 'PENDING').length); }
    };
    fetchPending(); const int = setInterval(fetchPending, 15000); return () => clearInterval(int);
  }, [isAdmin]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date(); const wibOffset = 7 * 60 * 60 * 1000; const nowWib = new Date(now.getTime() + wibOffset); const h = nowWib.getUTCHours();
      let targetWib = new Date(nowWib); targetWib.setUTCHours(0, 0, 0, 0);
      if (h < 6) targetWib.setUTCHours(6, 0, 0, 0); else if (h < 18) targetWib.setUTCHours(18, 0, 0, 0); else { targetWib.setUTCDate(targetWib.getUTCDate() + 1); targetWib.setUTCHours(6, 0, 0, 0); }
      const diffMs = targetWib.getTime() - nowWib.getTime(); setCountdown({ diffMs, target: new Date(targetWib.getTime() - wibOffset) });
    };
    updateTimer(); const id = setInterval(updateTimer, 1000); return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/players', { cache: 'no-store' }); const json: ApiData = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json); setError(null); setLastFetch(new Date());
    } catch (e: any) { setError(e.message || 'Terjadi kesalahan'); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, refreshMs); return () => clearInterval(id); }, [load, refreshMs]);

  const enriched = useMemo(() => (data?.players ?? []).map(p => ({ ...p, faction: detectFaction(p.name, factions) })), [data, factions]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: enriched.length };
    for (const f of [...factions, WARGA]) c[f.id] = 0;
    for (const p of enriched) c[p.faction] = (c[p.faction] ?? 0) + 1;
    return c;
  }, [enriched, factions]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeCat !== 'SEMUA') list = list.filter(p => p.faction === activeCat);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    return list;
  }, [enriched, activeCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  useEffect(() => { setPage(0); }, [search, activeCat]);

  const navCats = useMemo(() => {
    const items = [
      { id: 'SEMUA', short: 'Semua', dot: 'bg-accent' },
      ...factions.map(f => ({ id: f.id, short: f.short.split(',')[0], dot: f.dot })), // Tampilkan alias pertama di nav
      { id: 'WARGA', short: WARGA.short, dot: WARGA.dot }
    ];
    return items.filter(it => (counts[it.id] ?? 0) > 0 || it.id === activeCat);
  }, [counts, activeCat, factions]);

  const isWarning = countdown && countdown.diffMs < 30 * 60 * 1000;

  return (
    <main className="min-h-screen bg-app text-main">
      <div className="fixed top-3 left-0 right-0 z-40 flex justify-center px-3">
        <div className="relative w-full max-w-5xl overflow-hidden rounded-full">
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-12 bg-gradient-to-r from-app via-app/80 to-transparent rounded-l-full backdrop-blur-[2px]" />
          
          <div 
            ref={navRef} onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove} onWheel={onWheel}
            className={`nav-scroll no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-nav px-3 py-1.5 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {navCats.map(cat => {
              const active = activeCat === cat.id;
              return (
                <button key={cat.id} data-active={active} onClick={() => setActiveCat(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${active ? 'bg-accent text-accent-text shadow-[0_0_12px_var(--accent)]' : 'text-muted hover:bg-hover hover:text-main'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? 'bg-accent-text' : cat.dot}`} />
                  <span>{cat.short}</span>
                  <span className={`text-[10px] ${active ? 'text-accent-text/80' : 'text-subtle'}`}>{counts[cat.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-12 bg-gradient-to-l from-app via-app/80 to-transparent rounded-r-full backdrop-blur-[2px]" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">IME Roleplay</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Player Monitor</h1>
            <p className="mt-1 text-sm text-muted">Pantau siapa saja yang sedang bermain sekarang</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {countdown && (
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors ${isWarning ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-line bg-card text-muted'}`}>
                <span className="hidden sm:inline">Restart dalam</span><span className="sm:hidden">Restart</span><span className="font-bold">{formatTime(countdown.diffMs)}</span>
              </div>
            )}
            {isAdmin && (
              <button onClick={onOpenAdmin} className="relative flex h-8 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-emerald-500 transition hover:bg-emerald-500/20" title="Admin Panel">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span className="text-xs font-semibold">Admin</span>
                {pendingCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-app">{pendingCount}</span>}
              </button>
            )}
            <button onClick={onOpenSettings} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-all duration-300 hover:border-accent/50 hover:text-main hover:rotate-90" title="Pengaturan"><GearIcon className="h-4 w-4" /></button>
            <button onClick={() => setAiOpen(true)} className="group flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-hover"><SparkIcon className="h-3.5 w-3.5" />Tanya AI</button>
          </div>
        </header>

        {isWarning && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 animate-pulse">
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div><span className="font-bold tracking-wide">PERINGATAN BADAI:</span> Server akan direstart dalam <span className="font-mono font-bold">{formatTime(countdown.diffMs)}</span>.</div>
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Online" value={data ? fmt(data.online) : '—'} accent="text-emerald-500" />
          <Stat label="Max Slots" value={data ? fmt(data.max) : '—'} accent="text-blue-500" />
          <Stat label="Gate" value={data?.gate ?? '—'} accent="text-accent" small />
          <Stat label="Terakhir" value={lastFetch ? lastFetch.toLocaleTimeString('id-ID') : '—'} accent="text-muted" small />
        </section>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">⚠ {error}</div>}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau kantong…" className="w-full rounded-lg border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15" />
          </div>
          <button onClick={load} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-main transition hover:border-accent/40 disabled:opacity-40 sm:w-auto w-full">
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className={`border-b border-line bg-hover text-left text-[10px] font-semibold uppercase tracking-wider text-subtle ${compactMode ? 'h-9' : 'h-11'}`}>
                  <th className="w-24 px-4">Kantong</th>
                  <th className="px-4">Nama</th>
                  <th className="w-20 px-4 text-right">Ping</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-subtle">Memuat data…</td></tr>
                ) : slice.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-subtle">{filtered.length ? 'Tidak ada hasil.' : 'Tidak ada player di kategori ini.'}</td></tr>
                ) : slice.map(p => {
                  const fac = p.faction === 'WARGA' ? WARGA : factions.find(f => f.id === p.faction) ?? WARGA;
                  return (
                    <tr key={p.id} className={`border-b border-line transition hover:bg-hover ${compactMode ? 'h-10' : 'h-14'}`}>
                      <td className="px-4"><span className="inline-flex items-center rounded-md border border-line bg-app px-2 py-0.5 font-mono text-[11px] font-medium text-main">#{p.id}</span></td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          {/* WIDGET STYLE BADGE */}
                          <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${fac.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${fac.dot}`} />
                            {fac.short.split(',')[0]}
                          </div>
                          <span className="truncate text-[13px] text-main max-w-[120px] sm:max-w-none">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 text-right"><span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-medium ${pingClass(p.ping)}`}>{p.ping}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-4 text-xs text-muted sm:flex-row">
          <div className="order-2 sm:order-1">Auto-refresh {refreshMs/1000} detik · {filtered.length} player</div>
          <div className="order-1 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto">
            <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage <= 0} className="flex-1 rounded-lg border border-line bg-card py-2 font-medium text-main transition hover:border-accent/40 disabled:opacity-30 sm:flex-none sm:px-4 sm:py-1.5">← Prev</button>
            <span className="min-w-[52px] text-center font-mono text-muted">{safePage + 1}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="flex-1 rounded-lg border border-line bg-card py-2 font-medium text-main transition hover:border-accent/40 disabled:opacity-30 sm:flex-none sm:px-4 sm:py-1.5">Next →</button>
          </div>
        </div>
      </div>

      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} data={data} enriched={enriched} counts={counts} activeCat={activeCat} factions={factions} />
    </main>
  );
}

/* ══════════════ Settings Modal ══════════════ */
function SettingsModal({ open, onClose, currentTheme, currentRefresh, currentCompact, onSave }: any) {
  const [theme, setTheme] = useState(currentTheme);
  const [refreshMs, setRefreshMs] = useState(currentRefresh);
  const [compactMode, setCompactMode] = useState(currentCompact);

  useEffect(() => {
    if (open) { setTheme(currentTheme); setRefreshMs(currentRefresh); setCompactMode(currentCompact); }
  }, [open, currentTheme, currentRefresh, currentCompact]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15"><GearIcon className="h-4 w-4 text-accent" /></span>
            <div><div className="text-sm font-semibold text-main">Pengaturan</div><div className="text-[11px] text-subtle">Tampilan & preferensi</div></div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="space-y-6 px-5 py-5">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Tema Tampilan</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { id: 'dark', label: 'Dark', bg: 'bg-[#0c0a08]', border: 'border-[#2a2520]' }, 
                { id: 'light', label: 'Light', bg: 'bg-[#f8fafc]', border: 'border-[#e2e8f0]' }, 
                { id: 'glass', label: 'Glass', bg: 'bg-[#09090b]', border: 'border-white/10' },
                { id: 'cyberpunk', label: 'Cyberpunk', bg: 'bg-[#050505]', border: 'border-[#fcee0a]' },
                { id: 'nord', label: 'Nord', bg: 'bg-[#2e3440]', border: 'border-[#4c566a]' }
              ].map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)} className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${theme === t.id ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-accent/40'}`}>
                  <div className={`h-10 w-full rounded-md border ${t.bg} ${t.border} flex items-center justify-center`}><div className={`h-1.5 w-6 rounded-full ${theme === t.id ? 'bg-accent' : 'bg-line'}`} /></div>
                  <span className={`text-xs font-medium ${theme === t.id ? 'text-accent' : 'text-muted group-hover:text-main'}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <hr className="border-line" />
          <div>
            <div className="mb-3 flex items-center justify-between"><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Interval Refresh</div><div className="text-[11px] text-muted">{refreshMs / 1000} detik</div></div>
            <div className="flex rounded-lg border border-line bg-app p-1">
              {[30, 60, 120].map(s => (
                <button key={s} onClick={() => setRefreshMs(s * 1000)} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${refreshMs === s * 1000 ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>{s} Detik</button>
              ))}
            </div>
          </div>
          <hr className="border-line" />
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-medium text-main">Mode Ringkas</div><div className="text-[11px] text-muted mt-0.5">Kurangi jarak antar baris tabel agar muat lebih banyak.</div></div>
            <button onClick={() => setCompactMode(!compactMode)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${compactMode ? 'bg-accent' : 'bg-hover'}`}><span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${compactMode ? 'translate-x-5' : 'translate-x-0'}`} /></button>
          </div>
        </div>
        <div className="border-t border-line bg-app px-5 py-3 text-right">
          <button onClick={() => onSave(theme, refreshMs, compactMode)} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-text transition hover:bg-accent-hover">Simpan & Tutup</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ AI Drawer ══════════════ */
function AIDrawer({ open, onClose, data, enriched, counts, activeCat, factions }: any) {
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, sending]);

  const buildContext = useCallback(() => {
    if (!data) return null;
    const factionSummary: any = {};
    for (const [id, count] of Object.entries(counts)) {
      if (id === 'SEMUA' || !count) continue;
      const f = id === 'WARGA' ? WARGA : factions.find((x: any) => x.id === id);
      factionSummary[id] = { label: f?.label || 'Unknown', count };
    }
    return { totalOnline: data.online, maxSlots: data.max, gate: data.gate, updatedAt: data.updatedAt, currentFilter: activeCat, factions: factionSummary, players: enriched.slice(0, 150).map((p: any) => ({ kantong: p.id, nama: p.name, faction: (p.faction === 'WARGA' ? WARGA : factions.find((x:any) => x.id === p.faction))?.label || 'Untagged', ping: p.ping })) };
  }, [data, counts, activeCat, enriched, factions]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: AiMsg[] = [...msgs, { role: 'user', content: trimmed }];
    setMsgs(next); setInput(''); setSending(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, context: buildContext() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal');
      setMsgs([...next, { role: 'assistant', content: json.text }]);
    } catch (e: any) { setMsgs([...next, { role: 'assistant', content: `⚠ ${e.message}` }]); } finally { setSending(false); }
  }

  const SUGGESTIONS = ['Ringkas siapa saja yang online sekarang', 'Faction apa yang paling banyak online?', 'Siapa saja polisi (LSPD/LSSD) yang online?', 'Ada berapa CC dan siapa nama mereka?', 'Player mana yang pingnya paling buruk?'];

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-app transition-transform duration-300 sm:w-[440px] ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15"><SparkIcon className="h-4 w-4 text-accent" /></span><div><div className="text-sm font-semibold text-main">Analisis AI</div><div className="text-[11px] text-subtle">Konteks data realtime</div></div></div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (<div className="space-y-3"><p className="text-sm text-muted">Tanya apa saja soal server yang lagi online. Contoh:</p><div className="flex flex-col gap-2">{SUGGESTIONS.map(s => (<button key={s} onClick={() => send(s)} className="rounded-lg border border-line bg-card px-3 py-2 text-left text-[13px] text-muted transition hover:border-accent/40 hover:bg-hover hover:text-main">{s}</button>))}</div></div>)}
          {msgs.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-accent text-accent-text whitespace-pre-wrap' : 'border border-line bg-card text-main'}`}>{m.role === 'user' ? m.content : renderMarkdown(m.content)}</div></div>))}
          {sending && (<div className="flex justify-start"><div className="flex gap-1 rounded-xl border border-line bg-card px-3.5 py-3"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '0ms' }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '150ms' }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '300ms' }} /></div></div>)}
        </div>
        <div className="border-t border-line p-3">
          <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Tanya soal player, faction, ping…" rows={1} className="flex-1 resize-none rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15" />
            <button type="submit" disabled={sending || !input.trim()} className="flex shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-accent-text transition hover:bg-accent-hover disabled:opacity-30"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>
          </form>
        </div>
      </aside>
    </div>
  );
}

/* ══════════════ UI Bits & Icons ══════════════ */
function Stat({ label, value, accent, small }: any) {
  return (<div className="rounded-xl border border-line bg-card p-4 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</div><div className={`mt-1 truncate font-semibold ${accent} ${small ? 'text-base' : 'text-xl'}`}>{value}</div></div>);
}
function SearchIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>); }
function RefreshIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>); }
function SparkIcon({ className }: any) { return (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" /></svg>); }
function GearIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>); }
