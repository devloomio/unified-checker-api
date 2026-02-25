import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const statusColors = {
  connected: 'bg-green-500/20 text-green-400',
  connecting: 'bg-blue-500/20 text-blue-400',
  need_phone: 'bg-yellow-500/20 text-yellow-400',
  need_code: 'bg-orange-500/20 text-orange-400',
  need_password: 'bg-purple-500/20 text-purple-400',
  error: 'bg-red-500/20 text-red-400',
};

export default function TelegramSessions() {
  const [sessions, setSessions] = useState([]);
  const [credentials, setCredentials] = useState({ hasCredentials: false, apiId: null });
  const [showCreds, setShowCreds] = useState(false);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [verifyId, setVerifyId] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [passwordId, setPasswordId] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [sessRes, credRes] = await Promise.all([
      api.get('/admin/sessions/tg'),
      api.get('/admin/sessions/tg/credentials'),
    ]);
    if (sessRes.success) setSessions(sessRes.sessions || []);
    if (credRes.success) setCredentials(credRes);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveCreds = async () => {
    setLoading(true);
    const res = await api.post('/admin/sessions/tg/credentials', { apiId, apiHash });
    if (res.success) { await fetchData(); setShowCreds(false); }
    setLoading(false);
  };

  const createSession = async () => {
    setLoading(true);
    const res = await api.post('/admin/sessions/tg', {
      id: newId || undefined,
      name: newName || undefined,
      phone: newPhone,
    });
    if (res.success) {
      setShowCreate(false);
      setNewId(''); setNewName(''); setNewPhone('');
      await fetchData();
      if (res.status === 'need_code') setVerifyId(res.sessionId);
    }
    setLoading(false);
  };

  const submitCode = async () => {
    setLoading(true);
    const res = await api.post(`/admin/sessions/tg/${verifyId}/verify`, { code: verifyCode });
    if (res.success) {
      if (res.status === 'need_password') {
        setPasswordId(verifyId);
        setVerifyId(null);
        setVerifyCode('');
      } else {
        setVerifyId(null);
        setVerifyCode('');
      }
      await fetchData();
    }
    setLoading(false);
  };

  const submitPassword = async () => {
    setLoading(true);
    const res = await api.post(`/admin/sessions/tg/${passwordId}/password`, { password });
    if (res.success) {
      setPasswordId(null);
      setPassword('');
      await fetchData();
    }
    setLoading(false);
  };

  const deleteSession = async (id) => {
    if (!confirm(`Hapus session "${id}"?`)) return;
    await api.delete(`/admin/sessions/tg/${id}`);
    fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Telegram Sessions</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowCreds(!showCreds)}
            className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-700">
            API Credentials
          </button>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
            + Tambah Session
          </button>
        </div>
      </div>

      {/* API Credentials */}
      {showCreds && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Telegram API Credentials</h3>
          <p className="text-xs text-gray-600 mb-3">
            Dapatkan di <a href="https://my.telegram.org" target="_blank" className="text-blue-400 underline">my.telegram.org</a>
            {credentials.hasCredentials && <span className="text-green-400 ml-2">(Sudah di-set, API ID: {credentials.apiId})</span>}
          </p>
          <div className="flex gap-3">
            <input placeholder="API ID" value={apiId} onChange={e => setApiId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="API Hash" value={apiHash} onChange={e => setApiHash(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <button onClick={saveCreds} disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Simpan</button>
          </div>
        </div>
      )}

      {/* Create Session */}
      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Session Baru</h3>
          <div className="flex gap-3">
            <input placeholder="Session ID (opsional)" value={newId} onChange={e => setNewId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Nama" value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="No. Telepon (+62...)" value={newPhone} onChange={e => setNewPhone(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <button onClick={createSession} disabled={loading || !newPhone}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg text-sm">Buat</button>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white px-3 py-2 text-sm">Batal</button>
          </div>
        </div>
      )}

      {/* Verify OTP Modal */}
      {verifyId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-medium mb-4">Masukkan Kode OTP</h3>
            <p className="text-sm text-gray-500 mb-3">Kode dikirim ke Telegram kamu</p>
            <input placeholder="Kode OTP" value={verifyCode} onChange={e => setVerifyCode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={submitCode} disabled={loading || !verifyCode}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm">Verifikasi</button>
              <button onClick={() => { setVerifyId(null); setVerifyCode(''); }}
                className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Password Modal */}
      {passwordId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-medium mb-4">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500 mb-3">Akun ini menggunakan 2FA, masukkan password</p>
            <input type="password" placeholder="Password 2FA" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={submitPassword} disabled={loading || !password}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm">Submit</button>
              <button onClick={() => { setPasswordId(null); setPassword(''); }}
                className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Session List */}
      {sessions.length === 0 ? (
        <div className="text-center text-gray-500 py-12">Belum ada session Telegram</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white truncate">{s.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs ${statusColors[s.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">ID: {s.id}</p>
              {s.phone && <p className="text-xs text-gray-500 mb-1">Phone: {s.phone}</p>}
              <p className="text-xs text-gray-500 mb-3">Checked: {s.checkedCount}</p>
              <div className="flex gap-2">
                {s.status === 'need_code' && (
                  <button onClick={() => setVerifyId(s.id)} className="text-xs bg-orange-600/20 text-orange-400 px-3 py-1.5 rounded-lg hover:bg-orange-600/30">
                    Input OTP
                  </button>
                )}
                {s.status === 'need_password' && (
                  <button onClick={() => setPasswordId(s.id)} className="text-xs bg-purple-600/20 text-purple-400 px-3 py-1.5 rounded-lg hover:bg-purple-600/30">
                    Input 2FA
                  </button>
                )}
                <button onClick={() => deleteSession(s.id)} className="text-xs bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-600/30">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
