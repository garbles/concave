import { isObject } from "./is-object";
import { LensFocus, refineLensFocus } from "./lens-focus";
import { doNotShallowCopy } from "./shallow-copy";
import { Store } from "./store";
import { SuspendedClosure } from "./suspended-closure";
import { Unsubscribe } from "./types";

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

const cacheStub = doNotShallowCopy({} as ValueCache<any>);

export const connection = <A, I = void>(
  create: (store: Store<A>, input: I) => Unsubscribe | void
): Connection<A, I> => {
  const connectionCache: ConnectionCache<A> = {};
  let cacheRef: ValueCache<A>;

  const proxyHandler: ProxyHandler<ValueCache<A>> = {
    get(_target, _key): A {
      let key = _key as keyof ConnectionCache<A>;

      /**
       * If the value is not in the cache then create an unresolved entry for it.
       * This can happen if we call `getSnapshot()` before the connection has even
       * had a chance to insert an entry for the cache yet.
       */
      let cached = (connectionCache[key] ??= new SuspendedClosure<A>());

      return cached.getSnapshot();
    },

    set(_target, _key, value) {
      let key = _key as keyof ConnectionCache<A>;
      let conn = connectionCache[key];

      if (conn === undefined) {
        return false;
      }

      conn.setSnapshot(value);

      /**
       * When a new value is set on the cache wrap it in a new Proxy
       * so that it busts caching.
       */
      cacheRef = new Proxy(cacheStub, proxyHandler);

      return true;
    },
  };

  cacheRef = new Proxy(cacheStub, proxyHandler);

  const insert: InsertConnection<A, I> = (store, input, cacheKey) => {
    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let conn = (connectionCache[cacheKey] ??= new SuspendedClosure<A>());

    conn.load(() => create(store, input) ?? (() => {}));

    return conn;
  };

  return Object.defineProperties({} as Connection<A, I>, {
    [INSERT]: {
      configurable: true,
      enumerable: true,
      value: insert,
    },
    [CACHE]: {
      configurable: true,
      enumerable: true,
      get() {
        return cacheRef;
      },
    },
  });
};

export const focusToCache = <S, A, I>(focus: LensFocus<S, Connection<A, I>>, cacheKey: string): LensFocus<S, A> =>
  refineLensFocus(focus, [CACHE, cacheKey]);

export const insert = <A, I>(conn: Connection<A, I>, store: Store<A>, input: I, cacheKey: string) => {
  return conn[INSERT](store, input, cacheKey);
};

export const isConnection = <A, I>(conn: any): conn is Connection<A, I> => {
  return isObject(conn) && Reflect.has(conn, INSERT) && Reflect.has(conn, CACHE);
};
