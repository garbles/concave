export const ReactDevtools = {
  /**
   * A shitty hack to check whether the current function call is occurring
   * inside React Devtools.
   */
  isCalledInsideReactDevtools: () => {
    const err = new Error();
    return err.stack?.includes("react_devtools_backend");
  },
};
