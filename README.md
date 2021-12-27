<p align="center">
  <img src="./image.png" />
</p>

Lens-like state management (for React).

## Overview

Concave is not a general purpose state management library. It is intended for highly interactive UIs where the shape of the state is recursive and/or closely reflects the shape of the UI. Specifically, Concave is an strong candidate for page/form/diagram builder-type applications (written in React).

#### Why use Concave?

1. Excellent for handling recursive application states.
2. Use it where you need it. Not an all or nothing solution.
3. Minimalistic and intuitive API.

### Create your lens

```ts
// lens.ts

import { createLens } from "concave";

export type Todo = {
  description: string;
  completed: boolean;
};

export type State = {
  todos: Todo[];
};

const initialAppState: State = {
  todos: [],
};

export const lens = createLens<State>(initialAppState);
```

### Build your application

```tsx
// index.tsx

import ReactDOM from "react";
import { lens } from "./lens";
import { App } from "./components/App";

/**
 * Retreive the underlying store.
 */
const store = lens.getStore();

/**
 * Subscribe to state updates.
 */
store.subscribe(() => {
  const currentState = store.getSnapshot();

  /**
   * Do something with the `currentState`.
   */
});

const root = ReactDOM.createRoot(document.querySelector("#root"));
root.render(<App state={lens} />);
```

```tsx
// components/App.tsx

import { Lens } from "concave";
import { State } from "../lens";
import { NewTodoForm } from "./NewTodoForm";
import { Todo } from "./Todo";

type Props = {
  state: Lens<State>;
};

/**
 * Fully memoize the component because `Lens<State>` is static and will never change.
 */
export const App = React.memo((props: Props) => {
  /**
   * `lens.use()` is a React hook that integrates the underlying
   * store into the component life cycle.
   *
   * It takes a "should update?" argument that decides whether the hook should
   * trigger a re-render. In this case, we render when the length of todos changes
   * or any todo.completed is toggled.
   */
  const [todos, updateTodos] = props.state.todos.use({ completed: true });

  const incomplete = todos.filter((todo) => !todo.completed);
  const complete = todos.filter((todo) => todo.completed);

  <>
    {/* When creating a new TODO, append it to the list of existing todos. */}
    <NewTodoForm onCreate={(todo) => updateTodos((prev) => [...prev, todo])} />
    {incomplete.map((todo) => {
      /**
       * Tranform data back into `Lens<Todo>`.
       */
      const lens = todo.toLens();

      /**
       * Render using the unique `lens.$key` as the key.
       */
      return <Todo state={lens} key={lens.$key} />;
    })}
    {complete.map((todo) => {
      const lens = todo.toLens();
      return <Todo state={lens} key={lens.$key} />;
    })}
  </>;
});
```

```tsx
// components/Todo.tsx

import { Lens } from "concave";
import type { Todo } from "../lens";

type Props = {
  state: Lens<Todo>;
};

/**
 * Fully memoize the component because `Lens<Todo>` is static and will never change.
 */
export const Todo = React.memo((props: Props) => {
  const [todo, setTodo] = props.state.use();

  /**
   * Render the Todo.
   */
});
```

## Installation

This library uses `useSyncExternalStore` (introduced in React 18). If you want to use Concave with a version of React older than 18, you must also [install a shim](https://github.com/reactwg/react-18/discussions/86).

```bash
npm install concave use-sync-external-store
```

## API

### createLens

`createLens<S>(initialState: S): Lens<S>`

Creates a store with state `S` and wraps it in a `Lens<S>` which is returned. To create a `Lens<S>` inside of a React component, use `useCreateLens` (see below).

```ts
import { createLens } from "concave";
import { State, initialState } from "./state";

export const lens = createLens<State>(initialState);
```

### Lens

```ts
type Lens<A> = {
  getStore(): Store<A>;
  use(shouldUpdate?: ShouldUpdate): [ProxyValue<A>, Update<A>];
  $key: string;
};
```

A stateless [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around some data `A`. Inherits all
_own keys_ that the underlying object/array would have.

For example,

```ts
type Account = {
  name: string;
  email: string;
};

type User = {
  id: string;
  account: Account;
};

type State = {
  user: User;
};

let lens: Lens<State>;

// ...

const userLens: Lens<User> = lens.user;
const accountLens: Lens<Account> = userLens.account;
const emailLens: Lens<string> = accountLens.email;
```

Lenses are cached and static from the time they are first accessed. `lens.user.account` will always _be_ the same `Lens<Account>`.

:warning: If a React component only accepts a `Lens<Account>` as props then it can be fully memoized with `React.memo`.

### Lens.getStore(): Direct access to the store

`Lens<A>.getStore(): Store<A>`

Every `Lens<A>` exposes a `getStore()` method that returns the underlying `Store<A>` (see below). With this you can access the current state of the store for `A`, as well as subscribe to and push updates.

```ts
let accountLens: Lens<Account>;

const accountStore: Store<Account> = accountLens.getStore();

/**
 * Subscribe to all updates that may be relevant to `Lens<Account>`.
 */
const unsubscribe = accountStore.subscribe(() => {
  const currentAccount = accountStore.getSnapshot();

  /**
   * Do something with `currentAccount`.
   */
});

// ...

let email: string;

/**
 * Update email.
 */
accountStore.update((account) => {
  return { ...account, email };
});
```

### Lens.use(): Hook into a React component

`Lens<A>.use(shouldUpdate?: ShouldUpdate): [ProxyValue<A>, Update<A>]`

A React hook that wraps `getStore()` into the component lifecycle and returns a tuple similar to `React.useState`.

The first value, `ProxyValue<A>`, is a Proxy around some state `A`.

```ts
type ProxyValue<A> = { [K in keyof A]: ProxyValue<A[K]> } & { toLens(): Lens<A> };
```

It applies recursively, so accessing properties of a `ProxyValue<A>` will return another `ProxyValue<A[keyof A>` **unless it is a primitive value**.

That is,

```ts
let lens: Lens<State>;

const App = () => {
  const [state, updateState] = lens.use();

  /**
   * `state.user.account` is a `ProxyValue<Account>`.
   */
  const accountLens = state.user.account.toLens();

  /**
   * Error! `.toLens()` is not defined on primitive values.
   */
  state.user.account.email.toLens();

  // ...
};
```

Calling `toLens()` will return the same `Lens<A>` as if you had just traversed the lens.

```ts
let lens: Lens<State>;

const App = () => {
  const [state, updateState] = lens.use();

  /**
   * These are the same. `Object.is(accountLens1, accountLens2) === true`.
   */
  const accountLens1 = state.user.account.toLens();
  const accountLens2 = lens.user.account;

  // ...
};
```

The second value in the `use()` tuple, `Update<A>`, is a function that takes a callback where the current store value is passed as an argument and expects to return the next value.

```ts
let lens: Lens<State>;

const App = () => {
  const [account, updateAccount] = lens.user.account.use();

  // ...

  updateAccount((currentAccount) => {
    return {
      ...currentAccount,
      email: "neato@example.com",
    };
  });

  // ...
};
```

### Going back and forth between Lens and Value

### Should use() re-render?

Whether it's iterating an array or switching on a [discriminated union](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#union-exhaustiveness-checking), you will need to call `Lens.use()` in order to access the underlying data and decide _what_ to render. The "should update" argument is an optional way to decide whether `Lens.use()` should trigger a re-render. Specifically, it provides a convenient way to define the data dependencies for the component—not unlike the dependency array for `useEffect`, `useCallback`, etc.

By default, the behavior is to render when the values are no longer strictly equal. The following is a list of ways to define "should update",

1. `true`: Noop. Will inherit the default behavior.
2. `false`: Will never re-render.
3. `(prev: A, next: A) => boolean`: Similar to React's `shouldComponentUpdate`.
4. `(keyof A)[]`: Will only render when any of the listed keys change.
5. `{ [K in keyof A]: ShouldUpdate<A[K]> }`: Will recursively apply these rules to values and ignore any keys that are not provided.

Here are some examples,

```ts
/**
 * Render when the account object changes.
 */
lens.user.account.use(true);

/**
 * Never re-render.
 */
lens.user.account.use(false);

/**
 * Render _only_ when the account.email changes.
 */
lens.user.account.use({ email: true });

/**
 * Render _only_ when the next email value is longer than the one
 * that was previously rendered.
 */
lens.user.account.use({ email: (prev, next) => next.length > prev.length });

/**
 * Functionally equivalent to `false`. Never re-render.
 */
lens.user.account.use({});

/**
 * Render _only_ when the account.name changes.
 */
lens.user.account.use(["name"]);

/**
 * Render _only_ when the account.name or account.email changes.
 */
lens.user.account.use(["name", "email"]);

/**
 * Render _only_ when the user.account.name changes. Note this is different than
 * the above as it is the lens for the entire User and not just the Account.
 */
lens.user.use({ account: ["name"] });
```

:warning: **For arrays, when defining "should update" as an array of keys or an object (4 or 5 above), the library assumes that you also mean to trigger a render when the length of the array changes. Additionally, when specifying properties on an array, it is assumed that you mean to target all of the members of the array. You therefore do not need to traverse the keys of the array (the indices) and instead you define keys of the individual members.** :warning:

For example,

```ts
type State = {
  todos: Array<{
    completed: boolean;
    description: string;
    // ...
  }>;
};

let lens: Lens<State>;

/**
 * Render _only_ when the length of `todos` has changed and/or _any_ of
 * the todos' `completed` is toggled.
 */
lens.todos.use({ completed: true });

/**
 * Render _only_ when the length has changed _or_ any of the todos' `description` has changed.
 */
lens.todos.use(["description"]);

/**
 * Render _only_ when the length has changed.
 */
lens.todos.use([]);
lens.todos.use({});
lens.todos.use((prev, next) => prev.length !== next.length);
```

### Lens.$key: A unique key for the `Lens<A>`

A unique key for the `Lens<A>` (Just matches the traversal path.) `lens.user.account.email.$key === "root.user.account.email"`. Meant to be used when React requires a key.

```tsx
export const TodoList = () => {
  const [todos] = todoLens.use();

  return <>
    {todos.map((todo) => {
      const lens = todo.toLens();

      return <Todo state={lens} key={lens.$key} />
    })}
  <>
}
```

### Store

```ts
type Store<A> = {
  getSnapshot(): A;
  subscribe(listener: Listener): Unsubscribe;
  update((current: A) => A): void;
}

type Listener = () => void;
type Unsubscribe = () => void;
```

Returned by `lens.getStore()`. Mostly useful outside of the React component life cycle.

### useCreateLens

`useCreateLens<A>(initialState: S | (() => S)): Lens<S>`

A convenience wrapper that memoizes a call to `createLens`. If passed a function, it will call it once when creating the `Lens<S>`.
