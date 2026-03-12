import React from 'react';
import JelloButton from './JelloButton';
import { useGaze } from '../contexts/GazeContext';
import { Delete, Space } from 'lucide-react';

interface KeyboardProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  onSpace: () => void;
}

const QWERTY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress, onDelete, onSpace }) => {
  const { settings } = useGaze();
  const isLight = settings.faceLightEnabled;

  return (
    <div className={`flex flex-col gap-1 sm:gap-2 w-full max-w-4xl mx-auto p-2 sm:p-4 rounded-3xl backdrop-blur-md border transition-colors duration-500 ${isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-slate-800/40 border-slate-700/50'}`}>
      {QWERTY_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-2 w-full">
          {row.map((char) => (
            <JelloButton
              key={char}
              id={`key-${char}`}
              onClick={() => onKeyPress(char)}
              className={`flex-1 max-w-[60px] h-12 sm:h-16 rounded-lg sm:rounded-xl text-lg sm:text-2xl font-bold shadow-lg transition-colors ${isLight ? 'bg-white hover:bg-slate-50' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {char}
            </JelloButton>
          ))}
        </div>
      ))}
      
      <div className="flex justify-center gap-2 mt-2">
        <JelloButton
          id="key-space"
          onClick={onSpace}
          className={`flex-grow max-w-[280px] h-12 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg transition-colors ${isLight ? 'bg-white hover:bg-slate-50' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          <Space size={20} className="sm:w-8 sm:h-8" />
          <span className="ml-2 text-sm sm:text-lg font-medium">SPACE</span>
        </JelloButton>

        <JelloButton
          id="key-backspace"
          onClick={onDelete}
          className={`w-16 sm:w-24 h-12 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg transition-colors ${isLight ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-red-900/30 border border-red-800/50 text-red-200'}`}
        >
          <Delete size={20} className="sm:w-8 sm:h-8" />
        </JelloButton>
      </div>
    </div>
  );
};

export default Keyboard;