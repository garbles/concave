import { Store } from "./store";
import { Unsubscribe } from "./types";

const IS_DEFFERED = Symbol();

type DeferredObservable = {
  connect(): void;
  disconnect(): void;
};

type State = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export type Deferred<S, I> = {
  [IS_DEFFERED]: unknown;
  resolve(store: Store<S | void>, input: I): DeferredObservable;
};

export const deferred = <S, I>(fn: (store: Store<S | void>, input: I) => Unsubscribe | void): Deferred<S, I> => {
  type ObservableMap = { [cacheKey: string]: DeferredObservable };
  const cache = new WeakMap<Store<S | void>, ObservableMap>();

  return {
    [IS_DEFFERED]: true,

    resolve(store, input) {
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

      let state: State = { connected: false };

      map[cacheKey] = observable = {
        connect() {
          if (state.connected) {
            return;
          }

          const unsubscribe = fn(store, input) ?? (() => {});

          state = {
            connected: true,
            unsubscribe,
          };
        },

        disconnect() {
          if (!state.connected) {
            return;
          }

          const unsubscribe = state.unsubscribe;

          state = {
            connected: false,
          };

          unsubscribe();
        },
      };

      return observable;
    },
  };
};

export function assertIsDeferred<S, I>(obj: any): asserts obj is Deferred<S, I> {
  if (Reflect.has(obj, IS_DEFFERED) && Reflect.has(obj, "resolve") && obj.resolve.length === 2) {
    return;
  }

  throw new Error("Unexpected Error");
}
