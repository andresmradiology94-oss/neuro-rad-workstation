import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- PEGAR AQUÍ TU CONFIGURACIÓN DE FIREBASE ---
// Reemplaza el objeto de abajo con el que te dio Firebase Console
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "NUMEROS",
  appId: "TU_APP_ID"
};

// Inyectamos la configuración para que App.jsx la lea sin cambios
window.__firebase_config = JSON.stringify(firebaseConfig);
window.__app_id = 'neuro-rad-prod'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)