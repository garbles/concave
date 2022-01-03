import { BasicLens, prop } from "./basic-lens";
import { keyPathToString } from "./key-path-to-string";
import { doNotShallowCopy } from "./shallow-copy";
import { Store, StoreFactory } from "./store";
import { Key, Unsubscribe } from "./types";

const IS_CONNECTION = Symbol();

type Clear = () => void;

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type ConnectionState = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

type ConnectionResolution<A> =
  | { status: "loading"; onReady: Promise<unknown>; ready(): void }
  | { status: "resolved"; value: A };

type ConnectionEntry<A> = {
  connect(): void;
  disconnect(): void;
  resolution: ConnectionResolution<A>;
};

type ConnectionCache<A> = {
  [cacheKey: string]: ConnectionEntry<A>;
};

type ValueCache<A> = {
  [cacheKey: string]: A;
};

type InsertConnection<A, I> = (
  factory: StoreFactory<any>,
  focus: LensFocus<any, Connection<A, I>>,
  input: I
) => ConnectionEntry<A>;

export type Connection<A, I = void> = {
  [IS_CONNECTION]: true;
  insert: InsertConnection<A, I>;
  cache: ValueCache<A>;
};

const focusProp = <S, A, K extends keyof A>(focus: LensFocus<S, A>, key: K): LensFocus<S, A[K]> => {
  return {
    keyPath: [...focus.keyPath, key],
    lens: prop(focus.lens, key as K),
  };
};

export const connection = <A, I>(
  create: (store: Store<A | void>, input: I, clear: Clear) => Unsubscribe | void
): Connection<A, I> => {
  const connectionCache: ConnectionCache<A> = {};

  const insert: InsertConnection<A, I> = (factory, focus, input) => {
    const cacheKey = `${keyPathToString(focus.keyPath)}(${JSON.stringify(input ?? "")})`;
    const nextFocus = focusProp(focusProp(focus, "cache"), cacheKey);
    const store = factory(nextFocus);

    if (cacheKey in connectionCache) {
      return connectionCache[cacheKey];
    }

    let state: ConnectionState = { connected: false };

    const connect = () => {
      if (state.connected) {
        return;
      }

      const unsubscribe = create(store, input, clear) ?? (() => {});
      state = { connected: true, unsubscribe };
    };

    const disconnect = () => {
      if (!state.connected) {
        return;
      }

      const unsubscribe = state.unsubscribe;
      state = { connected: false };
      unsubscribe();
    };

    const clear = () => {
      let ready = () => {};

      let onReady = new Promise<void>((res) => {
        ready = res;
      });

      const resolution: ConnectionResolution<A> = {
        status: "loading",
        get ready() {
          return ready;
        },
        get onReady() {
          return onReady;
        },
      };

      connectionCache[cacheKey] = {
        connect,
        disconnect,
        resolution,
      };
    };

    clear();

    return connectionCache[cacheKey];
  };

  /**
   * Wrap the real cache to handle suspense.
   */
  const cache = new Proxy({} as ValueCache<A>, {
    has(target, key) {
      if (key === doNotShallowCopy) {
        return true;
      }

      return Reflect.has(target, key);
    },

    get(_target, key): A {
      const cached = connectionCache[key as string];

      /**
       * If the value is not cached, then throw an error.
       * Not sure how this would happen outside of someone trying
       * to manually inspect the cache.
       */
      if (!cached) {
        throw new Error("Unexpected Error");
      }

      /**
       * If the cached object is still loading then
       * throw the `onReady` promise.
       */
      if (cached.resolution.status === "loading") {
        throw cached.resolution.onReady;
      }

      /**
       * Otherwise just return the value.
       */
      return cached.resolution.value;
    },

    set(_target, key, value) {
      const cached = connectionCache[key as string];

      /**
       * If the value is not cached then return false.
       */
      if (!cached) {
        return false;
      }

      /**
       * Prep the `ready` callback before transitioning the resolution
       * status to resolved.
       */
      let ready = () => {};

      if (cached.resolution.status === "loading") {
        ready = cached.resolution.ready;
      }

      cached.resolution = { status: "resolved", value };

      /**
       * Call `ready` as suspense may be waiting for the promise to resolve.
       */
      ready();

      return true;
    },
  });

  return {
    [IS_CONNECTION]: true,
    insert,
    cache,
  };
};

export function assertIsConnection<A, I>(obj: any): asserts obj is Connection<A, I> {
  if (Reflect.has(obj, IS_CONNECTION)) {
    return;
  }

  throw new Error("Unexpected Error");
}
