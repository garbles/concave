import { awaitable } from "./awaitable";
import { basicLens, BasicLens } from "./basic-lens";
import { Breakable, Breaker } from "./breaker";
import { Connection, focusToCache, insert, isConnection } from "./connection";
import { SubscriptionGraph } from "./subscription-graph";
import { Key, Listener, Unsubscribe } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

export type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

export type Store<A> = {
  getSnapshot(): A;
  setSnapshot(next: A): boolean;
  subscribe(onStoreChange: Listener): Unsubscribe;
};

export const createRootStoreFactory = <S extends {}>(initialState: S): [StoreFactory<S>, LensFocus<S, S>] => {
  const graph = new SubscriptionGraph();
  let snapshot = initialState;

  const focus: LensFocus<S, S> = {
    keyPath: [],
    lens: basicLens(),
  };

  const factory: StoreFactory<S> = ({ keyPath, lens }) => {
    return {
      getSnapshot() {
        return lens.get(snapshot);
      },
      subscribe(listener) {
        return graph.subscribe(keyPath, listener);
      },
      setSnapshot(next) {
        snapshot = lens.set(snapshot, next);
        graph.notify(keyPath);
        return true;
      },
    };
  };

  return [factory, focus];
};

export const createConnectionStoreFactory = <S, A, I>(
  storeFactory: StoreFactory<S>,
  connFocus: LensFocus<S, Connection<A, I>>,
  input: I
): [StoreFactory<S>, LensFocus<S, A>] => {
  const root = storeFactory(connFocus);
  const cacheKey = `(${JSON.stringify(input)})`;

  const cacheKeyFocus = focusToCache(connFocus, cacheKey);
  let noopBreakable: Breakable = { connect() {}, disconnect() {} };

  const getBreakable = (): PromiseLike<Breakable> => {
    try {
      const conn = root.getSnapshot();
      let breakable = noopBreakable;

      if (isConnection<A, I>(conn)) {
        breakable = insert(conn, storeFactory(cacheKeyFocus), input, cacheKey);
      }

      return awaitable(breakable);
    } catch (err) {
      if (err instanceof Promise) {
        return err.then(getBreakable);
      }

      throw err;
    }
  };

  const breaker = new Breaker(() => {
    let connected = true;
    let prevConn = noopBreakable;

    getBreakable().then((conn) => {
      /**
       * In the case that the breaker
       * is disconnected before `getBreakable`
       * is resolved.
       */
      if (connected) {
        conn.connect();
      }

      prevConn = conn;
    });

    const unsubscribe = root.subscribe(() => {
      getBreakable().then((nextConn) => {
        /**
         * If the root state is updated and the connection
         * changes, then disconnect the old previous and
         * connect the next.
         */
        if (nextConn !== prevConn) {
          prevConn.disconnect();

          /**
           * In the case that the breaker
           * is disconnected before `getBreakable`
           * is resolved.
           */
          if (connected) {
            nextConn.connect();
          }

          prevConn = nextConn;
        }
      });
    });

    return () => {
      connected = false;

      prevConn.disconnect();
      unsubscribe();
    };
  });

  /**
   * Keep track of the number of subscribers in order to enable/disable
   * the above breaker.
   */
  let currentSubscribers = 0;

  const connectionStoreFactory: StoreFactory<S> = (refinedFocus) => {
    const store = storeFactory(refinedFocus);

    return {
      ...store,
      subscribe(listener) {
        const unsubscribe = store.subscribe(listener);

        currentSubscribers += 1;
        breaker.connect();

        return () => {
          unsubscribe();

          currentSubscribers = Math.max(currentSubscribers - 1, 0);

          if (currentSubscribers <= 0) {
            breaker.disconnect();
          }
        };
      },
    };
  };

  return [connectionStoreFactory, cacheKeyFocus];
};
