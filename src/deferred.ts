import { Store } from "./store";
import { Unsubscribe } from "./types";

const IS_DEFFERED = Symbol();

type DeferredObservable = {
  connect(): void;
  disconnect(): void;
};

export type Deferred<S, I> = {
  [IS_DEFFERED]: unknown;
  resolve(store: Store<S | undefined>, input: I): DeferredObservable;
};

export const deferred = <S, I>(fn: (store: Store<S | undefined>, input: I) => Unsubscribe): Deferred<S, I> => {
  type ObservableMap = { [cacheKey: string]: DeferredObservable };
  const cache = new WeakMap<Store<S | undefined>, ObservableMap>();

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

      let connected = false;
      let unsubscribe: Unsubscribe;

      return {
        connect() {
          if (connected) {
            return;
          }

          connected = true;
          unsubscribe = fn(store, input);
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

export function assertIsDeferred<S, I>(obj: any): asserts obj is Deferred<S, I> {
  if (Reflect.has(obj, IS_DEFFERED) && Reflect.has(obj, "resolve") && obj.resolve.length === 2) {
    return;
  }

  throw new Error("Unexpected Error");
}
