import { SubscriptionGraph } from "./subscription-graph";

type Key = string | number | symbol;
type Listener = () => void;
type Unsubscribe = () => void;
type Updater<A> = (a: A) => A;

type Handler<S> = {
  subscribe(onStoreChange: Listener): Unsubscribe;
  update(updater: Updater<S>): void;
};

export type ExternalStore<S> = {
  getSnapshot(): S;
  handle(keyPath: Key[]): Handler<S>;
};

export const externalStore = <S extends {}>(initialState: S): ExternalStore<S> => {
  const graph = new SubscriptionGraph();
  let snapshot = initialState;

  const getSnapshot = () => snapshot;

  /**
   * Closes over a `keyPath` so that its clear—external to those module—that
   * `subscribe` and `update` affect only the same piece of data.
   */
  const handle = (keyPath: Key[]): Handler<S> => {
    return {
      subscribe(listener) {
        return graph.subscribe(keyPath, listener);
      },
      update(updater) {
        const next = updater(snapshot);

        /**
         * If the next value _is_ the previous snapshot then do nothing.
         */
        if (Object.is(next, snapshot)) {
          return;
        }

        snapshot = next;
        graph.notify(keyPath);
      },
    };
  };

  return {
    getSnapshot,
    handle,
  };
};
