import { basicLens, BasicLens } from "./basic-lens";
import { derefConnection, Connection } from "./connection";
import { SubscriptionGraph } from "./subscription-graph";
import { Key, Listener, Unsubscribe, Updater } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

type ParentSubscriptionState = { subscribed: false } | { subscribed: true; unsubscribe: Unsubscribe };

interface GetSnapshot<A> {
  (opts?: { sync: true }): A;
  (opts: { sync: false }): Promise<A>;
}

export type Store<A> = {
  getSnapshot: GetSnapshot<A>;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): Promise<boolean>;
};

export function createStoreFactory<S>(): StoreFactory<S | void>;
export function createStoreFactory<S>(initialState: S): StoreFactory<S>;
export function createStoreFactory<S>(initialState?: S): StoreFactory<S> {
  const subscribers = new SubscriptionGraph();
  let snapshot: S;
  let resolved: boolean;
  let resolve: () => void;
  let onResolved: Promise<void>;

  if (initialState !== undefined) {
    snapshot = initialState;
    resolved = true;
    resolve = () => {};
    onResolved = Promise.resolve();
  } else {
    resolved = false;

    resolve = () => {
      resolved = true;
    };

    onResolved = new Promise<void>((res) => {
      resolve = () => {
        resolved = true;
        res();
        resolve = () => {};
      };

      if (resolved) {
        resolve();
      }
    });
  }

  return ({ keyPath, lens }) => {
    return {
      getSnapshot(opts = { sync: true }) {
        if (opts.sync) {
          if (resolved) {
            return lens.get(snapshot) as any;
          } else {
            throw onResolved;
          }
        }

        return onResolved.then(() => lens.get(snapshot));
      },
      subscribe(listener) {
        return subscribers.subscribe(keyPath, listener);
      },
      async update(updater) {
        const prev = resolved ? lens.get(snapshot) : undefined;
        const next = updater(prev as any);

        if (next === undefined) {
          throw new Error("Store.update cannot return undefined");
        }

        /**
         * If the next value _is_ the previous snapshot then do nothing.
         */
        if (Object.is(next, prev)) {
          return false;
        }

        snapshot = lens.set(snapshot, next);
        resolve();
        subscribers.notify(keyPath);

        return true;
      },
    };
  };
}

export const createConnectionStoreFactory = <S, I>(parent: Store<Connection<S, I>>, input: I): StoreFactory<S> => {
  const factory = createStoreFactory<S>();
  const subscribers = new SubscriptionGraph();
  const root = factory({ keyPath: [], lens: basicLens() });

  /**
   * This is lazy because the underlying data may change on every call to `parent.getSnapshot()`.
   */
  const getConnection = () =>
    parent
      .getSnapshot({ sync: false })
      .then(derefConnection)
      .then((conn) => conn(root, input));

  let parentSubscriptionState: ParentSubscriptionState = { subscribed: false };

  return (focus) => {
    const store = factory(focus);

    return {
      ...store,

      subscribe(listener) {
        if (parentSubscriptionState.subscribed === false) {
          let prev = getConnection();

          const parentUnsubscribe = parent.subscribe(async () => {
            const next = getConnection();

            const [prevConn, nextConn] = await Promise.all([prev, next]);

            if (prevConn !== nextConn) {
              prevConn.disconnect();
              nextConn.connect();
              prev = next;
            }
          });

          parentSubscriptionState = {
            subscribed: true,
            unsubscribe: parentUnsubscribe,
          };
        }

        getConnection().then((conn) => conn.connect());

        const unsubscribe = subscribers.subscribe(focus.keyPath, listener);

        return async () => {
          unsubscribe();

          const conn = await getConnection();

          if (subscribers.size === 0) {
            conn.disconnect();

            if (parentSubscriptionState.subscribed) {
              const parentUnsubscribe = parentSubscriptionState.unsubscribe;
              parentSubscriptionState = { subscribed: false };
              parentUnsubscribe();
            }
          }
        };
      },
    };
  };
};
