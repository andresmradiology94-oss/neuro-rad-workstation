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
  orderBy
} from 'firebase/firestore';
import { 
  Mic, MicOff, Settings, FileText, 
  Save, ChevronDown, ChevronRight,
  Layout, X, Search, Loader2, 
  Folder, Layers, HardDrive, ListTree, 
  Clipboard, Trash2, Edit3, Plus, CheckCircle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// El entorno inyectará __firebase_config y __app_id automáticamente.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "" }; // Fallback para desarrollo local inicial

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/\//g, '_').split('_src')[0];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('templates');
  const [notification, setNotification] = useState(null);
  
  // DATOS DE FIREBASE
  const [methods, setMethods] = useState([]);
  const [regions, setRegions] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  // UI ESTADOS
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'method', 'region', 'template'
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

  // 1. INICIALIZAR AUTH
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Error Auth:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. ESCUCHAR CAMBIOS EN FIRESTORE
  useEffect(() => {
    if (!user || !db) return;
    const userPath = ['artifacts', appId, 'users', user.uid];

    const unsubMethods = onSnapshot(query(collection(db, ...userPath, 'methods'), orderBy('order', 'asc')), s => {
        setMethods(s.docs.map(d => ({id: d.id, ...d.data()})));
    });

    const unsubRegions = onSnapshot(query(collection(db, ...userPath, 'regions'), orderBy('name', 'asc')), s => {
        setRegions(s.docs.map(d => ({id: d.id, ...d.data()})));
    });

    const unsubTemplates = onSnapshot(collection(db, ...userPath, 'templates'), s => {
        setTemplates(s.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => { unsubMethods(); unsubRegions(); unsubTemplates(); };
  }, [user]);

  // 3. RECONOCIMIENTO DE VOZ
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.onresult = (e) => {
        let transcript = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
        }
        if (transcript) {
          setReportText(prev => {
            const needsCap = !prev || ['.', '\n'].some(c => prev.trim().endsWith(c));
            const processed = transcript.trim();
            const final = needsCap ? processed.charAt(0).toUpperCase() + processed.slice(1) : processed;
            return prev + (prev && !prev.endsWith('\n') ? ' ' : '') + final;
          });
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // 4. FUNCIONES CRUD
  const saveItem = async () => {
      if (!user) return;
      setIsSaving(true);
      const collectionName = modalType === 'method' ? 'methods' : modalType === 'region' ? 'regions' : 'templates';
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, collectionName);
      
      try {
          if (editData.id) {
              const docRef = doc(db, 'artifacts', appId, 'users', user.uid, collectionName, editData.id);
              await updateDoc(docRef, { ...editData });
          } else {
              await addDoc(colRef, { ...editData, createdAt: Date.now() });
          }
          showNotification("Guardado con éxito");
          setIsModalOpen(false);
          setEditData({});
      } catch (e) { showNotification(e.message, "error"); }
      finally { setIsSaving(false); }
  };

  const deleteItem = async (type, id) => {
      if (!confirm("¿Eliminar este elemento permanentemente?")) return;
      try {
          const collectionName = type === 'method' ? 'methods' : type === 'region' ? 'regions' : 'templates';
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, id));
          showNotification("Eliminado");
      } catch (e) { showNotification(e.message, "error"); }
  };

  const toggleNode = (id) => {
      setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      {/* Notificaciones */}
      {notification && (
        <div className={`fixed top-6 right-6 p-4 rounded-2xl shadow-2xl z-50 text-white font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${notification.type === 'error' ? 'bg-red-500' : 'bg-indigo-600'}`}>
            <CheckCircle size={20} /> {notification.message}
        </div>
      )}

      {/* SIDEBAR NAVEGACIÓN */}
      <div className="w-16 lg:w-60 bg-slate-900 text-slate-400 flex flex-col z-20 shadow-2xl">
        <div className="h-16 flex items-center px-4 border-b border-white/5 bg-slate-950">
          <Layout size={22} className="text-indigo-400 shrink-0"/>
          <span className="ml-3 font-black text-white hidden lg:block tracking-tighter text-lg uppercase">NeuroRad <span className="text-indigo-500">PRO</span></span>
        </div>
        <div className="flex-1 py-6 space-y-2 px-2">
            <button onClick={() => setActiveTab('workstation')} className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === 'workstation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <FileText size={20}/><span className="ml-3 hidden lg:block font-bold text-sm">Informes</span>
            </button>
            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <Settings size={20}/><span className="ml-3 hidden lg:block font-bold text-sm">Configuración</span>
            </button>
        </div>
        <div className="p-4 border-t border-white/5 hidden lg:block">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Estado PACS</div>
            <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Conectado a Cloud
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'workstation' && (
          <div className="flex-1 flex h-full">
            <div className="flex-1 flex flex-col bg-slate-50 relative">
                {/* Header Estación */}
                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
                        <HardDrive size={14}/> Workstation
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setReportText('')} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-500">Limpiar</button>
                        <button onClick={() => {navigator.clipboard.writeText(reportText); showNotification("Copiado");}} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-black transition-all active:scale-95"><Save size={16}/> Copiar Informe</button>
                    </div>
                </div>

                <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
                    <div className="max-w-4xl mx-auto h-full min-h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col relative overflow-hidden">
                        <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Elige una plantilla y comienza a dictar..." className="flex-1 w-full p-10 outline-none resize-none text-xl text-slate-700 leading-relaxed font-serif placeholder:text-slate-200"/>
                        <button onClick={() => isListening ? (recognitionRef.current.stop(), setIsListening(false)) : (recognitionRef.current.start(), setIsListening(true))} className={`absolute bottom-10 right-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse text-white shadow-red-500/40' : 'bg-indigo-600 text-white shadow-indigo-600/40'}`}>
                            {isListening ? <MicOff size={32}/> : <Mic size={32}/>}
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPLORADOR DE ÁRBOL */}
            <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-tight"><Folder size={18} className="text-indigo-500"/> Explorador PACS</h3>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-300" size={16}/>
                        <input type="text" placeholder="Filtrar estudios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 ring-indigo-100 transition-all"/>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-white px-2 py-4">
                    {methods.length === 0 && (
                        <div className="p-10 text-center text-slate-300">
                            <ListTree size={40} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs font-bold uppercase italic">Árbol no configurado</p>
                        </div>
                    )}

                    {methods.map(method => {
                        const isMethodExpanded = expandedNodes.includes(method.id);
                        const methodRegions = regions.filter(r => r.methodId === method.id);
                        return (
                            <div key={method.id} className="mb-1">
                                <button onClick={() => toggleNode(method.id)} className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 transition-all text-indigo-600 font-black text-[11px] uppercase tracking-widest">
                                    {isMethodExpanded ? <ChevronDown size={14} className="mr-2"/> : <ChevronRight size={14} className="mr-2"/>}
                                    {method.name}
                                </button>
                                {isMethodExpanded && (
                                    <div className="mt-1 space-y-1">
                                        {methodRegions.map(region => {
                                            const regId = `${method.id}-${region.id}`;
                                            const isRegExpanded = expandedNodes.includes(regId);
                                            const regionTemplates = templates.filter(t => t.regionId === region.id && t.methodId === method.id);
                                            return (
                                                <div key={region.id} className="ml-3">
                                                    <button onClick={() => toggleNode(regId)} className="w-full flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-bold text-xs uppercase">
                                                        {isRegExpanded ? <ChevronDown size={14} className="mr-2 text-slate-300"/> : <ChevronRight size={14} className="mr-2 text-slate-300"/>}
                                                        {region.name}
                                                    </button>
                                                    {isRegExpanded && (
                                                        <div className="ml-6 space-y-2 py-2 pr-2 border-l-2 border-slate-100 pl-3">
                                                            {regionTemplates.map(tpl => (
                                                                <button key={tpl.id} onClick={() => setReportText(prev => prev + (prev ? '\n\n' : '') + tpl.content)} className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all group active:scale-95">
                                                                    <div className="font-bold text-slate-800 text-[13px] group-hover:text-indigo-600">{tpl.title}</div>
                                                                </button>
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

        {activeTab === 'config' && (
          <div className="p-8 lg:p-12 overflow-y-auto h-full bg-slate-50">
            <div className="max-w-6xl mx-auto">
               <div className="flex items-center justify-between mb-10">
                   <div>
                       <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                           <Layers className="text-indigo-600"/> Gestión de Catálogo
                       </h2>
                       <p className="text-sm text-slate-400 font-medium">Define tu jerarquía profesional y tus plantillas.</p>
                   </div>
                   <div className="flex gap-2">
                       <button onClick={() => { setModalType('method'); setEditData({ order: methods.length }); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={16}/> Nuevo Método</button>
                       <button onClick={() => { setModalType('region'); setEditData({}); setIsModalOpen(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={16}/> Nueva Región</button>
                   </div>
               </div>
               
               <div className="flex gap-4 mb-8">
                   <button onClick={() => setConfigSection('templates')} className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${configSection === 'templates' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200'}`}>Plantillas</button>
                   <button onClick={() => setConfigSection('structure')} className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${configSection === 'structure' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200'}`}>Estructura de Árbol</button>
               </div>

               {configSection === 'templates' && (
                  <div className="space-y-6">
                      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200">
                          <h3 className="font-black text-slate-800">Tus Informes ({templates.length})</h3>
                          <button onClick={() => { setModalType('template'); setEditData({ methodId: methods[0]?.id, regionId: regions[0]?.id }); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center gap-2"><Plus size={18}/> Crear Informe</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {templates.map(t => (
                              <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all group flex flex-col h-64">
                                  <div className="flex justify-between items-start mb-4">
                                      <h4 className="font-bold text-slate-800">{t.title}</h4>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => { setModalType('template'); setEditData(t); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={16}/></button>
                                          <button onClick={() => deleteItem('template', t.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                                  <p className="text-xs text-slate-400 line-clamp-6 font-mono bg-slate-50 p-4 rounded-2xl flex-1">{t.content}</p>
                              </div>
                          ))}
                      </div>
                  </div>
               )}

               {configSection === 'structure' && (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                           <h3 className="font-black text-xl text-slate-800 mb-6">Métodos (Nivel 1)</h3>
                           <div className="space-y-3">
                               {methods.map(m => (
                                   <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group">
                                       <span className="font-black text-slate-700 uppercase tracking-widest text-xs">{m.name}</span>
                                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => deleteItem('method', m.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>
                       <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                           <h3 className="font-black text-xl text-slate-800 mb-6">Regiones (Nivel 2)</h3>
                           <div className="space-y-3">
                               {regions.map(r => (
                                   <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group">
                                       <div className="flex flex-col">
                                           <span className="font-bold text-slate-700">{r.name}</span>
                                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Equipo: {methods.find(m => m.id === r.methodId)?.name || '---'}</span>
                                       </div>
                                       <button onClick={() => deleteItem('region', r.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                   </div>
                               ))}
                           </div>
                       </div>
                   </div>
               )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR/EDITAR */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-black text-xl text-slate-800 uppercase">Gestión de {modalType === 'method' ? 'Método' : modalType === 'region' ? 'Región' : 'Plantilla'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800"><X size={24}/></button>
                  </div>

                  <div className="p-10 space-y-6">
                      {modalType === 'method' && (
                          <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre del Equipo</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-700" placeholder="Ej: RM"/>
                          </div>
                      )}

                      {modalType === 'region' && (
                          <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método Maestro</label>
                              <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold text-slate-700">
                                  <option value="">-- Seleccionar --</option>
                                  {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre de la Región</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold text-slate-700" placeholder="Ej: NEUROLÓGICO"/>
                          </div>
                      )}

                      {modalType === 'template' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método</label>
                                      <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold">
                                          <option value="">-- Seleccionar --</option>
                                          {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Región</label>
                                      <select value={editData.regionId || ''} onChange={e => setEditData({...editData, regionId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold">
                                          <option value="">-- Seleccionar --</option>
                                          {regions.filter(r => r.methodId === editData.methodId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                      </select>
                                  </div>
                              </div>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Título del Informe</label>
                              <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-800" placeholder="Ej: RM CEREBRO NORMAL"/>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Contenido (Pega aquí el texto)</label>
                              <textarea value={editData.content || ''} onChange={e => setEditData({...editData, content: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl h-64 outline-none font-mono text-xs leading-relaxed"/>
                          </div>
                      )}

                      <button onClick={saveItem} disabled={isSaving} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                          {isSaving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                          GUARDAR CAMBIOS EN LA NUBE
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}