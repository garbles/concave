import React from "react";
import type { Store } from "./store";
import { type ShouldUpdate, type ShouldUpdateFunction, shouldUpdateToFunction } from "./should-update";

type Nothing = typeof NOTHING;

const NOTHING = Symbol();
const SHOULD_ALWAYS_UPDATE = () => true;

export const useStore = <A>(store: Store<A>, shouldUpdate: ShouldUpdate<A> = SHOULD_ALWAYS_UPDATE) => {
  /**
   * Track the previously resolved state, starting with `Nothing`.
   */
  const prevStateRef = React.useRef<A | Nothing>(NOTHING);

  /**
   * Track the previously supplied `shouldUpdate` and the resulting function.
   */
  const prevShouldUpdateRef = React.useRef<ShouldUpdate<A>>(shouldUpdate);
  const shouldUpdateFnRef = React.useRef<ShouldUpdateFunction<A> | Nothing>(NOTHING);

  /**
   * If the previous `shouldUpdate` does not match the next one,
   * Remove the function so that it can be re-resolved.
   */
  if (prevShouldUpdateRef.current !== shouldUpdate) {
    shouldUpdateFnRef.current = NOTHING;
  }

  /**
   * Store the current `shouldUpdate` for the next render.
   */
  prevShouldUpdateRef.current = shouldUpdate;

  const getSnapshot = () => {
    const prev = prevStateRef.current;
    const next = store.getSnapshot();

    /**
     * If `prev` _is_ `next` then we should bail because nothing changed.
     */
    if (Object.is(prev, next)) {
      return prev as A;
    }

    /**
     * If the `prev` is `Nothing` then this is the first render,
     * so just take `next.
     */
    if (prev === NOTHING) {
      return next;
    }

    /**
     * If the function is `Nothing`, then this is either the first render
     * or `shouldUpdate` changed so we should rebuild it.
     */
    if (shouldUpdateFnRef.current === NOTHING) {
      shouldUpdateFnRef.current = shouldUpdateToFunction(shouldUpdate);
    }
    const shouldUpdateFn = shouldUpdateFnRef.current;

    /**
     * If we should update then return the `next`, else return `prev`
     */
    if (shouldUpdateFn(prev, next)) {
      return next;
    } else {
      return prev;
    }
  };

  const state = React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  const setState = store.update;

  /**
   * Assign the current state to the previous state so that when `getSnapshot`
   * is called again it will reference it.
   */
  prevStateRef.current = state;

  return [state, setState] as const;
};
