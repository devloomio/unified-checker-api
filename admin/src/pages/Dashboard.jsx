import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);

  useEffect(() => {
    api.get('/admin/dashboard/stats').then(r => { if (r.success) setStats(r.data); });
    api.get('/admin/dashboard/usage-chart?days=7').then(r => { if (r.success) setChart(r.data); });
  }, []);

  if (!stats) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Requests Hari Ini" value={stats.requests.today} sub={`Minggu ini: ${stats.requests.thisWeek}`} />
        <StatCard label="API Keys Aktif" value={stats.apiKeys.active} sub={`Total: ${stats.apiKeys.total}`} />
        <StatCard label="WhatsApp Sessions" value={stats.whatsapp.connectedSessions} sub={`Total: ${stats.whatsapp.totalSessions}`} />
        <StatCard label="Telegram Sessions" value={stats.telegram.connectedSessions} sub={`Total: ${stats.telegram.totalSessions}`} />
      </div>

      {chart.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Requests (7 Hari Terakhir)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chart}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Bar dataKey="requests" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.recentLogs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Aktivitas Terakhir</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Endpoint</th>
                  <th className="text-left py-2 pr-4">Method</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Time</th>
                  <th className="text-left py-2">Key</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.map((log, i) => (
                  <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                    <td className="py-2 pr-4 font-mono text-xs">{log.endpoint}</td>
                    <td className="py-2 pr-4">{log.method}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${log.status_code < 400 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {log.status_code}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{log.response_time_ms}ms</td>
                    <td className="py-2 text-gray-500">{log.key_name || '-'}</td>
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
