type Sig<T extends {}, U> = (t: T) => U;

export const weakCache = <T extends {}, U>(fn: Sig<T, U>): Sig<T, U> => {
  const weak = new WeakMap<T, U>();
  const nothing = Symbol();

  return (t) => {
    let cached = weak.get(t) ?? nothing;

    if (cached === nothing) {
      const next = fn(t);
      weak.set(t, next);

      return next;
    } else {
      return cached;
    }
  };
};
