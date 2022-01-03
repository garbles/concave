import type { Connection } from "./connection";

export type Key = string | number | symbol;
export type AnyObject = { [key: string | number | symbol]: Value };
export type AnyArray = Value[];
export type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
export type AnyConnection = Connection<any, any>;
export type Value = AnyArray | AnyObject | AnyPrimitive | AnyConnection;
export type Listener = () => void;
export type Unsubscribe = () => void;
export type Updater<A> = (a: A) => A;
export type Update<A> = (updater: Updater<A>) => void;
