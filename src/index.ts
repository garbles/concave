import { ProxyLens } from "./proxy-lens";

export { create } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
