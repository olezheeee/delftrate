import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { within } from "./calendar-scores";

describe("within", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the result of work that answers in time", async () => {
    const work = new Promise<string>((resolve) => setTimeout(() => resolve("ratings"), 100));
    const waiting = within(work, 2000);
    await vi.advanceTimersByTimeAsync(100);
    await expect(waiting).resolves.toBe("ratings");
    // Nothing is left waiting once the answer is in.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails once the time is up, although the work is still going", async () => {
    const work = new Promise<string>((resolve) => setTimeout(() => resolve("ratings"), 5000));
    const waiting = within(work, 2000);
    const failed = expect(waiting).rejects.toThrow("No answer within 2000 ms.");
    await vi.advanceTimersByTimeAsync(2000);
    await failed;
  });

  it("passes on the error of work that fails in time", async () => {
    const work = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("no database")), 100));
    const waiting = within(work, 2000);
    const failed = expect(waiting).rejects.toThrow("no database");
    await vi.advanceTimersByTimeAsync(100);
    await failed;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not complain when the work fails after the time is up", async () => {
    const work = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("too late")), 5000));
    const failed = expect(within(work, 2000)).rejects.toThrow("No answer within 2000 ms.");
    await vi.advanceTimersByTimeAsync(5000);
    await failed;
  });
});
