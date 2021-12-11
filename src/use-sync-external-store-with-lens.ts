import React from "react";
import { BasicLens } from "./basic-lens";
import { ExternalStore } from "./external-store";

export const useSyncExternalStoreWithLens = <S, A>(store: ExternalStore<S>, lens: BasicLens<S, A>) => {
  const state = React.useSyncExternalStore(store.subscribe, () => lens.get(store.getSnapshot()));
  const setState = React.useCallback((next: A) => store.apply((s) => lens.set(s, next)), [store]);

  return [state, setState] as const;
};
