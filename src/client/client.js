/**
 * client.js  –  Promisified gRPC client for UserService
 *
 * Can be used standalone (node src/client/client.js) or required as a module.
 */

const path   = require("path");
const grpc   = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");

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

// ─── Client factory ───────────────────────────────────────────────────────────

function createClient(address = "localhost:50051") {
  const stub = new userProto.UserService(
    address,
    grpc.credentials.createInsecure()
  );

  // Wrap every stub method in a Promise
  const promisify = (method) =>
    (request) =>
      new Promise((resolve, reject) => {
        stub[method](request, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      });

  return {
    createUser: promisify("createUser"),
    getUser:    promisify("getUser"),
    updateUser: promisify("updateUser"),
    deleteUser: promisify("deleteUser"),
    listUsers:  promisify("listUsers"),
    close:      () => grpc.closeClient(stub),
  };
}

// ─── Demo runner (standalone) ─────────────────────────────────────────────────

async function runDemo() {
  const client = createClient();
  const log    = (label, data) => console.log(`\n── ${label} ──\n`, JSON.stringify(data, null, 2));

  try {
    // CREATE
    const created = await client.createUser({ name: "Alice", email: "alice@example.com", age: 28 });
    log("CREATE", created);
    const userId = created.user.id;

    // CREATE a second user
    const created2 = await client.createUser({ name: "Bob", email: "bob@example.com", age: 34 });
    log("CREATE #2", created2);

    // READ
    const fetched = await client.getUser({ id: userId });
    log("GET", fetched);

    // UPDATE
    const updated = await client.updateUser({ id: userId, name: "Alice Smith", age: 29 });
    log("UPDATE", updated);

    // LIST
    const list = await client.listUsers({});
    log("LIST", list);

    // DELETE
    const deleted = await client.deleteUser({ id: userId });
    log("DELETE", deleted);

    // LIST again – should show only Bob
    const listAfter = await client.listUsers({});
    log("LIST after delete", listAfter);

  } catch (err) {
    console.error("❌  Client error:", err.message);
  } finally {
    client.close();
  }
}

if (require.main === module) {
  runDemo();
}

module.exports = { createClient };
