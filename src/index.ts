import { ProxyLens } from "./proxy-lens";

export { react } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
