import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/variables.css'
import './styles/global.css'
import { initAnalytics } from './utils/analytics.js'

// Start GA4 only when a previously saved analytics consent exists.
initAnalytics()

// Non-blocking asynchronous web font loading to prevent render blocking on critical path
if (typeof document !== 'undefined') {
  const fontLink = document.createElement('link')
  fontLink.rel = 'stylesheet'
  fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
  document.head.appendChild(fontLink)
}

// Production build marker: canonical root stylesheet imports only.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
