import { BasicLens, prop } from "./basic-lens";
import { keyPathToString } from "./key-path-to-string";
import { doNotShallowCopy } from "./shallow-copy";
import { Store, StoreFactory } from "./store";
import { Key, Unsubscribe } from "./types";

/**
 * Use this unique symbol to make checking for a connection easier. Anything
 * conceivably use `insert` and `cache` as keys, so just check for this non-enumerable unique key instead.
 */
const IS_CONNECTION = Symbol();

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type ConnectionResolution<A> = { status: "unresolved" } | { status: "loading" } | { status: "resolved"; value: A };
type ConnectionActivation = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

class ConnectionCacheEntry<A> {
  resolution: ConnectionResolution<A> = { status: "unresolved" };
  activation: ConnectionActivation = { connected: false };
  create: () => Unsubscribe = () => () => {};

  private onReady: Promise<unknown>;
  private ready: () => void;

  constructor() {
    let ready = () => {};

    this.onReady = new Promise<void>((res) => {
      ready = res;
    });

    this.ready = () => ready();
  }

  get value(): A {
    if (this.resolution.status !== "resolved") {
      throw this.onReady;
    }

    return this.resolution.value;
  }

  set value(value: A) {
    switch (this.resolution.status) {
      case "unresolved": {
        return;
      }

      case "loading": {
        this.resolution = { status: "resolved", value };
        this.ready();

        return;
      }

      case "resolved": {
        this.resolution.value = value;
        return;
      }
    }
  }

  connectToStore(create: () => Unsubscribe) {
    if (this.resolution.status !== "unresolved") {
      return;
    }

    this.create = create;
    this.resolution = { status: "loading" };

    if (this.activation.connected) {
      this.activation = { connected: true, unsubscribe: create() };
    }
  }

  connect() {
    switch (this.resolution.status) {
      case "unresolved": {
        this.activation = { connected: true, unsubscribe: () => {} };
        break;
      }
      case "loading":
      case "resolved": {
        if (this.activation.connected) {
          return;
        }

        this.activation = {
          connected: true,
          unsubscribe: this.create(),
        };

        break;
      }
    }
  }

  disconnect() {
    switch (this.resolution.status) {
      case "unresolved": {
        this.activation = { connected: false };
        break;
      }

      case "loading":
      case "resolved": {
        if (!this.activation.connected) {
          return;
        }

        this.activation.unsubscribe();
        this.activation = { connected: false };
      }
    }
  }
}

type ConnectionCache<A> = {
  [cacheKey: string]: ConnectionCacheEntry<A>;
};

type ValueCache<A> = {
  [cacheKey: string]: A;
};

type InsertConnection<A, I> = (
  factory: StoreFactory<any>,
  focus: LensFocus<any, Connection<A, I>>,
  input: I
) => ConnectionCacheEntry<A>;

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

export const connectionCacheKey = <I>(input: I) => `(${JSON.stringify(input ?? "")})`;

export const connection = <A, I = void>(
  create: (store: Store<A | void>, input: I) => Unsubscribe | void
): Connection<A, I> => {
  const connectionCache: ConnectionCache<A> = {};

  const insert: InsertConnection<A, I> = (factory, focus, input) => {
    const cacheKey = connectionCacheKey(input);
    const nextFocus = focusProp(focusProp(focus, "cache"), cacheKey);
    const store = factory(nextFocus);

    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let conn = (connectionCache[cacheKey] ??= new ConnectionCacheEntry<A>());

    conn.connectToStore(() => create(store, input) ?? (() => {}));

    return conn;
  };

  /**
   * Wrap the real cache to handle suspense.
   */
  const cache = new Proxy({} as ValueCache<A>, {
    has(_target, key) {
      /**
       * Do not copy this object on update because it's a proxy facade around the real data.
       * shallowCopy checks for this key
       */
      if (key === doNotShallowCopy) {
        return true;
      }

      return false;
    },

    get(_target, key): A {
      let cached = connectionCache[key as string];

      /**
       * If the value is not in the cache then create an unresolved entry for it.
       * This can happen if we call `getSnapshot()` before the connection has even
       * had a chance to insert an entry for the cache yet.
       */
      if (!cached) {
        cached = connectionCache[key as string] = new ConnectionCacheEntry<A>();
      }

      return cached.value;
    },

    set(_target, _key, value) {
      let key = _key as keyof ConnectionCache<A>;
      let conn = connectionCache[key];

      if (conn === undefined) {
        return false;
      }

      conn.value = value;
      return true;
    },
  });

  const conn = Object.create({ insert, cache }) as Connection<A, I>;

  Object.defineProperties(conn, {
    [IS_CONNECTION]: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: true,
    },

    [doNotShallowCopy]: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: true,
    },
  });

  return conn;
};

export function assertIsConnection<A, I>(obj: any): asserts obj is Connection<A, I> {
  if (Reflect.has(obj, IS_CONNECTION)) {
    return;
  }

  throw new Error("Expected to resolve a Connection but didn't. This is likely a bug in Concave.");
}
