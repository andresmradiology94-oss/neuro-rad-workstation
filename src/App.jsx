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
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { 
  Mic, MicOff, Settings, FileText, Building2, 
  Book, Plus, Trash2, Save, 
  Layout, Smartphone, X, 
  Wifi, WifiOff, Loader2
} from 'lucide-react';

// --- TU CONFIGURACIÓN DE FIREBASE ---
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
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
    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// --- COMPONENTE MÓVIL (MICRÓFONO REMOTO) ---
const MobileMicInterface = ({ sessionId, user, isOnline }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Esperando conexión...');
  const recognitionRef = useRef(null);
  
  const updateRemoteText = async (text) => {
    if (!text || !user || !isOnline) return;
    try {
      setStatus('Enviando...');
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', sessionId);
      await setDoc(sessionRef, {
        latestText: text,
        timestamp: Date.now(),
        lastActiveUser: user.uid
      }, { merge: true });
      setTimeout(() => setStatus('Escuchando...'), 500);
    } catch (e) {
      console.error(e);
      setStatus('Reintentando...');
    }
  };

  useEffect(() => {
    if (!isOnline) { setStatus('Sin Internet'); setIsListening(false); return; }
    if (!user) { setStatus('Autenticando...'); return; }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) updateRemoteText(finalTranscript);
      };
      recognitionRef.current.onstart = () => setStatus('Escuchando...');
      recognitionRef.current.onend = () => { setIsListening(false); setStatus('Micrófono detenido'); };
      setStatus('Listo para dictar');
    } else {
      setStatus('Navegador no soportado (Usa Chrome/Safari)');
    }
  }, [sessionId, user, isOnline]);

  const toggleMic = () => {
    if (!recognitionRef.current || !isOnline || !user) return;
    if (isListening) recognitionRef.current.stop();
    else {
        try { recognitionRef.current.start(); setIsListening(true); } 
        catch (e) { recognitionRef.current.stop(); setTimeout(() => recognitionRef.current.start(), 200); }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {!isOnline && <div className="absolute top-0 w-full bg-red-600 text-center py-2 text-sm font-bold flex justify-center gap-2"><WifiOff size={16} /> Sin conexión</div>}
      {isListening && <div className="absolute w-64 h-64 bg-indigo-600 rounded-full opacity-20 animate-ping"></div>}
      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-indigo-300 flex items-center gap-2 text-sm"><Smartphone size={16}/> SESIÓN: {sessionId}</div>
        <button onClick={toggleMic} disabled={!isOnline || !user} className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 scale-110' : 'bg-indigo-600'}`}>
          {!user ? <Loader2 size={40} className="animate-spin"/> : isListening ? <Mic size={48} className="animate-pulse"/> : <MicOff size={48}/>}
        </button>
        <h2 className="text-2xl font-bold">{!user ? 'Conectando...' : isListening ? 'Dictando...' : 'Toca para hablar'}</h2>
        <p className="text-slate-400 text-sm">{status}</p>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function RadiologyWorkstation() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [mobileSessionId, setMobileSessionId] = useState('');
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('centers');
  
  const [centers, setCenters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [jargonDict, setJargonDict] = useState([]);
  
  const [currentCenterId, setCurrentCenterId] = useState('');
  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteSessionCode, setRemoteSessionCode] = useState('');
  
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tempData, setTempData] = useState({});
  
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const session = params.get('session');
    if (mode === 'mic' && session) { setIsMobileMode(true); setMobileSessionId(session); }

    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Auth Error:", err); }
    };
    initAuth();
    
    return onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) setLoading(false); 
      else setTimeout(() => setLoading(false), 3000); 
    });
  }, []);

  useEffect(() => {
    if (!user || !db || isMobileMode) return;
    const unsubCenters = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setCenters(data);
      if (!currentCenterId && data.length > 0) setCurrentCenterId(data[0].id);
    });
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), s => setTemplates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubJargon = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), s => setJargonDict(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { unsubCenters(); unsubTemplates(); unsubJargon(); };
  }, [user, isMobileMode]);

  useEffect(() => {
    if (isMobileMode || !showRemoteModal || !remoteSessionCode || !user) return;
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', remoteSessionCode);
    setDoc(sessionRef, { created: Date.now(), active: true }, { merge: true });
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.latestText && data.timestamp > (Date.now() - 5000)) { 
                let processedText = data.latestText.trim();
                jargonDict.forEach(item => { processedText = processedText.replace(new RegExp(`\\b${item.trigger}\\b`, 'gi'), item.replacement); });
                setReportText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + processedText + '.');
                updateDoc(sessionRef, { latestText: '' }).catch(console.error);
            }
        }
    });
    return () => unsubscribe();
  }, [showRemoteModal, remoteSessionCode, jargonDict, user]);

  useEffect(() => {
    if (isMobileMode) return;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; }
        if (finalTranscript) {
          let processedText = finalTranscript.trim();
          jargonDict.forEach(item => { processedText = processedText.replace(new RegExp(`\\b${item.trigger}\\b`, 'gi'), item.replacement); });
          setReportText(prev => prev + (prev ? ' ' : '') + processedText + '.');
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [jargonDict, isMobileMode]);

  const toggleDictation = () => {
    if (!recognitionRef.current) return alert("Navegador no compatible.");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
    setIsListening(!isListening);
  };

  const startRemoteSession = () => { setRemoteSessionCode(Math.floor(1000 + Math.random() * 9000).toString()); setShowRemoteModal(true); };
  const addCenter = async () => { if(tempData.name) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), {name: tempData.name}); setTempData({}); setShowCenterModal(false); }};
  const addTemplate = async () => { if(tempData.title) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), {title: tempData.title, content: tempData.content, centerId: tempData.centerId || 'global'}); setTempData({}); setShowTemplateModal(false); }};
  const addJargon = async () => { if(tempData.trigger) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), {trigger: tempData.trigger.toLowerCase(), replacement: tempData.replacement}); setTempData({}); }};
  const deleteItem = async (col, id) => { if(confirm('¿Eliminar?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id)); };

  if (isMobileMode) return loading ? <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> Iniciando...</div> : <MobileMicInterface sessionId={mobileSessionId} user={user} isOnline={isOnline} />;
  
  if (loading) return (
    <div className="h-screen flex items-center justify-center text-slate-400 flex-col gap-4">
      <Loader2 size={32} className="animate-spin text-indigo-600"/>
      <p>Cargando NeuroRad Workstation...</p>
      <p className="text-xs text-slate-300">Autenticando usuario seguro...</p>
    </div>
  );

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.href.split('?')[0]}?mode=mic&session=${remoteSessionCode}`)}`;
  const visibleTemplates = templates.filter(t => t.centerId === 'global' || t.centerId === currentCenterId);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm hidden md:flex">
        <div className="p-4 border-b border-slate-100">
          <h1 className="font-bold text-xl text-indigo-700 flex items-center gap-2"><Layout size={24}/> NeuroRad <span className="text-xs bg-indigo-100 px-2 py-0.5 rounded text-indigo-600">PRO</span></h1>
          <div className="flex items-center gap-2 mt-2"><div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-xs text-slate-400">{isOnline ? 'Online' : 'Offline'}</span></div>
        </div>
        <div className="flex-1 py-4 space-y-1">
            <SidebarItem icon={Mic} label="Estación de Dictado" active={activeTab === 'workstation'} onClick={() => setActiveTab('workstation')} />
            <SidebarItem icon={Settings} label="Configuración" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
        </div>
        {activeTab === 'config' && <div className="border-t border-slate-100 py-4 space-y-1 bg-slate-50"><SidebarItem icon={Building2} label="Mis Centros" active={configSection === 'centers'} onClick={() => setConfigSection('centers')} /><SidebarItem icon={FileText} label="Gestor de Plantillas" active={configSection === 'templates'} onClick={() => setConfigSection('templates')} /><SidebarItem icon={Book} label="Diccionario" active={configSection === 'jargon'} onClick={() => setConfigSection('jargon')} /></div>}
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeTab === 'workstation' && (
          <>
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                 {!isOnline && <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1 rounded text-sm font-bold border border-red-100"><WifiOff size={16}/> Sin Conexión</div>}
                 <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-medium">Ubicación</span>
                  <select className="font-bold text-slate-800 bg-transparent outline-none cursor-pointer hover:text-indigo-600" value={currentCenterId} onChange={(e) => setCurrentCenterId(e.target.value)}>
                    <option value="" disabled>-- Selecciona Centro --</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={startRemoteSession} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm border border-slate-200"><Smartphone size={16} /> Micrófono Remoto</button>
                <button onClick={() => setReportText('')} className="px-4 py-2 text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg">Limpiar</button>
                <button onClick={() => {navigator.clipboard.writeText(reportText); alert('Copiado');}} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"><Save size={18}/> Copiar</button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
                <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col relative">
                  <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Comienza a dictar..." className="flex-1 w-full p-8 outline-none resize-none text-lg text-slate-700 leading-relaxed font-serif"/>
                  <button onClick={toggleDictation} className={`absolute bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>{isListening ? <MicOff size={28}/> : <Mic size={28}/>}</button>
                </div>
              </div>
              <div className="w-80 bg-white border-l border-slate-200 flex flex-col hidden lg:flex">
                <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-sm text-slate-700 flex items-center gap-2"><FileText size={16}/> Plantillas</h3></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {visibleTemplates.map(tpl => (<div key={tpl.id} onClick={() => setReportText(prev => prev + '\n' + tpl.content)} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:shadow-md cursor-pointer group"><span className="font-semibold text-slate-700 text-sm block mb-1">{tpl.title}</span><p className="text-xs text-slate-400 line-clamp-2">{tpl.content}</p></div>))}
                </div>
              </div>
            </div>
          </>
        )}
        {activeTab === 'config' && (
          <div className="p-8 overflow-y-auto h-full"><div className="max-w-4xl mx-auto">
               <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3"><Settings className="text-indigo-600"/> Configuración</h2>
               <div className="flex gap-2 mb-6 md:hidden"><button onClick={()=>setConfigSection('centers')} className="px-3 py-1 bg-slate-200 rounded">Centros</button><button onClick={()=>setConfigSection('templates')} className="px-3 py-1 bg-slate-200 rounded">Plantillas</button></div>
               {configSection === 'centers' && <div className="space-y-4"><button onClick={() => setShowCenterModal(true)} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-lg border border-dashed border-indigo-200 flex justify-center gap-2"><Plus size={20}/> Nuevo Centro</button>{centers.map(c => (<div key={c.id} className="bg-white p-4 border rounded flex justify-between"><span>{c.name}</span><button onClick={()=>deleteItem('centers',c.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}</div>}
               {configSection === 'jargon' && <div className="space-y-4"><div className="bg-white p-4 rounded border flex gap-2 items-end"><div className="flex-1"><label className="text-xs text-slate-500">Si digo...</label><input className="w-full border-b" value={tempData.trigger||''} onChange={e=>setTempData({...tempData, trigger:e.target.value})}/></div><div className="flex-[2]"><label className="text-xs text-slate-500">Escribir...</label><input className="w-full border-b" value={tempData.replacement||''} onChange={e=>setTempData({...tempData, replacement:e.target.value})}/></div><button onClick={addJargon} className="bg-slate-800 text-white p-2 rounded"><Plus size={16}/></button></div>{jargonDict.map(j => (<div key={j.id} className="flex justify-between items-center p-2 bg-white border rounded"><div className="flex gap-2 text-sm"><span className="font-bold text-indigo-600">{j.trigger}</span> <span>→</span> <span className="text-slate-600 truncate max-w-[150px]">{j.replacement}</span></div><button onClick={()=>deleteItem('jargon',j.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}</div>}
               {configSection === 'templates' && <div className="space-y-4"><button onClick={() => setShowTemplateModal(true)} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-lg border border-dashed border-indigo-200 flex justify-center gap-2"><Plus size={20}/> Nueva Plantilla</button>{templates.map(t => (<div key={t.id} className="bg-white p-4 border rounded flex justify-between"><span className="font-bold">{t.title}</span><button onClick={()=>deleteItem('templates',t.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}</div>}
          </div></div>
        )}
      </div>
      {showCenterModal && <Modal title="Nuevo Centro" onClose={() => setShowCenterModal(false)}><input className="w-full p-3 border rounded mb-3" placeholder="Nombre" onChange={e => setTempData({...tempData, name: e.target.value})}/><button onClick={addCenter} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Guardar</button></Modal>}
      {showTemplateModal && <Modal title="Nueva Plantilla" onClose={() => setShowTemplateModal(false)}><input className="w-full p-3 border rounded mb-3" placeholder="Título" onChange={e => setTempData({...tempData, title: e.target.value})}/><select className="w-full p-3 border rounded mb-3 bg-white" onChange={e => setTempData({...tempData, centerId: e.target.value})} defaultValue=""><option value="" disabled>Centro</option><option value="global">Global</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea className="w-full p-3 border rounded mb-3 h-32" placeholder="Texto..." onChange={e => setTempData({...tempData, content: e.target.value})}/><button onClick={addTemplate} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Guardar</button></Modal>}
      {showRemoteModal && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-center relative"><button onClick={() => setShowRemoteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button><div className="bg-indigo-600 p-6 text-white"><h3 className="text-xl font-bold flex items-center justify-center gap-2"><Smartphone/> Micrófono Remoto</h3><p className="text-indigo-100 text-sm mt-1">Conecta tu celular de forma segura</p></div><div className="p-8 flex flex-col items-center"><div className="bg-white p-2 rounded-lg shadow-inner border border-slate-200 mb-6"><img src={qrUrl} alt="Escanear con celular" className="w-48 h-48 object-contain" /></div><div className="space-y-2 text-slate-600"><p className="font-medium">1. Escanea este código</p><p className="text-sm">2. Espera a ver "Listo para dictar"</p></div><div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Sesión: {remoteSessionCode}</div></div></div></div>}
    </div>
  );
}