import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupMsg, setCleanupMsg] = useState('');

  useEffect(() => {
    api.get('/admin/settings').then(r => { if (r.success) setSettings(r.data); });
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (newPassword !== confirmPassword) {
      setMsg('Password baru tidak cocok');
      setMsgType('error');
      return;
    }
    if (newPassword.length < 6) {
      setMsg('Password minimal 6 karakter');
      setMsgType('error');
      return;
    }
    const res = await api.put('/admin/auth/password', { currentPassword, newPassword });
    if (res.success) {
      setMsg('Password berhasil diubah');
      setMsgType('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMsg(res.message || 'Gagal');
      setMsgType('error');
    }
  };

  const cleanup = async () => {
    const res = await api.post('/admin/settings/cleanup', { days: cleanupDays });
    if (res.success) setCleanupMsg(res.message);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Ganti Password Admin</h3>

          {msg && (
            <div className={`text-sm px-4 py-2 rounded-lg mb-4 ${msgType === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {msg}
            </div>
          )}

          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Password Lama</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Password Baru</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Konfirmasi Password Baru</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
              Ubah Password
            </button>
          </form>
        </div>

        {/* Server Info */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Informasi Server</h3>
            {settings?._runtime ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Port</span>
                  <span className="text-white">{settings._runtime.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CORS Origins</span>
                  <span className="text-white">{settings._runtime.corsOrigins}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ENV API Key</span>
                  <span className={settings._runtime.hasEnvApiKey ? 'text-green-400' : 'text-gray-600'}>
                    {settings._runtime.hasEnvApiKey ? 'Set' : 'Tidak di-set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Node.js</span>
                  <span className="text-white">{settings._runtime.nodeVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uptime</span>
                  <span className="text-white">{Math.floor(settings._runtime.uptime / 60)} menit</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </div>

          {/* Cleanup */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Bersihkan Usage Log</h3>
            <p className="text-xs text-gray-600 mb-3">Hapus log API usage yang lebih lama dari:</p>
            <div className="flex gap-3 items-center">
              <input type="number" value={cleanupDays} onChange={e => setCleanupDays(parseInt(e.target.value) || 30)}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              <span className="text-sm text-gray-500">hari</span>
              <button onClick={cleanup} className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-lg text-sm">
                Bersihkan
              </button>
            </div>
            {cleanupMsg && <p className="text-xs text-green-400 mt-2">{cleanupMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
