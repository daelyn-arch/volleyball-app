interface Props {
  serverNumber: number;
}

export default function ServeIndicator({ serverNumber }: Props) {
  return (
    <div className="flex items-center gap-2 text-yellow-400">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="10" r="3" />
      </svg>
      <span className="text-lg font-semibold">Serving: #{serverNumber}</span>
    </div>
  );
}
