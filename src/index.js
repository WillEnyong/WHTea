import React from 'react';
import { createRoot } from 'react-dom/client'; // Impor createRoot dari react-dom/client
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root')); // Buat root baru
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
