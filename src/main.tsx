import { Buffer } from 'buffer'
  ; (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './firebase' // Initialize Firebase

// Set default theme
if (!localStorage.getItem('theme')) {
  localStorage.setItem('theme', 'dark');
}
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
