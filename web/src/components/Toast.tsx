import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ToastAction {
  label: string;
  run: () => void;
}
type ShowToast = (text: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

interface Msg {
  id: number;
  text: string;
  action?: ToastAction;
}

/** Pill toast at the top of the screen. With an action (Undo) it stays 4.5s, otherwise 1.8s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((text, action) => {
    clearTimeout(timer.current);
    setMsg({ id: ++seq.current, text, action });
    timer.current = setTimeout(() => setMsg(null), action ? 4500 : 1800);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {msg && (
          <div className="toast" key={msg.id}>
            {msg.text}
            {msg.action && (
              <button
                type="button"
                onClick={() => {
                  clearTimeout(timer.current);
                  setMsg(null);
                  msg.action?.run();
                }}
              >
                {msg.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
