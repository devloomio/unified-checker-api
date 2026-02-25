import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState(60);
  const [createdKey, setCreatedKey] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState(60);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    const res = await api.get('/admin/keys');
    if (res.success) setKeys(res.data || []);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    setLoading(true);
    const res = await api.post('/admin/keys', { name: newName, rate_limit: newLimit });
    if (res.success) {
      setCreatedKey(res.key);
      setShowCreate(false);
      setNewName('');
      setNewLimit(60);
      await fetchKeys();
    }
    setLoading(false);
  };

  const toggleActive = async (id, currentActive) => {
    await api.put(`/admin/keys/${id}`, { is_active: !currentActive });
    fetchKeys();
  };

  const saveEdit = async () => {
    await api.put(`/admin/keys/${editId}`, { name: editName, rate_limit: editLimit });
    setEditId(null);
    fetchKeys();
  };

  const deleteKey = async (id, name) => {
    if (!confirm(`Hapus API key "${name}"? Semua usage log juga akan dihapus.`)) return;
    await api.delete(`/admin/keys/${id}`);
    fetchKeys();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">API Keys</h2>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
          + Buat API Key
        </button>
      </div>

      {/* Created Key Alert */}
      {createdKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6">
          <h3 className="text-green-400 font-medium mb-2">API Key Berhasil Dibuat!</h3>
          <p className="text-xs text-gray-400 mb-3">Simpan key ini sekarang. Key tidak bisa dilihat lagi setelah ditutup.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-900 text-green-300 px-3 py-2 rounded-lg text-xs font-mono break-all">{createdKey}</code>
            <button onClick={() => copyToClipboard(createdKey)}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="text-xs text-gray-500 hover:text-gray-400 mt-3">Tutup</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Buat API Key Baru</h3>
          <div className="flex gap-3">
            <input placeholder="Nama (misal: Client A)" value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">Rate Limit:</label>
              <input type="number" value={newLimit} onChange={e => setNewLimit(parseInt(e.target.value) || 60)}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-600">/min</span>
            </div>
            <button onClick={createKey} disabled={loading || !newName}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg text-sm">Buat</button>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white px-3 py-2 text-sm">Batal</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-medium mb-4">Edit API Key</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rate Limit (per menit)</label>
                <input type="number" value={editLimit} onChange={e => setEditLimit(parseInt(e.target.value) || 60)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm">Simpan</button>
              <button onClick={() => setEditId(null)} className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {keys.length === 0 ? (
        <div className="text-center text-gray-500 py-12">Belum ada API key. Buat satu untuk mulai.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left py-3 px-4">Nama</th>
                  <th className="text-left py-3 px-4">Key</th>
                  <th className="text-left py-3 px-4">Rate Limit</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Total Requests</th>
                  <th className="text-left py-3 px-4">Last Used</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className="border-b border-gray-800/50 text-gray-300">
                    <td className="py-3 px-4 font-medium text-white">{k.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{k.key_prefix}</td>
                    <td className="py-3 px-4">{k.rate_limit}/min</td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleActive(k.id, k.is_active)}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer ${k.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {k.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4">{k.total_requests.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{k.last_used_at || 'Never'}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditId(k.id); setEditName(k.name); setEditLimit(k.rate_limit); }}
                          className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteKey(k.id, k.name)}
                          className="text-xs text-red-400 hover:text-red-300">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
