import type { ProxyLens } from "./proxy-lens";
export { connection } from "./connection";
export type { Connection } from "./connection";
export { createLens } from "./create-lens";
export { useCreateLens } from "./react";
export type { Store } from "./store";
export type Lens<A> = ProxyLens<A>;
