import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Mic, MicOff, Settings, FileText, Building2, Book, Plus, Trash2, Save, Layout, Smartphone, X, Wifi, WifiOff, Loader2, AlertTriangle, Clipboard, Upload } from 'lucide-react';

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

// --- 3. PROCESAMIENTO DE TEXTO (LÓGICA MAESTRA) ---

// Función para escapar caracteres especiales en Regex (Evita crash por T2*)
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const processText = (rawText, userJargon = [], previousText = "") => {
  if (!rawText) return "";
  
  // Limpieza inicial
  let cleanedRaw = rawText;
  // Quitar punto final automático si no es explícito
  if (cleanedRaw.trim().endsWith('.') && !cleanedRaw.toLowerCase().includes('punto')) {
      cleanedRaw = cleanedRaw.replace(/\.$/, '');
  }
  let text = cleanedRaw.toLowerCase();

  // A. MAPEO DE PUNTUACIÓN (Regex estricto)
  const PUNCTUATION_MAP = {
    "punto y aparte": ".\n", "punto aparte": ".\n", "nuevo párrafo": "\n\n",
    "punto y seguido": ".", "punto seguido": ".", 
    "punto": ".", "coma": ",", 
    "dos puntos": ":", "punto y coma": ";", 
    "abrir paréntesis": "(", "cerrar paréntesis": ")",
    "barra": "/", "guión": "-"
  };
  
  Object.keys(PUNCTUATION_MAP).forEach(punct => {
    // \b asegura que sea la palabra exacta
    const regex = new RegExp(`\\b${escapeRegExp(punct)}\\b`, 'gi');
    text = text.replace(regex, PUNCTUATION_MAP[punct]);
  });

  // B. DICCIONARIO MÉDICO MASIVO (Extraído de tus PDFs)
  const MEDICAL_CORRECTIONS = {
    // --- ERRORES FONÉTICOS COMUNES ---
    "dólares": "nodulares", "dolares": "nodulares", "modulares": "nodulares",
    "videos": "vidrio", "vídeos": "vidrio", 
    "sensacional": "centroacinar", "centro asin arias": "centroacinares", "sinacinales": "centroacinares",
    "inflexión": "infeccioso", "infección": "infeccioso",
    "brote": "brote", "árbol en brote": "árbol en brote",
    "a tele taxi as": "atelectasias", "atelectasia": "atelectasia",
    "impronta": "impronta", "sugestivo": "sugestivo", "compatible": "compatible",
    "evidencia": "evidencia", "hallazgo": "hallazgo", "significativo": "significativo",

    // --- NEURO (CEREBRO, CUELLO, ÓRBITAS, PEÑASCOS) ---
    "hiperintenso": "hiperintenso", "hipointenso": "hipointenso", "isointenso": "isointenso",
    "surcos": "surcos", "cisuras": "cisuras", "circunvoluciones": "circunvoluciones",
    "ventrículos": "ventrículos", "supratentorial": "supratentorial", "infratentorial": "infratentorial",
    "línea media": "línea media", "desviación": "desviación", "colapso": "colapso",
    "silla turca": "silla turca", "hipófisis": "hipófisis", "tallo": "tallo hipofisario",
    "cavernoso": "seno cavernoso", "polígono": "polígono de Willis", "sifones": "sifones carotídeos",
    "sustancia blanca": "sustancia blanca", "sustancia gris": "sustancia gris", "periventricular": "periventricular",
    "ganglios basales": "ganglios basales", "tálamo": "tálamo", "núcleo lenticular": "núcleo lenticular",
    "cerebelo": "cerebelo", "tronco": "tronco del encéfalo", "coronas radiatas": "coronas radiatas",
    "mesencéfalo": "mesencéfalo", "protuberancia": "protuberancia", "bulbo": "bulbo raquídeo",
    "gliosis": "gliosis", "isquemia": "isquemia", "infarto": "infarto", "agudo": "agudo", "crónico": "crónico",
    "microangiopatía": "microangiopatía", "leucoaraiosis": "leucoaraiosis", "desmielinizante": "desmielinizante",
    "cavum": "cavum", "meckel": "Meckel", "trigémino": "trigémino", "gasser": "Gasser",
    "cai": "CAI", "conducto auditivo": "conducto auditivo", "laberinto": "laberinto", "membranoso": "membranoso",
    "macizo": "macizo cráneo-facial", "ostiomeatales": "ostiomeatales", "infundibulares": "infundibulares",
    "septum": "septum nasal", "cornetes": "cornetes", "polipoide": "polipoide", "ocupación": "ocupación",
    "periamigdalino": "periamigdalino", "ganglionar": "ganglionar", "adenomegalias": "adenomegalias",

    // --- SECUENCIAS RM (PROTOCOLOS) ---
    "de uno": "T1", "t 1": "T1", "te uno": "T1",
    "de dos": "T2", "t 2": "T2", "te dos": "T2", "t dos estrella": "T2*",
    "flair": "FLAIR", "fler": "FLAIR", 
    "stir": "STIR", "estir": "STIR",
    "difusión": "DWI", "dwi": "DWI", "adc": "ADC", "mapa a de ce": "mapa ADC",
    "eco de gradiente": "eco de gradiente", "gre": "GRE", "susceptibilidad": "susceptibilidad magnética",
    "gadolinio": "gadolinio", "contraste": "contraste", "captación": "captación",
    "realce": "realce", "homogéneo": "homogéneo", "heterogéneo": "heterogéneo",
    "fiesta": "FIESTA", "siesta": "FIESTA", "tof": "TOF", "fatsat": "FATSAT", "saturación": "saturación grasa",
    "spgr": "SPGR", "volumétricas": "volumétricas", "angiorm": "angioRM",

    // --- TÓRAX ---
    "esmerilado": "esmerilado", "deslustrado": "deslustrado", "vidrio": "vidrio",
    "neumotórax": "neumotórax", "derrame plural": "derrame pleural", "laminar": "laminar",
    "costodiafragmático": "costodiafragmático", "mediastínico": "mediastínico", "cardiomediastínica": "cardiomediastínica",
    "hiliar": "hiliar", "perihiliar": "perihiliar", "precarinal": "precarinal", "subcarinal": "subcarinal",
    "parénquima": "parénquima", "intersticial": "intersticial", "septos": "septos interlobulillares",
    "alveolar": "alveolar", "consolidación": "consolidación", "broncograma": "broncograma aéreo",
    "bronquiectasias": "bronquiectasias", "cilíndricas": "cilíndricas", "quísticas": "quísticas",
    "subpleural": "subpleural", "apical": "apical", "basal": "basal", "segmento": "segmento",
    "lóbulo": "lóbulo", "cisura": "cisura", "ácigos": "ácigos", "aorta": "aorta", "calcificaciones": "calcificaciones",
    "botón aórtico": "botón aórtico", "silueta": "silueta", "ateromatosis": "ateromatosis",
    "bullas": "bullas", "enfisema": "enfisema", "centrolobulillar": "centrolobulillar", "paraseptal": "paraseptal",
    "panalización": "panalización", "panal de abejas": "panal de abejas", "empedrado": "empedrado (crazy paving)",
    "granuloma": "granuloma", "secuelar": "secuelar", "tractos": "tractos fibrosos",

    // --- ABDOMEN Y PELVIS ---
    "hígado graso": "esteatosis hepática", "esteatosis": "esteatosis", "segmento hepático": "segmento hepático",
    "litiasis": "litiasis", "colelitiasis": "colelitiasis", "coledocolitiasis": "coledocolitiasis", "lito": "lito",
    "colédoco": "colédoco", "vía biliar": "vía biliar", "intrahepática": "intrahepática", "extrahepática": "extrahepática",
    "páncreas": "páncreas", "wirsung": "Wirsung", "uncinado": "proceso uncinado",
    "retroperitoneo": "retroperitoneo", "peritoneo": "peritoneo", "líquido libre": "líquido libre",
    "anexos": "anexos", "quiste": "quiste", "bosniak": "Bosniak", "simple": "simple", "complejo": "complejo",
    "divertículos": "divertículos", "diverticulosis": "diverticulosis", "diverticulitis": "diverticulitis",
    "apendicitis": "apendicitis", "apéndice": "apéndice", "cecal": "cecal", "fosa ilíaca": "fosa ilíaca",
    "bazo": "bazo", "esplenomegalia": "esplenomegalia", "accesorio": "bazo accesorio",
    "riñón": "riñón", "renal": "renal", "cortical": "cortical", "medular": "medular", "seno renal": "seno renal",
    "pielocalicial": "pielocalicial", "ureter": "uréter", "vejiga": "vejiga", "repleción": "repleción",
    "próstata": "próstata", "seminales": "vesículas seminales", "agrandada": "agrandada",
    "útero": "útero", "endometrio": "endometrio", "miometrio": "miometrio", "fosas isquiorrectales": "fosas isquiorrectales",
    "intususcepción": "intususcepción", "vólvulo": "vólvulo", "distensión": "distensión", "niveles": "niveles hidroaéreos",

    // --- MUSCULOESQUELÉTICO (MSK) ---
    "osteofitos": "osteofitos", "espondilosis": "espondilosis", "artrosis": "artrosis", "degenerativos": "cambios degenerativos",
    "fractura": "fractura", "fisura": "fisura", "conminuta": "conminuta", "trazo": "trazo",
    "edema óseo": "edema óseo", "médula ósea": "médula ósea", "contusión": "contusión",
    "ligamento": "ligamento", "cruzado": "cruzado", "anterior": "anterior", "posterior": "posterior",
    "menisco": "menisco", "rotura": "rotura", "desgarro": "desgarro", 
    "manguito": "manguito rotador", "supraespinoso": "supraespinoso", "infraespinoso": "infraespinoso",
    "bursitis": "bursitis", "sinovitis": "sinovitis", "derrame articular": "derrame articular",
    "geodas": "geodas", "subcondrales": "subcondrales", "esclerosis": "esclerosis",
    "platillos": "platillos tibiales", "cóndilo": "cóndilo femoral", "rótula": "rótula", "fémur": "fémur",

    // --- ECOGRAFÍA Y GENERAL ---
    "ecogénico": "ecogénico", "hipoecoico": "hipoecoico", "hiperecoico": "hiperecoico",
    "anecoico": "anecoico", "isoecoico": "isoecoico", "heteroecoico": "heteroecoico",
    "sombra acústica": "sombra acústica posterior", "refuerzo": "refuerzo acústico posterior",
    "doppler": "Doppler", "flujo": "flujo", "vascularización": "vascularización",
    "proceso": "proceso", "neoformativo": "neoformativo", "secundarismo": "secundarismo"
  };

  Object.keys(MEDICAL_CORRECTIONS).forEach(term => {
    // Usamos límites de palabra (\b) para evitar reemplazos parciales incorrectos
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    text = text.replace(regex, MEDICAL_CORRECTIONS[term]);
  });

  // C. JERGA DE USUARIO (Tus personalizaciones)
  if (Array.isArray(userJargon)) {
    userJargon.forEach(item => {
       if(item && item.trigger && item.replacement) {
          const regex = new RegExp(`\\b${escapeRegExp(item.trigger.toLowerCase())}\\b`, 'gi');
          text = text.replace(regex, item.replacement);
       }
    });
  }

  // D. LIMPIEZA FINAL DE ESPACIOS
  // Quitar espacio antes de puntuación
  text = text.replace(/\s+([.,;:])/g, '$1');
  // Asegurar espacio después de puntuación si no hay salto
  text = text.replace(/([.,;:])(?=[^\s\n])/g, '$1 ');

  // E. MAYÚSCULAS INTELIGENTES
  const trimmedPrev = previousText ? previousText.trim() : "";
  const endsWithPunctuation = trimmedPrev.length === 0 || ['.', '\n', '!', '?', ':'].some(char => trimmedPrev.endsWith(char));

  if (endsWithPunctuation) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  } else {
    // Si la palabra corregida es una sigla (todo mayúsculas, ej: TOF), la respetamos
    const firstWord = text.split(' ')[0];
    const isAcronym = firstWord.length > 1 && firstWord === firstWord.toUpperCase() && !/\d/.test(firstWord);
    
    if (!isAcronym) {
        return text.charAt(0).toLowerCase() + text.slice(1);
    }
    return text;
  }
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
    if (!db) return; 
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
    
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch(e) {} }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // MODO RÁFAGA (Anti-Eco)
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => { setStatus('Escuchando...'); setIsListening(true); };
    
    recognition.onend = () => {
      if (shouldListenRef.current) {
          try { recognition.start(); } catch(e) { 
              setTimeout(() => { if(shouldListenRef.current) startRecognition(); }, 200);
          }
      } else {
          setIsListening(false); setStatus('Pausado.');
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

// --- 5. COMPONENTES UI AUXILIARES ---
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
    if (auth) {
        signInAnonymously(auth).catch(console.error);
        return onAuthStateChanged(auth, setUser);
    }
  }, []);

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
        return () => { unsubCenters(); unsubTemplates(); unsubJargon(); };
    } catch (e) { console.error("Error data:", e); }
  }, [user, isMobileMode]);

  // Listener Móvil (PC recibe texto)
  useEffect(() => {
    if (isMobileMode || !remoteSessionCode || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'remote_mic_sessions', remoteSessionCode), (docSnap) => {
      const data = docSnap.data();
      if (data?.latestText && data.latestText.trim() !== '' && data.timestamp > (Date.now() - 5000)) {
        const rawInput = data.latestText;
        const currentRep = reportTextRef.current;
        
        // Usamos la función de merge inteligente para evitar duplicados y puntuación doble
        if (!currentRep.trim().endsWith(rawInput)) {
             const processed = processText(rawInput, jargonDictRef.current, currentRep);
             // Calcular espacio necesario
             const isPunctuation = /^[.,;:]/.test(processed);
             const space = (currentRep && !currentRep.endsWith(' ') && !currentRep.endsWith('\n') && !isPunctuation) ? ' ' : '';
             
             setReportText(prev => prev + space + processed);
        }
        updateDoc(docSnap.ref, { latestText: '' }); 
      }
    });
    return () => unsub();
  }, [remoteSessionCode, isMobileMode]);

  // --- DICTADO PC ---
  const startPcDictation = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) return alert("Usa Chrome.");
    
    if (pcRecognitionRef.current) {
        try { pcRecognitionRef.current.abort(); } catch(e) {}
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => setIsPcListening(true);
    
    recognition.onend = () => {
        // Auto-restart si se cortó pero la intención es seguir
        if (pcShouldListenRef.current) {
            try { recognition.start(); } catch(e) { setTimeout(() => { if(pcShouldListenRef.current) startPcDictation(); }, 200); }
        } else {
            setIsPcListening(false);
        }
    };
    
    recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
            pcShouldListenRef.current = false;
            setIsPcListening(false);
            alert("Permiso denegado. Revisa el candado en la URL.");
        }
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
            const processed = processText(finalChunk, jargonDictRef.current, reportTextRef.current);
            const isPunctuation = /^[.,;:]/.test(processed);
            const space = (reportTextRef.current && !reportTextRef.current.endsWith(' ') && !reportTextRef.current.endsWith('\n') && !isPunctuation) ? ' ' : '';
            setReportText(prev => prev + space + processed);
            setPcInterimText(''); 
        }
    };

    pcRecognitionRef.current = recognition;
    recognition.start();
  };

  const togglePcDictation = () => {
    if (pcShouldListenRef.current) {
        pcShouldListenRef.current = false;
        if (pcRecognitionRef.current) pcRecognitionRef.current.stop();
        setIsPcListening(false);
    } else {
        pcShouldListenRef.current = true;
        startPcDictation();
    }
  };

  const startRemoteSession = () => { setRemoteSessionCode(Math.floor(1000 + Math.random() * 9000).toString()); setShowRemoteModal(true); };
  const addCenter = async () => { if(tempData.name && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'centers'), {name: tempData.name}); setTempData({}); setShowCenterModal(false); }};
  const addTemplate = async () => { if(tempData.title && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'templates'), {title: tempData.title, content: tempData.content, centerId: tempData.centerId || 'global'}); setTempData({}); setShowTemplateModal(false); }};
  const addJargon = async () => { if(tempData.trigger && db && user) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), {trigger: tempData.trigger.toLowerCase(), replacement: tempData.replacement}); setTempData({}); }};
  
  const bulkImportJargon = async () => {
      if (!tempData.bulkContent || !user || !db) return;
      const lines = tempData.bulkContent.split('\n');
      let count = 0;
      for (const line of lines) {
          let parts = line.includes(',') ? line.split(',') : line.split('->');
          if (parts.length >= 2) {
              const trigger = parts[0].trim().toLowerCase();
              const replacement = parts[1].trim();
              if (trigger && replacement) {
                  await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'jargon'), { trigger, replacement });
                  count++;
              }
          }
      }
      alert(`Importados ${count} términos.`);
      setShowBulkJargonModal(false);
      setTempData({});
  };

  const deleteItem = async (col, id) => { if(confirm('¿Eliminar?') && db && user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id)); };

  if (initError) return <div className="h-screen flex items-center justify-center bg-red-50 text-red-600 p-8 font-bold text-center"><div><AlertTriangle size={48} className="mx-auto mb-4"/>Error Crítico:<br/>{initError}</div></div>;
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
                  <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 flex gap-2"><AlertTriangle size={16}/><span>Tip: Agrega los errores de dictado aquí.</span></div>
                  <div className="flex justify-end"><button onClick={() => { setTempData({}); setShowBulkJargonModal(true); }} className="text-indigo-600 text-sm font-bold flex items-center gap-1"><Upload size={14}/> Importar Masivo</button></div>
                  <div className="bg-white p-4 rounded border flex gap-2 items-end"><div className="flex-1"><label className="text-xs text-slate-500">Error (Escucha)</label><input className="w-full border-b font-mono text-red-500" placeholder="ej. dolares" value={tempData.trigger||''} onChange={e=>setTempData({...tempData, trigger:e.target.value})}/></div><div className="flex-[2]"><label className="text-xs text-slate-500">Corrección (Escribe)</label><input className="w-full border-b font-bold text-green-600" placeholder="ej. nodulares" value={tempData.replacement||''} onChange={e=>setTempData({...tempData, replacement:e.target.value})}/></div><button onClick={addJargon} className="bg-slate-800 text-white p-2 rounded"><Plus size={16}/></button></div>
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
      
      {showBulkJargonModal && <Modal title="Importar Jerga Masiva" onClose={() => setShowBulkJargonModal(false)}>
          <p className="text-sm text-slate-500 mb-2">Pega tu lista en formato: <strong>Error, Corrección</strong> (una por línea)</p>
          <textarea className="w-full p-3 border rounded mb-3 h-48 font-mono text-sm" placeholder="dolares, nodulares&#10;videos, vidrio" onChange={e => setTempData({...tempData, bulkContent: e.target.value})}/>
          <button onClick={bulkImportJargon} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">Procesar Lista</button>
      </Modal>}
      
      {showRemoteModal && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-center relative"><button onClick={() => setShowRemoteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button><div className="bg-indigo-600 p-6 text-white"><h3 className="text-xl font-bold flex items-center justify-center gap-2"><Smartphone/> Micrófono Remoto</h3><p className="text-indigo-100 text-sm mt-1">Conecta tu celular de forma segura</p></div><div className="p-8 flex flex-col items-center"><div className="bg-white p-2 rounded-lg shadow-inner border border-slate-200 mb-6"><img src={qrUrl} alt="Escanear con celular" className="w-48 h-48 object-contain" /></div><div className="space-y-2 text-slate-600"><p className="font-medium">1. Escanea este código</p><p className="text-sm">2. Espera a ver "Listo para dictar"</p></div><div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Sesión: {remoteSessionCode}</div></div></div></div>}
    </div>
  );
}