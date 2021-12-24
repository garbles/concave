import { BasicLens } from "./basic-lens";
import { SubscriptionGraph } from "./subscription-graph";

type Key = string | number | symbol;
type Listener = () => void;
type Unsubscribe = () => void;
type Updater<A> = (a: A) => A;

type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

export type Store<A> = {
  getSnapshot(): A;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): void;
};

type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

export const createStoreFactory = <S extends {}>(initialState: S): StoreFactory<S> => {
  const graph = new SubscriptionGraph();
  const cache = new WeakMap<LensFocus<{}, any>, Store<any>>();
  let snapshot = initialState;

  return (focus) => {
    let cached = cache.get(focus);

    if (cached) {
      return cached;
    }

    const { keyPath, lens } = focus;

    cached = {
      getSnapshot() {
        return lens.get(snapshot);
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
          return;
        }

        snapshot = lens.set(snapshot, next);
        graph.notify(keyPath);
      },
    };

    cache.set(focus, cached);

    return cached;
  };
};
