import React from 'react';
import { useGaze } from '../contexts/GazeContext';

const GazeCursor: React.FC = () => {
  const { gazePoint, isDwelling, dwellProgress, settings } = useGaze();
  const isLight = settings.faceLightEnabled;

  return (
    <div
      className="gaze-cursor pointer-events-none fixed z-[9999] flex items-center justify-center"
      style={{
        left: gazePoint.x,
        top: gazePoint.y,
        width: isDwelling ? '60px' : '40px',
        height: isDwelling ? '60px' : '40px',
      }}
    >
      {/* Outer Ring */}
      <div className={`absolute inset-0 rounded-full border-2 transition-all duration-100 ${
        isDwelling 
            ? (isLight ? 'border-cyan-600 bg-cyan-100/50' : 'border-cyan-400 bg-cyan-900/20') 
            : (isLight ? 'border-slate-400/50' : 'border-red-500/50')
      }`} />
      
      {/* Inner Dot */}
      <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)] ${isLight ? 'bg-slate-800' : 'bg-white'}`} />
      
      {/* Progress Spinner */}
      {isDwelling && (
        <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className={isLight ? 'text-cyan-700' : 'text-cyan-400'}
            strokeDasharray="301.59"
            strokeDashoffset={301.59 * (1 - dwellProgress)}
          />
        </svg>
      )}
    </div>
  );
};

export default GazeCursor;