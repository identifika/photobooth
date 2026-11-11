import React from "react";

export interface ShapeProps {
  className?: string;
  style?: React.CSSProperties;
}

export function YellowEgg({ className = "w-24 h-24", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Black shoes */}
      <ellipse cx="38" cy="106" rx="10" ry="6" fill="#1C1827" />
      <ellipse cx="64" cy="106" rx="10" ry="6" fill="#1C1827" />

      {/* Main Body - Teardrop / Egg shape */}
      <path
        d="M50 12C32 28 14 55 14 74C14 94 30 104 50 104C70 104 86 94 86 74C86 55 68 28 50 12Z"
        fill="#FFD138"
      />

      {/* Smiling Eyes ^ ^ */}
      <path
        d="M34 52C36 48 42 48 44 52"
        stroke="#1C1827"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M56 52C58 48 64 48 66 52"
        stroke="#1C1827"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Open smiling mouth */}
      <path
        d="M42 62C44 71 56 71 58 62Z"
        fill="#D64821"
      />
    </svg>
  );
}

export function PinkFlower({ className = "w-24 h-24", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 110 115" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Black shoes */}
      <ellipse cx="44" cy="106" rx="9" ry="6" fill="#1C1827" />
      <ellipse cx="68" cy="106" rx="9" ry="6" fill="#1C1827" />

      {/* Flower lobes */}
      <circle cx="55" cy="28" r="19" fill="#FF7BA3" />
      <circle cx="28" cy="52" r="19" fill="#FF7BA3" />
      <circle cx="82" cy="52" r="19" fill="#FF7BA3" />
      <circle cx="36" cy="82" r="19" fill="#FF7BA3" />
      <circle cx="74" cy="82" r="19" fill="#FF7BA3" />
      <circle cx="55" cy="62" r="21" fill="#FF7BA3" />

      {/* Big Eyes */}
      <circle cx="46" cy="62" r="4.5" fill="#1C1827" />
      <circle cx="64" cy="62" r="4.5" fill="#1C1827" />

      {/* Rosy Cheeks */}
      <ellipse cx="38" cy="68" rx="4.5" ry="3" fill="#FF5387" opacity="0.6" />
      <ellipse cx="72" cy="68" rx="4.5" ry="3" fill="#FF5387" opacity="0.6" />

      {/* Cute W-mouth */}
      <path
        d="M51 68C53 71 55 71 55 69C55 71 57 71 59 68"
        stroke="#1C1827"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GreenCircle({ className = "w-20 h-20", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Black shoes */}
      <ellipse cx="33" cy="94" rx="8" ry="5.5" fill="#1C1827" />
      <ellipse cx="57" cy="94" rx="8" ry="5.5" fill="#1C1827" />

      {/* Round Body */}
      <circle cx="45" cy="50" r="40" fill="#2CC872" />

      {/* Surprised / Curious Oval Eyes (o o) */}
      <ellipse cx="36" cy="46" rx="4" ry="6" fill="#1C1827" />
      <ellipse cx="54" cy="46" rx="4" ry="6" fill="#1C1827" />

      {/* Small open 'o' mouth */}
      <ellipse cx="45" cy="62" rx="3.5" ry="4.5" fill="#1C1827" />
    </svg>
  );
}

export function PurpleArch({ className = "w-20 h-24", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 90 110" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Black shoes */}
      <ellipse cx="32" cy="104" rx="8.5" ry="5.5" fill="#1C1827" />
      <ellipse cx="58" cy="104" rx="8.5" ry="5.5" fill="#1C1827" />

      {/* Dome / Arch Body */}
      <path
        d="M15 100V45C15 28 28 15 45 15C62 15 75 28 75 45V100H15Z"
        fill="#A694F5"
      />

      {/* Blinking / Playful Left Wink */}
      <path
        d="M32 50L40 54"
        stroke="#1C1827"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Open Right Eye */}
      <circle cx="58" cy="52" r="4.5" fill="#1C1827" />

      {/* Smirk mouth */}
      <path
        d="M40 68C45 72 54 70 56 65"
        stroke="#1C1827"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OrangeSquare({ className = "w-20 h-20", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Black shoes */}
      <ellipse cx="34" cy="93" rx="8" ry="5.5" fill="#1C1827" />
      <ellipse cx="56" cy="93" rx="8" ry="5.5" fill="#1C1827" />

      {/* Rounded Cube Body */}
      <rect x="15" y="20" width="60" height="72" rx="16" fill="#FF7C36" />

      {/* Relaxed / Cool Eyes (flat lines) */}
      <line x1="30" y1="48" x2="40" y2="48" stroke="#1C1827" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="48" x2="60" y2="48" stroke="#1C1827" strokeWidth="3.5" strokeLinecap="round" />

      {/* Small calm mouth */}
      <line x1="42" y1="58" x2="48" y2="58" stroke="#1C1827" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SparkleStar({ className = "w-4 h-4 text-white", style }: ShapeProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
    </svg>
  );
}
