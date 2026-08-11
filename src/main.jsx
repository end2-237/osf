import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Analytics } from "@vercel/analytics/react"
import { reloadForNewVersion } from './lib/lazyLoading.jsx'

// Vite émet cet événement quand le préchargement d'un chunk échoue — typiquement
// après un déploiement, quand l'onglet ouvert référence des fichiers qui
// n'existent plus. On recharge pour récupérer la version en ligne.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForNewVersion()
})

// ✅ StrictMode retiré — incompatible avec Supabase GoTrueClient (navigator.locks conflict)
ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <Analytics/>
    <App />
  </>
)