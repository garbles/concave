import type { Connection } from "./connection";

export type Key = string | number | symbol;
export type AnyObject = { [key: string | number | symbol]: any };
export type AnyArray = any[];
export type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
export type AnyConnection = Connection<any, any>;
export type Listener = () => void;
export type Unsubscribe = () => void;
export type Updater<A> = (a: A) => A;
export type Update<A> = (updater: Updater<A>) => void;
