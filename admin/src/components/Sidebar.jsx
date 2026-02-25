import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/whatsapp', label: 'WhatsApp', icon: '💬' },
  { to: '/telegram', label: 'Telegram', icon: '✈️' },
  { to: '/api-keys', label: 'API Keys', icon: '🔑' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">Unified Checker</h1>
        <p className="text-xs text-gray-500">Admin Panel</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-400">{user?.username}</span>
          <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>
    </aside>
  );
}
