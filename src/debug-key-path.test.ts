import { debugKeyPath } from "./debug-key-path";

test("joins a keypath together", () => {
  const keyPath = ["a", "b", 10, "c", "55", Symbol("hello"), "d"];

  const result = debugKeyPath(keyPath);

  expect(result).toEqual("lens.a.b[10].c[55][Symbol(hello)].d");
});
