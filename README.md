<p align="center">
  <img src="./image.png" />
</p>

Lens-like state management (for React).

<!-- Table of Contents -->

## Overview

Concave is not a general purpose state management library. It is intended for highly interactive UIs where the shape of the state is recursive and/or closely reflects the shape of the UI. Specifically, Concave is an strong candidate for page/form/diagram builder-type applications (written in React).

### Why use Concave?

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

## Thinking in lenses

If you have built React applications with Redux then you are probably familiar with [selectors](https://redux.js.org/usage/deriving-data-selectors). A Redux selector is a "getter" from the monolithic application state meant to obfuscate the shape of that state from the rest of the application. Used correctly, they are a good application of the [Law of Demeter](https://en.wikipedia.org/wiki/Law_of_Demeter).

```ts
import { State, User } from "./state";

/**
 * Get `User` off of the global `State`
 */
export const getUser = (state: State): User => state.user;

/**
 * Get `name` off the `User`
 */
export const getUserName = (state: State) => getUser(state).name;
```

The second "getter", `getUserName`, is a "refinement" on `getUser`. It gives us a way to write `getUserName` in terms of the _entire_ application state without revealing it. That is, `getUserName` only needs to know the shape of `User`, while `getUser` can get it from the parent. And so on...

In Redux, state applications occur through dispatching actions. Lets consider how updates would look with explicit "setters".

```ts
/**
 * Set `user` on the global `State`.
 */
export const setUser = (state: State, user: User) => {
  return {
    ...state,
    user,
  };
};

/**
 * Set `name` on `user` which in turn will set `user` on the global `State`.
 */
export const setUserName = (state: State, name: string) => {
  const user = getUser(state);

  return setUser(state, {
    ...user,
    name,
  });
};
```

Again, notice how the second "setter" relies on the first: `setUserName` is a "refinement" of `setUser`. Once more, `setUserName` can rely on `getUser` and `setUser` in order to get and set the user on the global state without revealing it.

### A lens is a "getter" and "setter" pair that are "refined" together

Lets start by writing a basic lens for the entire state.

```ts
const stateLens: BasicLens<State, State> = {
  get(state: State): State {
    return state;
  },

  set(prev: State, next: State): State {
    return next;
  },
};
```

This is the identity equivalent for a lens, but now lets "refine" the lens for the user.

```ts
const userLens: BasicLens<State, User> = {
  get(state: State): User {
    return stateLens.get(state).user;
  },

  set(state: State, next: User): State {
    const prev = stateLens.get(state);

    return stateLens.set(state, {
      ...prev,
      user,
    });
  },
};
```

And finally for the user name.

```ts
const userNameLens: BasicLens<State, string> = {
  get(state: State) {
    return userLens.get(state).name;
  },

  set(state: State, name: string): State {
    const user = userLens.get(state);

    return userLens.set(state, {
      ...user,
      name,
    });
  },
};
```

These look nearly identical to the getter/setter examples above except they are defacto paired together. Each refinement _focuses_ more and more on a specific piece of data—which is why they are called lenses. Despite that, they are always rooted in terms of the global `State`.

```ts
const globalState: State = {
  /* ... */
};

/**
 * Retrieve the user name
 */
const userName = userNameLens.get(globalState);

// ...

const nextGlobalState = userNameLens.set(globalState, "Gabey Baby");
```

You may have noticed that it is probably common to make property (`keyof Refinement`) refinements and so we can just write a helper function to do this.

```ts
declare function prop<State, Refinement, Key extends keyof Refinement>(
  lens: BasicLens<State, Refinement>,
  key: Key
): BasicLens<State, Refinement[Key]>;
```

And so instead, you might say.

```ts
const userLens = prop(stateLens, "user");
const userNameLens = prop(userLens, "name");
```

### Looking recursively

Lenses start to become particularly useful in situations where both the UI and application state are recursive. Builder-type applications
often have sections inside of sections inside of sections with arbitrary contents and their data is represented as such. Using Redux to maintain this kind of state will often devolve into coming up with some kind of weird scheme where we keep track of the key path and pass it as an argument to the action so that the reducer can walk the state and find the piece of data that you actually meant to update. By pairing the data getter with a corresponding setter, these kinds of updates become trivial.

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

```ts
declare function getStore(): Store<A>;
```

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

```ts
declare function use(shouldUpdate?: ShouldUpdate): [ProxyValue<A>, Update<A>]`
```

A React hook that wraps `getStore()` into the component lifecycle and returns a tuple similar to `React.useState`.

The first value, `ProxyValue<A>`, is a Proxy around some state `A`.

```ts
type ProxyValue<A> = { [K in keyof A]: ProxyValue<A[K]> } & { toLens(): Lens<A> };
```

It applies recursively, so accessing properties of a `ProxyValue<A>` will return another `ProxyValue<A[keyof A>` **unless it is a primitive value** :warning:. That is,

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

### Should use() re-render?

Whether it's iterating an array or switching on a [discriminated union](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#union-exhaustiveness-checking), you will need to call `Lens.use()` in order to access the underlying data and decide _what_ to render. The "should update" argument is an optional way to decide whether `Lens.use()` _should_ re-render. Specifically, it provides a convenient way to define the data dependencies for the component—not unlike the dependency array for `useEffect`, `useCallback`, etc.

The default behavior of `Lens.use()` is to render when the next value is no longer _strictly equal_ to the previous one. However, this is not sufficient for a deeply recursive component tree. And the closer the `Lens.use()` call is to the root state, the more likely an update will fail the strictly equal check because changes cascade up the lens' inner traversal.

For example, a component relying on `lens.element.use()` that does not define a "should update" argument would trigger a re-render when another component updates from `lens.element.data.children[1].data.placeholder.use()`. Therefore, if the component only actually relied on the `status` property of the `element`, it could be rewritten as `lens.element.use({ status: true })` and all other changes would be ignored.

The following is a list of ways to define "should update",

1. `true`: Noop. Will inherit the default behavior.
2. `false`: Will never re-render.
3. `(prev: A, next: A) => boolean`: Similar to React's `shouldComponentUpdate`.
4. `(keyof A)[]`: Will only render when any of the listed keys change.
5. `{ [K in keyof A]: ShouldUpdate<A[K]> }`: Will recursively apply these rules to values and ignore any keys that are not provided.

Here are some examples of how you can define "should update",

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

```ts
declare function useCreateLens<A>(initialState: S | (() => S)): Lens<S>;
```

A convenience wrapper that memoizes a call to `createLens`. If passed a function, it will call it once when creating the `Lens<S>`.
