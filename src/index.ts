import { ProxyLens } from "./proxy-lens";

export { stateful, stateless, useStateful } from "./react";
export type Lens<A> = Omit<ProxyLens<A>, symbol>;
