const isObject = (obj: any): obj is object => Object.prototype.toString.call(obj) === "[object Object]";

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const shallowCopy = <T>(prev: T): T => {
  /**
   * Need to do this check to ensure that referential
   * equality will only break a single key in `S`
   */
  if (isObject(prev)) {
    return { ...prev };
  } else if (Array.isArray(prev)) {
    return [...prev] as any as T;
  } else {
    /**
     * If it's something else, make a deep copy just in case.
     */
    return deepCopy(prev);
  }
};
