import { isObject } from "./is-object";

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const shallowCopy = <T>(obj: T): T => {
  /**
   * Need to do this check to ensure that referential
   * equality will only break a single key in the object
   */
  if (isObject(obj)) {
    return { ...obj };
  } else if (Array.isArray(obj)) {
    return [...obj] as any as T;
  } else {
    /**
     * If it's something else, make a deep copy just in case.
     */
    return deepCopy(obj);
  }
};
