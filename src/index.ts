import { ProxyLens } from "./proxy-lens";

export { concave, useConcave } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
