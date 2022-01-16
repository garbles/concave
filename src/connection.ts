import { BasicLens } from "./basic-lens";
import { BreakerLike } from "./breaker";
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

type Load<A, I> = (store: Store<A>, input: I) => Unsubscribe | void;
type InsertConnection<A, I> = (store: Store<A>, input: I) => BreakerLike;

const CACHE = Symbol();

type Connectable<A, I = void> = {
  insert: InsertConnection<A, I>;
  [CACHE]: ValueCache<A>;
  enhance<J>(input: I, create: Load<A, J>): Connectable<A, J>;
  // figure this out first
  // with(input: I): Connection<A, void>;
  // // get cache key, pull closure from store, call this func
  // // in order to get input here, deserialize cachekey
  // refine<B>(fn: (input: I) => BasicLens<A, B>): Connection<B, I>;
};

export type Ref<A> = Connection<A, void>;

const serializeInput = <I>(input: I): string => {
  return JSON.stringify(input ?? "");
};

const deserializeCacheKey = (cacheKey: string): unknown => {
  return JSON.parse(cacheKey);
};

export class Connection<A, I = void> {
  #load: Load<A, I>;
  #connectionCache: ConnectionCache<A> = {};

  [CACHE] = new Proxy({} as ValueCache<A>, {
    get: (_target, _key): A => {
      let key = _key as keyof ConnectionCache<A>;

      /**
       * If the value is not in the cache then create an unresolved entry for it.
       * This can happen if we call `getSnapshot()` before the connection has even
       * had a chance to insert an entry for the cache yet.
       */
      let cached = (this.#connectionCache[key] ??= new SuspendedClosure<A>());

      return cached.getSnapshot();
    },

    set: (_target, _key, value) => {
      let key = _key as keyof ConnectionCache<A>;
      let conn = this.#connectionCache[key];

      if (conn === undefined) {
        return false;
      }

      conn.setSnapshot(value);

      return true;
    },
  });

  constructor(load: Load<A, I>) {
    this.#load = load;

    doNotShallowCopy(this[CACHE]);
    doNotShallowCopy(this);
  }

  insert(store: Store<A>, input: I): SuspendedClosure<A> {
    const cacheKey = serializeInput(input);

    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let cls = (this.#connectionCache[cacheKey] ??= new SuspendedClosure<A>());

    cls.load(() => this.#load(store, input) ?? (() => {}));

    return cls;
  }

  enhance<J>(i: I, load: Load<A, J>): Connection<A, J> {
    return new Connection((store, j) => {
      const unsubscribeI = this.#load(store, i) ?? (() => {});
      const unsubscribeJ = load(store, j) ?? (() => {});

      return () => {
        unsubscribeI();
        unsubscribeJ();
      };
    });
  }
}

export const connection = <A, I = void>(
  create: (store: Store<A>, input: I) => Unsubscribe | void
): Connection<A, I> => {
  return new Connection(create);
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

export const isConnection = <A, I>(conn: any): conn is Connection<A, I> => {
  return isObject(conn) && Reflect.has(conn, "insert") && Reflect.has(conn, CACHE);
};
