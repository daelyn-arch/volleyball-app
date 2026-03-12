import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DialogProvider } from './components/ThemedDialog';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DialogProvider>
        <App />
      </DialogProvider>
    </HashRouter>
  </React.StrictMode>
);
