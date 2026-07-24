# gRPC CRUD – Node.js + PostgreSQL

A complete gRPC service demonstrating **Create / Read / Update / Delete** operations on a `User` entity, backed by a PostgreSQL database via [`pg`](https://www.npmjs.com/package/pg) (node-postgres).

---

## Project structure

```
grpc-crud/
├── .env                ← Database & API config
├── proto/
│   └── user.proto          ← Service & message definitions
├── src/
│   ├── db/
│   │   └── database.js     ← PostgreSQL layer (pg Pool)
│   ├── server/
│   │   └── server.js       ← gRPC server + RPC handlers
│   ├── client/
│   │   └── client.js       ← Promisified client + demo runner
│   └── test/
│       └── test.js         ← Integration tests (no external runner)
├── package.json
└── README.md
```

---

## Quick start

### Prerequisites

- Node.js >= 18
- A running PostgreSQL instance

### Setup

```bash
# 1. Create the database (run once)
psql -U postgres -c "CREATE DATABASE grpc_crud;"

# 2. Configure connection in .env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=grpc_crud

# 3. Install dependencies
npm install

# Terminal 1 – start the server (auto-creates the users table)
npm start          # listens on :50051

# Terminal 2 – run the demo client
npm run client     # creates, reads, updates, lists, deletes users

# Run all tests
npm test
```

The `users` table is created automatically on first start if it doesn't exist.

---

## Proto service contract

```proto
service UserService {
  rpc CreateUser (CreateUserRequest) returns (UserResponse);
  rpc GetUser    (GetUserRequest)    returns (UserResponse);
  rpc UpdateUser (UpdateUserRequest) returns (UserResponse);
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserResponse);
  rpc ListUsers  (ListUsersRequest)  returns (ListUsersResponse);
}
```

---

## Testing options

### 1 – Automated tests (built-in)

```bash
npm test
```

Spins up a dedicated server on port 50099, runs 11 assertions covering every RPC and error case, then prints a pass/fail summary.

---

### 2 – Demo client (manual walkthrough)

```bash
# Make sure the server is running first
npm start

# In another terminal
npm run client
```

Executes the full CRUD lifecycle and pretty-prints each response.

---

### 3 – grpcurl (CLI, like curl for gRPC)

Install: https://github.com/fullstorydev/grpcurl/releases

```bash
# List available services
grpcurl -plaintext -import-path proto -proto user.proto localhost:50051 list

# CREATE
grpcurl -plaintext -import-path proto -proto user.proto \
  -d '{"name":"Alice","email":"alice@example.com","age":28}' \
  localhost:50051 user.UserService/CreateUser

# GET  (replace <id> with the id returned above)
grpcurl -plaintext -import-path proto -proto user.proto \
  -d '{"id":"<id>"}' \
  localhost:50051 user.UserService/GetUser

# UPDATE
grpcurl -plaintext -import-path proto -proto user.proto \
  -d '{"id":"<id>","name":"Alice Smith","age":29}' \
  localhost:50051 user.UserService/UpdateUser

# LIST
grpcurl -plaintext -import-path proto -proto user.proto \
  -d '{}' \
  localhost:50051 user.UserService/ListUsers

# DELETE
grpcurl -plaintext -import-path proto -proto user.proto \
  -d '{"id":"<id>"}' \
  localhost:50051 user.UserService/DeleteUser
```

---

### 4 – Postman / Kreya (GUI)

1. Open Postman → **New → gRPC Request**
2. Enter server URL: `localhost:50051`
3. Import `proto/user.proto`
4. Select a method from the dropdown and fill in the JSON body

---

### 5 – BloomRPC / Evans (dedicated gRPC GUI)

- **Evans** (interactive REPL): `evans --proto proto/user.proto --host localhost --port 50051`
- **BloomRPC**: import `proto/user.proto`, connect to `localhost:50051`

---

## gRPC status codes used

| Code | Meaning | When returned |
|------|---------|---------------|
| `OK` (0) | Success | All happy-path responses |
| `INVALID_ARGUMENT` (3) | Bad input | Missing required fields |
| `NOT_FOUND` (5) | Resource missing | Unknown id on get/update/delete |
| `ALREADY_EXISTS` (6) | Duplicate | Duplicate email on create/update |
| `INTERNAL` (13) | Server error | Unexpected DB exceptions |

---

## Swapping the database

The entire database layer lives in `src/db/database.js`.
It currently uses `pg` (node-postgres) with a connection pool.
Replace it with `better-sqlite3`, `mysql2`, or any other store
by re-implementing the exported functions:

```js
initDB()                    // async setup – create pool / tables
createUser({name, email, age})
getUserById(id)
updateUser({id, name, email, age})
deleteUser(id)
listUsers()
clearUsers()                // test helper
closeDB()                   // teardown
```

The server and client never touch the DB directly, so the swap is zero-friction.
