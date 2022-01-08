import { Connection, connection } from "./connection";
import { proxyLens, ProxyLens } from "./proxy-lens";
import { ProxyValue, proxyValue } from "./proxy-value";
import { ReactDevtools } from "./react-devtools";
import { createRootStoreFactory } from "./store";
import { Update, Updater } from "./types";

type State = {
  a: {
    b: {
      c: number;
    };
    d: {
      e: string;
    };

    f: Array<{ g: boolean }>;
  };
};

const initialState = (): State => ({
  a: {
    b: {
      c: 0,
    },
    d: {
      e: "cool",
    },

    f: [{ g: true }, { g: false }, { g: true }],
  },
});

let lens: ProxyLens<State>;

beforeEach(() => {
  const [factory, focus] = createRootStoreFactory(initialState());

  lens = proxyLens<State, State>(factory, focus);
});

const useLens = <A>(proxy: ProxyLens<A>): [ProxyValue<A>, Update<A>] => {
  const store = proxy.getStore();

  const update = (updater: Updater<A>) => {
    const prev = store.getSnapshot();
    const next = updater(prev);

    return store.setSnapshot(next);
  };

  return [proxyValue(store.getSnapshot(), proxy), update];
};

describe("use", () => {
  test("creates a wrapper around a value", () => {
    const [state] = useLens(lens);
    expect(state.toJSON()).toEqual(lens.getStore().getSnapshot());

    const [bState] = useLens(lens.a.b);
    expect(bState.toJSON()).toEqual(lens.getStore().getSnapshot().a.b);
  });

  test("can update state", () => {
    const [bState, setB] = useLens(lens.a.b);

    setB(() => ({ c: 500 }));

    const [nextBState] = useLens(lens.a.b);

    expect(bState.toJSON()).not.toEqual(nextBState.toJSON());
    expect(nextBState).toMatchObject({ c: 500 });
  });

  test("does not expose `toLens` on primitive values", () => {
    const [bState] = useLens(lens.a.b);
    const [cState] = useLens(lens.a.b.c);

    expect(bState).toHaveProperty("toLens");
    expect(cState).not.toHaveProperty("toLens");
  });
});

test("always returns the same proxy value", () => {
  const [state1, updateState] = useLens(lens);
  const [state2] = useLens(lens);
  const [aState] = useLens(lens.a);

  expect(state1).toBe(state2);
  expect(state1.toJSON).toBe(state2.toJSON);
  expect(state1.a).toBe(aState);

  updateState((prev) => ({ ...prev }));

  const [state3] = useLens(lens);

  expect(state3).not.toBe(state2);
  expect(state3.toJSON).not.toBe(state2.toJSON);
  expect(state3.a).toBe(aState);
});

describe("returning the same proxy lens", () => {
  test("returns the same proxy lens when toggled", () => {
    const [state] = useLens(lens);

    expect(state.toLens()).toBe(lens);
  });

  test("from within lists of things", () => {
    const [fState] = useLens(lens.a.f);

    const first = fState[0];

    expect(first.toLens()).toBe(lens.a.f[0]);
  });

  test("when a list is copied but the members stay the same", () => {
    const [fState, setF] = useLens(lens.a.f);
    const f1 = fState[0];

    // problem here is we return the wrapped value instead of the next one and so they don't wrap
    setF((f) => [...f, { g: true }]);

    const [nextFState] = useLens(lens.a.f);
    const nextF1 = nextFState[0];

    expect(fState.length + 1).toEqual(nextFState.length);
    expect(f1.toLens()).toBe(nextF1.toLens()); // the lens should be the same
    expect(nextFState.toLens()).toBe(lens.a.f);
    expect(f1).toBe(nextF1); // the proxy should have the same value
  });

  test("when an object is copied by the members stay the same", () => {
    const [bState, setBState] = useLens(lens.a.b);
    const [dState] = useLens(lens.a.d);

    const nextBState = { c: 5000 };

    setBState(() => ({ c: 5000 }));

    const [aState] = useLens(lens.a);

    expect(aState.b.toJSON()).toEqual(nextBState);
    expect(aState.d).toBe(dState);
    expect(aState.d.toLens()).toBe(lens.a.d);
    expect(dState.toLens()).toBe(lens.a.d);
    expect(bState.toLens()).toBe(lens.a.b);
    expect(bState.toLens()).toBe(aState.b.toLens());
  });

  test("checking for errors when making copies", () => {
    const [obj] = useLens(lens);

    expect(() => ({ ...obj })).not.toThrow();
    expect(() => Object.assign({}, obj)).not.toThrow();

    expect(() => [...obj.a.f]).not.toThrow();

    // iterate
    for (const key in obj) {
      expect(typeof key).not.toEqual("symbol");
    }

    for (const value of obj.a.f) {
      expect(typeof value).not.toEqual("symbol");
    }

    expect(() => ({ ...lens })).toThrow();

    expect(() => Object.getOwnPropertyDescriptors(lens)).toThrow();
  });
});

describe("inside React Devtools", () => {
  test("does not throw getting descriptors", () => {
    jest.spyOn(ReactDevtools, "isCalledInsideReactDevtools").mockImplementationOnce(() => true);
    expect(() => Object.getOwnPropertyDescriptors(lens)).not.toThrow();
  });
});

test("making a copy of a ProxyValue preserves the same attributes", () => {
  const [obj] = useLens(lens);
  const copy = { ...obj };

  expect(copy.toLens()).toBe(lens);
  expect(copy.toJSON()).toEqual(JSON.parse(JSON.stringify(copy)));
  expect(copy).toEqual(obj);
});

test("making a copy, dot-navigating, and then returning to a lens works", () => {
  const [obj] = useLens(lens);
  const copy = { ...obj };

  const b = copy.a.b;
  const f0 = copy.a.f[0];

  expect(b.toLens()).toBe(lens.a.b);
  expect(f0.toLens()).toBe(lens.a.f[0]);
});

describe("connections", () => {
  let disconnected = jest.fn();

  beforeEach(() => {
    disconnected = jest.fn();
  });

  type ConnectionState = {
    b: {
      c: number;
    };
  };

  const conn = connection<ConnectionState>((store) => {
    store.setSnapshot({ b: { c: 20 } });

    return disconnected;
  });

  const [factory, focus] = createRootStoreFactory({ a: conn });

  const create = () => {
    return proxyLens<{ a: Connection<ConnectionState> }, { a: Connection<ConnectionState> }>(factory, focus);
  };

  test("throws on first sync call if data is not there", () => {
    const lens = create();

    expect(() => lens.a.getStore().getSnapshot()).not.toThrow();
    expect(() => lens.a().getStore().getSnapshot()).toThrow();
    expect(() => lens.a().b.getStore().getSnapshot()).toThrow();
    expect(() => lens.a().b.c.getStore().getSnapshot()).toThrow();
  });

  test("does not throw when calling for async data", async () => {
    const lens = create();
    const bStore = lens.a().b.getStore();

    const unsubscribe = bStore.subscribe();
    await new Promise((res) => setTimeout(res));

    const value = bStore.getSnapshot();

    expect(value).toEqual({ c: 20 });

    unsubscribe();

    await new Promise((res) => setTimeout(res));

    expect(disconnected).toHaveBeenCalled();
  });

  test("allows nested connections", () => {
    const state = {
      b: connection<{ a: Connection<number> }, number>((store, input) => {
        const a = connection<number>((s) => {
          s.setSnapshot(input + 20);
        });

        store.setSnapshot({ a });
      }),
    };

    const [factory, focus] = createRootStoreFactory(state);
    const lens = proxyLens(factory, focus);

    const aStore = lens.b(5).a().getStore();

    const unsubscribe = aStore.subscribe();

    expect(aStore.getSnapshot()).toEqual(25);

    unsubscribe();
  });

  test("allows connectiions to be swapped for other values", () => {
    const setup = jest.fn();
    const cleanup = jest.fn();

    const conn = connection<number, number>((store, input) => {
      setup();

      store.setSnapshot(50 + input);

      return cleanup;
    });

    const state: { b: Connection<number, number> | string } = {
      b: conn,
    };

    const [factory, focus] = createRootStoreFactory(state);
    const lens = proxyLens(factory, focus);

    const bStore = lens.b.getStore();
    const bConnStore = (lens.b as any)(20).getStore();

    const unsubscribe = bConnStore.subscribe();

    /**
     * Connection works as expected
     */
    expect(bConnStore.getSnapshot()).toEqual(70);

    expect(cleanup).not.toHaveBeenCalled();

    (bStore as any).setSnapshot("gabe");

    /**
     * Cleanup is called when the connection is removed.
     */
    expect(cleanup).toHaveBeenCalledTimes(1);

    /**
     * Using the connection store will throw an error now because
     * the cache is not inserted into the store.
     */
    expect(() => bConnStore.getSnapshot()).toThrow();

    /**
     * Immediately connects when connection is re-established.
     */
    expect(setup).toHaveBeenCalledTimes(1);
    (bStore as any).setSnapshot(conn);
    expect(setup).toHaveBeenCalledTimes(2);

    /**
     * Value can be accessed again.
     */
    expect(bConnStore.getSnapshot()).toEqual(70);

    unsubscribe();

    /**
     * Cleanup function is called again.
     */
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test("adjacent connections with the same input do not share the same data", () => {
    const conn = connection<number, number>((store, input) => {
      store.setSnapshot(input + 100);
    });

    const state = {
      a: conn,
      b: conn,
    };

    const [factory, focus] = createRootStoreFactory(state);
    const lens = proxyLens(factory, focus);

    const aStore = lens.a(20).getStore();
    const bStore = lens.b(20).getStore();

    const aUnsubscribe = aStore.subscribe();
    const bUnsubscribe = bStore.subscribe();

    expect(aStore.getSnapshot()).toEqual(120);
    expect(bStore.getSnapshot()).toEqual(120);

    aStore.setSnapshot(0);

    expect(aStore.getSnapshot()).toEqual(0);
    expect(bStore.getSnapshot()).toEqual(120);

    bStore.setSnapshot(-100);

    expect(aStore.getSnapshot()).toEqual(0);
    expect(bStore.getSnapshot()).toEqual(-100);

    aUnsubscribe();
    bUnsubscribe();
  });
});
