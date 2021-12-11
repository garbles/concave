import { ProxyLens } from "./proxy";

export { create } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
