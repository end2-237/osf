import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Analytics } from "@vercel/analytics/react"

// ✅ StrictMode retiré — incompatible avec Supabase GoTrueClient (navigator.locks conflict)
ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <Analytics/>
    <App />
  </>
)