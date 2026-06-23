import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeTelemetry } from './telemetry.js'

try {
  initializeTelemetry()
} catch (error) {
  console.warn('Telemetry disabled after startup error', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
