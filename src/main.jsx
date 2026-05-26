import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import App from './App.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { initCapacitor } from './lib/capacitor.js';
import { initOTAUpdater } from './lib/updater.js';
import UpdateBanner from './components/UpdateBanner.jsx';
import './styles.css';
import 'react-toastify/dist/ReactToastify.css';

// Init native bridge + OTA
initCapacitor().then(() => initOTAUpdater());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <UpdateBanner />
        <ToastContainer position="top-right" autoClose={2500} />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
