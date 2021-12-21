import { isObject } from "./is-object";

export const shallowCopy = <T>(obj: T): T => {
  /**
   * Need to do this check to ensure that referential
   * equality will only break a single key in the object/array.
   * We can't blanket use `{ ...obj }` on everything because
   * that would transform an array into a plain object.
   */
  if (isObject(obj)) {
    return { ...obj };
  } else if (Array.isArray(obj)) {
    return [...obj] as any as T;
  } else {
    /**
     * This function should only ever be called with a plain object or array.
     * Other data types either can't be copied or can only be mutated, so
     * just throw.
     */
    throw new Error("shallowCopy expected a plain object or array");
  }
};
