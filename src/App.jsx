import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Mic, MicOff, Settings, FileText, Building2, Book, Plus, Trash2, Save, Layout, Smartphone, X, Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

// --- TU CONFIGURACIÓN (RADIO-A06EE) ---
const firebaseConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734",
  measurementId: "G-XDJ6W8VH9K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'neuro-rad-prod'; 

// --- COMPONENTES UI ---
const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
    <Icon size={18} /> {label}
  </button>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden p-6 relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
      <h3 className="font-bold text-lg mb-4">{title}</h3>
      {children}
    </div>
  </div>
);

// --- COMPONENTE MÓVIL (MODO RÁFAGA ANTI-ECO) ---
const MobileMicInterface = ({ sessionId, user, isOnline }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Listo');
  const [localText, setLocalText] = useState(''); 
  
  // Usamos useRef para mantener el estado de "queremos escuchar" independiente del ciclo de vida del componente
  const shouldListenRef = useRef(false);
  const recognitionRef = useRef(null);
  
  const updateRemoteText = async (text) => {
    if (!text || !user || !text.trim()) return;
    try {
      setLocalText(text); // Feedback visual
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', sessionId);
      await setDoc(sessionRef, {
        latestText: text.trim(),
        timestamp: Date.now(),
        lastActiveUser: user.uid
      }, { merge: true });
    } catch (e) {
      console.error(e);
      setStatus('Reintentando envío...');
    }
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatus('Navegador no soportado.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    // CAMBIO CLAVE: Desactivamos continuous. Esto obliga a limpiar el buffer tras cada frase.
    recognitionRef.current.continuous = false; 
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'es-ES';

    recognitionRef.current.onstart = () => {
        setStatus('Escuchando...');
    };
    
    recognitionRef.current.onend = () => {
      // Si el usuario NO ha pausado manualmente, reiniciamos el micrófono inmediatamente
      if (shouldListenRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Si falla el reinicio rápido, esperamos un poco
            setTimeout(() => {
                if (shouldListenRef.current) recognitionRef.current.start();
            }, 100);
          }
      } else {
          setIsListening(false);
          setStatus('Pausado.');
      }
    };

    recognitionRef.current.onerror = (event) => {
      // Ignoramos errores de "no-speech" que ocurren cuando hay silencio y simplemente reiniciamos
      if (event.error === 'no-speech') return; 
      
      console.error(event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          setStatus('Error: Permiso denegado.');
      }
    };

    recognitionRef.current.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript) setLocalText(interimTranscript + '...');

      // Al ser continuous=false, cada vez que hay un finalTranscript es nuevo y único.
      // No necesitamos calcular diferencias ni índices.
      if (finalTranscript.trim()) {
         updateRemoteText(finalTranscript);
      }
    };

  }, [sessionId, user]);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      // Usuario quiere detener
      shouldListenRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Usuario quiere iniciar
      shouldListenRef.current = true;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setStatus('Error al iniciar. Toca de nuevo.');
        shouldListenRef.current = false;
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-indigo-300 flex items-center justify-center gap-2">
          <Smartphone/> Modo Remoto
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Sesión: {sessionId}</p>
      </div>

      <button onClick={toggleMic} className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 scale-110 animate-pulse' : 'bg-indigo-600'}`}>
        {isListening ? <Mic size={48}/> : <MicOff size={48}/>}
      </button>

      <div className="mt-8 w-full max-w-md bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[100px]">
        <p className="text-xs text-slate-400 mb-2 uppercase font-bold tracking-wider">Monitor</p>
        <p className="text-lg font-medium text-white leading-relaxed">
          {localText || <span className="text-slate-600 italic">Esperando voz...</span>}
        </p>
      </div>

      <p className="mt-6 text-sm text-slate-400 max-w-xs">{status}</p>
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function RadiologyWorkstation() {
  const [user, setUser] = useState(null);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [mobileSessionId, setMobileSessionId] = useState('');
  const [activeTab, setActiveTab] = useState('workstation');
  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteSessionCode, setRemoteSessionCode] = useState('');
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'mic') {
      setIsMobileMode(true);
      setMobileSessionId(params.get('session'));
    }
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // DICTADO LOCAL
  useEffect(() => {
    if (isMobileMode) return;
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
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
  }, [isMobileMode]);

  // DICTADO REMOTO (PC Listener)
  useEffect(() => {
    if (isMobileMode || !remoteSessionCode) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', remoteSessionCode), (docSnap) => {
      const data = docSnap.data();
      // Verificación de timestamp para evitar leer mensajes viejos
      if (data?.latestText && data.latestText.trim() !== '' && data.timestamp > (Date.now() - 5000)) {
        setReportText(prev => {
            const newTxt = data.latestText.trim();
            // Evitar duplicar si llega el mismo texto muy rápido
            if (prev.trim().endsWith(newTxt)) return prev;
            
            // Añadir espacio inteligente
            return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + newTxt;
        });
        updateDoc(docSnap.ref, { latestText: '' }); 
      }
    });
    return () => unsub();
  }, [remoteSessionCode, isMobileMode]);

  const toggleDictation = () => {
    if (!recognitionRef.current) return alert("Usa Chrome o Edge.");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
    setIsListening(!isListening);
  };

  const startRemoteSession = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRemoteSessionCode(code);
    setShowRemoteModal(true);
  };

  if (isMobileMode) return <MobileMicInterface sessionId={mobileSessionId} user={user} isOnline={navigator.onLine} />;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.href.split('?')[0]}?mode=mic&session=${remoteSessionCode}`)}`;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <div className="w-64 bg-white border-r hidden md:block p-4">
        <h1 className="font-bold text-xl text-indigo-700 mb-6 flex items-center gap-2"><Layout/> NeuroRad</h1>
        <div className="space-y-1">
          <SidebarItem icon={Mic} label="Dictado" active={activeTab==='workstation'} onClick={()=>setActiveTab('workstation')}/>
          <SidebarItem icon={Settings} label="Configuración" active={activeTab==='config'} onClick={()=>setActiveTab('config')}/>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full">
        {activeTab === 'workstation' && (
          <>
            <div className="h-16 bg-white border-b px-6 flex items-center justify-between">
              <span className="font-bold">Editor de Informes</span>
              <div className="flex gap-2">
                <button onClick={startRemoteSession} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <Smartphone size={16}/> Usar Celular
                </button>
                <button onClick={() => setReportText('')} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm">Limpiar</button>
                <button onClick={() => navigator.clipboard.writeText(reportText)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><Save size={16}/> Copiar</button>
              </div>
            </div>
            <div className="flex-1 p-8 relative">
              <textarea 
                className="w-full h-full p-8 rounded-xl border border-slate-200 shadow-sm text-lg outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-serif leading-relaxed"
                placeholder="El texto dictado aparecerá aquí..."
                value={reportText}
                onChange={e => setReportText(e.target.value)}
              />
              <button onClick={toggleDictation} className={`absolute bottom-12 right-12 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>
                {isListening ? <MicOff size={28}/> : <Mic size={28}/>}
              </button>
            </div>
          </>
        )}
        {activeTab === 'config' && <div className="p-8"><h2 className="text-2xl font-bold">Configuración</h2><p className="text-slate-500 mt-2">Aquí podrás configurar tus plantillas y centros.</p></div>}
      </div>

      {showRemoteModal && (
        <Modal title="Micrófono Remoto" onClose={() => setShowRemoteModal(false)}>
          <div className="flex flex-col items-center text-center">
            <div className="bg-white p-2 rounded border mb-4">
              <img src={qrUrl} alt="QR" className="w-48 h-48"/>
            </div>
            <p className="font-bold text-lg mb-1">Escanea con tu celular</p>
            <p className="text-sm text-slate-500 mb-4">Asegúrate de dar permiso al micrófono.</p>
            <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-mono text-slate-500">Sesión: {remoteSessionCode}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}