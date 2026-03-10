interface Props {
  onUndo: () => void;
  disabled: boolean;
}

export default function UndoButton({ onUndo, disabled }: Props) {
  function handleClick() {
    if (confirm('Undo last action?')) {
      onUndo();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
    >
      Undo
    </button>
  );
}
