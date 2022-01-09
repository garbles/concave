import { Connection, connection } from "./connection";
import { createConnectionStoreFactory, createRootStoreFactory } from "./store";

type State = {
  a: number;
  b: number;
};

const tick = () => new Promise((r) => setTimeout(r));

test("triggers one call to listeners per call", () => {
  const [factory, focus] = createRootStoreFactory<State>({ a: 0, b: 0 });
  const listener = jest.fn();
  const store = factory(focus);

  const unsubscribe = store.subscribe(listener);

  store.setSnapshot({ ...store.getSnapshot(), a: store.getSnapshot().a + 1 });
  store.setSnapshot({ ...store.getSnapshot(), b: store.getSnapshot().b + 1 });

  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
});

describe("async store", () => {
  const setup = <S, I>(def: Connection<S, I>, input: I) => {
    const [rootFactory, rootFocus] = createRootStoreFactory(def);
    const rootStore = rootFactory(rootFocus);
    const [connFactory, connFocus] = createConnectionStoreFactory(rootFactory, rootFocus, input);
    const connStore = connFactory(connFocus);

    return [connStore, rootStore, connFactory, connFocus] as const;
  };

  test("creates an async store", async () => {
    const [store] = setup(
      connection<number, number>((store, input) => {
        store.setSnapshot(input + 10);
      }),
      1
    );

    const unsubscribe = store.subscribe();

    const value = store.getSnapshot();
    expect(value).toEqual(11);

    unsubscribe();
  });

  test("async store does not resolve unless it is subscribed to", async () => {
    const callback = jest.fn();

    const [store] = setup(connection<number, number>(callback), 1);

    expect(callback).not.toHaveBeenCalled();

    const unsubscribe1 = store.subscribe();

    await tick();

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe1();

    await tick();

    const unsubscribe2 = store.subscribe();

    await tick();

    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe2();
  });

  test("disconnects properly when the underlying data changes", async () => {
    const cleanup1 = jest.fn();
    const cleanup2 = jest.fn();

    const conn1 = connection<number, void>((store) => {
      store.setSnapshot(1);

      return cleanup1;
    });

    const conn2 = connection<number, void>((store) => {
      store.setSnapshot(100);

      return cleanup2;
    });

    const [connStore, syncStore] = setup(conn1, undefined);
    await tick();

    const unsubscribe = connStore.subscribe();
    await tick();

    expect(connStore.getSnapshot()).toEqual(1);
    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).not.toHaveBeenCalled();

    await syncStore.setSnapshot(conn2);
    await tick();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).not.toHaveBeenCalled();

    expect(connStore.getSnapshot()).toEqual(100);

    unsubscribe();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  test("setSnapshot is called synchronously", () => {
    const [store] = setup(
      connection<number, number>((store, input) => {
        store.setSnapshot(input + 10);
      }),
      1
    );

    const unsubscribe = store.subscribe();

    expect(store.getSnapshot()).toEqual(11);

    unsubscribe();
  });

  test("can be updated from outside", async () => {
    const [store] = setup(
      connection<number, number>((store, input) => {
        store.setSnapshot(input + 10);
      }),
      1
    );

    const unsubscribe = store.subscribe();

    expect(store.getSnapshot()).toEqual(11);

    store.setSnapshot(50);

    expect(store.getSnapshot()).toEqual(50);

    unsubscribe();
  });

  test("can listen to changes on the inside and react to them", () => {
    const cleanup = jest.fn();
    const listener = jest.fn();

    const [store] = setup(
      connection<number, number>((store, input) => {
        store.setSnapshot(input + 10);

        const innerUnsub = store.subscribe(listener);

        return () => {
          innerUnsub();
          cleanup();
        };
      }),
      1
    );

    const unsubscribe = store.subscribe();

    expect(listener).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();

    store.setSnapshot(0);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    store.setSnapshot(1);
    store.setSnapshot(2);
    store.setSnapshot(3);

    expect(listener).toHaveBeenCalledTimes(4);
    expect(cleanup).not.toHaveBeenCalled();

    unsubscribe();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("notifies the parent store", () => {
    const listener = jest.fn();

    const [connStore, rootStore] = setup(
      connection<number, number>((store, input) => {
        store.setSnapshot(input + 10);
      }),
      1
    );

    const unsubscribe1 = rootStore.subscribe(listener);

    expect(() => connStore.getSnapshot()).toThrow();

    const unsubscribe2 = connStore.subscribe();

    expect(connStore.getSnapshot()).toEqual(11);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe1();
    unsubscribe2();
  });

  test("does not share values between inputs", () => {
    const cleanup = jest.fn();

    const conn = connection<number, number>((store, input) => {
      store.setSnapshot(input + 100);

      return cleanup;
    });

    const [connStore1] = setup(conn, 1);
    const [connStore2] = setup(conn, 2);

    expect(() => connStore1.getSnapshot()).toThrow();
    expect(() => connStore2.getSnapshot()).toThrow();

    const unsubscribe1 = connStore1.subscribe();

    expect(connStore1.getSnapshot()).toEqual(101);
    expect(() => connStore2.getSnapshot()).toThrow();

    const unsubscribe2 = connStore2.subscribe();

    expect(connStore1.getSnapshot()).toEqual(101);
    expect(connStore2.getSnapshot()).toEqual(102);

    unsubscribe1();
    unsubscribe2();
  });
});
