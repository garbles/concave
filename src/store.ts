import { basicLens, BasicLens } from "./basic-lens";
import { assertIsDeferred, Deferred } from "./deferred";
import { SubscriptionGraph } from "./subscription-graph";
import { Key, Listener, Unsubscribe, Updater } from "./types";

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

interface GetSnapshot<A> {
  (opts?: { sync: true }): A;
  (opts: { sync: false }): Promise<A>;
}

export type Store<A> = {
  getSnapshot: GetSnapshot<A>;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): boolean;
};

export function createStoreFactory<S>(): StoreFactory<S | void>;
export function createStoreFactory<S>(initialState: S): StoreFactory<S>;
export function createStoreFactory<S>(initialState?: S): StoreFactory<S> {
  const subscribers = new SubscriptionGraph();
  let snapshot: S;
  let resolved: boolean;

  if (initialState !== undefined) {
    snapshot = initialState;
    resolved = true;
  } else {
    resolved = false;
  }

  let resolve = () => {
    resolved = true;
  };

  const onResolved = new Promise<void>((res) => {
    resolve = () => {
      resolved = true;
      res();
      resolve = () => {};
    };

    if (resolved) {
      resolve();
    }
  });

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
      update(updater) {
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

export const createDeferredStoreFactory = <S, I>(parent: Store<Deferred<S, I>>, input: I): StoreFactory<S> => {
  const factory = createStoreFactory<S>();
  const subscribers = new SubscriptionGraph();
  const root = factory({ keyPath: [], lens: basicLens() });

  root.subscribe(() => subscribers.notify([]));

  /**
   * This is lazy because the underlying data may change.
   */
  const getObservable = () =>
    parent.getSnapshot({ sync: false }).then((deferred) => {
      assertIsDeferred<S, I>(deferred);
      return deferred.resolve(root, input);
    });

  return (focus) => {
    const store = factory(focus);

    return {
      ...store,

      subscribe(listener) {
        const unsubscribe = subscribers.subscribe(focus.keyPath, listener);

        getObservable().then((observable) => observable.connect());

        return async () => {
          unsubscribe();

          const observable = await getObservable();

          if (subscribers.size === 0) {
            observable.disconnect();
          }
        };
      },
    };
  };
};
