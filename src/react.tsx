/// <reference types="react/next" />

import React from "react";
import { basicLens } from "./basic-lens";
import { createStoreFactory, Store } from "./store";
import { keyPathToString } from "./key-path-to-string";
import { initProxyLens, ProxyLens } from "./proxy-lens";
import { useStore } from "./use-store";

export type Lens<A> = Omit<ProxyLens<A>, symbol>;

export const concave = <S,>(initialState: S): [Lens<S>, Store<S>] => {
  const factory = createStoreFactory(initialState);
  const root = factory({ keyPath: [], lens: basicLens() });

  const lens = initProxyLens<S>((focus) => {
    const debugValue = keyPathToString(focus.keyPath);
    const store = factory(focus);

    return function useLensState(shouldUpdate) {
      React.useDebugValue(debugValue);
      return useStore(store, shouldUpdate);
    };
  });

  return [lens, root];
};

export const useConcave = <S,>(initialState: S) => React.useMemo(() => concave<S>(initialState), []);
