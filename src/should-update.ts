type ShouldUpdateBoolean = boolean;
type ShouldUpdateArray<A> = (keyof A)[];
type ShouldUpdateObject<A> = { [K in keyof A]?: A[K] extends any[] ? ShouldUpdate<A[K][number]> : ShouldUpdate<A[K]> };
export type ShouldUpdateFunction<A> = (prev: A, next: A) => boolean;
export type ShouldUpdate<A> =
  | ShouldUpdateBoolean
  | ShouldUpdateFunction<A>
  | ShouldUpdateArray<A>
  | ShouldUpdateObject<A>;

export const shouldUpdateToFunction = <A>(shouldUpdate: ShouldUpdate<A>): ShouldUpdateFunction<A> => {
  if (typeof shouldUpdate === "boolean") {
    return (prev, next) => (shouldUpdate ? prev !== next : false);
  }

  if (typeof shouldUpdate === "function") {
    return shouldUpdate as ShouldUpdateFunction<A>;
  }

  if (Array.isArray(shouldUpdate)) {
    const obj = Object.fromEntries(shouldUpdate.map((key) => [key, true])) as { [K in keyof A]: boolean };
    return shouldUpdateToFunction(obj);
  }

  return (prev, next) => {
    let prevIsArr = false;
    let nextIsArr = false;

    let prevArr: (A & any[]) | A[];
    let nextArr: (A & any[]) | A[];

    /**
     * If the prev or next values are arrays then keep
     * track of it, but noop. If they are not arrays then
     * wrap in an array to make the rest of the function
     * easy to walk.
     */
    if (Array.isArray(prev)) {
      prevIsArr = true;
      prevArr = prev;
    } else {
      prevArr = [prev];
    }

    if (Array.isArray(next)) {
      nextIsArr = true;
      nextArr = next;
    } else {
      nextArr = [next];
    }

    /**
     * If one value was is an array but the other isn't
     * then stop and just return true... and fix your data.
     */
    if (nextIsArr !== prevIsArr) {
      return true;
    }

    /**
     * This is implicitly required to be able to traverse
     * array keys. Therefore using `[]` or `{}` as the value
     * for a key will automatically compare the length of an array.
     * If both prev and next were not arrays then we will not return here.
     */
    if (prevArr.length !== nextArr.length) {
      return true;
    }

    /**
     * Iterate through each entry in the array and short circuit `true` at
     * the first check to return `true`.
     */
    for (let i = 0; i < prevArr.length; i++) {
      const prevValue = prevArr[i];
      const nextValue = nextArr[i];

      for (const key in shouldUpdate) {
        const func = shouldUpdateToFunction(shouldUpdate[key] as ShouldUpdate<A[keyof A]>);

        if (func(prevValue[key], nextValue[key])) {
          return true;
        }
      }
    }

    /**
     * No checks returns true so we won't update.
     */
    return false;
  };
};
