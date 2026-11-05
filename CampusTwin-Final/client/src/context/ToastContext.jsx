import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext({ toast: () => {} });
let nextId = 1;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, kind = "success") => {
    const id = nextId++;
    setItems((list) => [...list, { id, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  const colors = { success: "bg-ok", error: "bg-bad", info: "bg-sel" };
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[3000] flex flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${colors[t.kind] || colors.info} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-sm`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
