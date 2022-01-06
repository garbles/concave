import { basicLens } from "./basic-lens";
import { createStoreFactory } from "./store";

type State = {
  a: number;
  b: number;
};

test("triggers one call to listeners per call", () => {
  const factory = createStoreFactory<State>({ a: 0, b: 0 });
  const listener = jest.fn();
  const store = factory({ keyPath: [], lens: basicLens() });

  const unsubscribe = store.subscribe(listener);

  store.setSnapshot({ ...store.getSnapshot(), a: store.getSnapshot().a + 1 });
  store.setSnapshot({ ...store.getSnapshot(), b: store.getSnapshot().b + 1 });

  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
});
