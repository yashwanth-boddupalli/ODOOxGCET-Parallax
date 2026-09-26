import { createContext, useContext, useEffect, useState } from 'react';

// Shared by every page inside the app shell: active warehouse, a refresh signal
// after any change, toasts, and the global modals (Add Product, new operation, details).
export const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside the app layout');
  return ctx;
}

// Loads data and reloads when deps change. Keeps the previous data while reloading
// so tables don't flash empty.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState((s) => ({ data: s.data, error, loading: false })),
    );
    return () => {
      alive = false;
    };
    // The caller lists the real dependencies; the loader itself changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
