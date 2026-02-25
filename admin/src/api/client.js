const BASE = '/api';

async function request(method, path, body = null) {
  const token = localStorage.getItem('admin_token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();

  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
