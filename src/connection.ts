import { Store } from "./store";
import { Unsubscribe } from "./types";

const IS_CONNECTION = Symbol();

type ConnectionToggle = {
  connect(): void;
  disconnect(): void;
};

type State = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export type Connection<S, I> = {
  [IS_CONNECTION]: unknown;
  resolve(store: Store<S | void>, input: I): ConnectionToggle;
};

export const connection = <S, I>(fn: (store: Store<S | void>, input: I) => Unsubscribe | void): Connection<S, I> => {
  type ConnectionMap = { [cacheKey: string]: ConnectionToggle };
  const mapCache = new WeakMap<Store<S | void>, ConnectionMap>();

  return {
    [IS_CONNECTION]: true,

    resolve(store, input) {
      let map = mapCache.get(store);

      if (!map) {
        map = {};
        mapCache.set(store, map);
      }

      const cacheKey = JSON.stringify(input);
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

export function assertIsConnection<S, I>(obj: any): asserts obj is Connection<S, I> {
  if (Reflect.has(obj, IS_CONNECTION) && Reflect.has(obj, "resolve") && obj.resolve.length === 2) {
    return;
  }

  throw new Error("Unexpected Error");
}
