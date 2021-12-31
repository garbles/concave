import { basicLens } from "./basic-lens";
import { Deferred, deferred } from "./deferred";
import { createDeferredStoreFactory, createStoreFactory } from "./store";

type State = {
  a: number;
  b: number;
};

const noFocus = { keyPath: [], lens: basicLens<any>() };

describe("sync store", () => {
  test("triggers one call to listeners per call", () => {
    const factory = createStoreFactory<State>({ a: 0, b: 0 });
    const listener = jest.fn();
    const store = factory(noFocus);

    const unsubscribe = store.subscribe(listener);

    store.update((s) => ({ ...s, a: s.a + 1 }));
    store.update((s) => ({ ...s, b: s.b + 1 }));

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  test("noop when the same value is returned", () => {
    const factory = createStoreFactory<State>({ a: 0, b: 0 });
    const listener = jest.fn();
    const store = factory(noFocus);

    const unsubscribe = store.subscribe(listener);

    store.update((s) => s);

    expect(listener).toHaveBeenCalledTimes(0);

    unsubscribe();
  });

  test("when factory is initialized with no state, it throws a promise on sync getSnapshot", () => {
    const factory = createStoreFactory<State>();
    const store = factory(noFocus);

    expect.hasAssertions();

    try {
      store.getSnapshot();
    } catch (err) {
      expect(err).toBeInstanceOf(Promise);
    }
  });

  test("when factory is initialized with no state, it does not resolve on async getSnapshot", () => {
    jest.useFakeTimers();

    const factory = createStoreFactory<State>();
    const store = factory(noFocus);

    let resolved = false;

    store.getSnapshot({ sync: false }).then(() => {
      resolved = true;
    });

    jest.runAllTimers();

    expect(resolved).toEqual(false);

    jest.useRealTimers();
  });

  test("when factory is initialized with no state, update is passed undefined to start", () => {
    const factory = createStoreFactory<number>();
    const store = factory(noFocus);

    expect.hasAssertions();

    store.update((prev) => {
      expect(prev).toBeUndefined();

      return 1;
    });
  });

  test("store won't accept undefined on update", () => {
    const factory = createStoreFactory<number>();
    const store = factory(noFocus);

    expect(() => store.update(() => undefined)).toThrowError();

    store.update(() => 1);
    store.update(() => 2);
    store.update(() => 3);

    expect(() => store.update(() => undefined)).toThrowError();
  });
});

describe("async store", () => {
  const setup = <S, I>(def: Deferred<S, I>, input: I) => {
    const syncFactory = createStoreFactory(def);
    const syncStore = syncFactory(noFocus);
    const deferredFactory = createDeferredStoreFactory(syncStore, input);

    return deferredFactory(noFocus);
  };

  test("creates an async store", async () => {
    const store = setup(
      deferred<number, number>((store, input) => {
        store.update(() => input + 10);
      }),
      1
    );

    const unsubscribe = store.subscribe(() => {});

    const value = await store.getSnapshot({ sync: false });
    expect(value).toEqual(11);

    unsubscribe();
  });

  test.todo("async store does not resolve unless it is subscribed to");
  test.todo("async store first update call is passed undefined always");
  test.todo("can be updated from outside");
  test.todo("can listen to changes on the inside and react to them");
  test.todo("walking keypath resolves as you would expect");
});
