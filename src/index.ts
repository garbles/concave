import { ProxyLens } from "./proxy-lens";
import { stateless, stateful } from "./react";

export type Lens<A> = Omit<ProxyLens<A>, symbol>;

export default {
  stateful,
  stateless,
};
