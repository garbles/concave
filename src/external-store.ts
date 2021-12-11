type Listener = () => void;
type Unsubscribe = () => void;

export type ExternalStore<S> = {
  subscribe(onStoreChange: Listener): Unsubscribe;
  getSnapshot(): S;
  apply(setter: (state: S) => S): void;
};

export const externalStore = <S>(initialState: S): ExternalStore<S> => {
  const listeners = new Set<Listener>();
  let state = initialState;

  return {
    subscribe(sub) {
      listeners.add(sub);
      return () => listeners.delete(sub);
    },

    getSnapshot() {
      return state;
    },

    apply(set) {
      state = set(state);
      listeners.forEach((fn) => fn());
    },
  };
};
