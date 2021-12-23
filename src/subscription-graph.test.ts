import { SubscriptionGraph } from "./subscription-graph";

test("recursively creates nodes for nested listeners", () => {
  const graph = new SubscriptionGraph();

  const listener = jest.fn();

  expect(graph.size).toEqual(0);

  const unsub = graph.subscribe(["a", "b", "c", "d"], listener);

  expect(graph.size).toEqual(5); // 1 more than keyPath length because the root node is `[]`

  unsub();

  expect(graph.size).toEqual(0);
});

test("recursively adds/removes parents when a node is added", () => {
  const graph = new SubscriptionGraph();

  const root = jest.fn();
  const d = jest.fn();
  const f = jest.fn();

  expect(graph.size).toEqual(0);

  const unsub1 = graph.subscribe(["a", "b", "c", "d"], d);

  expect(graph.size).toEqual(5);

  const unsub2 = graph.subscribe([], root);

  expect(graph.size).toEqual(5);

  const unsub3 = graph.subscribe(["a", "f"], f);

  expect(graph.size).toEqual(6);

  graph.notify([]); // all
  graph.notify(["a"]); // all
  graph.notify(["a", "b"]); // root, d
  graph.notify(["a", "b", "c"]); // root, d
  graph.notify(["a", "b", "c", "d"]); // root, d
  graph.notify(["a", "b", "c", "d"]); // root, d
  graph.notify(["a", "f"]); // root, f

  expect(root).toHaveBeenCalledTimes(7);
  expect(d).toHaveBeenCalledTimes(6);
  expect(f).toHaveBeenCalledTimes(3);

  /**
   * Randomize the order that subs are removed
   *  and confirm that it is still zero
   */
  const unsubs = [unsub1, unsub2, unsub3];

  while (unsubs.length > 0) {
    const index = Math.floor(Math.random() * unsubs.length);
    const [unsub] = unsubs.splice(index, 1);

    unsub();
  }

  expect(graph.size).toEqual(0);
});

test("do not notify if it is not dependent", () => {
  const graph = new SubscriptionGraph();
  const listener = jest.fn();

  const unsub = graph.subscribe(["a", "b", "c"], listener);
  const other = graph.subscribe(["j"], () => {});

  graph.notify(["j"]);

  expect(listener).not.toHaveBeenCalled();

  unsub();
  other();
});

test("if the node does not exist, then we cannot notify from it", () => {
  const graph = new SubscriptionGraph();
  const listener = jest.fn();

  const unsub = graph.subscribe(["a", "b", "c"], listener);

  graph.notify(["a", "b", "c", "d", "e"]);

  expect(listener).not.toHaveBeenCalled();

  unsub();
});
