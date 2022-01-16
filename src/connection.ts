import { isObject } from "./is-object";
import { LensFocus, refineLensFocus } from "./lens-focus";
import { doNotShallowCopy } from "./shallow-copy";
import type { Store } from "./store";
import { SuspendedClosure } from "./suspended-closure";
import type { Unsubscribe } from "./types";

type ConnectionCache<A> = { [cacheKey: string]: SuspendedClosure<A> };
type ValueCache<A> = { [cacheKey: string]: A };
type Load<A, I> = (store: Store<A>, input: I) => Unsubscribe | void;

const VALUE_CACHE = Symbol();

const serializeInput = <I>(input: I): string => {
  return JSON.stringify(input ?? "");
};

const deserializeCacheKey = (cacheKey: string): unknown => {
  return JSON.parse(cacheKey);
};

export class Connection<A, I = void> {
  #load: Load<A, I>;
  #cache: ConnectionCache<A> = {};

  [VALUE_CACHE] = new Proxy({} as ValueCache<A>, {
    get: (_target, _key): A => {
      let key = _key as keyof ConnectionCache<A>;

      /**
       * If the value is not in the cache then create an unresolved entry for it.
       * This can happen if we call `getSnapshot()` before the connection has even
       * had a chance to insert an entry for the cache yet.
       */
      let cached = (this.#cache[key] ??= new SuspendedClosure<A>());

      return cached.getSnapshot();
    },

    set: (_target, _key, value) => {
      let key = _key as keyof ConnectionCache<A>;
      let conn = this.#cache[key];

      if (conn === undefined) {
        return false;
      }

      conn.setSnapshot(value);

      return true;
    },
  });

  constructor(load: Load<A, I>) {
    this.#load = load;

    doNotShallowCopy(this[VALUE_CACHE]);
    doNotShallowCopy(this);
  }

  insert(store: Store<A>, input: I): SuspendedClosure<A> {
    const cacheKey = serializeInput(input);

    /**
     * It can be that the cache entry was previously created by trying to
     * access the cache because the code had been loaded.
     */
    let cls = (this.#cache[cacheKey] ??= new SuspendedClosure<A>());

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

export const focusToCacheEntry = <S, A, I>(focus: LensFocus<S, Connection<A, I>>, input: I): LensFocus<S, A> => {
  const cacheKey = serializeInput(input);
  return refineLensFocus(focus, [VALUE_CACHE, cacheKey]);
};

export const isConnection = <A, I>(conn: any): conn is Connection<A, I> => {
  return isObject(conn) && Reflect.has(conn, "insert") && Reflect.has(conn, VALUE_CACHE);
};
