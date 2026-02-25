import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for debugging
window.addEventListener('error', (e) => {
  document.getElementById('root').innerHTML = `<pre style="color:red;padding:20px;font-size:14px;">JS Error: ${e.message}\n${e.filename}:${e.lineno}</pre>`;
});

window.addEventListener('unhandledrejection', (e) => {
  document.getElementById('root').innerHTML = `<pre style="color:orange;padding:20px;font-size:14px;">Promise Error: ${e.reason}</pre>`;
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  document.getElementById('root').innerHTML = `<pre style="color:red;padding:20px;font-size:14px;">Render Error: ${err.message}\n${err.stack}</pre>`;
}
