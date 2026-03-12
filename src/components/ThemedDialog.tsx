import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  type: 'confirm' | 'alert';
}

interface DialogContextType {
  showConfirm: (title: string, message?: string) => Promise<boolean>;
  showAlert: (title: string, message?: string) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback((title: string, message?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ title, message, type: 'confirm' });
    });
  }, []);

  const showAlert = useCallback((title: string, message?: string) => {
    resolveRef.current = null;
    setDialog({ title, message, type: 'alert' });
  }, []);

  function handleConfirm() {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setDialog(null);
  }

  function handleCancel() {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setDialog(null);
  }

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-600">
            <h3 className="text-lg font-bold text-white mb-2 text-center">{dialog.title}</h3>
            {dialog.message && (
              <p className="text-slate-400 text-sm text-center mb-4">{dialog.message}</p>
            )}
            <div className="flex gap-3 mt-4">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
