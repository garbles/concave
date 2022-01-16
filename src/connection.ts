import { BasicLens } from "./basic-lens";
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

type InsertConnection<A, I> = (store: Store<A>, input: I) => SuspendedClosure<A>;

const INSERT = Symbol();
const CACHE = Symbol();

export type Connection<A, I = void> = {
  [INSERT]: InsertConnection<A, I>;
  [CACHE]: ValueCache<A>;
  // figure this out first
  with(input: I): Connection<A, void>;
  // get cache key, pull closure from store, call this func
  extend<J>(input: I, create: (store: Store<A>, input: J) => Unsubscribe | void): Connection<A, J>;
  // in order to get input here, deserialize cachekey
  refine<B>(fn: (input: I) => BasicLens<A, B>): Connection<B, I>;
};

export type Ref<A> = Connection<A, void>;

const serializeInput = <I>(input: I): string => {
  return JSON.stringify(input ?? "");
};

const deserializeCacheKey = (cacheKey: string): unknown => {
  return JSON.parse(cacheKey);
};

export const connection = <A, I = void>(
  create: (store: Store<A>, input: I) => Unsubscribe | void
): Connection<A, I> => {
  const connectionCache: ConnectionCache<A> = {};
  let cacheRef: ValueCache<A>;

  const handler: ProxyHandler<ValueCache<A>> = {
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
      cacheRef = new Proxy({}, handler);
      doNotShallowCopy(cacheRef);

      return true;
    },
  };

  cacheRef = new Proxy({}, handler);
  doNotShallowCopy(cacheRef);

  const insert: InsertConnection<A, I> = (store, input) => {
    const cacheKey = serializeInput(input);

    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let cls = (connectionCache[cacheKey] ??= new SuspendedClosure<A>());

    cls.load(() => create(store, input) ?? (() => {}));

    return cls;
  };

  const conn = {} as Connection<A, I>;

  return Object.defineProperties(conn, {
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

export const ref = <A>(initialState: A): Ref<A> => {
  let initialized = false;

  return connection<A>((store) => {
    if (!initialized) {
      store.setSnapshot(initialState);
      initialized = true;
    }
  });
};

export const focusToCacheEntry = <S, A, I>(focus: LensFocus<S, Connection<A, I>>, input: I): LensFocus<S, A> => {
  const cacheKey = serializeInput(input);
  return refineLensFocus(focus, [CACHE, cacheKey]);
};

export const insert = <A, I>(conn: Connection<A, I>, store: Store<A>, input: I) => {
  return conn[INSERT](store, input);
};

export const isConnection = <A, I>(conn: any): conn is Connection<A, I> => {
  return isObject(conn) && Reflect.has(conn, INSERT) && Reflect.has(conn, CACHE);
};
