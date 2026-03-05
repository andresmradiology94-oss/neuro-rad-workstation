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
  Clipboard, Trash2, Edit3, Plus, CheckCircle, Sparkles
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

// --- DATOS MAESTROS PARA AUTOCONFIGURACIÓN ---
const DEFAULT_STRUCTURE = {
  methods: [
    { name: 'RM', order: 1 },
    { name: 'TC', order: 2 },
    { name: 'RX', order: 3 },
    { name: 'US', order: 4 },
    { name: 'PETCT', order: 5 }
  ],
  regions: [
    { name: 'NEURO', icon: '🧠' },
    { name: 'COLUMNA', icon: '🦴' },
    { name: 'MCF / CUELLO', icon: '👤' },
    { name: 'TÓRAX', icon: '🫁' },
    { name: 'ABDOMEN', icon: '🩸' },
    { name: 'PELVIS', icon: '🚽' },
    { name: 'MSK', icon: '🏃' },
    { name: 'VASCULAR', icon: '➰' }
  ],
  subRegions: {
    'NEURO': ['Encéfalo', 'Órbitas', 'Oído / Peñasco', 'Silla Turca', 'Base de Cráneo', 'Plexos'],
    'COLUMNA': ['Cervical', 'Dorsal', 'Lumbar', 'Sacrocoxis', 'Médula'],
    'MSK': ['Hombro', 'Codo', 'Muñeca', 'Mano', 'Cadera', 'Rodilla', 'Tobillo', 'Pie'],
    'ABDOMEN': ['Hígado / Vías Biliares', 'Páncreas', 'Renal', 'Suprarrenales', 'Entero-RM'],
    'TÓRAX': ['Pulmonar', 'Mediastino', 'Corazón', 'Pared Torácica'],
    'MCF / CUELLO': ['Senos Paranasales', 'Cavum / Faringe', 'Laringe', 'Glándulas Salivales']
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('templates');
  const [notification, setNotification] = useState(null);
  
  const [methods, setMethods] = useState([]);
  const [regions, setRegions] = useState([]);
  const [subRegions, setSubRegions] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [reportText, setReportText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const showNotification = (message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const path = ['artifacts', appId, 'users', user.uid];
    const unsubM = onSnapshot(query(collection(db, ...path, 'methods'), orderBy('order', 'asc')), s => setMethods(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubR = onSnapshot(query(collection(db, ...path, 'regions'), orderBy('name', 'asc')), s => setRegions(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubSR = onSnapshot(query(collection(db, ...path, 'subRegions'), orderBy('name', 'asc')), s => setSubRegions(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubT = onSnapshot(collection(db, ...path, 'templates'), s => setTemplates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { unsubM(); unsubR(); unsubSR(); unsubT(); };
  }, [user]);

  // --- FUNCIÓN DE AUTOCONFIGURACIÓN ---
  const seedStructure = async () => {
      if (!user || !confirm("¿Quieres generar la estructura automática? Esto creará todas las carpetas necesarias.")) return;
      setIsSaving(true);
      try {
          const path = ['artifacts', appId, 'users', user.uid];
          // 1. Crear Métodos
          for (const m of DEFAULT_STRUCTURE.methods) {
              const mDoc = await addDoc(collection(db, ...path, 'methods'), m);
              // 2. Crear Regiones para cada Método
              for (const r of DEFAULT_STRUCTURE.regions) {
                  const rDoc = await addDoc(collection(db, ...path, 'regions'), { ...r, methodId: mDoc.id });
                  // 3. Crear SubRegiones si existen
                  const subs = DEFAULT_STRUCTURE.subRegions[r.name] || [];
                  for (const subName of subs) {
                      await addDoc(collection(db, ...path, 'subRegions'), { 
                          name: subName, 
                          regionId: rDoc.id, 
                          methodId: mDoc.id 
                      });
                  }
              }
          }
          showNotification("¡Estructura generada correctamente!");
      } catch (e) { showNotification(e.message, "error"); }
      finally { setIsSaving(false); }
  };

  const saveItem = async () => {
      if (!user) return;
      setIsSaving(true);
      const collectionName = modalType === 'method' ? 'methods' : modalType === 'region' ? 'regions' : modalType === 'subRegion' ? 'subRegions' : 'templates';
      const colRef = collection(db, 'artifacts', appId, 'users', user.uid, collectionName);
      try {
          if (editData.id) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, editData.id), { ...editData });
          else await addDoc(colRef, { ...editData, createdAt: Date.now() });
          showNotification("Guardado con éxito");
          setIsModalOpen(false);
          setEditData({});
      } catch (e) { showNotification(e.message, "error"); }
      finally { setIsSaving(false); }
  };

  const deleteItem = async (type, id) => {
      if (!confirm("¿Eliminar permanentemente?")) return;
      const collectionName = type === 'method' ? 'methods' : type === 'region' ? 'regions' : type === 'subRegion' ? 'subRegions' : 'templates';
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, id));
      showNotification("Eliminado");
  };

  const toggleNode = (id) => setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {notification && (
        <div className={`fixed top-6 right-6 p-4 rounded-2xl shadow-2xl z-50 text-white font-bold flex items-center gap-3 bg-indigo-600`}>
            <CheckCircle size={20} /> {notification.message}
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-16 lg:w-64 bg-slate-900 text-slate-400 flex flex-col z-20 shadow-2xl">
        <div className="h-16 flex items-center px-4 border-b border-white/5 bg-slate-950">
          <Layout size={22} className="text-indigo-400 shrink-0"/>
          <span className="ml-3 font-black text-white hidden lg:block tracking-tighter uppercase">NeuroRad <span className="text-indigo-500">PRO</span></span>
        </div>
        <div className="flex-1 py-6 space-y-2 px-2">
            <button onClick={() => setActiveTab('workstation')} className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === 'workstation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <FileText size={20}/><span className="ml-3 hidden lg:block font-bold text-sm">Informes</span>
            </button>
            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 hover:text-white'}`}>
                <Settings size={20}/><span className="ml-3 hidden lg:block font-bold text-sm">Configuración</span>
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'workstation' && (
          <div className="flex-1 flex h-full">
            <div className="flex-1 flex flex-col bg-slate-50 relative">
                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2"><HardDrive size={14}/> Estación Activa</div>
                    <div className="flex gap-2">
                        <button onClick={() => setReportText('')} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-500">Limpiar</button>
                        <button onClick={() => {navigator.clipboard.writeText(reportText); showNotification("Copiado");}} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-black transition-all active:scale-95"><Save size={16}/> Copiar Informe</button>
                    </div>
                </div>

                <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
                    <div className="max-w-4xl mx-auto h-full min-h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col relative overflow-hidden">
                        <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Navega en el árbol lateral y selecciona una plantilla..." className="flex-1 w-full p-10 outline-none resize-none text-xl text-slate-700 leading-relaxed font-serif placeholder:text-slate-200"/>
                        <button onClick={() => isListening ? (recognitionRef.current.stop(), setIsListening(false)) : (recognitionRef.current.start(), setIsListening(true))} className={`absolute bottom-10 right-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse text-white shadow-red-500/40' : 'bg-indigo-600 text-white shadow-indigo-600/40'}`}>
                            {isListening ? <MicOff size={32}/> : <Mic size={32}/>}
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPLORADOR PACS 3 NIVELES */}
            <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 overflow-hidden text-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-tight"><Folder size={18} className="text-indigo-500"/> Explorador PACS</h3>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <div className="relative group">
                        <Search className="absolute left-3 top-3 text-slate-300" size={16}/>
                        <input type="text" placeholder="Buscar estudios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 ring-indigo-100 transition-all"/>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-white px-2 py-4 custom-scrollbar">
                    {methods.map(method => {
                        const isMExp = expandedNodes.includes(method.id);
                        const mRegs = regions.filter(r => r.methodId === method.id);
                        return (
                            <div key={method.id} className="mb-1">
                                <button onClick={() => toggleNode(method.id)} className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 transition-all text-indigo-600 font-black text-[10px] uppercase tracking-widest text-left">
                                    {isMExp ? <ChevronDown size={14} className="mr-2"/> : <ChevronRight size={14} className="mr-2"/>}
                                    {method.name}
                                </button>
                                {isMExp && (
                                    <div className="mt-1 space-y-1">
                                        {mRegs.map(region => {
                                            const regId = `r-${method.id}-${region.id}`;
                                            const isRExp = expandedNodes.includes(regId);
                                            const rSubs = subRegions.filter(sr => sr.regionId === region.id && sr.methodId === method.id);
                                            return (
                                                <div key={region.id} className="ml-3">
                                                    <button onClick={() => toggleNode(regId)} className="w-full flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-bold text-[11px] uppercase text-left">
                                                        {isRExp ? <ChevronDown size={12} className="mr-2 text-slate-300"/> : <ChevronRight size={12} className="mr-2 text-slate-300"/>}
                                                        {region.name}
                                                    </button>
                                                    {isRExp && (
                                                        <div className="mt-1 space-y-1 ml-4 border-l-2 border-slate-100 pl-3">
                                                            {rSubs.map(sub => {
                                                                const subId = `sr-${method.id}-${region.id}-${sub.id}`;
                                                                const isSRExp = expandedNodes.includes(subId);
                                                                const sTpls = templates.filter(t => t.subRegionId === sub.id && t.regionId === region.id && t.methodId === method.id);
                                                                return (
                                                                    <div key={sub.id}>
                                                                        <button onClick={() => toggleNode(subId)} className="w-full flex items-center p-1.5 rounded-lg hover:bg-slate-50 text-slate-500 font-bold text-[10px] uppercase text-left tracking-tighter">
                                                                            {isSRExp ? <ChevronDown size={10} className="mr-2"/> : <ChevronRight size={10} className="mr-2"/>}
                                                                            {sub.name}
                                                                        </button>
                                                                        {isSRExp && (
                                                                            <div className="mt-1 space-y-1 ml-2">
                                                                                {sTpls.map(tpl => (
                                                                                    <button key={tpl.id} onClick={() => setReportText(prev => prev + (prev ? '\n\n' : '') + tpl.content)} className="w-full text-left p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all group active:scale-95">
                                                                                        <div className="font-bold text-slate-800 text-xs group-hover:text-indigo-600">{tpl.title}</div>
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
                       <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3"><Layers className="text-indigo-600"/> Gestión de Catálogo</h2>
                       <p className="text-sm text-slate-400 font-medium">Configura manualmente o usa el botón de autocompletar.</p>
                   </div>
                   <div className="flex gap-2">
                       <button onClick={seedStructure} disabled={isSaving} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all">
                           {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>} INICIALIZAR ÁRBOL COMPLETO
                       </button>
                   </div>
               </div>
               
               <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                   {['templates', 'methods', 'regions', 'subRegions'].map(sec => (
                       <button key={sec} onClick={() => setConfigSection(sec)} className={`px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${configSection === sec ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200'}`}>
                           {sec === 'templates' ? 'Plantillas' : sec === 'methods' ? 'N1: Métodos' : sec === 'regions' ? 'N2: Regiones' : 'N3: Sub-Regiones'}
                       </button>
                   ))}
               </div>

               {/* SECCIONES CRUD SIMPLIFICADAS */}
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{configSection}</h3>
                       <button onClick={() => { 
                           setModalType(configSection.slice(0,-1)); 
                           setEditData({}); 
                           setIsModalOpen(true); 
                       }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 tracking-widest"><Plus size={14}/> NUEVO</button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {(configSection === 'templates' ? templates : configSection === 'methods' ? methods : configSection === 'regions' ? regions : subRegions).map(item => (
                           <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                               <div className="flex flex-col truncate">
                                   <span className="font-bold text-slate-800 truncate">{item.title || item.name}</span>
                                   <span className="text-[9px] text-slate-400 font-black uppercase">ID: {item.id.slice(0,8)}</span>
                               </div>
                               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                   <button onClick={() => deleteItem(configSection.slice(0,-1), item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CMS 3 NIVELES */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-black text-lg text-slate-800 uppercase">Gestión de {modalType}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800"><X size={24}/></button>
                  </div>

                  <div className="p-10 space-y-6">
                      {modalType === 'method' && (
                          <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre del Método</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-700" placeholder="Ej: RM"/>
                          </div>
                      )}

                      {modalType === 'region' && (
                          <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método Maestro</label>
                              <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold">
                                  <option value="">-- Seleccionar --</option>
                                  {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre de la Región</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold" placeholder="Ej: NEUROLOGÍA"/>
                          </div>
                      )}

                      {modalType === 'subRegion' && (
                          <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Selección de Ubicación</label>
                              <div className="grid grid-cols-2 gap-4">
                                  <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
                                      <option value="">-- Método --</option>
                                      {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                  </select>
                                  <select value={editData.regionId || ''} onChange={e => setEditData({...editData, regionId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
                                      <option value="">-- Región --</option>
                                      {regions.filter(r => r.methodId === editData.methodId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                              </div>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre de la Sub-Región</label>
                              <input type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-bold" placeholder="Ej: Encéfalo / Columna Lumbar"/>
                          </div>
                      )}

                      {modalType === 'template' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-2">
                                  <select value={editData.methodId || ''} onChange={e => setEditData({...editData, methodId: e.target.value})} className="p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[10px]">
                                      <option value="">Método</option>
                                      {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                  </select>
                                  <select value={editData.regionId || ''} onChange={e => setEditData({...editData, regionId: e.target.value})} className="p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[10px]">
                                      <option value="">Región</option>
                                      {regions.filter(r => r.methodId === editData.methodId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                                  <select value={editData.subRegionId || ''} onChange={e => setEditData({...editData, subRegionId: e.target.value})} className="p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[10px]">
                                      <option value="">Sub-Región</option>
                                      {subRegions.filter(sr => sr.regionId === editData.regionId && sr.methodId === editData.methodId).map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                                  </select>
                              </div>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Título del Informe</label>
                              <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-1 outline-none font-black text-slate-800" placeholder="Ej: RM CEREBRO NORMAL"/>
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Contenido</label>
                              <textarea value={editData.content || ''} onChange={e => setEditData({...editData, content: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl h-64 outline-none font-mono text-[10px] leading-relaxed"/>
                          </div>
                      )}

                      <button onClick={saveItem} disabled={isSaving} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                          {isSaving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                          SINCRONIZAR CON CLOUD
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const SidebarButton = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`w-full flex items-center p-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 hover:text-white'}`}>
        {icon}<span className="ml-3 hidden lg:block font-bold text-sm">{label}</span>
    </button>
);