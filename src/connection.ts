import { BasicLens, prop } from "./basic-lens";
import { doNotShallowCopy } from "./shallow-copy";
import { Store } from "./store";
import { SuspendedClosure } from "./suspended-closure";
import { Key, Unsubscribe } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type ConnectionCache<A> = {
  [cacheKey: string]: SuspendedClosure<A>;
};

type ValueCache<A> = {
  [cacheKey: string]: A;
};

type InsertConnection<A, I> = (store: Store<A>, input: I, cacheKey: string) => SuspendedClosure<A>;

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
      let cached = (connectionCache[key] ??= new SuspendedClosure<A>());

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
    let conn = (connectionCache[cacheKey] ??= new SuspendedClosure<A>());

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
