import { proxyLens, ProxyLens } from "./proxy-lens";
import { createStoreFactory } from "./store";

export const createLens = <S>(initialState: S): ProxyLens<S> => {
  const factory = createStoreFactory(initialState);
  return proxyLens(factory);
};
