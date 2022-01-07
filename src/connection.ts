import { BasicLens, prop } from "./basic-lens";
import { doNotShallowCopy } from "./shallow-copy";
import { Store } from "./store";
import { Key, Unsubscribe } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type ConnectionResolution<A> = { status: "unresolved" } | { status: "loading" } | { status: "resolved"; value: A };
type ConnectionActivation = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

// GABE rename to SuspendedClosure<A> and move to own module for testing
export class ConnectionCacheEntry<A> {
  private resolution: ConnectionResolution<A> = { status: "unresolved" };
  private activation: ConnectionActivation = { connected: false };
  private create: () => Unsubscribe = () => () => {};
  private onReady: Promise<unknown>;
  private ready: () => void;

  constructor() {
    let ready = () => {};

    this.onReady = new Promise<void>((resolve) => {
      ready = resolve;
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

  /**
   * Connect the entry to the store by passing a create function. Only
   * allow this in transitioning from unresolved to resolved.
   */
  load(create: () => Unsubscribe) {
    if (this.resolution.status !== "unresolved") {
      return;
    }

    this.create = create;
    this.resolution = { status: "loading" };

    /**
     * If the entry was previously unresolved, but connected - via subscribe - then
     * we need to actually call the `create` function
     */
    if (this.activation.connected) {
      this.activation = { connected: true, unsubscribe: create() };
    }
  }

  connect() {
    if (this.activation.connected) {
      return;
    }

    switch (this.resolution.status) {
      case "unresolved": {
        this.activation = {
          connected: true,
          unsubscribe: () => {},
        };

        break;
      }
      case "loading":
      case "resolved": {
        const unsubscribe = this.create();

        this.activation = {
          connected: true,
          unsubscribe,
        };

        break;
      }
    }
  }

  disconnect() {
    if (!this.activation.connected) {
      return;
    }

    this.activation.unsubscribe();

    this.activation = {
      connected: false,
    };
  }
}

type ConnectionCache<A> = {
  [cacheKey: string]: ConnectionCacheEntry<A>;
};

type ValueCache<A> = {
  [cacheKey: string]: A;
};

type InsertConnection<A, I> = (store: Store<A>, input: I, cacheKey: string) => ConnectionCacheEntry<A>;

const INSERT = Symbol();
const CACHE = Symbol();

export type Connection<A, I = void> = {
  [INSERT]: InsertConnection<A, I>;
  [CACHE]: ValueCache<A>;
};

export const connection = <A, I = void>(
  create: (store: Store<A>, input: I) => Unsubscribe | void
): Connection<A, I> => {
  const connectionCache: ConnectionCache<A> = {};

  const stub: ValueCache<A> = Object.create(null);

  Object.defineProperties(stub, {
    [doNotShallowCopy]: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: true,
    },
  });

  /**
   * Wrap the real cache to handle suspense.
   */
  const cache = new Proxy(stub, {
    get(_target, _key): A {
      let key = _key as keyof ConnectionCache<A>;
      /**
       * If the value is not in the cache then create an unresolved entry for it.
       * This can happen if we call `getSnapshot()` before the connection has even
       * had a chance to insert an entry for the cache yet.
       */
      let cached = (connectionCache[key] ??= new ConnectionCacheEntry<A>());

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

  const insert: InsertConnection<A, I> = (store, input, cacheKey) => {
    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let conn = (connectionCache[cacheKey] ??= new ConnectionCacheEntry<A>());

    conn.load(() => create(store, input) ?? (() => {}));

    return conn;
  };

  const conn = Object.create(null);

  Object.defineProperties(conn, {
    [doNotShallowCopy]: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: true,
    },
    [INSERT]: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: insert,
    },
    [CACHE]: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: cache,
    },
  });

  return conn;
};

export const focusToCache = <S, A, I>(focus: LensFocus<S, Connection<A, I>>, cacheKey: string): LensFocus<S, A> => {
  return {
    keyPath: [...focus.keyPath, CACHE, cacheKey],
    lens: prop(prop(focus.lens, CACHE), cacheKey),
  };
};

export const insert = <A, I>(conn: Connection<A, I>, store: Store<A>, input: I, cacheKey: string) => {
  return conn[INSERT](store, input, cacheKey);
};
