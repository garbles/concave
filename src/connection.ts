import { BasicLens, prop } from "./basic-lens";
import { keyPathToString } from "./key-path-to-string";
import { Store, StoreFactory } from "./store";
import { Key, Unsubscribe } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type ConnectionState = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

type ConnectionResolution<S> =
  | { status: "loading"; onReady: Promise<unknown>; ready(): void }
  | { status: "resolved"; value: S };

type ConnectionEntry<S> = {
  connect(): void;
  disconnect(): void;
  resolution: ConnectionResolution<S>;
};

type ConnectionCache<S> = {
  [cacheKey: string]: ConnectionEntry<S>;
};

type ValueCache<S> = {
  [cacheKey: string]: S;
};

type InsertConnection<S, A, I> = (
  factory: StoreFactory<S>,
  focus: LensFocus<S, Connection<S, A, I>>,
  input: I
) => ConnectionEntry<A>;

export type Connection<S, A, I> = {
  insert: InsertConnection<S, A, I>;
  cache: ValueCache<A>;
};

const focusProp = <S, A, K extends keyof A>(focus: LensFocus<S, A>, key: K): LensFocus<S, A[K]> => {
  return {
    keyPath: [...focus.keyPath, key],
    lens: prop(focus.lens, key as K),
  };
};

export const connection = <S, A, I>(
  create: (store: Store<A | void>, input: I) => Unsubscribe | void
): Connection<S, A, I> => {
  const cache: ConnectionCache<A> = {};

  const resolveConnection: InsertConnection<S, A, I> = (factory, focus, input) => {
    const cacheKey = `${keyPathToString(focus.keyPath)}(${JSON.stringify(input ?? "")})`;
    const nextFocus = focusProp(focusProp(focus, "cache"), cacheKey);
    const store = factory(nextFocus);

    let conn = cache[cacheKey];

    if (conn) {
      return conn;
    }

    let state: ConnectionState = { connected: false };

    let ready = () => {};

    let onReady = new Promise<void>((res) => {
      ready = res;
    });

    const connect = () => {
      if (state.connected) {
        return;
      }

      const unsubscribe = create(store, input) ?? (() => {});
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

    const resolution: ConnectionResolution<S> = {
      status: "loading",
      get ready() {
        return ready;
      },
      onReady,
    };

    conn = cache[cacheKey] = {
      connect,
      disconnect,
      resolution,
    };

    return conn;
  };

  /**
   * Wrap the real cache to handle suspense.
   */
  const cacheProxy = new Proxy({} as ValueCache<A>, {
    get(_target, key): A {
      const cached = cache[key as string];

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
      const cached = cache[key as string];

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
    insert: resolveConnection,
    cache: cacheProxy,
  };
};
