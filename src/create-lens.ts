import { ProxyLens, proxyLens } from "./proxy-lens";
import { createRootStoreFactory } from "./store";

export const createLens = <S>(initialState: S): ProxyLens<S> => {
  const [factory, focus] = createRootStoreFactory(initialState);
  return proxyLens(factory, focus);
};
