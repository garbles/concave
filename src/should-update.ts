type ShouldUpdateFn<A> = (prev: A, next: A) => boolean;
type ShouldUpdateArray<A> = (keyof A)[];
type ShouldUpdateObject<A> = { [K in keyof A]: boolean };

export type ShouldUpdate<A> = ShouldUpdateFn<A> | ShouldUpdateArray<A> | ShouldUpdateObject<A>;

export const normalizeShouldUpdate = <A>(shouldUpdate: ShouldUpdate<A>): ShouldUpdateFn<A> => {
  if (typeof shouldUpdate === "function") {
    return shouldUpdate;
  }

  if (Array.isArray(shouldUpdate)) {
    return (prev, next) => {
      for (const key of shouldUpdate) {
        if (prev[key] !== next[key]) {
          return true;
        }
      }

      return false;
    };
  } else {
    return (prev, next) => {
      for (const key in shouldUpdate) {
        if (shouldUpdate[key] === true && prev[key] !== next[key]) {
          return true;
        }
      }

      return false;
    };
  }
};
