import { isObject } from "./is-object";

export type Awaitable<T> = T | PromiseLike<T>;

const isPromiseLike = <T>(obj: any): obj is PromiseLike<T> => {
  return isObject(obj) && Reflect.has(obj, "then");
};

/**
 * Wraps a callback that returns an `Awaitable`. This is benefitial over async/await in
 * some cases because it can be made to be synchronous when the callback does not return
 * a promise and therefore calling `.then()` will yield immediately instead of waiting
 * like a typical promise does. If the callback does return a promise then the consumer
 * will wait.
 */
export const awaitable =
  <T>(get: () => Awaitable<T>) =>
  (): PromiseLike<T> => {
    return {
      then(onfulfilled) {
        const value = get();
        onfulfilled ??= null;

        if (onfulfilled === null) {
          throw new Error("Unexpected error. Do not use awaitable(value).then()");
        }

        if (isPromiseLike(value)) {
          return value.then(onfulfilled);
        }

        const result = onfulfilled(value);

        if (isPromiseLike(result)) {
          return result;
        }

        return awaitable(() => result)();
      },
    };
  };
