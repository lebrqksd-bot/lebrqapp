type Handler = (payload?: any) => void;

const listeners: Record<string, Set<Handler>> = {};

export const Events = {
  on(event: string, handler: Handler) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(handler);
    return () => {
      listeners[event]?.delete(handler);
    };
  },
  off(event: string, handler: Handler) {
    listeners[event]?.delete(handler);
  },
  emit(event: string, payload?: any) {
    const ls = listeners[event];
    if (!ls) return;
    for (const h of Array.from(ls)) try { h(payload); } catch {}
  },
};
