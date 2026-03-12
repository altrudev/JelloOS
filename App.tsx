import React, { useState, useEffect, useCallback } from 'react';
import { GazeProvider, useGaze } from './contexts/GazeContext';
import GazeCursor from './components/GazeCursor';
import Keyboard from './components/Keyboard';
import JelloButton from './components/JelloButton';
import { AppMode } from './types';
import { predictNextPhrases, getSmartSuggestionsByTime } from './services/geminiService';
import { 
  MessageSquare, 
  Home, 
  Volume2, 
  Battery, 
  Wifi, 
  Trash2,
  Play,
  Eye,
  Settings,
  X,
  Sun,
  Moon,
  Zap
} from 'lucide-react';

const Header: React.FC<{ onSettings: () => void }> = ({ onSettings }) => {
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const { settings, updateSettings, ambientBrightness } = useGaze();
    
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const isLight = settings.faceLightEnabled;

    return (
        <div className={`fixed top-0 left-0 right-0 h-12 border-b flex items-center justify-between px-2 sm:px-4 z-40 transition-colors duration-1000 ${isLight ? 'bg-white/95 border-slate-200 text-slate-500' : 'bg-slate-900/95 border-slate-800 text-slate-400'} text-[9px] sm:text-sm`}>
            <div className="flex items-center gap-1.5 sm:gap-4">
                <span className={`font-black tracking-tighter sm:tracking-wider ${isLight ? 'text-cyan-700' : 'text-cyan-500'}`}>JELLO OS</span>
                <div className={`flex items-center gap-1 text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${settings.enableEyeTracking ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="hidden xs:inline">{settings.enableEyeTracking ? 'EYE TRACKING' : 'SIMULATION'}</span>
                </div>
                {settings.autoFaceLight && settings.enableEyeTracking && (
                   <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md border border-cyan-500/30 font-mono ${isLight ? 'text-cyan-800 bg-cyan-50' : 'text-cyan-400 bg-cyan-950/20'}`}>
                       <Zap size={10} className="animate-pulse" />
                       <span className="hidden xs:inline">AUTO-LIGHT</span> {Math.round(ambientBrightness)}%
                   </div>
                )}
            </div>
            <div className="flex items-center gap-2 sm:gap-6">
                <span className="font-medium">{time}</span>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Wifi size={14} className="hidden xs:block" />
                    <Battery size={14} className="hidden xs:block" />
                    <JelloButton 
                        id="nav-facelight" 
                        onClick={() => updateSettings({ faceLightEnabled: !settings.faceLightEnabled, autoFaceLight: false })}
                        className={`p-1.5 rounded-full transition-all ${isLight ? 'bg-cyan-100 text-cyan-700 scale-110 shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        {isLight ? <Sun size={18} /> : <Moon size={18} />}
                    </JelloButton>
                    <JelloButton id="nav-settings" onClick={onSettings} className={`ml-1 p-1 ${isLight ? 'text-slate-400 hover:text-slate-900' : 'text-slate-500 hover:text-white'}`}>
                        <Settings size={18} />
                    </JelloButton>
                </div>
            </div>
        </div>
    )
}

const CalibrationOverlay = () => {
    const { setIsCalibrating, settings } = useGaze();
    const [points, setPoints] = useState([
        { id: 1, x: '15%', y: '15%', count: 0 },
        { id: 2, x: '85%', y: '15%', count: 0 },
        { id: 3, x: '50%', y: '50%', count: 0 },
        { id: 4, x: '15%', y: '85%', count: 0 },
        { id: 5, x: '85%', y: '85%', count: 0 },
    ]);

    const handlePointClick = (id: number) => {
        setPoints(prev => prev.map(p => {
            if (p.id === id) {
                const newCount = p.count + 1;
                return { ...p, count: newCount };
            }
            return p;
        }));
    };

    const completed = points.every(p => p.count >= 3);
    const isLight = settings.faceLightEnabled;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm transition-colors duration-1000 ${isLight ? 'bg-white/95' : 'bg-slate-900/95'}`}>
            <div className="max-w-md text-center mb-12">
                <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>Calibration</h2>
                <p className={`text-sm sm:text-base ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Look steadily at each red dot until it turns green. Complete all 5 points.</p>
                {completed && (
                    <button 
                        onClick={() => setIsCalibrating(false)}
                        className="mt-6 px-8 py-4 bg-cyan-600 text-white rounded-full font-bold animate-bounce shadow-xl shadow-cyan-500/40"
                    >
                        Success! Begin Typing
                    </button>
                )}
            </div>

            {points.map(p => (
                <JelloButton
                    key={p.id}
                    id={`calib-${p.id}`}
                    onClick={() => handlePointClick(p.id)}
                    className="absolute w-12 h-12 rounded-full border-4 transition-all duration-300"
                    style={{ left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${1 + p.count * 0.15})`, borderColor: isLight ? '#cbd5e1' : 'rgba(255,255,255,0.2)' }}
                >
                    <div className={`w-4 h-4 rounded-full transition-colors ${p.count >= 3 ? 'bg-green-500 scale-125' : 'bg-red-500'}`} />
                    <span className={`absolute -bottom-6 text-[10px] font-mono font-bold ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{p.count}/3</span>
                </JelloButton>
            ))}

            <JelloButton 
                id="close-calib" 
                onClick={() => setIsCalibrating(false)} 
                className="absolute top-16 right-6 text-slate-500"
            >
                <X size={32} />
            </JelloButton>
        </div>
    );
};

const MainApp = () => {
  const { startEyeTracking, isCalibrating, settings, updateSettings } = useGaze();
  const [text, setText] = useState("");
  const [predictions, setPredictions] = useState<string[]>([]);
  const [mode, setMode] = useState<AppMode>(AppMode.KEYBOARD);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    getSmartSuggestionsByTime().then(setPredictions);
  }, []);

  const handleKeyPress = (char: string) => {
    const newText = text + char;
    setText(newText);
    if (newText.length > 2 && newText.endsWith(' ')) {
        predictNextPhrases(newText).then(setPredictions);
    }
  };

  const handleDelete = () => setText(text.slice(0, -1));
  const handleSpace = () => {
    setText(text + " ");
    predictNextPhrases(text + " ").then(setPredictions);
  };

  const handleSpeak = useCallback(() => {
    if (!text) return;
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [text]);

  const handleClear = () => {
      setText("");
      getSmartSuggestionsByTime().then(setPredictions);
  };

  const handlePredictionClick = (phrase: string) => {
      const trimmed = text.trim();
      const needsSpace = trimmed.length > 0;
      setText(trimmed + (needsSpace ? " " : "") + phrase + " ");
  }

  const isLight = settings.faceLightEnabled;

  return (
    <div className={`fixed inset-0 transition-colors duration-1000 font-sans selection:bg-cyan-500/30 pt-14 pb-4 overflow-hidden flex flex-col ${isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}`}>
      <Header onSettings={() => setMode(AppMode.SETTINGS)} />
      <GazeCursor />
      
      {isCalibrating && <CalibrationOverlay />}

      {/* Output Display */}
      <div className="px-4 mb-4 shrink-0">
        <div className={`rounded-2xl p-4 min-h-[90px] sm:min-h-[140px] border shadow-inner flex flex-col justify-between relative group transition-colors duration-500 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
           <textarea 
            value={text}
            readOnly
            placeholder="Focus on keys to type..."
            className={`w-full bg-transparent border-none outline-none text-xl sm:text-4xl font-light resize-none h-full placeholder:text-slate-500 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}
           />
           {isSpeaking && (
               <div className="absolute right-4 top-4 text-cyan-500 animate-bounce">
                   <Volume2 size={32} />
               </div>
           )}
           <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 border rounded-full text-[10px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all ${isLight ? 'bg-white border-slate-300 text-slate-500 shadow-md' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
               DWELL TO RESET
           </div>
        </div>
      </div>

      {/* Predictive Bar */}
      <div className="px-4 mb-4 shrink-0">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {predictions.map((pred, i) => (
                <JelloButton 
                    key={i} 
                    id={`pred-${i}`} 
                    onClick={() => handlePredictionClick(pred)}
                    className={`px-5 py-4 sm:px-8 sm:py-5 border-2 rounded-2xl text-base sm:text-xl font-bold whitespace-nowrap transition-all duration-500 ${isLight ? 'bg-cyan-50 border-cyan-100 text-cyan-900 shadow-sm' : 'bg-cyan-900/20 border-cyan-800/30 text-cyan-100'}`}
                >
                    {pred}
                </JelloButton>
            ))}
        </div>
      </div>

      {/* Main Controls */}
      <div className="px-4 flex-grow flex flex-col justify-end pb-4">
        {mode === AppMode.KEYBOARD && (
            <Keyboard 
                onKeyPress={handleKeyPress}
                onDelete={handleDelete}
                onSpace={handleSpace}
            />
        )}

        {mode === AppMode.SETTINGS && (
            <div className={`rounded-3xl p-8 border flex flex-col gap-6 animate-in slide-in-from-bottom-10 transition-colors duration-1000 ${isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-800/90 border-slate-700'}`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <Settings className="text-cyan-500" />
                        SETTINGS
                    </h3>
                    <JelloButton id="close-set" onClick={() => setMode(AppMode.KEYBOARD)} className="p-2">
                        <X size={24} />
                    </JelloButton>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <JelloButton 
                        id="set-eye" 
                        onClick={startEyeTracking} 
                        className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${settings.enableEyeTracking ? 'bg-cyan-500 text-white border-cyan-400' : (isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-700 border-slate-600')}`}
                    >
                        <Eye size={32} />
                        <div className="text-center">
                            <div className="font-bold text-xs">EYE TRACKER</div>
                        </div>
                    </JelloButton>
                    <JelloButton 
                        id="set-auto-light" 
                        onClick={() => updateSettings({ autoFaceLight: !settings.autoFaceLight })} 
                        className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${settings.autoFaceLight ? 'bg-amber-500 text-white border-amber-400' : (isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-700 border-slate-600')}`}
                    >
                        <Zap size={32} />
                        <div className="text-center">
                            <div className="font-bold text-xs">AUTO-LIGHT</div>
                        </div>
                    </JelloButton>
                </div>

                <div className={`p-5 rounded-2xl border flex items-center gap-4 text-xs font-medium leading-relaxed ${isLight ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-blue-950/20 border-blue-900/30 text-blue-300'}`}>
                    <div className="p-2 rounded-full bg-blue-500/20">
                        <Sun size={20} className="animate-pulse" />
                    </div>
                    <span>When Auto-Light is active, JelloOS detects low room light via your camera and brightens the screen automatically to help with tracking.</span>
                </div>
            </div>
        )}

        {mode === AppMode.KEYBOARD && (
            <div className="mt-8 flex justify-center items-center gap-6 sm:gap-12">
                <JelloButton 
                    id="btn-clear" 
                    onClick={handleClear} 
                    className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 flex flex-col items-center justify-center gap-1 text-[8px] uppercase font-black tracking-widest transition-colors duration-500 ${isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                    <Trash2 size={22} />
                </JelloButton>
                
                <JelloButton 
                    id="btn-speak" 
                    onClick={handleSpeak} 
                    className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 flex flex-col items-center justify-center gap-2 text-sm uppercase font-black tracking-widest shadow-2xl transition-all ${text ? (isLight ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-cyan-500 border-cyan-300 text-white') : (isLight ? 'bg-slate-100 border-slate-300 text-slate-300' : 'bg-slate-800 border-slate-700 text-slate-600')}`}
                    disabled={!text}
                >
                    <Play size={40} fill="currentColor" />
                    Speak
                </JelloButton>

                <JelloButton 
                    id="btn-mode" 
                    onClick={() => setMode(AppMode.SETTINGS)} 
                    className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 flex flex-col items-center justify-center gap-1 text-[8px] uppercase font-black tracking-widest transition-colors duration-500 ${isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                    <Settings size={22} />
                </JelloButton>
            </div>
        )}
      </div>

      {!isLight && (
        <>
            <div className="fixed top-1/2 left-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="fixed bottom-10 right-10 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        </>
      )}
    </div>
  );
};

function App() {
  return (
    <GazeProvider>
      <MainApp />
    </GazeProvider>
  );
}

export default App;