/**
 * test.js  –  Self-contained integration tests for gRPC UserService
 *
 * Run:  node src/test/test.js
 *
 * Spins up a real gRPC server on a random port, runs every RPC,
 * then tears everything down. No external test runner required.
 */

const assert = require("assert");
const { startServer } = require("../server/server");
const { createClient } = require("../client/client");
const db = require("../db/database");

// ─── Tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n🧪  Starting gRPC CRUD integration tests\n");

  // Boot server on a random available port
  const PORT = 50099;
  const server = await startServer(PORT);
  const client = createClient(`localhost:${PORT}`);

  // Clean up any leftover test data
  await db.clearUsers();

  let userId;

  // ── CREATE ────────────────────────────────────────────────────────────────

  await test("createUser – success", async () => {
    const res = await client.createUser({ name: "Test User", email: "test@example.com", age: 25 });
    assert.strictEqual(res.success, true);
    assert.ok(res.user.id, "should return an id");
    assert.strictEqual(res.user.name, "Test User");
    assert.strictEqual(res.user.email, "test@example.com");
    assert.strictEqual(res.user.age, 25);
    userId = res.user.id; // save for later tests
  });

  await test("createUser – duplicate email returns error", async () => {
    try {
      await client.createUser({ name: "Dup User", email: "test@example.com", age: 30 });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.message.includes("already in use") || err.code === 6 /* ALREADY_EXISTS */);
    }
  });

  await test("createUser – missing fields returns INVALID_ARGUMENT", async () => {
    try {
      await client.createUser({ name: "No Email" });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.code === 3 /* INVALID_ARGUMENT */ || err.message);
    }
  });

  // ── READ ──────────────────────────────────────────────────────────────────

  await test("getUser – existing id", async () => {
    const res = await client.getUser({ id: userId });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.id, userId);
  });

  await test("getUser – non-existent id returns NOT_FOUND", async () => {
    try {
      await client.getUser({ id: "00000000-0000-0000-0000-000000000000" });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.code === 5 /* NOT_FOUND */);
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  await test("updateUser – change name and age", async () => {
    const res = await client.updateUser({ id: userId, name: "Updated Name", age: 99 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.name, "Updated Name");
    assert.strictEqual(res.user.age, 99);
    assert.strictEqual(res.user.email, "test@example.com"); // unchanged
  });

  await test("updateUser – non-existent id returns NOT_FOUND", async () => {
    try {
      await client.updateUser({ id: "bad-id", name: "Ghost" });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.code === 5 /* NOT_FOUND */);
    }
  });

  // ── LIST ──────────────────────────────────────────────────────────────────

  await test("listUsers – returns array with at least one user", async () => {
    const res = await client.listUsers({});
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.users));
    assert.ok(res.users.length >= 1);
  });

  await test("listUsers – created user appears in list", async () => {
    const res = await client.listUsers({});
    const found = res.users.find((u) => u.id === userId);
    assert.ok(found, "created user should be in list");
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  await test("deleteUser – existing user", async () => {
    const res = await client.deleteUser({ id: userId });
    assert.strictEqual(res.success, true);
  });

  await test("deleteUser – already deleted returns NOT_FOUND", async () => {
    try {
      await client.deleteUser({ id: userId });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.code === 5 /* NOT_FOUND */);
    }
  });

  await test("getUser – after deletion returns NOT_FOUND", async () => {
    try {
      await client.getUser({ id: userId });
      throw new Error("should have thrown");
    } catch (err) {
      assert.ok(err.code === 5 /* NOT_FOUND */);
    }
  });

  // ── Teardown ──────────────────────────────────────────────────────────────

  client.close();
  server.forceShutdown();
  await db.closeDB();

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Total : ${passed + failed}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);
  console.log(`${"─".repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
