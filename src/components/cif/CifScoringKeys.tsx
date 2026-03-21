export default function CifScoringKeys() {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1 text-[9px] text-gray-600">
      <div className="font-bold text-gray-500 text-[10px] mb-0.5">SCORING KEY</div>
      <div className="flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#1e40af" strokeWidth="1.5" />
        </svg>
        <span>Served point</span>
      </div>
      <div className="flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="2" y1="12" x2="12" y2="2" stroke="#dc2626" strokeWidth="2" />
        </svg>
        <span>Rally point (sideout)</span>
      </div>
      <div className="flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <polygon points="7,1 1,13 13,13" fill="none" stroke="#0d9488" strokeWidth="1.5" />
        </svg>
        <span>Libero serving</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-purple-600 w-[14px] text-center">S</span>
        <span>Sub (this team)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-purple-600 w-[14px] text-center">Sx</span>
        <span>Sub (opponent)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-orange-600 w-[14px] text-center">T</span>
        <span>Timeout (this team)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-orange-600 w-[14px] text-center">Tx</span>
        <span>Timeout (opponent)</span>
      </div>
    </div>
  );
}
