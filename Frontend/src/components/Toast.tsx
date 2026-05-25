import { useEffect, useState, useCallback } from "react";

type Toast = {
  id: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
  action?: { label: string; onClick: () => void };
};

let pushExternal: ((t: Omit<Toast, "id">) => void) | null = null;
export function toast(t: Omit<Toast, "id">) {
  pushExternal?.(t);
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setItems((x) => x.filter((t) => t.id !== id)), []);
  useEffect(() => {
    pushExternal = (t) => {
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur.slice(-2), { ...t, id }]);
      setTimeout(() => remove(id), 4000);
    };
    return () => { pushExternal = null; };
  }, [remove]);

  const color = (t: Toast["type"]) =>
    t === "success" ? "border-l-[color:var(--success)]"
    : t === "error" ? "border-l-[color:var(--danger)]"
    : t === "warning" ? "border-l-[color:var(--accent)]"
    : "border-l-[color:var(--primary)]";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 no-print" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`bg-white border border-[color:var(--border)] border-l-4 ${color(t.type)} rounded-lg shadow-lg px-4 py-3 min-w-[280px] max-w-sm flex items-start gap-3 animate-fade-up`}>
          <div className="text-sm flex-1">{t.message}</div>
          {t.action && (
            <button onClick={() => { t.action!.onClick(); remove(t.id); }} className="text-xs font-semibold text-[color:var(--primary)]">
              {t.action.label}
            </button>
          )}
          <button onClick={() => remove(t.id)} aria-label="Dismiss" className="text-[color:var(--muted)] hover:text-[color:var(--ink)]">×</button>
        </div>
      ))}
    </div>
  );
}
