import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Mic, MicOff, Settings, FileText, Building2, Book, Plus, Trash2, Save, Layout, Smartphone, X, Loader2, AlertTriangle, Clipboard } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734",
  measurementId: "G-XDJ6W8VH9K"
};

// --- INICIALIZACIÓN SEGURA ---
let app, auth, db;
let initError = "";

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  initError = e.message;
  console.error("Firebase Error:", e);
}

const appId = 'neuro-rad-prod'; 

// --- PROCESAMIENTO DE TEXTO ---
const processText = (rawText, userJargon = [], previousText = "") => {
  if (!rawText) return "";
  
  // 1. Limpieza inicial
  let cleanedRaw = rawText;
  if (cleanedRaw.trim().endsWith('.') && !cleanedRaw.toLowerCase().includes('punto')) {
      cleanedRaw = cleanedRaw.replace(/\.$/, '');
  }
  let text = cleanedRaw.toLowerCase();

  // 2. Mapeo de Puntuación
  const PUNCTUATION_MAP = {
    "punto y aparte": ".\n", "punto aparte": ".\n", "nuevo párrafo": "\n\n",
    "punto y seguido": ".", "punto": ".", "coma": ",", "dos puntos": ":",
    "punto y coma": ";", "abrir paréntesis": "(", "cerrar paréntesis": ")",
    "barra": "/", "guión": "-"
  };
  
  Object.keys(PUNCTUATION_MAP).forEach(punct => {
    const regex = new RegExp(`\\b${punct}\\b`, 'gi');
    text = text.replace(regex, PUNCTUATION_MAP[punct]);
  });

  // 3. Correcciones Médicas
  const MEDICAL_CORRECTIONS = {
    "dólares": "nodulares", "dolares": "nodulares", "modulares": "nodulares",
    "videos": "vidrio", "vídeos": "vidrio",
    "sensacional": "centroacinar", "centro asin arias": "centroacinares", "centroacinares": "centroacinares", "sinacinales": "centroacinares",
    "inflexión": "infeccioso", "infección": "infeccioso",
    "brote": "brote", "árbol en brote": "árbol en brote",
    "a tele taxi as": "atelectasias", "atelectasia": "atelectasia",
    "esmerilado": "esmerilado", "deslustrado": "deslustrado",
    "neumotórax": "neumotórax", "derrame plural": "derrame pleural",
    "costodiafragmático": "costodiafragmático", "mediastínico": "mediastínico",
    "hiliar": "hiliar", "parénquima": "parénquima", "intersticial": "intersticial",
    "alveolar": "alveolar", "consolidación": "consolidación",
    "bronquiectasias": "bronquiectasias", "broncograma": "broncograma",
    "hígado graso": "esteatosis hepática", "litiasis": "litiasis",
    "colelitiasis": "colelitiasis", "colédoco": "colédoco", "páncreas": "páncreas",
    "hiperintenso": "hiperintenso", "hipointenso": "hipointenso", "isointenso": "isointenso",
    "surcos": "surcos", "cisuras": "cisuras", "circunvoluciones": "circunvoluciones",
    "ventrículos": "ventrículos", "silla turca": "silla turca",
    "de uno": "T1", "t 1": "T1", "te uno": "T1",
    "de dos": "T2", "t 2": "T2", "te dos": "T2",
    "flair": "FLAIR", "fler": "FLAIR", "stir": "STIR", "estir": "STIR",
    "difusión": "DWI", "adc": "ADC", "gadolinio": "gadolinio"
  };

  Object.keys(MEDICAL_CORRECTIONS).forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    text = text.replace(regex, MEDICAL_CORRECTIONS[term]);
  });

  // 4. Jerga Usuario
  userJargon.forEach(item => {
     const regex = new RegExp(`\\b${item.trigger.toLowerCase()}\\b`, 'gi');
     text = text.replace(regex, item.replacement);
  });

  // 5. Mayúsculas Inteligentes
  const trimmedPrev = previousText ? previousText.trim() : "";
  const endsWithPunctuation = trimmedPrev.length === 0 || ['.', '\n', '!', '?', ':'].some(char => trimmedPrev.endsWith(char));

  if (endsWithPunctuation) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  } 
  return text;
};

// --- COMPONENTES ---
const MobileMicInterface = ({ sessionId, user }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Listo');
  const [localText, setLocalText] = useState(''); 
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

  const sendText = async (text) => {
    if (!text || !user || !text.trim()) return;
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', sessionId);
      await setDoc(sessionRef, {
        latestText: text.trim(),
        timestamp: Date.now(),
        lastActiveUser: user.uid
      }, { merge: true });
    } catch (e) {
      setStatus('Error de Red...');
    }
  };

  const startRecognition = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setStatus('Navegador no soportado.');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // MODO RÁFAGA (Corta eco)
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => { setStatus('Escuchando...'); setIsListening(true); };
    
    recognition.onend = () => {
      if (shouldListenRef.current) {
          try { recognition.start(); } catch(e) { 
              setTimeout(() => { if(shouldListenRef.current) startRecognition(); }, 200);
          }
      } else {
          setIsListening(false);
          setStatus('Pausado.');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; 
      if (event.error === 'not-allowed') {
         shouldListenRef.current = false;
         setStatus('Permiso denegado.');
         setIsListening(false);
      }
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setLocalText(interim || "...");
      if (final.trim()) sendText(final);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) {}
  };

  const toggleMic = () => {
    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      startRecognition();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8"><h2 className="text-xl font-bold text-indigo-300 flex items-center justify-center gap-2"><Smartphone/> Modo Remoto</h2><p className="text-xs text-slate-500 font-mono mt-1">Sesión: {sessionId}</p></div>
      <button onClick={toggleMic} className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 scale-110 animate-pulse' : 'bg-indigo-600'}`}>{isListening ? <Mic size={48}/> : <MicOff size={48}/>}</button>
      <div className="mt-8 w-full max-w-md bg-slate-800 p-4 rounded-xl border border-slate-700 min-h-[100px]"><p className="text-xs text-slate-400 mb-2 uppercase font-bold tracking-wider">Monitor</p><p className="text-lg font-medium text-white leading-relaxed">{localText || <span className="text-slate-600 italic">Esperando voz...</span>}</p></div>
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
  const [configSection, setConfigSection] = useState('centers');
  
  const [centers, setCenters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [jargonDict, setJargonDict] = useState([]);
  
  const [currentCenterId, setCurrentCenterId] = useState('');
  const [reportText, setReportText] = useState('');
  
  const [isPcListening, setIsPcListening] = useState(false);
  const pcRecognitionRef = useRef(null);
  
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteSessionCode, setRemoteSessionCode] = useState('');
  const [pcInterimText, setPcInterimText] = useState(''); 
  
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tempData, setTempData] = useState({});
  
  const textareaRef = useRef(null);
  const reportTextRef = useRef(''); 
  const jargonDictRef = useRef([]); 

  useEffect(() => { reportTextRef.current = reportText; }, [reportText]);
  useEffect(() => { jargonDictRef.current = jargonDict; }, [jargonDict]);

  useEffect(() => {
    if (initError) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'mic') { setIsMobileMode(true); setMobileSessionId(params.get('session')); }
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
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

  // Listener Móvil (PC recibe texto)
  useEffect(() => {
    if (isMobileMode || !remoteSessionCode) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', remoteSessionCode), (docSnap) => {
      const data = docSnap.data();
      if (data?.latestText && data.latestText.trim() !== '' && data.timestamp > (Date.now() - 5000)) {
        const rawInput = data.latestText;
        const currentRep = reportTextRef.current;
        // Solo agregamos si no es exactamente igual a lo último (filtro básico)
        if (!currentRep.trim().endsWith(rawInput)) {
             const processed = processText(rawInput, jargonDictRef.current, currentRep);
             // Espaciado inteligente
             const isPunctuation = /^[.,;:]/.test(processed);
             const space = (currentRep && !currentRep.endsWith(' ') && !currentRep.endsWith('\n') && !isPunctuation) ? ' ' : '';
             
             setReportText(prev => prev + space + processed);
        }
        updateDoc(docSnap.ref, { latestText: '' }); 
      }
    });
    return () => unsub();
  }, [remoteSessionCode, isMobileMode]);

  // --- DICTADO PC (VERSIÓN SIMPLE) ---
  const togglePcDictation = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) return alert("Usa Chrome.");
    
    if (isPcListening) {
        if (pcRecognitionRef.current) pcRecognitionRef.current.stop();
        setIsPcListening(false);
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => setIsPcListening(true);
    
    recognition.onend = () => setIsPcListening(false);
    
    recognition.onerror = (e) => {
        console.error("PC Mic Error:", e.error);
        if (e.error === 'not-allowed') alert("Permiso denegado. Revisa el candado en la URL.");
        setIsPcListening(false);
    };

    recognition.onresult = (e) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
            if(e.results[i].isFinal) finalChunk += e.results[i][0].transcript;
            else interimChunk += e.results[i][0].transcript;
        }

        setPcInterimText(interimChunk);

        if(finalChunk) {
            const currentRep = reportTextRef.current;
            const processed = processText(finalChunk, jargonDictRef.current, currentRep);
            
            const isPunctuation = /^[.,;:]/.test(processed);
            const space = (currentRep && !currentRep.endsWith(' ') && !currentRep.endsWith('\n') && !isPunctuation) ? ' ' : '';
            
            setReportText(prev => prev + space + processed);
            setPcInterimText(''); 
        }
    };

    pcRecognitionRef.current = recognition;
    recognition.start();
  };

  const startRemoteSession = () => { setRemoteSessionCode(Math.floor(1000 + Math.random() * 9000).toString()); setShowRemoteModal(true); };
  const addCenter = async () => { if(tempData.name) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), {name: tempData.name}); setTempData({}); setShowCenterModal(false); }};
  const addTemplate = async () => { if(tempData.title) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), {title: tempData.title, content: tempData.content, centerId: tempData.centerId || 'global'}); setTempData({}); setShowTemplateModal(false); }};
  const addJargon = async () => { if(tempData.trigger) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), {trigger: tempData.trigger.toLowerCase(), replacement: tempData.replacement}); setTempData({}); }};
  const deleteItem = async (col, id) => { if(confirm('¿Eliminar?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id)); };

  // Renderizado Condicional Seguro
  if (initError) return <div className="p-10 text-red-600 font-bold bg-white h-screen">Error de Configuración: {initError}</div>;
  if (isMobileMode) return <MobileMicInterface sessionId={mobileSessionId} user={user} />;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.href.split('?')[0]}?mode=mic&session=${remoteSessionCode}`)}`;
  const visibleTemplates = templates.filter(t => t.centerId === 'global' || t.centerId === currentCenterId);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm hidden md:flex">
        <div className="p-4 border-b border-slate-100">
          <h1 className="font-bold text-xl text-indigo-700 flex items-center gap-2"><Layout size={24}/> NeuroRad <span className="text-xs bg-indigo-100 px-2 py-0.5 rounded text-indigo-600">PRO</span></h1>
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
            <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
              <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col relative">
                <div className="relative flex-1">
                    <textarea 
                        ref={textareaRef} 
                        value={reportText} 
                        onChange={(e) => setReportText(e.target.value)} 
                        placeholder="Comienza a dictar..." 
                        className="w-full h-full p-8 outline-none resize-none text-lg text-slate-700 leading-relaxed font-serif"
                    />
                    {pcInterimText && (<div className="absolute bottom-4 left-8 right-24 pointer-events-none"><span className="bg-indigo-50 text-indigo-400 px-2 py-1 rounded animate-pulse shadow-sm border border-indigo-100 backdrop-blur-sm">... {pcInterimText}</span></div>)}
                </div>
                <button onClick={togglePcDictation} className={`absolute bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${isPcListening ? 'bg-red-500 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>{isPcListening ? <MicOff size={28}/> : <Mic size={28}/>}</button>
              </div>
            </div>
            <div className="w-80 bg-white border-l border-slate-200 flex flex-col hidden lg:flex">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-sm text-slate-700 flex items-center gap-2"><FileText size={16}/> Plantillas</h3></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {visibleTemplates.map(tpl => (<div key={tpl.id} onClick={() => setReportText(prev => prev + '\n' + tpl.content)} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:shadow-md cursor-pointer group"><span className="font-semibold text-slate-700 text-sm block mb-1">{tpl.title}</span><p className="text-xs text-slate-400 line-clamp-2">{tpl.content}</p></div>))}
              </div>
            </div>
          </>
        )}
        {activeTab === 'config' && (
          <div className="p-8 overflow-y-auto h-full"><div className="max-w-4xl mx-auto">
               <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3"><Settings className="text-indigo-600"/> Configuración</h2>
               <div className="flex gap-2 mb-6 md:hidden"><button onClick={()=>setConfigSection('centers')} className="px-3 py-1 bg-slate-200 rounded">Centros</button><button onClick={()=>setConfigSection('templates')} className="px-3 py-1 bg-slate-200 rounded">Plantillas</button></div>
               {configSection === 'centers' && <div className="space-y-4"><button onClick={() => setShowCenterModal(true)} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-lg border border-dashed border-indigo-200 flex justify-center gap-2"><Plus size={20}/> Nuevo Centro</button>{centers.map(c => (<div key={c.id} className="bg-white p-4 border rounded flex justify-between"><span>{c.name}</span><button onClick={()=>deleteItem('centers',c.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}</div>}
               {configSection === 'jargon' && <div className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 flex gap-2"><AlertTriangle size={16}/><span>Tip: Agrega aquí los errores que detectes. La app aprenderá de ellos.</span></div>
                  <div className="bg-white p-4 rounded border flex gap-2 items-end"><div className="flex-1"><label className="text-xs text-slate-500">Si el dictado escribe (Error)...</label><input className="w-full border-b font-mono text-red-500" placeholder="ej. dolares" value={tempData.trigger||''} onChange={e=>setTempData({...tempData, trigger:e.target.value})}/></div><div className="flex-[2]"><label className="text-xs text-slate-500">Debe corregirse a (Real)...</label><input className="w-full border-b font-bold text-green-600" placeholder="ej. nodulares" value={tempData.replacement||''} onChange={e=>setTempData({...tempData, replacement:e.target.value})}/></div><button onClick={addJargon} className="bg-slate-800 text-white p-2 rounded"><Plus size={16}/></button></div>
                  {jargonDict.map(j => (<div key={j.id} className="flex justify-between items-center p-2 bg-white border rounded"><div className="flex gap-2 text-sm"><span className="font-mono text-red-500 line-through">{j.trigger}</span> <span>→</span> <span className="font-bold text-green-600">{j.replacement}</span></div><button onClick={()=>deleteItem('jargon',j.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}
               </div>}
               {configSection === 'templates' && <div className="space-y-4">
                   <div className="flex justify-between">
                       <button onClick={() => setShowTemplateModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"><Plus size={18}/> Nueva Plantilla</button>
                       <button onClick={() => { setTempData({}); setShowTemplateModal(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900"><Clipboard size={18}/> Pegar desde Word</button>
                   </div>
                   {templates.map(t => (<div key={t.id} className="bg-white p-4 border rounded flex justify-between"><span className="font-bold">{t.title}</span><button onClick={()=>deleteItem('templates',t.id)}><Trash2 size={16} className="text-red-400"/></button></div>))}
                </div>}
          </div></div>
        )}
      </div>
      
      {showTemplateModal && <Modal title="Nueva Plantilla" onClose={() => setShowTemplateModal(false)}>
          <input className="w-full p-3 border rounded mb-3" placeholder="Título (ej. Tórax Normal)" onChange={e => setTempData({...tempData, title: e.target.value})}/>
          <select className="w-full p-3 border rounded mb-3 bg-white" onChange={e => setTempData({...tempData, centerId: e.target.value})} defaultValue=""><option value="" disabled>Centro</option><option value="global">Global</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea className="w-full p-3 border rounded mb-3 h-48 font-mono text-sm" placeholder="Pega aquí el texto de tu informe o documento Word..." onChange={e => setTempData({...tempData, content: e.target.value})}/>
          <button onClick={addTemplate} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Guardar Plantilla</button>
      </Modal>}
      
      {showCenterModal && <Modal title="Nuevo Centro" onClose={() => setShowCenterModal(false)}><input className="w-full p-3 border rounded mb-3" placeholder="Nombre" onChange={e => setTempData({...tempData, name: e.target.value})}/><button onClick={addCenter} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Guardar</button></Modal>}
      
      {showRemoteModal && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-center relative"><button onClick={() => setShowRemoteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button><div className="bg-indigo-600 p-6 text-white"><h3 className="text-xl font-bold flex items-center justify-center gap-2"><Smartphone/> Micrófono Remoto</h3><p className="text-indigo-100 text-sm mt-1">Conecta tu celular de forma segura</p></div><div className="p-8 flex flex-col items-center"><div className="bg-white p-2 rounded-lg shadow-inner border border-slate-200 mb-6"><img src={qrUrl} alt="Escanear con celular" className="w-48 h-48 object-contain" /></div><div className="space-y-2 text-slate-600"><p className="font-medium">1. Escanea este código</p><p className="text-sm">2. Espera a ver "Listo para dictar"</p></div><div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Sesión: {remoteSessionCode}</div></div></div></div>}
    </div>
  );
}