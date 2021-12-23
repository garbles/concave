import { ProxyLens } from "./proxy-lens";

export { concave, useConcave } from "./concave";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
