import React from 'react';

interface GrowthVisualProps {
  stage: number; // 0, 1, 2, 3
  isDarkMode: boolean;
}

export const FlowerGrowth: React.FC<GrowthVisualProps> = ({ stage }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full animate-sway origin-bottom">
      {/* Soil */}
      <ellipse cx="50" cy="85" rx="20" ry="5" fill="#3f2b2b" opacity="0.3" />
      
      {/* Stem */}
      <path 
        d={stage === 0 ? "M50 85 Q50 80 50 78" : "M50 85 Q50 60 50 40"} 
        stroke="#4ade80" 
        strokeWidth={stage > 1 ? "4" : "2"} 
        fill="none" 
        className="transition-all duration-1000"
      />

      {/* Leaves */}
      {stage >= 1 && (
        <>
          <path d="M50 70 Q40 60 35 65" stroke="#22c55e" strokeWidth="2" fill="#4ade80" className="animate-sway-delayed origin-right" />
          {stage >= 2 && <path d="M50 60 Q60 50 65 55" stroke="#22c55e" strokeWidth="2" fill="#4ade80" className="animate-sway origin-left" />}
        </>
      )}

      {/* Bloom */}
      {stage === 2 && (
        <circle cx="50" cy="40" r="6" fill="#f472b6" className="animate-pulse" />
      )}
      
      {stage >= 3 && (
        <g className="animate-float">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <path 
              key={i}
              d="M50 40 Q50 20 65 25 Q70 40 50 40" 
              fill="#f472b6" 
              stroke="#db2777"
              strokeWidth="0.5"
              transform={`rotate(${angle} 50 40)`}
              className="transition-all duration-1000"
            />
          ))}
          <circle cx="50" cy="40" r="5" fill="#fbbf24" />
        </g>
      )}
    </svg>
  );
};

export const TreeGrowth: React.FC<GrowthVisualProps> = ({ stage }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full origin-bottom">
      {/* Trunk */}
      <path 
        d={stage === 0 ? "M50 85 L50 80" : stage === 1 ? "M50 85 L50 70" : stage === 2 ? "M50 85 Q50 60 45 45" : "M50 85 Q50 50 40 30"} 
        stroke="#78350f" 
        strokeWidth={stage === 0 ? "2" : stage === 1 ? "4" : stage === 2 ? "6" : "8"} 
        fill="none" 
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
      
      {/* Branches & Leaves */}
      {stage >= 1 && (
        <g className="animate-sway">
          <circle cx="50" cy={stage === 1 ? 65 : 45} r={stage === 1 ? 8 : 12} fill="#22c55e" opacity="0.8" />
          {stage >= 2 && (
            <>
              <circle cx="35" cy="40" r="10" fill="#16a34a" opacity="0.8" />
              <circle cx="60" cy="35" r="11" fill="#15803d" opacity="0.8" />
            </>
          )}
          {stage >= 3 && (
            <g className="animate-sway-delayed">
              <circle cx="50" cy="20" r="15" fill="#4ade80" opacity="0.6" />
              <circle cx="30" cy="25" r="12" fill="#22c55e" opacity="0.6" />
              <circle cx="70" cy="25" r="13" fill="#16a34a" opacity="0.6" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
};

export const BirdGrowth: React.FC<GrowthVisualProps> = ({ stage }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full animate-float">
      {/* Egg / Body */}
      <ellipse 
        cx="50" cy="60" 
        rx={stage === 0 ? 12 : stage === 1 ? 15 : 18} 
        ry={stage === 0 ? 15 : stage === 1 ? 18 : 22} 
        fill={stage === 0 ? "#f1f5f9" : "#60a5fa"} 
        stroke={stage === 0 ? "#cbd5e1" : "#2563eb"}
        strokeWidth="1"
        className="transition-all duration-1000"
      />

      {/* Cracks for Egg */}
      {stage === 0 && (
        <path d="M45 55 L50 65 L55 58" stroke="#cbd5e1" fill="none" />
      )}

      {/* Bird Features */}
      {stage >= 1 && (
        <g className="transition-opacity duration-1000">
          <circle cx="50" cy="45" r={stage > 1 ? 10 : 8} fill="#60a5fa" />
          <circle cx="47" cy="43" r="1.5" fill="black" />
          <circle cx="53" cy="43" r="1.5" fill="black" />
          <path d="M50 48 L48 52 L52 52 Z" fill="#fbbf24" />
        </g>
      )}

      {/* Wings */}
      {stage >= 2 && (
        <g className={stage >= 3 ? "animate-flap" : "animate-sway"}>
          <path d="M35 60 Q20 50 25 70" fill="#3b82f6" opacity="0.9" />
          <path d="M65 60 Q80 50 75 70" fill="#3b82f6" opacity="0.9" />
        </g>
      )}
    </svg>
  );
};

export const BabyGrowth: React.FC<GrowthVisualProps> = ({ stage }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full origin-bottom">
      {/* Stage 0: Newborn */}
      {stage === 0 && (
        <g className="animate-sway origin-bottom">
          <circle cx="50" cy="70" r="15" fill="#ffedd5" stroke="#f97316" strokeWidth="1" />
          <path d="M42 65 Q50 60 58 65" stroke="#f97316" fill="none" />
          <circle cx="45" cy="70" r="1.5" fill="#1e293b" />
          <circle cx="55" cy="70" r="1.5" fill="#1e293b" />
          <path d="M50 75 L48 80 L52 80 Z" fill="#f97316" /> {/* Pacifier */}
          <path d="M40 58 Q50 45 60 58" fill="#7dd3fc" /> {/* Baby cap */}
        </g>
      )}

      {/* Stage 1: Child */}
      {stage === 1 && (
        <g className="animate-float origin-bottom">
          <circle cx="50" cy="40" r="12" fill="#ffedd5" stroke="#f97316" strokeWidth="1" />
          <rect x="42" y="52" width="16" height="25" rx="4" fill="#fbbf24" />
          <rect x="44" y="77" width="4" height="10" fill="#ffedd5" />
          <rect x="52" y="77" width="4" height="10" fill="#ffedd5" />
          <path d="M45 35 A2 2 0 1 1 45.1 35" fill="#1e293b" />
          <path d="M55 35 A2 2 0 1 1 55.1 35" fill="#1e293b" />
          <path d="M46 45 Q50 48 54 45" stroke="#f97316" fill="none" />
        </g>
      )}

      {/* Stage 2: Adult */}
      {stage === 2 && (
        <g className="animate-float origin-bottom">
          <circle cx="50" cy="25" r="10" fill="#ffedd5" stroke="#f97316" strokeWidth="1" />
          <rect x="40" y="35" width="20" height="45" rx="2" fill="#1e293b" />
          <rect x="42" y="80" width="6" height="15" fill="#1e293b" />
          <rect x="52" y="80" width="6" height="15" fill="#1e293b" />
          <path d="M40 38 L30 55" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
          <path d="M60 38 L70 55" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}

      {/* Stage 3: Elderly */}
      {stage === 3 && (
        <g className="animate-sway origin-bottom">
          <circle cx="50" cy="35" r="9" fill="#ffedd5" stroke="#f97316" strokeWidth="1" />
          <path d="M41 35 Q50 25 59 35" fill="none" stroke="#e2e8f0" strokeWidth="4" /> {/* Gray hair */}
          <rect x="42" y="44" width="16" height="38" rx="1" fill="#475569" />
          <path d="M35 85 L35 55" stroke="#78350f" strokeWidth="3" strokeLinecap="round" /> {/* Cane */}
          <rect x="44" y="82" width="4" height="10" fill="#ffedd5" />
          <rect x="52" y="82" width="4" height="10" fill="#ffedd5" />
        </g>
      )}
    </svg>
  );
};
