import { isObject } from "./is-object";

const isAwaitable = <T>(obj: any): obj is PromiseLike<T> => {
  return isObject(obj) && Reflect.has(obj, "then");
};

export const awaitable = <T>(value: T): PromiseLike<T> => {
  return {
    then(onfulfilled) {
      onfulfilled ??= null;

      if (onfulfilled === null) {
        throw new Error("Unexpected error. Do not use awaitable(value).then()");
      }

      const result = onfulfilled(value);

      if (isAwaitable(result)) {
        return result;
      }

      return awaitable(result);
    },
  };
};
