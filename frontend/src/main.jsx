import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.jsx'

// Clickjacking protection: break out of iframe embedding
if (window.self !== window.top) {
  window.top.location = window.self.location;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
