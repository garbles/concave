export type Key = string | number | symbol;
export type AnyObject = { [key: string | number | symbol]: JSON };
export type AnyArray = JSON[];
export type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
export type JSON = AnyArray | AnyObject | AnyPrimitive;
export type Listener = () => void;
export type Unsubscribe = () => void;
export type Updater<A> = (a: A) => A;
export type Update<A> = (updater: Updater<A>) => void;
