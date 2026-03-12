
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { GazePoint, AppSettings } from '../types';

interface GazeContextType {
  gazePoint: GazePoint;
  isDwelling: boolean;
  dwellProgress: number;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  registerTarget: (id: string, rect: DOMRect, callback: () => void) => void;
  unregisterTarget: (id: string) => void;
  activeTargetId: string | null;
  startEyeTracking: () => Promise<void>;
  isCalibrating: boolean;
  setIsCalibrating: (val: boolean) => void;
  ambientBrightness: number;
}

const GazeContext = createContext<GazeContextType | undefined>(undefined);

export const useGaze = () => {
  const context = useContext(GazeContext);
  if (!context) throw new Error('useGaze must be used within a GazeProvider');
  return context;
};

declare var webgazer: any;

export const GazeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gazePoint, setGazePoint] = useState<GazePoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [settings, setSettings] = useState<AppSettings>({
    dwellTimeMs: 1200,
    sensitivity: 0.5,
    voice: null,
    enableEyeTracking: false,
    faceLightEnabled: false,
    autoFaceLight: true,
  });

  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [ambientBrightness, setAmbientBrightness] = useState(100);
  
  const targetsRef = useRef<Map<string, { rect: DOMRect; callback: () => void }>>(new Map());
  const dwellStartTimeRef = useRef<number | null>(null);
  const activeTargetIdRef = useRef<string | null>(null);
  const gazePointRef = useRef<GazePoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  // Fix Error: Expected 1 arguments, but got 0. Added null as initial value.
  const animationFrameRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const registerTarget = useCallback((id: string, rect: DOMRect, callback: () => void) => {
    targetsRef.current.set(id, { rect, callback });
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Autonomous Light Detection Logic - Enhanced for Mobile
  useEffect(() => {
    if (!settings.enableEyeTracking || !settings.autoFaceLight) return;

    const interval = setInterval(() => {
      // Find the video element. Mobile browsers sometimes name/nest this differently.
      const video = (document.getElementById('webgazerVideoFeed') || 
                    document.querySelector('video[id^="webgazer"]')) as HTMLVideoElement;
      
      if (!video || video.paused || video.ended) return;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = 10;
        offscreenCanvasRef.current.height = 10;
      }

      const ctx = offscreenCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      try {
        ctx.drawImage(video, 0, 0, 10, 10);
        const imageData = ctx.getImageData(0, 0, 10, 10).data;
        
        let totalLuminance = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          totalLuminance += (0.2126 * r + 0.7152 * g + 0.0722 * b);
        }
        
        const avgBrightness = totalLuminance / (imageData.length / 4);
        const brightnessPercent = (avgBrightness / 255) * 100;
        setAmbientBrightness(brightnessPercent);

        if (brightnessPercent < 20 && !settings.faceLightEnabled) {
          updateSettings({ faceLightEnabled: true });
        } else if (brightnessPercent > 45 && settings.faceLightEnabled) {
          updateSettings({ faceLightEnabled: false });
        }
      } catch (e) {
        // Handle cross-origin canvas errors if they occur
        console.warn("Luminance check failed:", e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [settings.enableEyeTracking, settings.autoFaceLight, settings.faceLightEnabled]);

  const startEyeTracking = async () => {
    if (typeof webgazer === 'undefined') return;

    try {
        await webgazer.setRegression('ridge')
            .setTracker('clmtrackr')
            .setGazeListener((data: any) => {
                if (data == null) return;
                const currentX = gazePointRef.current.x;
                const currentY = gazePointRef.current.y;
                const lerpAmount = 0.25;
                gazePointRef.current = { 
                    x: currentX + (data.x - currentX) * lerpAmount, 
                    y: currentY + (data.y - currentY) * lerpAmount 
                };
                setGazePoint(gazePointRef.current);
            })
            .saveDataAcrossSessions(true)
            .begin();
        
        webgazer.showVideoPreview(true)
                .showPredictionPoints(false)
                .applyKalmanFilter(true);
                
        updateSettings({ enableEyeTracking: true });
        setIsCalibrating(true);
    } catch (e) {
        console.error("Failed to start eye tracking:", e);
    }
  };

  useEffect(() => {
    const handleInput = (x: number, y: number) => {
      if (settings.enableEyeTracking) return;
      gazePointRef.current = { x, y };
      setGazePoint(gazePointRef.current);
    };

    const handleMouseMove = (e: MouseEvent) => handleInput(e.clientX, e.clientY);
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) handleInput(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
    };
  }, [settings.enableEyeTracking]);

  useEffect(() => {
    const loop = (timestamp: number) => {
      const gaze = gazePointRef.current;
      let hitId: string | null = null;

      for (const [id, target] of targetsRef.current.entries()) {
        const { left, right, top, bottom } = target.rect;
        if (gaze.x >= left && gaze.x <= right && gaze.y >= top && gaze.y <= bottom) {
          hitId = id;
          break;
        }
      }

      if (hitId) {
        if (activeTargetIdRef.current !== hitId) {
          activeTargetIdRef.current = hitId;
          setActiveTargetId(hitId);
          dwellStartTimeRef.current = timestamp;
          setDwellProgress(0);
        } else if (dwellStartTimeRef.current !== null) {
          const elapsed = timestamp - dwellStartTimeRef.current;
          const progress = Math.min(elapsed / settings.dwellTimeMs, 1);
          setDwellProgress(progress);

          if (progress >= 1) {
            const target = targetsRef.current.get(hitId);
            if (target) {
              target.callback();
              dwellStartTimeRef.current = null; 
              setDwellProgress(0);
              activeTargetIdRef.current = null;
              setActiveTargetId(null);
            }
          }
        }
      } else {
        activeTargetIdRef.current = null;
        setActiveTargetId(null);
        dwellStartTimeRef.current = null;
        setDwellProgress(0);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [settings.dwellTimeMs]);

  return (
    <GazeContext.Provider value={{
      gazePoint,
      isDwelling: activeTargetId !== null,
      dwellProgress,
      settings,
      updateSettings,
      registerTarget,
      unregisterTarget,
      activeTargetId,
      startEyeTracking,
      isCalibrating,
      setIsCalibrating,
      ambientBrightness
    }}>
      <div className={`${isCalibrating ? 'show-tracker' : ''} ${settings.faceLightEnabled ? 'face-light-mode' : ''} transition-colors duration-1000 min-h-screen`}>
        {children}
      </div>
    </GazeContext.Provider>
  );
};
