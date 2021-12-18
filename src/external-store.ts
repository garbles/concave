type Listener = () => void;
type Unsubscribe = () => void;
type Updater<A> = (a: A) => A;

export type ExternalStore<S> = {
  subscribe(onStoreChange: Listener): Unsubscribe;
  getSnapshot(): S;
  update(updater: Updater<S>): void;
};

export const externalStore = <S extends {}>(initialState: S): ExternalStore<S> => {
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

    update(updater) {
      const next = updater(state);

      /**
       * If the next value _is_ the previous one then do nothing.
       */
      if (Object.is(next, state)) {
        return;
      }

      state = next;
      listeners.forEach((fn) => fn());
    },
  };
};
