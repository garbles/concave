import { basicLens, BasicLens } from "./basic-lens";
import { Connection, focusToCache, insert } from "./connection";
import { SubscriptionGraph } from "./subscription-graph";
import { SuspendedClosure } from "./suspended-closure";
import { Key, Listener, Unsubscribe } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type RootActivation = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

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

  const getConnection = async (): Promise<SuspendedClosure<A>> => {
    try {
      const conn = root.getSnapshot();
      return insert(conn, storeFactory(cacheKeyFocus), input, cacheKey);
    } catch (err) {
      if (err instanceof Promise) {
        await err;
        return getConnection();
      }

      throw err;
    }
  };

  let rootSubscription: RootActivation = { connected: false };

  const connectToRoot = () => {
    if (rootSubscription.connected) {
      return;
    }

    let nullConn = { connect() {}, disconnect() {} };
    let prevConn = nullConn;

    const unsubscribe = root.subscribe(async () => {
      const nextConn = await getConnection();

      if (nextConn !== prevConn) {
        prevConn.disconnect();
      }

      if (nextConn instanceof SuspendedClosure) {
        nextConn.connect();
        prevConn = nextConn;
      } else {
        prevConn = nullConn;
      }
    });

    rootSubscription = { connected: true, unsubscribe };
  };

  const disconnectFromRoot = () => {
    if (!rootSubscription.connected) {
      return;
    }

    rootSubscription.unsubscribe();
    rootSubscription = { connected: false };
  };

  // GABE in subscribe below we need subscribeToRoot and unsubscribeFromRoot

  const connectionStoreFactory: StoreFactory<S> = (refinedFocus) => {
    let listeners = 0;
    const store = storeFactory(refinedFocus);

    return {
      ...store,
      subscribe(listener) {
        const unsubscribe = store.subscribe(listener);
        let subscribed = true;
        listeners += 1;

        connectToRoot();

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
            disconnectFromRoot();
          }
        };
      },
    };
  };

  return [connectionStoreFactory, cacheKeyFocus];
};
