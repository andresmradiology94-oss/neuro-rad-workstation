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
  onSnapshot 
} from 'firebase/firestore';
import { 
  Mic, MicOff, Settings, FileText, 
  Save, ChevronDown, ChevronRight,
  Layout, X, Search, Loader2, 
  UploadCloud, CheckCircle, Folder, 
  Database, Trash2, Info, ClipboardPaste
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE ---
const fallbackConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : fallbackConfig;
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'neuro-rad-prod';
const appId = rawAppId.replace(/\//g, '_').split('_src')[0];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const METODOLOGIAS = [
  { id: 'RM', label: 'Resonancia Magnética', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'TC', label: 'Tomografía Computada', color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'RX', label: 'Radiología Convencional', color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'US', label: 'Ecografía', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'PETCT', label: 'PET-TC', color: 'text-purple-600', bg: 'bg-purple-50' }
];

const REGIONES = [
  { id: 'neuro', label: 'Neuro & Cabeza/Cuello', icon: '🧠' },
  { id: 'torax', label: 'Tórax', icon: '🫁' },
  { id: 'abdomen', label: 'Abdomen & Pelvis', icon: '🩸' },
  { id: 'msk', label: 'Músculo-Esquelético', icon: '🦴' },
  { id: 'vascular', label: 'Vascular / Angio', icon: '➰' },
  { id: 'otros', label: 'Otros / PET', icon: '📋' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('import');
  const [notification, setNotification] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(['RM', 'TC']);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [bulkMeta, setBulkMeta] = useState({ method: 'RM', region: 'neuro', subRegion: '' });
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const showNotification = (message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (err) { console.error("Auth Error:", err); }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), s => {
        setTemplates(s.docs.map(d => ({id: d.id, ...d.data()})));
    });
  }, [user]);

  const handleBulkImport = async () => {
      if (!bulkText.trim() || !user) return;
      setIsProcessingBulk(true);
      try {
          const blocks = bulkText.split('---').filter(b => b.trim().length > 5);
          const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'templates');
          
          for (let block of blocks) {
              let title = "Plantilla Nueva";
              let content = block.trim();
              const titleMatch = block.match(/\[(.*?)\]/);
              if (titleMatch) {
                  title = titleMatch[1];
                  content = block.replace(titleMatch[0], '').trim();
              } else {
                  const lines = block.trim().split('\n');
                  title = lines[0].substring(0, 50);
                  content = block.trim();
              }
              await addDoc(colRef, { ...bulkMeta, title, content, createdAt: Date.now() });
          }
          showNotification(`¡${blocks.length} plantillas añadidas!`);
          setBulkText('');
      } catch (e) {
          showNotification("Error: " + e.message, "error");
      } finally { setIsProcessingBulk(false); }
  };

  const insertTemplate = (content) => {
      setReportText(prev => prev + (prev.length > 0 ? '\n\n' : '') + content);
      textareaRef.current?.focus();
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      {notification && (
        <div className="fixed top-6 right-6 p-4 rounded-2xl shadow-2xl z-50 text-white font-bold bg-indigo-600 flex items-center gap-3 animate-bounce">
            <CheckCircle size={20} /> {notification.message}
        </div>
      )}

      <div className="w-16 lg:w-60 bg-slate-900 text-slate-400 flex flex-col z-20 shadow-2xl">
        <div className="h-16 flex items-center px-4 border-b border-white/5 bg-slate-950">
          <Layout size={22} className="text-indigo-400 shrink-0"/>
          <span className="ml-3 font-black text-white hidden lg:block tracking-tighter text-lg uppercase">NeuroRad <span className="text-indigo-500">PRO</span></span>
        </div>
        <div className="flex-1 py-6 space-y-2 px-2">
            <button onClick={() => setActiveTab('workstation')} className={`w-full flex items-center p-3 rounded-xl ${activeTab === 'workstation' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/5 hover:text-white'}`}>
                <FileText size={20}/><span className="ml-3 hidden lg:block font-bold">Informes</span>
            </button>
            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center p-3 rounded-xl ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/5 hover:text-white'}`}>
                <Settings size={20}/><span className="ml-3 hidden lg:block font-bold">Ajustes</span>
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'workstation' && (
          <div className="flex-1 flex h-full">
            <div className="flex-1 flex flex-col bg-slate-50 relative">
                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <Database size={14}/> Estación Activa
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setReportText('')} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-500">Limpiar</button>
                        <button onClick={() => {navigator.clipboard.writeText(reportText); showNotification("Copiado");}} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-black transition-all active:scale-95"><Save size={16}/> Copiar Informe</button>
                    </div>
                </div>
                <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
                    <div className="max-w-4xl mx-auto h-full min-h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col relative overflow-hidden">
                        <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Dicta o elige una plantilla del árbol lateral..." className="flex-1 w-full p-10 outline-none resize-none text-xl text-slate-700 leading-relaxed font-serif"/>
                        <button onClick={() => isListening ? (recognitionRef.current.stop(), setIsListening(false)) : (recognitionRef.current.start(), setIsListening(true))} className={`absolute bottom-10 right-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>
                            {isListening ? <MicOff size={32}/> : <Mic size={32}/>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-tight"><Folder size={18} className="text-indigo-500"/> Explorador PACS</h3>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <div className="relative group">
                        <Search className="absolute left-3 top-3 text-slate-300" size={16}/>
                        <input type="text" placeholder="Filtrar estudios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 ring-indigo-100 transition-all"/>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-white px-2 py-4">
                    {METODOLOGIAS.map(method => {
                        const methodTemplates = templates.filter(t => t.method === method.id);
                        if (methodTemplates.length === 0 && !searchTerm) return null;
                        const isExpanded = expandedNodes.includes(method.id);

                        return (
                            <div key={method.id} className="mb-1">
                                <button onClick={() => setExpandedNodes(prev => prev.includes(method.id) ? prev.filter(n => n !== method.id) : [...prev, method.id])} className={`w-full flex items-center p-3 rounded-xl hover:bg-slate-50 transition-all ${method.color} font-black text-[11px] uppercase tracking-widest`}>
                                    {isExpanded ? <ChevronDown size={14} className="mr-2"/> : <ChevronRight size={14} className="mr-2"/>}
                                    <span className={`w-2 h-2 rounded-full mr-2 ${method.bg}`}></span>
                                    {method.label}
                                </button>

                                {isExpanded && (
                                    <div className="mt-1 space-y-1">
                                        {REGIONES.map(region => {
                                            const regionTemplates = methodTemplates.filter(t => t.region === region.id);
                                            if (regionTemplates.length === 0) return null;
                                            const regId = `${method.id}-${region.id}`;
                                            const isRegExpanded = expandedNodes.includes(regId);

                                            return (
                                                <div key={region.id} className="ml-3">
                                                    <button onClick={() => setExpandedNodes(prev => prev.includes(regId) ? prev.filter(n => n !== regId) : [...prev, regId])} className="w-full flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-bold text-xs uppercase">
                                                        {isRegExpanded ? <ChevronDown size={14} className="mr-2 text-slate-300"/> : <ChevronRight size={14} className="mr-2 text-slate-300"/>}
                                                        {region.icon} <span className="ml-2">{region.label}</span>
                                                    </button>

                                                    {isRegExpanded && (
                                                        <div className="ml-6 space-y-2 py-2 pr-2 border-l-2 border-slate-100 pl-3">
                                                            {Array.from(new Set(regionTemplates.map(t => t.subRegion))).map(sub => {
                                                                const subs = regionTemplates.filter(t => t.subRegion === sub);
                                                                return (
                                                                    <div key={sub || 'Gral'}>
                                                                        <div className="text-[9px] text-slate-400 font-black uppercase mb-2 flex items-center gap-2">
                                                                             {sub || 'General'} <div className="h-px flex-1 bg-slate-100"></div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {subs.map(tpl => (
                                                                                <button key={tpl.id} onClick={() => insertTemplate(tpl.content)} className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all group active:scale-95">
                                                                                    <div className="font-bold text-slate-800 text-[13px] group-hover:text-indigo-600">{tpl.title}</div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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

        {activeTab === 'config' && (
          <div className="p-8 lg:p-12 overflow-y-auto h-full flex flex-col items-center bg-slate-50">
            <div className="max-w-4xl w-full">
               <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-8"><Settings className="text-indigo-600"/> Gestión de Datos</h2>
               
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="space-y-2">
                       <button onClick={()=>setConfigSection('import')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${configSection === 'import' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                           <UploadCloud size={20}/> Importador Inteligente
                       </button>
                       <button onClick={()=>setConfigSection('stats')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${configSection === 'stats' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                           <Database size={20}/> Mi Catálogo
                       </button>
                   </div>

                   <div className="lg:col-span-2">
                       {configSection === 'import' && (
                           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                               <h3 className="font-black text-xl text-slate-800 mb-2">Importación de Bloques</h3>
                               <p className="text-sm text-slate-400 mb-6">Copia un bloque del nuevo documento procesado y pégalo aquí.</p>
                               
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                   <div>
                                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método</label>
                                       <select value={bulkMeta.method} onChange={e=>setBulkMeta({...bulkMeta, method: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold text-slate-700">
                                           {METODOLOGIAS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                       </select>
                                   </div>
                                   <div>
                                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Región</label>
                                       <select value={bulkMeta.region} onChange={e=>setBulkMeta({...bulkMeta, region: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold text-slate-700">
                                           {REGIONES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
                                       </select>
                                   </div>
                               </div>

                               <div className="mb-6">
                                   <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sub-región (Ej: Encéfalo, Columna...)</label>
                                   <input type="text" value={bulkMeta.subRegion} onChange={e=>setBulkMeta({...bulkMeta, subRegion: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold" placeholder="Nombre de la sub-carpeta..."/>
                               </div>

                               <textarea 
                                   value={bulkText} 
                                   onChange={e=>setBulkText(e.target.value)} 
                                   placeholder="Pega aquí el texto del archivo PLANTILLAS_PARA_IMPORTAR..." 
                                   className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl h-64 outline-none font-mono text-xs mb-6"
                               />

                               <button onClick={handleBulkImport} disabled={isProcessingBulk || !bulkText} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                   {isProcessingBulk ? <Loader2 className="animate-spin"/> : <ClipboardPaste size={22}/>}
                                   INYECTAR EN FIREBASE
                               </button>
                           </div>
                       )}

                       {configSection === 'stats' && (
                           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
                               <div className="flex justify-between items-center mb-6">
                                   <h3 className="font-black text-slate-800 uppercase text-xs">Catálogo de Plantillas ({templates.length})</h3>
                                   <button onClick={()=>{ if(confirm('¿Borrar TODO?')) templates.forEach(t => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'templates', t.id)))}} className="text-[10px] text-red-500 font-bold hover:underline">VACIAR TODO</button>
                               </div>
                               <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                   {templates.map(t => (
                                       <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                           <div className="flex flex-col">
                                               <span className="text-xs font-bold text-slate-700">{t.title}</span>
                                               <span className="text-[9px] text-slate-400 font-bold uppercase">{t.method} > {t.subRegion}</span>
                                           </div>
                                           <Trash2 size={14} className="text-slate-300 hover:text-red-500 cursor-pointer" onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'templates', t.id))}/>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       )}
                   </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}