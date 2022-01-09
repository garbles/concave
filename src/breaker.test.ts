import { Breaker } from "./breaker";

test("connects/disconnects", () => {
  const unsubscribe = jest.fn();
  const subscribe = jest.fn(() => unsubscribe);

  const breaker = new Breaker(subscribe);

  expect(breaker.connected).toBe(false);

  breaker.connect();

  expect(breaker.connected).toBe(true);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(0);

  breaker.connect();

  expect(breaker.connected).toBe(true);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(0);

  breaker.disconnect();

  expect(breaker.connected).toBe(false);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);

  breaker.connect();

  expect(breaker.connected).toBe(true);
  expect(subscribe).toHaveBeenCalledTimes(2);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
