import React from "react";

type Nothing = typeof NOTHING;
const NOTHING = Symbol();

export const useValueOnce = <A>(fn: () => A): A => {
  /**
   * Make the null state `Nothing` because `A` could be
   * `null` or `undefined`.
   */
  const ref = React.useRef<A | Nothing>(NOTHING);

  if (ref.current === NOTHING) {
    ref.current = fn();
  }

  return ref.current;
};
