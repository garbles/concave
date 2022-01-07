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

test.todo("calls subscribe when it's loading and connected");
test.todo("calls unsubscribe when it's loading and disconnected");
test.todo("calls subscribe if it connects before subscribe is available and then connects");
test.todo("does not load twice");
test.todo("awaits being ready");
