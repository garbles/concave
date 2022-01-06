import { BasicLens } from "./basic-lens";
import { assertIsConnection, Connection, ConnectionCacheEntry } from "./connection";
import { SubscriptionGraph } from "./subscription-graph";
import { Key, Listener, Unsubscribe, Updater } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

export type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

export type Store<A> = {
  getSnapshot(): A;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): Promise<boolean>;
};

export const createStoreFactory = <S extends {}>(initialState: S): StoreFactory<S> => {
  const graph = new SubscriptionGraph();
  let snapshot = initialState;

  return ({ keyPath, lens }) => {
    return {
      getSnapshot() {
        return lens.get(snapshot);
      },
      subscribe(listener) {
        return graph.subscribe(keyPath, listener);
      },
      async update(updater) {
        let prev: any = undefined;

        /**
         * Try to fetch the previous value, but it may not have
         * been set, so let prev stay undefined.
         */
        try {
          prev = lens.get(snapshot);
        } catch (err) {
          if (!(err instanceof Promise)) {
            throw err;
          }
        }

        const next = updater(prev);

        /**
         * If the next value _is_ the previous snapshot then do nothing.
         */
        if (Object.is(next, prev)) {
          return false;
        }

        snapshot = lens.set(snapshot, next);
        graph.notify(keyPath);
        return true;
      },
    };
  };
};

export const createConnectionStoreFactory = <S, A, I>(
  factory: StoreFactory<S>,
  connFocus: LensFocus<S, Connection<A, I>>,
  input: I
): StoreFactory<S> => {
  let listeners = 0;
  const connStore = factory(connFocus);

  /**
   * This is lazy so that we never need to recreate the factory/lens
   * while the underlying data may change.
   */
  const getConnection = async (): Promise<ConnectionCacheEntry<A>> => {
    try {
      const conn = connStore.getSnapshot();
      assertIsConnection<A, I>(conn);
      return conn.insert(factory, connFocus, input);
    } catch (err) {
      if (err instanceof Promise) {
        await err;
        return getConnection();
      }

      throw err;
    }
  };

  return (focus) => {
    const store = factory(focus);

    return {
      ...store,
      subscribe(listener) {
        const unsubscribe = store.subscribe(listener);
        let subscribed = true;
        listeners += 1;

        getConnection().then((conn) => {
          /**
           * Do this in case unsubscription happens before
           * the connection was resolved.
           */
          if (subscribed) {
            conn.connect();
          }

          return conn;
        });

        return async () => {
          unsubscribe();
          subscribed = false;

          const conn = await getConnection();

          listeners = Math.max(listeners - 1, 0);

          if (listeners <= 0) {
            conn.disconnect();
          }
        };
      },
    };
  };
};
