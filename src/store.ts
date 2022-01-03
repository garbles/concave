import { BasicLens } from "./basic-lens";
import { assertIsConnection, Connection } from "./connection";
import { SubscriptionGraph } from "./subscription-graph";
import { Key, Listener, Unsubscribe, Updater } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

export type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

interface GetSnapshot<A> {
  (opts?: { sync: true }): A;
  (opts: { sync: false }): Promise<A>;
}

export type Store<A> = {
  getSnapshot: GetSnapshot<A>;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): boolean;
};

export const createStoreFactory = <S extends {}>(initialState: S): StoreFactory<S> => {
  const graph = new SubscriptionGraph();
  let snapshot = initialState;

  return ({ keyPath, lens }) => {
    return {
      getSnapshot(opts = { sync: true }) {
        if (opts.sync) {
          return lens.get(snapshot);
        }

        try {
          return lens.get(snapshot);
        } catch (obj) {
          if (obj instanceof Promise) {
            return obj as any;
          }

          throw obj;
        }
      },
      subscribe(listener) {
        return graph.subscribe(keyPath, listener);
      },
      update(updater) {
        const prev = lens.get(snapshot);
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
  const getConnection = async () => {
    const conn = await connStore.getSnapshot({ sync: false });
    assertIsConnection<A, I>(conn);
    return conn.insert(factory, connFocus, input);
  };

  return (focus) => {
    const store = factory(focus);

    return {
      ...store,
      subscribe(listener) {
        const unsubscribe = store.subscribe(listener);
        listeners += 1;

        getConnection().then((conn) => conn.connect());

        return async () => {
          unsubscribe();

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
