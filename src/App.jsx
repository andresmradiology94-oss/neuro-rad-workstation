import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, setDoc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { Mic, MicOff, Settings, FileText, Building2, Book, Plus, Trash2, Save, Layout, Smartphone, X, Wifi, WifiOff, Loader2, AlertTriangle, Clipboard, Upload, Database, Check } from 'lucide-react';

// --- 1. CONFIGURACIÓN FIREBASE (RADIO-A06EE) ---
const firebaseConfig = {
  apiKey: "AIzaSyAteWvkLVgv9rRsMLeK5BXuDKhw8nvppR4",
  authDomain: "radio-a06ee.firebaseapp.com",
  projectId: "radio-a06ee",
  storageBucket: "radio-a06ee.firebasestorage.app",
  messagingSenderId: "287944172765",
  appId: "1:287944172765:web:dc5cebe49a1cc41c3b2734",
  measurementId: "G-XDJ6W8VH9K"
};

// --- 2. INICIALIZACIÓN SEGURA ---
let app = null;
let auth = null;
let db = null;
let initError = "";

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Error crítico inicializando Firebase:", e);
  initError = e.message;
}

const appId = 'neuro-rad-prod'; 

// --- 3. DICCIONARIO MAESTRO (Extracción de tus 6 PDFs) ---
const INITIAL_MASTER_DICTIONARY = {
    // --- ERRORES DE AUDIO CRÍTICOS (Correcciones fonéticas) ---
    "imperio intensas": "hiperintensas", "imperio": "hiper",
    "microscopía": "microangiopatía", "microscopia": "microangiopatía",
    "dólares": "nodulares", "dolares": "nodulares", "modulares": "nodulares",
    "videos": "vidrio", "vídeos": "vidrio",
    "sensacional": "centroacinar", "centro de similares": "centroacinares", "centro similares": "centroacinares",
    "inflexión": "infeccioso", "infección": "infeccioso",
    "brote": "brote", "a tele taxi as": "atelectasias",
    "vi frontal": "bifrontal", "vi hemisférica": "bihemisférica", "vi parietal": "biparietal",
    "entre 2": "en T2", "entre 1": "en T1", "en de dos": "en T2", "en de uno": "en T1",
    "como ha compatible": "hallazgo compatible", "cómo ha compatible": "hallazgo compatible",
    "cifones": "sifones", "cifón": "sifón", "fisc": "FIESTA",

    // --- NEURO (Cerebro, Cuello, Peñascos) ---
    "hiperintenso": "hiperintenso", "hipointenso": "hipointenso", "isointenso": "isointenso",
    "surcos": "surcos", "cisuras": "cisuras", "circunvoluciones": "circunvoluciones",
    "ventrículos": "ventrículos", "supratentorial": "supratentorial", "infratentorial": "infratentorial",
    "línea media": "línea media", "desviación": "desviación", "colapso": "colapso",
    "silla turca": "silla turca", "hipófisis": "hipófisis", "tallo": "tallo hipofisario",
    "cavernoso": "seno cavernoso", "polígono": "polígono de Willis", "sifones": "sifones carotídeos",
    "sustancia blanca": "sustancia blanca", "sustancia gris": "sustancia gris", "periventricular": "periventricular",
    "ganglios basales": "ganglios basales", "tálamo": "tálamo", "lenticular": "núcleo lenticular", "caudado": "núcleo caudado",
    "cerebelo": "cerebelo", "tronco": "tronco del encéfalo", "coronas radiatas": "coronas radiatas",
    "centros semiovales": "centros semiovales", "mesencéfalo": "mesencéfalo",
    "protuberancia": "protuberancia", "bulbo": "bulbo raquídeo",
    "gliosis": "gliosis", "isquemia": "isquemia", "infarto": "infarto",
    "microangiopatía": "microangiopatía", "leucoaraiosis": "leucoaraiosis", "desmielinizante": "desmielinizante",
    "cavum": "cavum", "meckel": "Meckel", "trigémino": "trigémino", "gasser": "Gasser",
    "cai": "CAI", "conducto auditivo": "conducto auditivo", "laberinto": "laberinto",
    "macizo": "macizo cráneo-facial", "ostiomeatales": "ostiomeatales", "infundibulares": "infundibulares",
    "septum": "septum nasal", "cornetes": "cornetes", "polipoide": "polipoide",
    "periamigdalino": "periamigdalino", "ganglionar": "ganglionar", "adenomegalias": "adenomegalias",
    "neumoencéfalo": "neumoencéfalo", "neumoventrículo": "neumoventrículo", "craneotomía": "craneotomía",

    // --- PROTOCOLOS Y SECUENCIAS ---
    "t1": "T1", "t2": "T2", "t2*": "T2*", "flair": "FLAIR", "stir": "STIR",
    "dwi": "DWI", "adc": "ADC", "gre": "GRE", "gadolinio": "gadolinio",
    "fiesta": "FIESTA", "tof": "TOF", "fatsat": "FATSAT", "spgr": "SPGR",
    "angiorm": "angioRM", "angiotc": "angioTC", "propeller": "PROPELLER",
    "dos de": "2D", "tres de": "3D", "volumétricas": "volumétricas",

    // --- TÓRAX ---
    "esmerilado": "esmerilado", "deslustrado": "deslustrado", "neumotórax": "neumotórax",
    "derrame plural": "derrame pleural", "costodiafragmático": "costodiafragmático",
    "mediastínico": "mediastínico", "hiliar": "hiliar", "perihiliar": "perihiliar",
    "parénquima": "parénquima", "intersticial": "intersticial", "alveolar": "alveolar",
    "consolidación": "consolidación", "broncograma": "broncograma aéreo",
    "bronquiectasias": "bronquiectasias", "panalización": "panalización",
    "empedrado": "empedrado (Crazy Paving)", "centrolobulillar": "centrolobulillar",
    "paraseptal": "paraseptal", "enfisema": "enfisema", "bullas": "bullas",
    "árbol en brote": "árbol en brote", "micronodulillares": "micronodulillares",
    "granuloma": "granuloma", "tractos": "tractos fibrosos", "empiema": "empiema",
    "precarinal": "precarinal", "subcarinal": "subcarinal",

    // --- ABDOMEN ---
    "esteatosis": "esteatosis hepática", "litiasis": "litiasis", "colelitiasis": "colelitiasis",
    "coledocolitiasis": "coledocolitiasis", "colédoco": "colédoco", "vía biliar": "vía biliar",
    "páncreas": "páncreas", "wirsung": "Wirsung", "uncinado": "proceso uncinado",
    "retroperitoneo": "retroperitoneo", "peritoneo": "peritoneo", "líquido libre": "líquido libre",
    "bosniak": "Bosniak", "quiste": "quiste", "cortical": "cortical", "medular": "medular",
    "pielocalicial": "pielocalicial", "ureter": "uréter", "vejiga": "vejiga",
    "divertículos": "divertículos", "diverticulosis": "diverticulosis", "diverticulitis": "diverticulitis",
    "apendicitis": "apendicitis", "cecal": "cecal", "intususcepción": "intususcepción",
    "vólvulo": "vólvulo", "meteorismo": "meteorismo", "niveles hidroaéreos": "niveles hidroaéreos",
    "bazo": "bazo", "esplenomegalia": "esplenomegalia", "próstata": "próstata",
    "vesículas seminales": "vesículas seminales", "útero": "útero", "endometrio": "endometrio",
    "anexos": "anexos", "isquiorrectales": "isquiorrectales", "repleción": "repleción",

    // --- MSK ---
    "osteofitos": "osteofitos", "espondilosis": "espondilosis", "artrosis": "artrosis",
    "fractura": "fractura", "fisura": "fisura", "conminuta": "conminuta",
    "edema óseo": "edema óseo", "médula ósea": "médula ósea", "ligamento": "ligamento",
    "cruzado": "cruzado", "menisco": "menisco", "rotura": "rotura", "desgarro": "desgarro",
    "manguito": "manguito rotador", "supraespinoso": "supraespinoso", "bursitis": "bursitis",
    "sinovitis": "sinovitis", "geodas": "geodas", "subcondrales": "subcondrales",
    "esclerosis": "esclerosis", "platillos": "platillos tibiales", "cóndilo": "cóndilo femoral",
    "rótula": "rótula", "poplíteo": "poplíteo", "dextroconvexa": "dextroconvexa",
    "supracondílea": "supracondílea", "glenohumeral": "glenohumeral", "acromioclavicular": "acromioclavicular",

    // --- GENERAL ---
    "ecogénico": "ecogénico", "hipoecoico": "hipoecoico", "anecoico": "anecoico",
    "sombra acústica": "sombra acústica posterior", "refuerzo": "refuerzo acústico posterior",
    "doppler": "Doppler", "vascularización": "vascularización", "neoformativo": "neoformativo",
    "secundarismo": "secundarismo", "nodular": "nodular", "espiculados": "espiculados"
};

// --- 4. PROCESAMIENTO DE TEXTO (Lectura de Nube) ---
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const processText = (rawText, globalDictionary = {}, userJargon = [], previousText = "") => {
  if (!rawText) return "";
  
  let cleanedRaw = rawText;
  // Quitar punto final automático si no es explícito
  if (cleanedRaw.trim().endsWith('.') && !cleanedRaw.toLowerCase().includes('punto')) {
      cleanedRaw = cleanedRaw.replace(/\.$/, '');
  }
  let text = cleanedRaw.toLowerCase();

  // A. MAPEO DE PUNTUACIÓN
  const PUNCTUATION_MAP = {
    "punto y aparte": ".\n", "punto aparte": ".\n", "nuevo párrafo": "\n\n",
    "punto y seguido": ".", "punto seguido": ".", 
    "punto": ".", "coma": ",", 
    "dos puntos": ":", "punto y coma": ";", 
    "abrir paréntesis": "(", "cerrar paréntesis": ")",
    "barra": "/", "guión": "-"
  };
  
  Object.keys(PUNCTUATION_MAP).forEach(punct => {
    const regex = new RegExp(`\\b${escapeRegExp(punct)}\\b`, 'gi');
    text = text.replace(regex, PUNCTUATION_MAP[punct]);
  });

  // B. DICCIONARIO GLOBAL (Desde Firebase)
  // Si ya cargó la base de datos, usamos esa. Si no, usamos un fallback mínimo.
  const dictionaryToUse = (globalDictionary && Object.keys(globalDictionary).length > 0) 
      ? globalDictionary 
      : { "dólares": "nodulares", "videos": "vidrio" }; // Fallback mínimo

  Object.keys(dictionaryToUse).forEach(term => {
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    text = text.replace(regex, dictionaryToUse[term]);
  });

  // C. JERGA USUARIO (Prioridad Alta)
  if (Array.isArray(userJargon)) {
    userJargon.forEach(item => {
       if(item?.trigger && item?.replacement) {
          const regex = new RegExp(`\\b${escapeRegExp(item.trigger.toLowerCase())}\\b`, 'gi');
          text = text.replace(regex, item.replacement);
       }
    });
  }

  // D. LIMPIEZA FINAL DE ESPACIOS
  text = text.replace(/\s+([.,;:])/g, '$1'); // Quitar espacio antes de puntuación
  text = text.replace(/([.,;:])(?=[^\s\n])/g, '$1 '); // Asegurar espacio después

  // E. CAPITALIZACIÓN INTELIGENTE
  const trimmedPrev = previousText ? previousText.trim() : "";
  const endsWithPunctuation = trimmedPrev.length === 0 || ['.', '\n', '!', '?'].some(char => trimmedPrev.endsWith(char));

  if (endsWithPunctuation) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  } else {
    // Respetar siglas si la palabra resultante es una sigla (ej: TOF)
    const firstWord = text.split(' ')[0];
    const isAcronym = firstWord.length > 1 && firstWord === firstWord.toUpperCase() && !/\d/.test(firstWord);
    
    if (!isAcronym) {
        return text.charAt(0).toLowerCase() + text.slice(1);
    }
    return text;
  }
};

// --- FUNCIÓN DE MERGE ---
const mergeText = (currentReport, newFragmentRaw, globalDict, userJargon) => {
    const processedFragment = processText(newFragmentRaw, globalDict, userJargon, currentReport);
    if (!processedFragment) return currentReport;

    const trimmedReport = currentReport.trimEnd();
    
    // Capitalización extra check para el fragmento procesado
    const endsInStopper = trimmedReport.length === 0 || ['.', '\n', '!', '?'].some(c => trimmedReport.endsWith(c));
    let finalFragment = processedFragment;
    
    if (endsInStopper) {
        finalFragment = finalFragment.charAt(0).toUpperCase() + finalFragment.slice(1);
    } else {
        const isAcronym = finalFragment.length > 1 && finalFragment === finalFragment.toUpperCase();
        if (!isAcronym) finalFragment = finalFragment.charAt(0).toLowerCase() + finalFragment.slice(1);
    }

    // Fusión Puntuación (Evitar doble punto)
    if (trimmedReport.endsWith('.') && finalFragment.startsWith('.')) finalFragment = finalFragment.substring(1);
    if (trimmedReport.endsWith('.') && finalFragment.startsWith('.\n')) finalFragment = finalFragment.substring(1);

    // Espaciado
    const isPunctuation = /^[.,;:]/.test(finalFragment);
    const needsSpace = trimmedReport.length > 0 && !trimmedReport.endsWith('\n') && !isPunctuation;

    return trimmedReport + (needsSpace ? ' ' : '') + finalFragment;
};

// --- 4. COMPONENTE MÓVIL ---
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
      await setDoc(sessionRef, { latestText: text.trim(), timestamp: Date.now(), lastActiveUser: user.uid }, { merge: true });
    } catch (e) { setStatus('Reintentando...'); }
  };

  const startRecognition = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) { setStatus('Navegador no soportado.'); return; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch(e) {} }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Ráfaga para evitar eco
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => { setStatus('Escuchando...'); setIsListening(true); };
    recognition.onend = () => {
      if (shouldListenRef.current) { try { recognition.start(); } catch(e) { setTimeout(() => { if(shouldListenRef.current) startRecognition(); }, 200); } }
      else { setIsListening(false); setStatus('Pausado.'); }
    };
    recognition.onerror = (e) => { if (e.error === 'not-allowed') { shouldListenRef.current = false; setStatus('Permiso denegado.'); setIsListening(false); } };
    recognition.onresult = (e) => {
      let final = ''; let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
      setLocalText(interim || "...");
      if (final.trim()) sendText(final);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) {}
  };

  const toggleMic = () => {
    if (shouldListenRef.current) { shouldListenRef.current = false; if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); }
    else { shouldListenRef.current = true; startRecognition(); }
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

// --- COMPONENTES UI AUXILIARES ---
const SidebarItem = ({ icon: Icon, label, active, onClick }) => ( <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} /> {label}</button> );
const Modal = ({ title, onClose, children }) => ( <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden p-6 relative"><button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button><h3 className="font-bold text-lg mb-4">{title}</h3>{children}</div></div> );

// --- 6. APP PRINCIPAL ---
export default function RadiologyWorkstation() {
  const [user, setUser] = useState(null);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [mobileSessionId, setMobileSessionId] = useState('');
  const [activeTab, setActiveTab] = useState('workstation');
  const [configSection, setConfigSection] = useState('centers');
  
  const [centers, setCenters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [jargonDict, setJargonDict] = useState([]);
  const [globalJargon, setGlobalJargon] = useState({}); // DICCIONARIO CLOUD
  
  const [currentCenterId, setCurrentCenterId] = useState('');
  const [reportText, setReportText] = useState('');
  
  const [isPcListening, setIsPcListening] = useState(false);
  const pcRecognitionRef = useRef(null);
  const pcShouldListenRef = useRef(false);
  const [pcInterimText, setPcInterimText] = useState(''); 
  
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteSessionCode, setRemoteSessionCode] = useState('');
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBulkJargonModal, setShowBulkJargonModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempData, setTempData] = useState({});
  
  const textareaRef = useRef(null);
  const reportTextRef = useRef(''); 
  const jargonDictRef = useRef([]);
  const globalJargonRef = useRef({});

  useEffect(() => { reportTextRef.current = reportText; }, [reportText]);
  useEffect(() => { jargonDictRef.current = jargonDict; }, [jargonDict]);
  useEffect(() => { globalJargonRef.current = globalJargon; }, [globalJargon]);

  useEffect(() => {
    if (initError) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'mic') { setIsMobileMode(true); setMobileSessionId(params.get('session')); }
    if (auth) { signInAnonymously(auth).catch(console.error); return onAuthStateChanged(auth, setUser); }
  }, []);

  // CARGA DE DATOS (Incluye Diccionario Global)
  useEffect(() => {
    if (!user || !db || isMobileMode) return;
    try {
        const unsubCenters = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), s => {
          const data = s.docs.map(d => ({id: d.id, ...d.data()}));
          setCenters(data);
          if (!currentCenterId && data.length > 0) setCurrentCenterId(data[0].id);
        });
        const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), s => setTemplates(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubJargon = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), s => setJargonDict(s.docs.map(d => ({id: d.id, ...d.data()}))));
        
        // SUSCRIPCIÓN AL DICCIONARIO GLOBAL
        const unsubGlobal = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'jargon_global'), s => {
            const globalData = {};
            s.docs.forEach(doc => {
                const data = doc.data();
                Object.assign(globalData, data.dictionary || {});
            });
            setGlobalJargon(globalData);
        });

        return () => { unsubCenters(); unsubTemplates(); unsubJargon(); unsubGlobal(); };
    } catch (e) { console.error("Error data:", e); }
  }, [user, isMobileMode]);

  // Listener Móvil
  useEffect(() => {
    if (isMobileMode || !remoteSessionCode || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', remoteSessionCode), (docSnap) => {
      const data = docSnap.data();
      if (data?.latestText && data.latestText.trim() !== '' && data.timestamp > (Date.now() - 5000)) {
        const rawInput = data.latestText;
        const currentRep = reportTextRef.current;
        if (!currentRep.trim().endsWith(rawInput)) {
             const newText = mergeText(currentRep, rawInput, globalJargonRef.current, jargonDictRef.current);
             setReportText(newText);
        }
        updateDoc(docSnap.ref, { latestText: '' }); 
      }
    });
    return () => unsub();
  }, [remoteSessionCode, isMobileMode]);

  // --- DICTADO PC ---
  const startPcDictation = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) return alert("Usa Chrome.");
    if (pcRecognitionRef.current) { try { pcRecognitionRef.current.abort(); } catch(e) {} }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    recognition.onstart = () => setIsPcListening(true);
    recognition.onend = () => {
        if (pcShouldListenRef.current) { try { recognition.start(); } catch(e) { setTimeout(() => { if(pcShouldListenRef.current) startPcDictation(); }, 200); } }
        else { setIsPcListening(false); }
    };
    recognition.onerror = (e) => { if (e.error === 'not-allowed') { pcShouldListenRef.current = false; setIsPcListening(false); alert("Permiso denegado."); } };
    recognition.onresult = (e) => {
        let final = ''; let interim = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) { if(e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
        setPcInterimText(interim);
        if(final) {
            const newText = mergeText(reportTextRef.current, final, globalJargonRef.current, jargonDictRef.current);
            setReportText(newText);
            setPcInterimText(''); 
        }
    };
    pcRecognitionRef.current = recognition;
    recognition.start();
  };

  const togglePcDictation = () => {
    if (pcShouldListenRef.current) { pcShouldListenRef.current = false; if (pcRecognitionRef.current) pcRecognitionRef.current.stop(); setIsPcListening(false); }
    else { pcShouldListenRef.current = true; startPcDictation(); }
  };

  // --- SCRIPT DE CARGA MASIVA (ADMIN) ---
  const uploadMasterDictionary = async () => {
      if (!db || !user) return;
      if (!confirm("¿Estás seguro? Esto subirá +1000 términos a la base de datos pública.")) return;
      setUploadProgress(10);
      
      const batchSize = 400; 
      const entries = Object.entries(INITIAL_MASTER_DICTIONARY);
      const totalChunks = Math.ceil(entries.length / batchSize);
      
      try {
          for (let i = 0; i < totalChunks; i++) {
              const chunk = entries.slice(i * batchSize, (i + 1) * batchSize);
              const chunkObj = Object.fromEntries(chunk);
              const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'jargon_global', `chunk_${i}`);
              await setDoc(docRef, { dictionary: chunkObj, version: 1, updated: Date.now() });
              setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
          }
          alert("¡Base de datos maestra actualizada con éxito!");
          setUploadProgress(0);
      } catch (e) {
          console.error(e);
          alert("Error subiendo datos: " + e.message);
          setUploadProgress(0);
      }
  };

  const startRemoteSession = () => { setRemoteSessionCode(Math.floor(1000 + Math.random() * 9000).toString()); setShowRemoteModal(true); };
  const addCenter = async () => { if(tempData.name && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), {name: tempData.name}); setTempData({}); setShowCenterModal(false); }};
  const addTemplate = async () => { if(tempData.title && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), {title: tempData.title, content: tempData.content, centerId: tempData.centerId || 'global'}); setTempData({}); setShowTemplateModal(false); }};
  const addJargon = async () => { if(tempData.trigger && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), {trigger: tempData.trigger.toLowerCase(), replacement: tempData.replacement}); setTempData({}); }};
  const bulkImportJargon = async () => {
      if (!tempData.bulkContent || !user || !db) return;
      const lines = tempData.bulkContent.split('\n');
      for (const line of lines) {
          let parts = line.includes(',') ? line.split(',') : line.split('->');
          if (parts.length >= 2) {
              const trigger = parts[0].trim().toLowerCase();
              const replacement = parts[1].trim();
              if (trigger && replacement) await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), { trigger, replacement });
          }
      }
      alert("Importado."); setShowBulkJargonModal(false); setTempData({});
  };
  const deleteItem = async (col, id) => { if(confirm('¿Eliminar?') && db && user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id)); };

  if (initError) return <div className="h-screen flex items-center justify-center bg-red-50 text-red-600 p-8 font-bold text-center"><div><AlertTriangle size={48} className="mx-auto mb-4"/>Error Crítico:<br/>{initError}</div></div>;
  if (isMobileMode) return <MobileMicInterface sessionId={mobileSessionId} user={user} />;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.href.split('?')[0]}?mode=mic&session=${remoteSessionCode}`)}`;
  const visibleTemplates = templates.filter(t => t.centerId === 'global' || t.centerId === currentCenterId);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm hidden md:flex">
        <div className="p-4 border-b border-slate-100"><h1 className="font-bold text-xl text-indigo-700 flex items-center gap-2"><Layout size={24}/> NeuroRad <span className="text-xs bg-indigo-100 px-2 py-0.5 rounded text-indigo-600">PRO</span></h1></div>
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
                 <div className="flex flex-col"><span className="text-xs text-slate-400 font-medium">Ubicación</span>
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
                    <textarea ref={textareaRef} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Comienza a dictar..." className="w-full h-full p-8 outline-none resize-none text-lg text-slate-700 leading-relaxed font-serif"/>
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
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <button onClick={()=>setConfigSection('centers')} className={`p-4 rounded-lg border text-left ${configSection==='centers'?'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500':'bg-white hover:bg-slate-50'}`}><h3 className="font-bold text-slate-700">Centros</h3><p className="text-xs text-slate-500">Gestiona tus lugares de trabajo</p></button>
                 <button onClick={()=>setConfigSection('templates')} className={`p-4 rounded-lg border text-left ${configSection==='templates'?'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500':'bg-white hover:bg-slate-50'}`}><h3 className="font-bold text-slate-700">Plantillas</h3><p className="text-xs text-slate-500">Macros y textos predefinidos</p></button>
               </div>
               
               {/* SECCIÓN DE CARGA MASIVA */}
               <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8 flex items-center justify-between">
                   <div>
                       <h3 className="font-bold text-orange-800 flex items-center gap-2"><Database size={18}/> Base de Datos Maestra</h3>
                       <p className="text-xs text-orange-700 mt-1">Carga inicial del vocabulario médico (+1200 términos).</p>
                       <p className="text-xs text-orange-600 mt-1 italic">Estado: {Object.keys(globalJargon).length} términos cargados.</p>
                   </div>
                   <button onClick={uploadMasterDictionary} disabled={uploadProgress > 0} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors">
                       {uploadProgress > 0 ? `Cargando ${uploadProgress}%...` : "Inicializar BD"}
                   </button>
               </div>

               {configSection === 'centers' && <div className="space-y-4"><button onClick={() => setShowCenterModal(true)} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-lg border border-dashed border-indigo-200 flex justify-center gap-2 hover:bg-indigo-100 transition-colors"><Plus size={20}/> Nuevo Centro</button>{centers.map(c => (<div key={c.id} className="bg-white p-4 border rounded flex justify-between items-center shadow-sm"><span>{c.name}</span><button onClick={()=>deleteItem('centers',c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button></div>))}</div>}
               
               {configSection === 'templates' && <div className="space-y-4">
                   <div className="flex justify-between">
                       <button onClick={() => setShowTemplateModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus size={18}/> Nueva Plantilla</button>
                       <button onClick={() => { setTempData({}); setShowTemplateModal(true); }} className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50"><Clipboard size={18}/> Pegar desde Word</button>
                   </div>
                   {templates.map(t => (<div key={t.id} className="bg-white p-4 border rounded flex justify-between items-center shadow-sm"><span className="font-bold text-slate-700">{t.title}</span><button onClick={()=>deleteItem('templates',t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button></div>))}
                </div>}
          </div></div>
        )}
      </div>
      
      {showTemplateModal && <Modal title="Nueva Plantilla" onClose={() => setShowTemplateModal(false)}>
          <input className="w-full p-3 border rounded mb-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Título (ej. Tórax Normal)" onChange={e => setTempData({...tempData, title: e.target.value})}/>
          <select className="w-full p-3 border rounded mb-3 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" onChange={e => setTempData({...tempData, centerId: e.target.value})} defaultValue=""><option value="" disabled>Centro</option><option value="global">Global</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea className="w-full p-3 border rounded mb-3 h-48 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Pega aquí el texto de tu informe o documento Word..." onChange={e => setTempData({...tempData, content: e.target.value})}/>
          <button onClick={addTemplate} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700 transition-colors">Guardar Plantilla</button>
      </Modal>}
      
      {showCenterModal && <Modal title="Nuevo Centro" onClose={() => setShowCenterModal(false)}><input className="w-full p-3 border rounded mb-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nombre (ej. Hospital Central)" onChange={e => setTempData({...tempData, name: e.target.value})}/><button onClick={addCenter} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700 transition-colors">Guardar</button></Modal>}
      
      {showBulkJargonModal && <Modal title="Importar Jerga Masiva" onClose={() => setShowBulkJargonModal(false)}>
          <p className="text-sm text-slate-500 mb-2">Pega tu lista en formato: <strong>Error, Corrección</strong> (una por línea)</p>
          <textarea className="w-full p-3 border rounded mb-3 h-48 font-mono text-sm" placeholder="dolares, nodulares&#10;videos, vidrio" onChange={e => setTempData({...tempData, bulkContent: e.target.value})}/>
          <button onClick={bulkImportJargon} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Procesar Lista</button>
      </Modal>}
      
      {showRemoteModal && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-center relative"><button onClick={() => setShowRemoteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button><div className="bg-indigo-600 p-6 text-white"><h3 className="text-xl font-bold flex items-center justify-center gap-2"><Smartphone/> Micrófono Remoto</h3><p className="text-indigo-100 text-sm mt-1">Conecta tu celular de forma segura</p></div><div className="p-8 flex flex-col items-center"><div className="bg-white p-2 rounded-lg shadow-inner border border-slate-200 mb-6"><img src={qrUrl} alt="Escanear con celular" className="w-48 h-48 object-contain" /></div><div className="space-y-2 text-slate-600"><p className="font-medium">1. Escanea este código</p><p className="text-sm">2. Espera a ver "Listo para dictar"</p></div><div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Sesión: {remoteSessionCode}</div></div></div></div>}
    </div>
  );
}