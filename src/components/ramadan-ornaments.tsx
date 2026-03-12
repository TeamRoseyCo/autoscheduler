"use client";

/** Small hanging lantern SVG for decoration */
export function MiniLantern({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 30 60" className={className} style={style} fill="none">
      <line x1="15" y1="0" x2="15" y2="12" stroke="#c9a84c" strokeWidth="1" />
      <circle cx="15" cy="6" r="1" fill="#c9a84c" />
      <path d="M11 12 L19 12 L18 15 L12 15 Z" fill="#c9a84c" />
      <path
        d="M12 15 Q9 25 9 32 Q9 40 12 42 L18 42 Q21 40 21 32 Q21 25 18 15 Z"
        fill="url(#miniGlow)"
        stroke="#c9a84c"
        strokeWidth="0.8"
      />
      <path d="M10 22 Q15 21 20 22" stroke="#c9a84c" strokeWidth="0.5" fill="none" />
      <path d="M9.5 30 Q15 29 20.5 30" stroke="#c9a84c" strokeWidth="0.5" fill="none" />
      <path d="M10 37 Q15 36 20 37" stroke="#c9a84c" strokeWidth="0.5" fill="none" />
      <path d="M12 42 L18 42 L17 46 L13 46 Z" fill="#c9a84c" />
      <defs>
        <radialGradient id="miniGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.25" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Crescent + star decoration */
export function CrescentStar({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill="currentColor"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M18 2l.5 1.5L20 4l-1.5.5L18 6l-.5-1.5L16 4l1.5-.5L18 2z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

/** Toolbar ornaments — lanterns hanging from top + golden accent */
export function RamadanToolbarOrnaments() {
  return (
    <>
      {/* Left lantern */}
      <div className="absolute top-0 left-[120px] w-4 opacity-50 animate-pulse pointer-events-none z-20" style={{ animationDuration: "3.5s" }}>
        <MiniLantern className="w-full h-auto" />
      </div>
      {/* Right lantern */}
      <div className="absolute top-0 right-[200px] w-3.5 opacity-40 animate-pulse pointer-events-none z-20" style={{ animationDuration: "4.5s", animationDelay: "1.5s" }}>
        <MiniLantern className="w-full h-auto" />
      </div>
      {/* Golden top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none z-20" />
    </>
  );
}

/** Sidebar ornaments — small crescent at bottom */
export function RamadanSidebarOrnaments() {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none">
      <CrescentStar className="text-amber-400 w-5 h-5" />
    </div>
  );
}

/** Column header crescent for day columns */
export function RamadanColumnAccent() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />
  );
}
