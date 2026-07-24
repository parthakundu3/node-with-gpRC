/**
 * server.js  –  gRPC server wiring all UserService RPCs to the database layer
 */

const path   = require("path");
const grpc   = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");

const db = require("../db/database");

// ─── Proto loading ────────────────────────────────────────────────────────────

const PROTO_PATH = path.join(__dirname, "../../proto/user.proto");

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDef).user;

// ─── RPC handlers ─────────────────────────────────────────────────────────────

// CREATE
async function createUser(call, callback) {
  try {
    const { name, email, age } = call.request;

    if (!name || !email || !age) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "name, email and age are required",
      });
    }

    const user = await db.createUser({ name, email, age });
    callback(null, { success: true, message: "User created successfully", user });
  } catch (err) {
    callback({ code: grpc.status.ALREADY_EXISTS, message: err.message });
  }
}

// READ – single
async function getUser(call, callback) {
  try {
    const { id } = call.request;
    const user = await db.getUserById(id);

    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: `User "${id}" not found` });
    }

    callback(null, { success: true, message: "User retrieved successfully", user });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// UPDATE
async function updateUser(call, callback) {
  try {
    const { id, name, email, age } = call.request;

    if (!id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "id is required" });
    }

    const user = await db.updateUser({ id, name, email, age });

    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: `User "${id}" not found` });
    }

    callback(null, { success: true, message: "User updated successfully", user });
  } catch (err) {
    callback({ code: grpc.status.ALREADY_EXISTS, message: err.message });
  }
}

// DELETE
async function deleteUser(call, callback) {
  try {
    const { id } = call.request;
    const deleted = await db.deleteUser(id);

    if (!deleted) {
      return callback({ code: grpc.status.NOT_FOUND, message: `User "${id}" not found` });
    }

    callback(null, { success: true, message: "User deleted successfully" });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// LIST
async function listUsers(call, callback) {
  try {
    const users = await db.listUsers();
    callback(null, { success: true, message: `${users.length} user(s) found`, users });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

async function startServer(port = 50051) {
  await db.initDB();

  const server = new grpc.Server();

  server.addService(userProto.UserService.service, {
    createUser,
    getUser,
    updateUser,
    deleteUser,
    listUsers,
  });

  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) return reject(err);
        console.log(`🚀  gRPC server listening on port ${boundPort}`);
        resolve(server);
      }
    );
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

module.exports = { startServer };
