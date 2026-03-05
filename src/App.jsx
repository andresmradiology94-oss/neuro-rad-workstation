import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { 
  Mic, MicOff, Settings, FileText, 
  Save, ChevronDown, ChevronRight,
  Layout, X, Search, Loader2, 
  Folder, Layers, HardDrive, 
  Clipboard, Trash2, Edit3, Plus, CheckCircle, 
  Smartphone, Building2, QrCode, Languages, 
  RefreshCw, Copy, PlusCircle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734"
};

const appId = 'neuro-rad-workstation-main';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- MOTOR DE PROCESAMIENTO DE TEXTO (PUNTUACIÓN Y MACROS) ---
const processTranscript = (rawText, macrosList) => {
    let text = rawText.toLowerCase().trim();
    
    // 1. Eliminar el punto automático que añade Chrome (si no se dijo "punto")
    if (text.endsWith('.') && !text.endsWith('punto')) {
        text = text.slice(0, -1).trim();
    }

    // 2. Aplicar Diccionario de Macros (Jerga Médica)
    if (macrosList && macrosList.length > 0) {
        // Ordenar por longitud para que frases largas no pisen a las cortas
        const sortedMacros = [...macrosList].sort((a, b) => b.trigger.length - a.trigger.length);
        sortedMacros.forEach(m => {
            const regex = new RegExp(`\\b${m.trigger.toLowerCase()}\\b`, 'gi');
            text = text.replace(regex, m.replacement);
        });
    }

    // 3. Aplicar Comandos de Puntuación Exactos
    const CMDS = { 
        "punto y aparte": ".\n\n",
        "punto aparte": ".\n\n",
        "nuevo párrafo": "\n\n",
        "punto y seguido": ". ",
        "punto": ".", 
        "coma": ",", 
        "dos puntos": ":" 
    };
    
    Object.keys(CMDS).forEach(cmd => {
        const regex = new RegExp(`\\b${cmd}\\b`, 'gi');
        text = text.replace(regex, CMDS[cmd]);
    });

    // 4. Limpiar espacios antes de los signos de puntuación
    text = text.replace(/\s+([.,;:])/g, '$1');
    
    return text;
};

// =====================================================================
// COMPONENTE 1: VISTA MÓVIL (MICRÓFONO REMOTO)
// =====================================================================
function MobileMicView({ sessionId }) {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState("Listo para dictar");
    const [macros, setMacros] = useState([]);
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Cargar macros del usuario
        const unsubMacros = onSnapshot(collection(db, 'artifacts', appId, 'users', sessionId, 'macros'), s => {
            setMacros(s.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsubMacros();
    }, [sessionId]);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.lang = 'es-ES';
            
            recognitionRef.current.onstart = () => setStatus("Escuchando...");
            recognitionRef.current.onend = () => {
                setIsListening(false);
                setStatus("Listo para dictar");
            };

            recognitionRef.current.onresult = (e) => {
                let finalTranscript = '';
                // Evitar repeticiones: solo procesar el resultado final actual
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
                }
                
                if (finalTranscript.trim()) {
                    const processed = processTranscript(finalTranscript, macros);
                    // Enviar a Firebase
                    setDoc(doc(db, 'artifacts', appId, 'users', sessionId, 'remote', 'session'), { 
                        transcript: processed,
                        timestamp: Date.now()
                    }, { merge: true });
                }
            };
        } else {
            setStatus("Navegador no compatible");
        }
    }, [macros, sessionId]);

    const toggleMic = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-6">
            <div className="mb-12 text-center">
                <h1 className="text-2xl font-black text-indigo-400 tracking-widest mb-2">NEURORAD <span className="text-white">MIC</span></h1>
                <p className="text-sm text-slate-400">Conectado a la Workstation</p>
            </div>
            
            <button 
                onClick={toggleMic} 
                className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-95 ${isListening ? 'bg-red-500 shadow-red-500/50 animate-pulse' : 'bg-indigo-600 shadow-indigo-600/50'}`}
            >
                {isListening ? <MicOff size={64} className="text-white"/> : <Mic size={64} className="text-white"/>}
            </button>
            
            <div className="mt-12 text-center font-mono text-sm uppercase tracking-widest text-slate-500">
                {status}
            </div>
        </div>
    );
}


// =====================================================================
// COMPONENTE 2: VISTA ESCRITORIO (WORKSTATION PRO)
// =====================================================================
export default function App() {
  // Detector de sesión móvil
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');

  if (sessionId) {
      return <MobileMicView sessionId={sessionId} />;
  }

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('workstation'); 
  const [configSection, setConfigSection] = useState('templates');
  const [notification, setNotification] = useState(null);
  
  // DATOS DE FIREBASE
  const [methods, setMethods] = useState([]);
  const [regions, setRegions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [macros, setMacros] = useState([]);
  const [centers, setCenters] = useState([]);
  
  // UI ESTADOS
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // EDITOR Y VOZ
  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const showNotification = (message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  // 1. AUTENTICACIÓN
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. SINCRONIZACIÓN EN TIEMPO REAL
  useEffect(() => {
    if (!user || !db) return;
    const path = ['artifacts', appId, 'users', user.uid];

    const unsubM = onSnapshot(query(collection(db, ...path, 'methods'), orderBy('order', 'asc')), s => setMethods(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubR = onSnapshot(query(collection(db, ...path, 'regions'), orderBy('name', 'asc')), s => setRegions(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubT = onSnapshot(collection(db, ...path, 'templates'), s => setTemplates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubMacros = onSnapshot(collection(db, ...path, 'macros'), s => setMacros(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubCenters = onSnapshot(collection(db, ...path, 'centers'), s => setCenters(s.docs.map(d => ({id: d.id, ...d.data()}))));
    
    // Escucha de Micrófono Remoto
    let lastProcessedTime = 0;
    const unsubRemote = onSnapshot(doc(db, ...path, 'remote', 'session'), (d) => {
        if (d.exists() && d.data().transcript) {
            const data = d.data();
            if (data.timestamp && data.timestamp > lastProcessedTime) {
                appendProcessedText(data.transcript);
                lastProcessedTime = data.timestamp;
            }
        }
    });

    return () => { unsubM(); unsubR(); unsubT(); unsubMacros(); unsubCenters(); unsubRemote(); };
  }, [user]);

  // 3. APLICAR TEXTO AL EDITOR (Control de mayúsculas)
  const appendProcessedText = (processed) => {
      setReportText(prev => {
          const needsCap = !prev || ['.', '\n'].some(c => prev.trim().endsWith(c));
          const final = needsCap ? processed.charAt(0).toUpperCase() + processed.slice(1) : processed;
          return prev + (prev && !prev.endsWith('\n') ? ' ' : '') + final;
      });
  };

  // 4. VOZ LOCAL (PC)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'es-ES';
      
      recognitionRef.current.onresult = (e) => {
        let finalTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        }
        if (finalTranscript.trim()) {
            const processed = processTranscript(finalTranscript, macros);
            appendProcessedText(processed);
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [macros]);

  // 5. GESTIÓN DE DATOS (CRUD)
  const saveItem = async () => {
    if (!user) return;
    setIsSaving(true);
    const colName = modalType === 'method' ? 'methods' : modalType === 'region' ? 'regions' : modalType === 'macro' ? 'macros' : modalType === 'center' ? 'centers' : 'templates';
    const path = ['artifacts', appId, 'users', user.uid, colName];
    try {
        if (editData.id) await updateDoc(doc(db, ...path, editData.id), { ...editData });
        else await addDoc(collection(db, ...path), { ...editData, createdAt: Date.now() });
        showNotification("Guardado con éxito");
        setIsModalOpen(false);
        setEditData({});
    } catch (e) { showNotification(e.message, "error"); }
    finally { setIsSaving(false); }
  };

  const deleteItem = async (type, id) => {
    if (!confirm("¿Deseas eliminar este registro permanentemente?")) return;
    const colName = type + 's';
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, colName, id));
    showNotification("Eliminado");
  };

  const toggleNode = (id) => setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {notification && (
        <div className={`fixed top-6 right-6 p-4 rounded-2xl shadow-2xl z-50 text-white font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${notification.type === 'error' ? 'bg-red-500' : 'bg-indigo-600'}`}>
            <CheckCircle size={20} /> {notification.message}
        </div>
      )}

      {/* SIDEBAR DE HERRAMIENTAS */}
      <div className="w-16 lg:w-64 bg-slate-900 text-slate-400 flex flex-col z-20 shadow-2xl">
        <div className="h-16 flex items-center px-4 border-b border-white/5 bg-slate-950">
          <Layout size={22} className="text-indigo-400 shrink-0"/>
          <span className="ml-3 font-black text-white hidden lg:block tracking-tighter uppercase text-sm">NeuroRad <span className="text-indigo-500 text-xs">PRO</span></span>
        </div>
        <div className="flex-1 py-6 space-y-1 px-2">
            <SidebarBtn active={activeTab === 'workstation'} onClick={()=>setActiveTab('workstation')} icon={<FileText size={18}/>} label="Estación PACS" />
            <SidebarBtn active={activeTab === 'macros'} onClick={()=>setActiveTab('macros')} icon={<Languages size={18}/>} label="Diccionario" />
            <SidebarBtn active={activeTab === 'centers'} onClick={()=>setActiveTab('centers')} icon={<Building2 size={18}/>} label="Centros Médicos" />
            <SidebarBtn active={activeTab === 'remote'} onClick={()=>setActiveTab('remote')} icon={<Smartphone size={18}/>} label="MicRemoto QR" />
            <div className="my-4 border-t border-white/5 mx-2"></div>
            <SidebarBtn active={activeTab === 'config'} onClick={()=>setActiveTab('config')} icon={<Settings size={18}/>} label="Ajustes Sistema" />
        </div>
        <div className="p-4 border-t border-white/5 hidden lg:block text-[9px] font-black text-slate-600 uppercase tracking-widest">
            v3.0 - 2 NIVELES
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* VISTA 1: ESTACIÓN (PACS + EDITOR) */}
        {activeTab === 'workstation' && (
          <div className="flex-1 flex h-full">
            <div className="flex-1 flex flex-col bg-slate-50 relative">
                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
                    <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2"><HardDrive size={14}/> Workstation Activa</div>
                    <div className="flex gap-2">
                        <button onClick={() => setReportText('')} className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-500">Limpiar</button>
                        <button onClick={() => {navigator.clipboard.writeText(reportText); showNotification("Copiado al portapapeles");}} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-black transition-all active:scale-95"><Copy size={14}/> Copiar Informe</button>
                    </div>
                </div>
                <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
                    <div className="max-w-4xl mx-auto h-full min-h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col relative overflow-hidden">
                        <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Dicta hallazgos o selecciona una plantilla del árbol lateral..." className="flex-1 w-full p-10 outline-none resize-none text-lg text-slate-700 leading-relaxed font-serif placeholder:text-slate-200"/>
                        <button onClick={() => isListening ? (recognitionRef.current.stop(), setIsListening(false)) : (recognitionRef.current.start(), setIsListening(true))} className={`absolute bottom-10 right-10 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse text-white shadow-red-500/30' : 'bg-indigo-600 text-white shadow-indigo-600/30'}`}>
                            {isListening ? <MicOff size={28}/> : <Mic size={28}/>}
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPLORADOR PACS (2 NIVELES + PLANTILLAS) */}
            <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 overflow-hidden text-xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Folder size={16} className="text-indigo-500"/> Explorador PACS</h3>
                </div>
                <div className="p-3 border-b border-slate-100">
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 text-slate-300" size={14}/>
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 ring-indigo-100 transition-all"/>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-white px-2 py-4 custom-scrollbar">
                    {methods.length === 0 && (
                        <div className="p-10 text-center text-slate-300">
                            <ListTree size={40} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs font-bold uppercase italic">Árbol Vacío</p>
                        </div>
                    )}
                    {methods.map(method => {
                        const isMExp = expandedNodes.includes(method.id);
                        const mRegs = regions.filter(r => r.methodId === method.id);
                        return (
                            <div key={method.id} className="mb-1">
                                <button onClick={() => toggleNode(method.id)} className="w-full flex items-center p-2 rounded-lg hover:bg-slate-50 transition-all text-indigo-600 font-black text-[11px] uppercase tracking-widest text-left">
                                    {isMExp ? <ChevronDown size={12} className="mr-2"/> : <ChevronRight size={12} className="mr-2"/>}
                                    {method.name}
                                </button>
                                {isMExp && (
                                    <div className="mt-1 space-y-1">
                                        {mRegs.map(region => {
                                            const regId = `r-${method.id}-${region.id}`;
                                            const isRExp = expandedNodes.includes(regId);
                                            const rTpls = templates.filter(t => t.regionId === region.id && t.methodId === method.id);
                                            return (
                                                <div key={region.id} className="ml-3">
                                                    <div className="flex items-center justify-between group">
                                                        <button onClick={() => toggleNode(regId)} className="flex-1 flex items-center p-1.5 rounded-lg hover:bg-slate-50 text-slate-700 font-bold text-[10px] uppercase text-left">
                                                            {isRExp ? <ChevronDown size={10} className="mr-2 text-slate-400"/> : <ChevronRight size={10} className="mr-2 text-slate-400"/>}
                                                            {region.name}
                                                        </button>
                                                        {/* BOTÓN + PARA AÑADIR PLANTILLA DIRECTO EN LA REGIÓN */}
                                                        <button 
                                                            onClick={() => { setModalType('template'); setEditData({ methodId: method.id, regionId: region.id }); setIsModalOpen(true); }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-indigo-400 hover:text-indigo-600 transition-all"
                                                            title="Añadir Plantilla aquí"
                                                        >
                                                            <PlusCircle size={14}/>
                                                        </button>
                                                    </div>
                                                    
                                                    {isRExp && (
                                                        <div className="mt-1 space-y-1 ml-4 border-l border-slate-100 pl-3">
                                                            {rTpls.length === 0 && <p className="text-[9px] text-slate-300 italic py-1 pl-1">Carpeta vacía</p>}
                                                            {rTpls.map(tpl => (
                                                                <div key={tpl.id} className="flex justify-between items-center group">
                                                                    <button onClick={() => setReportText(prev => prev + (prev ? '\n\n' : '') + tpl.content)} className="flex-1 text-left p-2 bg-white border border-slate-100 rounded-lg hover:border-indigo-400 hover:shadow-sm transition-all group-hover:text-indigo-600">
                                                                        <div className="font-bold text-slate-800 text-[10px] group-hover:text-indigo-600 line-clamp-1">{tpl.title}</div>
                                                                    </button>
                                                                    <button onClick={() => deleteItem('template', tpl.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {/* VISTA 2: DICCIONARIO (MACROS) */}
        {activeTab === 'macros' && (
            <div className="p-10 max-w-5xl mx-auto w-full overflow-y-auto h-full">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3"><Languages className="text-indigo-600"/> Diccionario de Jerga Médica</h2>
                    <button onClick={()=>{ setModalType('macro'); setEditData({}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all"><Plus size={18}/> Nuevo Término</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {macros.map(m => (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 -rotate-45 translate-x-8 -translate-y-8"></div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Si detecta:</div>
                                <div className="text-lg font-black text-red-500 mb-4 tracking-tighter">"{m.trigger}"</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Corregir a:</div>
                                <div className="text-lg font-black text-emerald-600 uppercase italic tracking-tighter">"{m.replacement}"</div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={()=>deleteItem('macro', m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VISTA 3: MICRÓFONO REMOTO (QR) */}
        {activeTab === 'remote' && (
            <div className="p-10 flex flex-col items-center justify-center h-full text-center bg-slate-50">
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100 max-w-md w-full flex flex-col items-center">
                    <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-200">
                        <QrCode size={40}/>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Voz Inalámbrica</h2>
                    <p className="text-sm text-slate-400 mb-10 font-medium px-4">Usa tu smartphone como micrófono. Escanea y dicta; el texto aparecerá mágicamente en tu PC.</p>
                    
                    <div className="p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-inner mb-10">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${window.location.origin}?session=${user?.uid}`} 
                            alt="QR Session" 
                            className="w-56 h-56"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-3 rounded-full">
                        <RefreshCw size={14} className="animate-spin"/> Esperando señal remota...
                    </div>
                </div>
            </div>
        )}

        {/* VISTA 4: AJUSTES */}
        {activeTab === 'config' && (
          <div className="p-8 lg:p-12 overflow-y-auto h-full bg-slate-50">
            <div className="max-w-6xl mx-auto">
               <div className="flex items-center justify-between mb-10">
                   <div>
                       <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3"><Layers className="text-indigo-600"/> Gestión Estructural</h2>
                       <p className="text-sm text-slate-400 font-medium">Configuración de los 2 niveles principales.</p>
                   </div>
               </div>
               
               <div className="flex gap-4 mb-8 overflow-x-auto pb-4 custom-scrollbar">
                   {['templates', 'methods', 'regions', 'centers'].map(sec => (
                       <button key={sec} onClick={() => setConfigSection(sec)} className={`px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap shadow-sm ${configSection === sec ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200'}`}>
                           {sec === 'templates' ? 'Plantillas' : sec === 'methods' ? 'Nivel 1: Métodos' : sec === 'regions' ? 'Nivel 2: Regiones' : 'Centros Médicos'}
                       </button>
                   ))}
               </div>

               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[400px]">
                   <div className="flex justify-between items-center mb-8">
                       <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest border-b-2 border-indigo-500 pb-1">{configSection} registrados</h3>
                       <button onClick={() => { setModalType(configSection.slice(0,-1)); setEditData({}); setIsModalOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 tracking-widest uppercase hover:bg-black transition-all"><Plus size={16}/> Añadir nuevo</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {(configSection === 'templates' ? templates : configSection === 'methods' ? methods : configSection === 'regions' ? regions : centers).map(item => (
                           <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:border-indigo-200 transition-all">
                               <div className="flex flex-col truncate pr-4">
                                   <span className="font-bold text-slate-800 truncate text-[11px] uppercase tracking-tight">{item.title || item.name}</span>
                                   <span className="text-[8px] text-slate-400 font-bold">UID: {item.id.slice(0,10)}</span>
                               </div>
                               <button onClick={() => deleteItem(configSection.slice(0,-1), item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                           </div>
                       ))}
                   </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL MAESTRO: CREACIÓN / EDICIÓN */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-black text-lg text-slate-800 uppercase text-xs tracking-tighter">Editor: {modalType.toUpperCase()}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><X size={24}/></button>
                  </div>

                  <div className="p-10 space-y-6">
                      {modalType === 'macro' && (
                          <div className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Si el sistema oye...</label>
                                  <input type="text" value={editData.trigger || ''} onChange={e => setEditData({...editData, trigger: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-red-500 text-lg shadow-inner" placeholder="ej: imperio intensas"/>
                              </div>
                              <div>
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Corregir automáticamente a...</label>
                                  <input type="text" value={editData.replacement || ''} onChange={e => setEditData({...editData, replacement: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-emerald-600 text-lg shadow-inner" placeholder="ej: hiperintensas"/>
                              </div>
                          </div>
                      )}

                      {modalType === 'template' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                  <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[10px] uppercase tracking-tighter">
                                      <option value="">Método</option>
                                      {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                  </select>
                                  <select value={editData.regionId || ''} onChange={e => setEditData({...editData, regionId: e.target.value})} className="p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[10px] uppercase tracking-tighter">
                                      <option value="">Región</option>
                                      {regions.filter(r => r.methodId === editData.methodId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                              </div>
                              <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-800 shadow-inner" placeholder="Título (Ej: Cerebro Normal)"/>
                              <div className="relative">
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cuerpo del Informe</label>
                                  <textarea value={editData.content || ''} onChange={e => setEditData({...editData, content: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] h-80 outline-none font-mono text-[10px] leading-relaxed shadow-inner" placeholder="Pega aquí el texto completo del informe..."/>
                                  <button onClick={async () => { const t = await navigator.clipboard.readText(); setEditData({...editData, content: t}); }} className="absolute bottom-6 right-6 bg-white p-2 rounded-xl border border-slate-200 text-indigo-500 hover:bg-indigo-50 transition-all"><Clipboard size={16}/></button>
                              </div>
                          </div>
                      )}

                      {(modalType === 'method' || modalType === 'region' || modalType === 'center') && (
                           <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre descriptivo</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-700 text-lg shadow-inner" placeholder="EJEMPLO CATEGORÍA"/>
                              {modalType === 'region' && (
                                  <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-2 outline-none font-bold shadow-inner">
                                      <option value="">-- Vincular al Método --</option>
                                      {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                  </select>
                              )}
                          </div>
                      )}

                      <button onClick={saveItem} disabled={isSaving} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]">
                          {isSaving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                          Guardar en la Nube
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const SidebarBtn = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`w-full flex items-center p-3 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'hover:bg-white/5 hover:text-white'}`}>
        <div className="shrink-0">{icon}</div>
        <span className="ml-4 hidden lg:block font-black text-[10px] uppercase tracking-tighter">{label}</span>
    </button>
);