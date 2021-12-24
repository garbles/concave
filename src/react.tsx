/// <reference types="react/next" />

import React from "react";
import { basicLens } from "./basic-lens";
import { keyPathToString } from "./key-path-to-string";
import { initProxyLens, ProxyLens } from "./proxy-lens";
import { createStoreFactory, Store } from "./store";
import { useStore } from "./use-store";

export type Lens<A> = ProxyLens<A>;

export const concave = <S,>(initialState: S): [Lens<S>, Store<S>] => {
  const factory = createStoreFactory(initialState);
  const root = factory({ keyPath: [], lens: basicLens() });

  /**
   * Can't really generalize this without higher-kinded types :(.
   * Needs to be a way to describe a hook factory that creates a hook returning
   *  the same type as `store.getSnapshot()`, but the factory must
   * be passed in as an argument to the function wrapping this.
   *
   * It would be nice to be able to define a hook factory so that
   * `lens.use()` could return something different (and decouple from React).
   */

  const lens = initProxyLens<S>((store, debugValue) => {
    return function useLensState(shouldUpdate) {
      React.useDebugValue(debugValue);
      return useStore(store, shouldUpdate);
    };
  }, factory);

  return [lens, root];
};

export const useConcave = <S,>(initialState: S) => React.useMemo(() => concave<S>(initialState), []);
