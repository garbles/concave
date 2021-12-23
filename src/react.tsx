/// <reference types="react/next" />

import React from "react";
import { basicLens } from "./basic-lens";
import { createStoreFactory, Store } from "./store";
import { keyPathToString } from "./key-path-to-string";
import { initProxyLens } from "./proxy-lens";
import { useStore } from "./use-store";

export const concave = <S,>(initialState: S) => {
  const factory = createStoreFactory(initialState);
  const store = factory({ keyPath: [], lens: basicLens() });

  const lens = initProxyLens<S>((focus) => {
    const debugValue = keyPathToString(focus.keyPath);
    const focusedStore = factory(focus);

    return function useLensState(shouldUpdate) {
      React.useDebugValue(debugValue);
      return useStore(focusedStore, shouldUpdate);
    };
  });

  return [lens, store] as const;
};

export const useConcave = <S,>(initialState: S) => React.useMemo(() => concave<S>(initialState), []);
