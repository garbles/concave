import { basicLens, BasicLens, prop } from "./basic-lens";
import { Connection, ConnectionCacheEntry } from "./connection";
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

  const cacheKeyFocus: LensFocus<S, A> = {
    keyPath: [...connFocus.keyPath, "cache", cacheKey],
    lens: prop(prop(connFocus.lens, "cache"), cacheKey),
  };

  // GABE: need to setup a subscriber on the root store to check when the connection is swapped or removed.

  const getConnection = async (): Promise<ConnectionCacheEntry<A>> => {
    try {
      const connection = root.getSnapshot();
      return connection.insert(storeFactory(cacheKeyFocus), input, cacheKey);
    } catch (err) {
      if (err instanceof Promise) {
        await err;
        return getConnection();
      }

      throw err;
    }
  };

  const connectionStoreFactory: StoreFactory<S> = (refinedFocus) => {
    let listeners = 0;
    const store = storeFactory(refinedFocus);

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

  return [connectionStoreFactory, cacheKeyFocus];
};
