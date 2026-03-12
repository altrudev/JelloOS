
import React, { useRef, useEffect, useState } from 'react';
import { useGaze } from '../contexts/GazeContext';

interface JelloButtonProps {
  id: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  // Fix: Added style property to interface to allow custom styling from parent components.
  style?: React.CSSProperties;
}

const JelloButton: React.FC<JelloButtonProps> = ({ id, onClick, children, className = '', disabled = false, style }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { gazePoint, registerTarget, unregisterTarget, activeTargetId, dwellProgress, settings } = useGaze();
  const [scale, setScale] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (buttonRef.current && !disabled) {
      const updateRect = () => {
        if(buttonRef.current) {
            registerTarget(id, buttonRef.current.getBoundingClientRect(), onClick);
        }
      }
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect);
      return () => {
        unregisterTarget(id);
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
      };
    }
  }, [id, onClick, registerTarget, unregisterTarget, disabled]);

  useEffect(() => {
    if (!buttonRef.current || disabled) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt(Math.pow(gazePoint.x - centerX, 2) + Math.pow(gazePoint.y - centerY, 2));
    const maxDist = 300;
    const maxScale = 1.15;

    if (dist < maxDist) {
      const norm = dist / maxDist;
      const effect = Math.max(0, 1 - norm);
      setScale(1 + (maxScale - 1) * effect * effect);
    } else {
      setScale(1);
    }
  }, [gazePoint, disabled]);

  useEffect(() => {
    setIsHovered(activeTargetId === id);
  }, [activeTargetId, id]);

  const isLight = settings.faceLightEnabled;

  return (
    <button
      ref={buttonRef}
      className={`relative group jello-element overflow-hidden ${className} ${disabled ? 'opacity-50 grayscale' : ''} ${isLight ? 'text-slate-900' : 'text-slate-100'}`}
      style={{
        ...style,
        // Fix: Merging passed transform with internal jello scale effect.
        transform: `${style?.transform || ''} scale(${scale})`.trim(),
        zIndex: isHovered ? 20 : (Number(style?.zIndex) || 1),
      }}
      disabled={disabled}
    >
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${isLight ? 'bg-cyan-100' : 'bg-blue-500'} opacity-0 ${isHovered ? 'opacity-30' : ''}`}
      />
      
      {isHovered && !disabled && (
        <div 
          className={`absolute inset-0 opacity-30 origin-left transition-all duration-75 ease-linear ${isLight ? 'bg-cyan-400' : 'bg-blue-400'}`}
          style={{ width: `${dwellProgress * 100}%` }}
        />
      )}

      <div className="relative z-10 flex items-center justify-center w-full h-full">
        {children}
      </div>

      <div className={`absolute inset-0 border-2 rounded-xl transition-colors duration-200 ${isHovered ? (isLight ? 'border-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.3)]' : 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]') : (isLight ? 'border-slate-300' : 'border-slate-700')}`} />
    </button>
  );
};

export default JelloButton;
