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

export type FocusedStore<A> = {
  getSnapshot(): A;
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<A>): void;
};

type Store<S> = <A>(focus: LensFocus<S, A>) => FocusedStore<A>;

export const createStore = <S extends {}>(initialState: S): Store<S> => {
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
  };
};