import { Awaitable, awaitable } from "./awaitable";
import { Breaker, BreakerLike } from "./breaker";
import { Connection, focusToCacheEntry, isConnection } from "./connection";
import { LensFocus, rootLensFocus } from "./lens-focus";
import { Listener, Unsubscribe } from "./types";

export type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

export type Store<A> = {
  getSnapshot(): A;
  setSnapshot(next: A): boolean;
  subscribe(onStoreChange?: Listener): Unsubscribe;
};

const noop: Listener = () => {};

export const createRootStoreFactory = <S extends {}>(initialState: S): [StoreFactory<S>, LensFocus<S, S>] => {
  const subscriptions = new Set<Unsubscribe>();
  const focus = rootLensFocus<S>();
  let snapshot = initialState;

  const factory: StoreFactory<S> = ({ lens }) => {
    return {
      getSnapshot() {
        return lens.get(snapshot);
      },
      subscribe(listener = noop) {
        subscriptions.add(listener);

        return () => {
          subscriptions.delete(listener);
        };
      },
      setSnapshot(next) {
        snapshot = lens.set(snapshot, next);
        subscriptions.forEach((fn) => fn());
        return true;
      },
    };
  };

  return [factory, focus];
};

let noopBreakable: BreakerLike = { connect() {}, disconnect() {} };

export const createConnectionStoreFactory = <S, A, I>(
  storeFactory: StoreFactory<S>,
  connFocus: LensFocus<S, Connection<A, I>>,
  input: I
): [StoreFactory<S>, LensFocus<S, A>] => {
  const cacheKey = `connection(${JSON.stringify(input ?? {})})`;
  const cacheKeyFocus = focusToCacheEntry(connFocus, input);

  const rootStore = storeFactory(connFocus);
  const cacheEntryStore = storeFactory(cacheKeyFocus);

  const getCacheEntry = awaitable((): Awaitable<BreakerLike> => {
    try {
      const conn = rootStore.getSnapshot();

      if (isConnection<A, I>(conn)) {
        return conn.insert(cacheEntryStore, input);
      } else {
        return noopBreakable;
      }
    } catch (err) {
      if (err instanceof Promise) {
        return err.then(getCacheEntry);
      }

      throw err;
    }
  });

  const breaker = new Breaker(() => {
    let connected = true;
    let prevConn = noopBreakable;

    getCacheEntry().then((conn) => {
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

    const unsubscribe = rootStore.subscribe(() => {
      getCacheEntry().then((nextConn) => {
        /**
         * If the root state is updated and the connection
         * changes, then disconnect the old previous and
         * connect the next.
         */
        if (nextConn !== prevConn) {
          prevConn.disconnect();
          prevConn = nextConn;

          /**
           * In the case that the breaker
           * is disconnected before `getBreakable`
           * is resolved.
           */
          if (connected) {
            nextConn.connect();
          }
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
   * Here we wrap the parent store factory in order to keep track of
   * the number of subscribers in order to enable/disable the above breaker.
   * This will be done at every "level" that a connection exists in the state
   * hierarchy.
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
