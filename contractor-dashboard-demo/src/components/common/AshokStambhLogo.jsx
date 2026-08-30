import React from 'react';
import emblemImg from '../../assets/ashok_stambh.png';

/**
 * State Emblem of India (Ashok Stambh / Lion Capital of Ashoka)
 * Uses the exact official high-resolution emblem image in crisp light theme.
 */
export const AshokStambhLogo = ({ className = 'w-10 h-10', theme = 'light' }) => {
  const isLight = theme === 'light';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 p-1 rounded-xl transition-all ${
        isLight
          ? 'bg-slate-100/90 border border-slate-200/80 shadow-xs'
          : 'bg-slate-800/90 border border-slate-700 shadow-xs'
      } ${className}`}
      title="State Emblem of India"
    >
      <img
        src={emblemImg}
        alt="State Emblem of India (Ashok Stambh)"
        className="w-full h-full object-contain mix-blend-multiply drop-shadow-xs"
      />
    </div>
  );
};
