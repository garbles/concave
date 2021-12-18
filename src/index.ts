import { ProxyLens } from "./proxy-lens";

export { stateless, stateful } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
