import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { 
  Mic, MicOff, Settings, FileText, Building2, 
  Book, Plus, Trash2, Save, 
  Layout, Smartphone, X, 
  Wifi, WifiOff, Loader2, AlertTriangle
} from 'lucide-react';

// --- TUS CLAVES REALES ---
const firebaseConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734",
  measurementId: "G-XDJ6W8VH9K"
};

// --- INICIALIZACIÓN ---
let app, auth, db;
let initError = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  initError = e.message;
}

const appId = 'neuro-rad-prod'; 

// --- COMPONENTES UI ---
const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
      active ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// --- APP PRINCIPAL ---
export default function RadiologyWorkstation() {
  const [user, setUser] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Iniciando sistema...');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // ESTADOS DE UI
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('centers');
  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [centers, setCenters] = useState([]);
  
  // Modales y Formularios
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [tempData, setTempData] = useState({});
  const recognitionRef = useRef(null);

  // 1. AUTH AL INICIAR
  useEffect(() => {
    if (initError) {
      setStatusMsg(`ERROR GRAVE DE CONFIGURACIÓN: ${initError}`);
      return;
    }

    const runAuth = async () => {
      try {
        setStatusMsg('Intentando conectar con Firebase...');
        await signInAnonymously(auth);
      } catch (err) {
        console.error(err);
        setStatusMsg(`Error de Autenticación: ${err.message}. Revisa la consola de Firebase > Authentication.`);
      }
    };
    runAuth();

    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setStatusMsg(`Conectado como: ${u.uid.slice(0,5)}...`);
      } else {
        setUser(null);
      }
    });
  }, []);

  // 2. CARGAR DATOS SI HAY USUARIO
  useEffect(() => {
    if (!user || !db) return;
    
    // Intentar leer centros para probar la base de datos
    try {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), 
        (snapshot) => {
          setCenters(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
          setStatusMsg('Base de datos conectada y sincronizada.');
        },
        (error) => {
          console.error(error);
          if (error.code === 'permission-denied') {
            setStatusMsg('ERROR: Permiso denegado. Revisa las Reglas de Firestore.');
          } else {
            setStatusMsg(`Error Base de Datos: ${error.message}`);
          }
        }
      );
      return () => unsub();
    } catch (e) {
      setStatusMsg(`Error conexión DB: ${e.message}`);
    }
  }, [user]);

  // DICTADO LOCAL
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.onresult = (e) => {
        let txt = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) if(e.results[i].isFinal) txt += e.results[i][0].transcript;
        if(txt) setReportText(prev => prev + ' ' + txt);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) return alert("Navegador no soporta dictado");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const addCenter = async () => {
    if (!tempData.name || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), { name: tempData.name });
      setShowCenterModal(false);
      setTempData({});
    } catch (e) {
      alert(`Error al guardar: ${e.message}`);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden flex-col">
      
      {/* BARRA DE DIAGNÓSTICO (ESTO TE DIRÁ EL ERROR REAL) */}
      <div className={`px-4 py-2 text-white text-xs font-mono font-bold flex justify-between items-center ${statusMsg.includes('Error') || statusMsg.includes('ERROR') ? 'bg-red-600' : 'bg-slate-800'}`}>
        <span>ESTADO DEL SISTEMA: {statusMsg}</span>
        <span>{isOnline ? 'INTERNET OK' : 'SIN INTERNET'}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
          <div className="p-4 border-b border-slate-100">
             <h1 className="font-bold text-xl text-indigo-700 flex items-center gap-2"><Layout size={24}/> NeuroRad</h1>
          </div>
          <div className="py-4 space-y-1">
             <SidebarItem icon={Mic} label="Dictado" active={activeTab === 'workstation'} onClick={() => setActiveTab('workstation')} />
             <SidebarItem icon={Settings} label="Configuración" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
          </div>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col relative">
          
          {/* Workstation */}
          {activeTab === 'workstation' && (
             <div className="flex-1 flex flex-col">
               <div className="h-16 bg-white border-b px-6 flex items-center justify-between">
                  <span className="font-bold text-slate-700">Editor de Informes</span>
                  <div className="flex gap-2">
                    <button onClick={() => setReportText('')} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded">Limpiar</button>
                    <button onClick={() => navigator.clipboard.writeText(reportText)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded shadow hover:bg-indigo-700">Copiar</button>
                  </div>
               </div>
               <div className="flex-1 p-8 bg-slate-50 overflow-y-auto relative">
                  <div className="max-w-4xl mx-auto bg-white rounded-xl shadow min-h-[500px] flex flex-col relative">
                    <textarea 
                      className="flex-1 p-8 text-lg outline-none resize-none" 
                      placeholder="Escribe o dicta aquí..."
                      value={reportText}
                      onChange={e => setReportText(e.target.value)}
                    />
                    <button onClick={toggleDictation} className={`absolute bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>
                       {isListening ? <MicOff size={28}/> : <Mic size={28}/>}
                    </button>
                  </div>
               </div>
             </div>
          )}

          {/* Configuración */}
          {activeTab === 'config' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Configuración</h2>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded shadow border">
                  <h3 className="font-bold mb-2">Mis Centros</h3>
                  {centers.map(c => <div key={c.id} className="p-2 border-b">{c.name}</div>)}
                  <button onClick={() => setShowCenterModal(true)} className="mt-2 text-indigo-600 font-bold flex items-center gap-1"><Plus size={16}/> Agregar Centro</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCenterModal && (
        <Modal title="Agregar Centro" onClose={() => setShowCenterModal(false)}>
           <input className="w-full border p-2 rounded mb-4" placeholder="Nombre del Hospital" onChange={e => setTempData({name: e.target.value})} />
           <button onClick={addCenter} className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Guardar</button>
        </Modal>
      )}

    </div>
  );
}

// PRUEBA DE CAMBIO