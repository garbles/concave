import { proxyLens, ProxyLens } from "./proxy-lens";
import { createStoreFactory } from "./store";

export type Lens<A> = ProxyLens<A>;

export const createLens = <S>(initialState: S): Lens<S> => {
  const factory = createStoreFactory(initialState);
  return proxyLens(factory);
};
