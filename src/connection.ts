import { Store } from "./store";
import { Unsubscribe } from "./types";

const RESOLVE_CONNECTION_TOGGLE = Symbol();

type ConnectionToggle = {
  connect(): void;
  disconnect(): void;
};

type ResolveConnectionToggle<S, I> = (store: Store<S | void>, input: I) => ConnectionToggle;

type State = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export type Connection<S, I> = {
  [RESOLVE_CONNECTION_TOGGLE]: ResolveConnectionToggle<S, I>;
};

function assertIsConnection<S, I>(obj: any): asserts obj is Connection<S, I> {
  if (Reflect.has(obj, RESOLVE_CONNECTION_TOGGLE) && obj[RESOLVE_CONNECTION_TOGGLE].length === 2) {
    return;
  }

  throw new Error("Unexpected Error");
}

export const connection = <S, I>(fn: (store: Store<S | void>, input: I) => Unsubscribe | void): Connection<S, I> => {
  type ToggleMap = { [cacheKey: string]: ConnectionToggle };
  const mapCache = new WeakMap<Store<S | void>, ToggleMap>();

  return {
    [RESOLVE_CONNECTION_TOGGLE](store, input) {
      let map = mapCache.get(store);

      if (!map) {
        map = {};
        mapCache.set(store, map);
      }

      const cacheKey = JSON.stringify(input ?? "");
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
          state = { connected: true, unsubscribe };
        },

        disconnect() {
          if (!state.connected) {
            return;
          }

          const unsubscribe = state.unsubscribe;
          state = { connected: false };
          unsubscribe();
        },
      };

      return observable;
    },
  };
};

export const derefConnection = <S, I>(obj: any): ResolveConnectionToggle<S, I> => {
  assertIsConnection<S, I>(obj);
  return obj[RESOLVE_CONNECTION_TOGGLE];
};
