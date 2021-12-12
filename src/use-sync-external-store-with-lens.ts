import React from "react";
import { BasicLens, update } from "./basic-lens";
import { ExternalStore } from "./external-store";

const nothing = Symbol();
type Nothing = typeof nothing;
type ShouldUpdate<A> = (prev: A, next: A) => boolean;
type Updater<A> = (a: A) => A;

export const useSyncExternalStoreWithLens = <S, A>(
  store: ExternalStore<S>,
  lens: BasicLens<S, A>,
  shouldUpdate: ShouldUpdate<A> = () => true
) => {
  /**
   * Track the previously resolved state, starting with `Nothing`.
   */
  const prevRef = React.useRef<A | Nothing>(nothing);

  const getSnapshot = () => {
    const prev = prevRef.current;
    const next = lens.get(store.getSnapshot());

    /**
     * If the `prev` is `Nothing` then this is the first render,
     * so just take `next.
     */
    if (prev === nothing) {
      return next;
    }

    /**
     * If we should update then return the `next`.
     */
    if (shouldUpdate(prev, next)) {
      return next;
    }

    /**
     * If the previous condition failed then we should not
     * update so return the previous value.
     */
    return prev;
  };

  const state = React.useSyncExternalStore(store.subscribe, getSnapshot);

  const setState = React.useCallback((updater: Updater<A>) => store.update(update(lens, updater)), [store]);

  /**
   * Assign the current state to the previous state so that when `getSnapshot`
   * is called again it will reference it.
   */
  prevRef.current = state;

  return [state, setState] as const;
};
