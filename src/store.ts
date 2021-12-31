import { basicLens, BasicLens } from "./basic-lens";
import { Deferred, DeferredObservable } from "./deferred";
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
  size: number;
};

export const createStoreFactory = <S>(initialState: S): StoreFactory<S> => {
  const subscribers = new SubscriptionGraph();
  let snapshot = initialState;

  return ({ keyPath, lens }) => {
    return {
      getSnapshot(opts = { sync: true }) {
        const value = lens.get(snapshot);

        if (opts.sync) {
          return value as any;
        } else {
          return Promise.resolve(value);
        }
      },
      subscribe(listener) {
        return subscribers.subscribe(keyPath, listener);
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
        subscribers.notify(keyPath);

        return true;
      },
      get size() {
        return subscribers.size;
      },
    };
  };
};

export const createAsyncStoreFactory = <S, I>(parent: Store<Deferred<S, I>>, input: I): StoreFactory<S> => {
  const factory = createStoreFactory<S | undefined>(undefined);
  const root = factory({ keyPath: [], lens: basicLens() });

  function resolve(sync?: false): Promise<DeferredObservable>;
  function resolve(sync: true): DeferredObservable;
  function resolve(sync: boolean = false) {
    if (sync === true) {
      const deferred = parent.getSnapshot({ sync: true });
      return deferred.resolve(root, input);
    } else {
      return parent.getSnapshot({ sync: false }).then((deferred) => deferred.resolve(root, input));
    }
  }

  const subscribers = new SubscriptionGraph();

  return <A>(focus: LensFocus<S | undefined, A>): Store<A> => {
    const store = factory(focus);

    return {
      getSnapshot(opts = { sync: true }) {
        if (opts.sync === true) {
          const observable = resolve(true);
          const latest = root.getSnapshot(opts);

          if (latest === undefined) {
            throw observable.onResolved;
          }

          return store.getSnapshot(opts) as any;
        }

        resolve().then(async (observable) => {
          await observable.onResolved;
          return store.getSnapshot(opts);
        });
      },

      subscribe(listener) {
        const unsubscribe = subscribers.subscribe(focus.keyPath, listener);

        resolve().then((observable) => observable.connect());

        return async () => {
          unsubscribe();

          const observable = await resolve();

          if (subscribers.size === 0) {
            observable.disconnect();
          }
        };
      },

      update(updater) {
        const isChanged = store.update(updater);

        if (isChanged) {
          subscribers.notify(focus.keyPath);
        }

        return isChanged;
      },

      get size() {
        return subscribers.size;
      },
    };
  };
};
