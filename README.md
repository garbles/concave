<p align="center">
  <img src="./image.png" />
</p>

Lens-like state management (for React).

## Overview

Concave is not a general purpose state management library. It is intended for highly interactive UIs where the shape of the state is recursive and/or closely reflects the shape of the UI. Specifically, Concave is an excellent candidate for page/form/diagram builder-type applications (written in React).

#### Why use Concave?

1. Excellent for handling recursive application states.
2. Use it where you need it. Not an all or nothing solution.
3. Minimalistic and intuitive API.
4. Superior component testing experience.

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
import { State } from "./lens";
import { NewTodoForm } from "./new-todo-form";
import { Todo } from "./todo";

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
   * trigger a re-render. In this case, we re-render when the length of todos changes
   * or any of them are completed.
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
import { Lens } from "concave";
import type { Todo } from "./lens";

type Props = {
  state: Lens<Todo>;
};

/**
 * Fully memoize the component because `Lens<Todo>` is static and will never change.
 */
export const Todo = React.memo((props: Props) => {
  const [todo, setTodo] = props.state.use();

  /**
   * Render your TODO.
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

Creates a store with state `S` and wraps it in a `Lens<S>` which is returned. To create a `Lens` inside of a React component.

```ts
import { createLens } from "concave";
import { State, initialState } from "./state";

export const lens = createLens<State>(initialState);
```

### Lens

`Lens<A>`

A stateless [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around some data `A`. Inherits all
_own keys_ that the underlying object/array would have. So for example,

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

Lenses are cached and static from the time they are first accessed. So `lens.user.account` will always _be_ the same `Lens`. (Therefore, if a React component only accepts a `Lens<Account>` as props then it can be fully memoized with `React.memo`.)

#### Get the store with `getStore`

`Lens<A>.getStore(): Store<A>`

Every `Lens<A>` exposes a `getStore()` method that returns the underlying `Store<A>` (see below). With this you can access the current state of the store for `A`, as well as subscribe to and push updates.

```ts
let accountLens: Lens<Account>;

const unsubscribe = accountLens.subscribe(() => {
  const currentAccount = accountLens.getSnapshot();

  /**
   * Do something with `currentAccount`.
   */
});

// ...

let email: string;

/**
 * Update email.
 */
accountLens.update((account) => {
  return { ...account, email };
});
```

#### Hook into a React component with `use`

`Lens<A>.use(shouldUpdate?: ShouldUpdate): [ProxyValue<A>, Update<A>]`

A React hook that wraps `getStore()` in the component lifecycle and returns a tuple similar to `React.useState` (with some additional goodies).

`ProxyValue<A>` is a Proxy around `A` that is effectively `A & { toLens(): Lens<A> }`

#### `$key`

`Lens<A>.$key`

### Store

`Store<A>`

### useCreateLens

`useCreateLens<A>(initialState: S): Lens<S>`

A convenience wrapper that just memoizes a call to `createLens`.

Quite literally: `React.useMemo(() => createLens(initialState), [])`.

<!--

## Examples

## Testing

## Performance

1. Use shouldUpdate.

2. If do use a shouldUpdate argument for the lens, you can either memoize it with `React.useMemo` or `React.useCallback` or store it outside of the component.

3. Memoize every component with `React.memo` foward lenses as props rather than globals.

-->
