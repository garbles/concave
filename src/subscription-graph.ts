import { keyPathToString } from "./key-path-to-string";

type Key = string | symbol | number;
type NodeId = string;
type Listener = () => void;
type Unsubscribe = () => void;
type SubscriptionNodeAncestor = { none: true } | { none: false; keyPath: Key[] };

const id = keyPathToString;

class SubscriptionNode {
  private listeners = new Set<Listener>();
  public readonly id: string;
  public readonly ancestor: SubscriptionNodeAncestor;

  constructor(private readonly keyPath: Key[]) {
    this.id = id(keyPath);

    if (keyPath.length === 0) {
      this.ancestor = { none: true };
    } else {
      this.ancestor = { none: false, keyPath: this.keyPath.slice(0, -1) };
    }
  }

  public subscribe(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public get size(): number {
    return this.listeners.size;
  }
}

/**
 * A graph to keep track of depedencies between keyPaths
 * so that notifications do not need to cascade to all listeners.
 */
export class SubscriptionGraph {
  private nodes = new Map<NodeId, SubscriptionNode>();
  private parents = new Map<NodeId, SubscriptionNode>();
  private children = new Map<NodeId, Set<SubscriptionNode>>();

  /**
   * Notifies all ancestors and then all children of the node.
   */
  public notify(keyPath: Key[]) {
    const nodeId = id(keyPath);
    const node = this.nodes.get(nodeId);

    /**
     * If this node exists, then we need to notify. There is an assumption
     * that we will only ever notify from a node that exists, i.e. a `keyPath`
     * where there is currently a subscription.
     */
    if (node) {
      /**
       * Notify the ancestors first because they made notifications to children unnecessary.
       */
      this.notifyAncestors(node);
      this.notifySelfAndChildren(node);
    }
  }

  public subscribe(keyPath: Key[], listener: Listener): Unsubscribe {
    const node = this.addNode(keyPath);
    const unsubscribe = node.subscribe(listener);

    return () => {
      unsubscribe();
      this.clean(node);
    };
  }

  public get size() {
    return this.nodes.size;
  }

  /**
   * Recursively inserts nodes until there is a pathway
   * between the `keyPath` and the root (keyPath === []).
   */
  private addNode(keyPath: Key[]): SubscriptionNode {
    /**
     * Derive a `nodeId` key based on the `keyPath`.
     */
    const nodeId: NodeId = id(keyPath);
    let node = this.nodes.get(nodeId);

    /**
     * If the node already exists then just return it.
     */
    if (node) {
      return node;
    }

    /**
     * Otherwise, create a new node with the `nodeId`
     * and insert it into the nodes map.
     */
    node = new SubscriptionNode(keyPath);
    this.nodes.set(node.id, node);
    this.children.set(node.id, new Set());

    /**
     * If the node does not have an ancestor, then we can
     * exit here because we don't need to create any parent/child
     * relationship.
     */
    if (node.ancestor.none) {
      return node;
    }

    /**
     * Upsert the parent node. It will recursively create
     * the parent if it does not exist yet. An example of how this
     * could happen might be calling this with `['a', 'b', 'c']`
     * before calling it with `['a']` or `['a', 'b']`. See tests.
     */
    const parent = this.addNode(node.ancestor.keyPath);

    /**
     * Keep track of the node's parent.
     */
    this.parents.set(node.id, parent);

    /**
     * Add this node to the set of children for the parent.
     */
    const siblings = this.children.get(parent.id);

    if (siblings === undefined) {
      // impossible?
      throw new Error("Unexpected Error");
    }

    siblings.add(node);

    return node;
  }

  /**
   * Recursively notifies the parent node until there is no parent left.
   */
  private notifyAncestors(node: SubscriptionNode) {
    const ancestor = this.parents.get(node.id);

    if (ancestor) {
      /**
       * Make sure the root node is the first one to receive the notification
       * by recursively calling up the graph before notifying self.
       */
      this.notifyAncestors(ancestor);

      ancestor.notify();
    }
  }

  /**
   * Recursively notifies children until there are no children left.
   */
  private notifySelfAndChildren(node: SubscriptionNode) {
    /**
     * Notify self before recursively going down the graph to notify children.
     */
    node.notify();

    const children = this.children.get(node.id) ?? new Set();

    for (const child of children) {
      this.notifySelfAndChildren(child);
    }
  }

  /**
   * Check whether a node no longer has listeners or children.
   * If so, then it should be cleaned up to avoid memory leaks.
   */
  private clean(node: SubscriptionNode) {
    const children = this.children.get(node.id) ?? new Set();

    /**
     * If the node has any dependents (children or listeners),
     * then we should not clean this up, so bail.
     */
    if (children.size > 0 || node.size > 0) {
      return;
    }

    /**
     * Remove this node from the list of nodes.
     */
    this.nodes.delete(node.id);

    /**
     * Get the parent node. If there is no parent, we
     * are at the root node so there is nothing left to do.
     */
    const parent = this.parents.get(node.id);

    if (parent) {
      /**
       * Delete the current node parents map.
       */
      this.parents.delete(node.id);

      /**
       * Remove the node from the parent's list of children. It's a `Set`
       * so no need to re-insert into `this.children`.
       */
      const siblings = this.children.get(parent.id) ?? new Set();
      siblings.delete(node);

      /**
       * Now recurse and see whether the parent node should also be removed.
       * This could occur if you only had one listener for `['a', 'b', 'c', 'd']`
       * and it is removed. In this case, we would want to go up the chain and
       * remove all of them.
       */
      this.clean(parent);
    }
  }
}
