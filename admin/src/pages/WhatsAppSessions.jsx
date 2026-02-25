import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const statusColors = {
  connected: 'bg-green-500/20 text-green-400',
  qr: 'bg-yellow-500/20 text-yellow-400',
  connecting: 'bg-blue-500/20 text-blue-400',
  reconnecting: 'bg-orange-500/20 text-orange-400',
  logged_out: 'bg-red-500/20 text-red-400',
};

export default function WhatsAppSessions() {
  const [sessions, setSessions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [qrData, setQrData] = useState(null);

  const fetchSessions = useCallback(async () => {
    const res = await api.get('/admin/sessions/wa');
    if (res.success) setSessions(res.sessions || []);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Auto-refresh QR
  useEffect(() => {
    if (!qrModal) return;
    const interval = setInterval(async () => {
      const res = await api.get(`/admin/sessions/wa/${qrModal}/qr`);
      if (res.success && res.qr) setQrData(res.qr);
      // Also refresh session list to detect connection
      const sessRes = await api.get('/admin/sessions/wa');
      if (sessRes.success) {
        setSessions(sessRes.sessions || []);
        const session = sessRes.sessions?.find(s => s.id === qrModal);
        if (session?.status === 'connected') {
          setQrModal(null);
          setQrData(null);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [qrModal]);

  const createSession = async () => {
    setLoading(true);
    const res = await api.post('/admin/sessions/wa', {
      id: newId || undefined,
      name: newName || undefined,
    });
    if (res.success) {
      setShowCreate(false);
      setNewId('');
      setNewName('');
      await fetchSessions();
      // Open QR modal
      if (res.sessionId) {
        setQrModal(res.sessionId);
        const qrRes = await api.get(`/admin/sessions/wa/${res.sessionId}/qr`);
        if (qrRes.success) setQrData(qrRes.qr);
      }
    }
    setLoading(false);
  };

  const deleteSession = async (id) => {
    if (!confirm(`Hapus session "${id}"?`)) return;
    await api.delete(`/admin/sessions/wa/${id}`);
    fetchSessions();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">WhatsApp Sessions</h2>
        <button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm">
          + Tambah Session
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Session Baru</h3>
          <div className="flex gap-3">
            <input placeholder="Session ID (opsional)" value={newId} onChange={e => setNewId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Nama" value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <button onClick={createSession} disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg text-sm">
              {loading ? '...' : 'Buat'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white px-3 py-2 text-sm">
              Batal
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center text-gray-500 py-12">Belum ada session WhatsApp</div>
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
              <p className="text-xs text-gray-500 mb-3">Checked: {s.checkedCount}</p>
              <div className="flex gap-2">
                {s.hasQR && (
                  <button onClick={async () => {
                    setQrModal(s.id);
                    const res = await api.get(`/admin/sessions/wa/${s.id}/qr`);
                    if (res.success) setQrData(res.qr);
                  }} className="text-xs bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-600/30">
                    Scan QR
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

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setQrModal(null); setQrData(null); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-4">Scan QR Code</h3>
            {qrData ? (
              <img src={qrData} alt="QR Code" className="w-full rounded-lg bg-white p-2" />
            ) : (
              <div className="text-center text-gray-500 py-12">Menunggu QR code...</div>
            )}
            <p className="text-xs text-gray-500 mt-3 text-center">Buka WhatsApp &gt; Linked Devices &gt; Link a Device</p>
            <button onClick={() => { setQrModal(null); setQrData(null); }}
              className="w-full mt-4 bg-gray-800 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
