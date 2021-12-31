import { Store } from "./store";
import { Unsubscribe } from "./types";

export type DeferredObservable = {
  resolved: boolean;
  onResolved: Promise<unknown>;
  connect(): void;
  disconnect(): void;
};

export type Deferred<S, I> = {
  resolve(store: Store<S | undefined>, input: I): DeferredObservable;
};

export const deferred = <S, I>(fn: (store: Store<S | undefined>, input: I) => Unsubscribe): Deferred<S, I> => {
  type ObservableMap = { [cacheKey: string]: DeferredObservable };
  const cache = new WeakMap<Store<S | undefined>, ObservableMap>();

  return {
    resolve(store: Store<S | undefined>, input: I): DeferredObservable {
      const cacheKey = JSON.stringify(input);
      let map = cache.get(store);

      if (!map) {
        map = {};
        cache.set(store, map);
      }

      let observable = map[cacheKey];

      if (observable) {
        return observable;
      }

      let connected = false;
      let resolved = false;
      let unsubscribe: Unsubscribe;

      let resolve = () => {
        resolved = true;
      };

      const onResolved = new Promise<void>((res) => {
        resolve = () => {
          resolved = true;
          res();
        };

        if (resolved) {
          resolve();
        }
      });

      const wrapper: Store<S | undefined> = {
        ...store,
        update(updater) {
          resolve();
          return store.update(updater);
        },
      };

      return {
        get resolved() {
          return resolved;
        },

        get onResolved() {
          return onResolved;
        },

        connect() {
          if (connected) {
            return;
          }

          connected = true;
          unsubscribe = fn(wrapper, input);
        },

        disconnect() {
          if (!connected) {
            return;
          }

          connected = false;
          unsubscribe();
        },
      };
    },
  };
};
