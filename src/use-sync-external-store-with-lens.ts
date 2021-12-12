import React from "react";
import { BasicLens } from "./basic-lens";
import { ExternalStore } from "./external-store";

const nothing = Symbol();
type Nothing = typeof nothing;
type ShouldUpdate<A> = (prev: A, next: A) => boolean;

export const useSyncExternalStoreWithLens = <S, A>(
  store: ExternalStore<S>,
  lens: BasicLens<S, A>,
  shouldUpdate?: ShouldUpdate<A>
) => {
  /**
   * Track the previously resolved state, starting with `Nothing`.
   */
  const prevRef = React.useRef<A | Nothing>(nothing);

  /**
   *
   */
  const shouldUpdateRef = React.useRef<ShouldUpdate<A>>();
  shouldUpdateRef.current = shouldUpdate;

  const getSnapshot = React.useCallback(() => {
    const _shouldUpdate = shouldUpdateRef.current ?? (() => true);
    const prev = prevRef.current;
    const next = lens.get(store.getSnapshot());

    if (prev === nothing || _shouldUpdate(prev, next)) {
      return next;
    } else {
      return prev;
    }
  }, [store, lens]);

  const state = React.useSyncExternalStore(store.subscribe, getSnapshot);

  const setState = React.useCallback(
    (fn: (a: A) => A) => store.apply((s) => lens.set(s, fn(lens.get(store.getSnapshot())))),
    [store]
  );

  /**
   * Assign the current state to the previous state so that when `getSnapshot`
   * is called again it will reference it.
   */
  prevRef.current = state;

  return [state, setState] as const;
};
