export interface GazePoint {
  x: number;
  y: number;
}

export interface AppSettings {
  dwellTimeMs: number;
  sensitivity: number; // 0.0 to 1.0
  voice: SpeechSynthesisVoice | null;
  enableEyeTracking: boolean; // If false, use mouse simulation
  faceLightEnabled: boolean; // For low-light conditions
  autoFaceLight: boolean; // Autonomous light sensing
}

export enum AppMode {
  KEYBOARD = 'KEYBOARD',
  HOME = 'HOME',
  SETTINGS = 'SETTINGS',
  PHRASES = 'PHRASES'
}

export interface PhraseCategory {
  id: string;
  label: string;
  phrases: string[];
  icon: string; // Lucide icon name
}