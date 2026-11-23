import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startGoogle } from './lib/google/client';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

startGoogle();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
