process.env.DB_FILE = "./data/test.sqlite";
process.env.UPLOAD_DIR = "./uploads-test";
process.env.SESSION_SECRET = "secreto-de-pruebas-suficientemente-largo";

const {
  test,
  before,
  after
} = require("node:test");

const assert = require("node:assert/strict");

const fs = require("node:fs");

const request = require("supertest");

const { createApp } = require("../src/app");

const db = require("../src/db");

let app;
let agent;

before(() => {

  db.exec("DELETE FROM tasks");

  app = createApp();

  agent = request.agent(app);
});

after(() => {

  db.exec("DELETE FROM tasks");

  db.close();

  fs.rmSync("./data/test.sqlite", {
    force: true
  });

  fs.rmSync("./uploads-test", {
    recursive: true,
    force: true
  });
});

test("Debe impedir el acceso sin sesión", async () => {

  const response = await request(app)
    .get("/api/tasks");

  assert.equal(response.status, 401);

  assert.equal(
    response.body.error.code,
    "UNAUTHENTICATED"
  );
});

test("Debe iniciar sesión correctamente", async () => {

  const response = await agent
    .post("/api/session/login")
    .send({
      username: "administrador",
      password: "demo012"
    });

  assert.equal(response.status, 200);

  assert.equal(
    response.body.data.user.username,
    "administrador"
  );
});

test("Debe rechazar datos incorrectos", async () => {

  const response = await agent
    .post("/api/tasks")
    .send({
      title: ""
    });

  assert.equal(response.status, 400);

  assert.equal(
    response.body.error.code,
    "VALIDATION_ERROR"
  );
});

test("Debe ejecutar el CRUD completo", async () => {

  // CREATE

  const created = await agent
    .post("/api/tasks")
    .send({
      title: "Preparar proyecto",
      description: "Desarrollar API REST",
      status: "pendiente"
    });

  assert.equal(created.status, 201);

  const id = created.body.data.id;

  assert.equal(
    created.body.data.title,
    "Preparar proyecto"
  );

  // READ

  const fetched = await agent
    .get(`/api/tasks/${id}`);

  assert.equal(fetched.status, 200);

  assert.equal(
    fetched.body.data.title,
    "Preparar proyecto"
  );

  // LIST

  const listed = await agent
    .get("/api/tasks?status=pendiente");

  assert.equal(listed.status, 200);

  assert.equal(listed.body.data.length, 1);

  // UPDATE

  const version = fetched.body.data.version;

  const updated = await agent
    .patch(`/api/tasks/${id}`)
    .set("If-Match", String(version))
    .send({
      status: "completada"
    });

  assert.equal(updated.status, 200);

  assert.equal(
    updated.body.data.status,
    "completada"
  );

  assert.equal(
    updated.body.data.version,
    version + 1
  );

  // CONFLICTO DE VERSIONES

  const conflict = await agent
    .patch(`/api/tasks/${id}`)
    .set("If-Match", String(version))
    .send({
      title: "Cambio obsoleto"
    });

  assert.equal(conflict.status, 409);

  assert.equal(
    conflict.body.error.code,
    "VERSION_CONFLICT"
  );

  // ID INCORRECTO

  const badId = await agent
    .get("/api/tasks/no-es-un-id");

  assert.equal(badId.status, 400);

  // DELETE

  const deleted = await agent
    .delete(`/api/tasks/${id}`);

  assert.equal(deleted.status, 204);

  // COMPROBAR ELIMINACIÓN

  const missing = await agent
    .get(`/api/tasks/${id}`);

  assert.equal(missing.status, 404);
});

test("Debe cerrar la sesión", async () => {

  const response = await agent
    .delete("/api/session");

  assert.equal(response.status, 204);

  const protectedResponse = await agent
    .get("/api/tasks");

  assert.equal(protectedResponse.status, 401);
});