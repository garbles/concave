import { basicLens } from "./basic-lens";
import { Connection, connection } from "./connection";
import { createConnectionStoreFactory, createStoreFactory } from "./store";

type State = {
  a: number;
  b: number;
};

const noFocus = { keyPath: [], lens: basicLens<any>() };

const tick = () => new Promise((r) => setTimeout(r));

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

  test("can synchronously resolve a value from the store after at least one value has been resolved", () => {
    const factory = createStoreFactory<number>();
    const store = factory(noFocus);

    expect(() => store.getSnapshot()).toThrow();

    store.update(() => 1);

    expect(() => store.getSnapshot()).not.toThrow();
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

    store.update((prev) => {
      expect(prev).toBe(1);

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
  const setup = <S, I>(def: Connection<S, I>, input: I) => {
    const syncFactory = createStoreFactory(def);
    const syncStore = syncFactory(noFocus);
    const connectionFactory = createConnectionStoreFactory(syncStore, input);

    return connectionFactory(noFocus);
  };

  test("creates an async store", async () => {
    const store = setup(
      connection<number, number>((store, input) => {
        store.update(() => input + 10);
      }),
      1
    );

    const unsubscribe = store.subscribe(() => {});

    const value = await store.getSnapshot({ sync: false });
    expect(value).toEqual(11);

    unsubscribe();
  });

  test("async store does not resolve unless it is subscribed to", async () => {
    const callback = jest.fn();

    const store = setup(connection<number, number>(callback), 1);

    expect(callback).not.toHaveBeenCalled();

    const unsubscribe1 = store.subscribe(() => {});

    await tick();

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe1();

    await tick();

    const unsubscribe2 = store.subscribe(() => {});

    await tick();

    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe2();
  });

  test("async store first update call is passed undefined always", () => {
    expect.hasAssertions();

    const store = setup(
      connection<number, number>((store, input) => {
        store.update((prev) => {
          expect(prev).toBeUndefined();

          return 2;
        });
      }),
      1
    );

    store.subscribe(() => {})();
  });

  test.todo("can be updated from outside");
  test.todo("can listen to changes on the inside and react to them");
  test.todo("disconnects and calls clean up function after all listeners are removed");
  test.todo("walking keypath resolves as you would expect");
  test.todo("can synchronously resolve a value from the store after at least one value has been resolved");
  test.todo("disconnects properly when the underlying data changes");
});
