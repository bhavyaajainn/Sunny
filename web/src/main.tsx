import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { StoreProvider } from './data/store';
import { readDevScreen } from './lib/dev';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <div className="app">
      <ToastProvider>
        <StoreProvider>
          <App dev={readDevScreen()} />
        </StoreProvider>
      </ToastProvider>
    </div>
  </StrictMode>,
);
