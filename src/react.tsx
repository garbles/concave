/// <reference types="react/next" />

import React from "react";
import { initProxyLens, ProxyLens } from "./proxy-lens";
import { createStoreFactory } from "./store";
import { useStore } from "./use-store";

export type Lens<A> = ProxyLens<A>;

export const concave = <S,>(initialState: S): Lens<S> => {
  const factory = createStoreFactory(initialState);

  /**
   * Can't really generalize this without higher-kinded types :(.
   * Needs to be a way to describe a hook factory that creates a hook returning
   *  the same type as `store.getSnapshot()`, but the factory must
   * be passed in as an argument to the function wrapping this.
   *
   * It would be nice to be able to define a hook factory so that
   * `lens.use()` could return something different (and decouple from React).
   */

  const lens = initProxyLens<S>(
    (proxy) =>
      function useLensState(shouldUpdate) {
        React.useDebugValue(proxy.$key);
        return useStore(proxy.getStore(), shouldUpdate);
      },
    factory
  );

  return lens;
};

export const useConcave = <S,>(initialState: S) => React.useMemo(() => concave<S>(initialState), []);
