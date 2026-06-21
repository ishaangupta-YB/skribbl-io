/**
 * @skribbl/shared — the single source of truth shared by the Expo client and the
 * Cloudflare Workers/Durable Object backend.
 *
 * Everything here is runtime-agnostic (no Node, RN, or Workers APIs) so it runs
 * identically in Metro, workerd, and Vitest. This package is the FROZEN CONTRACT
 * that lets the parallel agents build against a stable interface.
 */
export * from "./constants";
export * from "./utils";
export * from "./schemas";
export * from "./protocol";
export * from "./scoring";
export * from "./mask";
export * from "./state-machine";
export * from "./words";
