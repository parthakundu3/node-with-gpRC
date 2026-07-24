/**
 * database.js  –  PostgreSQL database layer via pg (node-postgres)
 */

require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

let pool;

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function initDB() {
  pool = new Pool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      age        INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  console.log("✅  PostgreSQL database initialised");
  return pool;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, age: row.age, createdAt: row.created_at };
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

async function createUser({ name, email, age }) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  try {
    await pool.query(
      "INSERT INTO users (id, name, email, age, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, name, email, age, createdAt]
    );
    return getUserById(id);
  } catch (err) {
    if (err.code === "23505") {
      throw new Error(`Email "${email}" is already in use`);
    }
    throw err;
  }
}

async function getUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rowToUser(rows[0] || null);
}

async function updateUser({ id, name, email, age }) {
  const existing = await getUserById(id);
  if (!existing) return null;

  const newName  = name  || existing.name;
  const newEmail = email || existing.email;
  const newAge   = age   || existing.age;

  try {
    await pool.query(
      "UPDATE users SET name = $1, email = $2, age = $3 WHERE id = $4",
      [newName, newEmail, newAge, id]
    );
    return getUserById(id);
  } catch (err) {
    if (err.code === "23505") {
      throw new Error(`Email "${newEmail}" is already in use`);
    }
    throw err;
  }
}

async function deleteUser(id) {
  const existing = await getUserById(id);
  if (!existing) return false;
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return true;
}

async function listUsers() {
  const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
  return rows.map(rowToUser);
}

// ─── Teardown ────────────────────────────────────────────────────────────────

async function closeDB() {
  if (pool) await pool.end();
}

// ─── Test helpers ────────────────────────────────────────────────────────────

async function clearUsers() {
  if (pool) await pool.query("DELETE FROM users");
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { initDB, createUser, getUserById, updateUser, deleteUser, listUsers, closeDB, clearUsers };
