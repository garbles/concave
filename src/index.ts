import { ProxyLens } from "./proxy-lens";
import { createLens } from "./create-lens";

export type Lens<A> = ProxyLens<A>;
export { createLens };
