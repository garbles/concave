import { SuspendedClosure } from "./suspended-closure";

const expectThrowsPromise = (obj: SuspendedClosure<any>, shouldThrow: boolean) => {
  let didThrow = false;

  try {
    obj.getSnapshot();
  } catch (err) {
    expect(err).toBeInstanceOf(Promise);
    didThrow = true;
  }

  expect(didThrow).toEqual(shouldThrow);
};

test("throws when the value is not resolved", () => {
  const obj = new SuspendedClosure<string>();

  expectThrowsPromise(obj, true);

  obj.load(() => () => {});

  expectThrowsPromise(obj, true);

  obj.setSnapshot("abc");

  expectThrowsPromise(obj, false);
});

test("does not do anything if the value is unresolved", () => {
  const obj = new SuspendedClosure<string>();

  obj.setSnapshot("abc");

  expectThrowsPromise(obj, true);
});

test("calls subscribe when it's connected and then loading", () => {
  const obj = new SuspendedClosure<string>();
  const subscribe = jest.fn();

  obj.connect();
  obj.load(subscribe);

  expect(subscribe).toHaveBeenCalledTimes(1);
});

test("calls subscribe when it's loading and then connected", () => {
  const obj = new SuspendedClosure<string>();
  const subscribe = jest.fn();

  obj.load(subscribe);
  obj.connect();

  expect(subscribe).toHaveBeenCalledTimes(1);
});

test("calls unsubscribe when it's loading and disconnected", () => {
  const obj = new SuspendedClosure<string>();
  const unsubscribe = jest.fn();
  const subscribe = jest.fn(() => unsubscribe);

  obj.connect();
  obj.disconnect();

  expect(subscribe).not.toHaveBeenCalled();
  expect(unsubscribe).not.toHaveBeenCalled();

  obj.load(subscribe);

  expect(subscribe).not.toHaveBeenCalled();
  expect(unsubscribe).not.toHaveBeenCalled();

  obj.connect();

  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).not.toHaveBeenCalled();

  obj.disconnect();

  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("does not load twice", () => {
  const obj = new SuspendedClosure<string>();
  const subscribe1 = jest.fn();
  const subscribe2 = jest.fn();

  obj.load(subscribe1);
  obj.load(subscribe2);

  obj.connect();

  expect(subscribe1).toHaveBeenCalledTimes(1);
  expect(subscribe2).not.toHaveBeenCalled();
});

test("awaits being ready", () => {
  const obj = new SuspendedClosure<string>();
  let prom!: Promise<unknown>;

  try {
    obj.getSnapshot();
  } catch (err) {
    prom = err as any;
  }

  expect(prom).toBeInstanceOf(Promise);
  expect(prom).resolves.toBeUndefined();

  obj.load(() => () => {});
  obj.setSnapshot("!");
});
