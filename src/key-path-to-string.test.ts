import { keyPathToString } from "./key-path-to-string";

test("joins a keypath together", () => {
  const keyPath = ["a", "b", 10, "c", "55", Symbol("hello"), "d"];

  const result = keyPathToString(keyPath);

  expect(result).toEqual("root.a.b[10].c[55][Symbol(hello)].d");
});
