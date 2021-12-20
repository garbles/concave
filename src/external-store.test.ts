import { externalStore } from "./external-store";

type State = {
  a: number;
  b: number;
};

test("triggers one call to listeners per call", () => {
  const store = externalStore<State>({ a: 0, b: 0 });
  const listener = jest.fn();

  const unsubscribe = store.subscribe(listener);

  store.update((s) => ({ ...s, a: s.a + 1 }));
  store.update((s) => ({ ...s, b: s.b + 1 }));

  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
});

test("noop when the same value is returned", () => {
  const store = externalStore<State>({ a: 0, b: 0 });
  const listener = jest.fn();

  const unsubscribe = store.subscribe(listener);

  store.update((s) => s);

  expect(listener).toHaveBeenCalledTimes(0);

  unsubscribe();
});