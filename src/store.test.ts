import { basicLens } from "./basic-lens";
import { createStore } from "./store";

type State = {
  a: number;
  b: number;
};

test("triggers one call to listeners per call", () => {
  const store = createStore<State>({ a: 0, b: 0 });
  const listener = jest.fn();
  const focused = store({ keyPath: [], lens: basicLens() });

  const unsubscribe = focused.subscribe(listener);

  focused.update((s) => ({ ...s, a: s.a + 1 }));
  focused.update((s) => ({ ...s, b: s.b + 1 }));

  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
});

test("noop when the same value is returned", () => {
  const store = createStore<State>({ a: 0, b: 0 });
  const listener = jest.fn();
  const focused = store({ keyPath: [], lens: basicLens() });

  const unsubscribe = focused.subscribe(listener);

  focused.update((s) => s);

  expect(listener).toHaveBeenCalledTimes(0);

  unsubscribe();
});
