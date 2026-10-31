const db = require("../db");

const columns = `
  id,
  title,
  description,
  status,
  due_date,
  attachment_name,
  version,
  created_at,
  updated_at
`;

function list({ status, q }) {

  const clauses = [];
  const params = {};

  if (status) {
    clauses.push("status = @status");
    params.status = status;
  }

  if (q) {
    clauses.push(
      "(title LIKE @q OR description LIKE @q)"
    );

    params.q = `%${q}%`;
  }

  const where = clauses.length
    ? `WHERE ${clauses.join(" AND ")}`
    : "";

  return db.prepare(`
    SELECT ${columns}
    FROM tasks
    ${where}
    ORDER BY id DESC
  `).all(params);
}

function findById(id) {

  return db.prepare(`
    SELECT ${columns}
    FROM tasks
    WHERE id = ?
  `).get(id);
}

function create(task) {

  const result = db.prepare(`
    INSERT INTO tasks (
      title,
      description,
      status,
      due_date
    )
    VALUES (
      @title,
      @description,
      @status,
      @due_date
    )
  `).run({

    title: task.title,

    description: task.description || "",

    status: task.status || "pendiente",

    due_date: task.due_date ?? null

  });

  return findById(Number(result.lastInsertRowid));
}

function update(id, patch, expectedVersion) {

  const allowed = [
    "title",
    "description",
    "status",
    "due_date"
  ];

  const entries = Object.entries(patch)
    .filter(([key]) => allowed.includes(key));

  if (!entries.length) {
    return null;
  }

  const assignments = entries
    .map(([key]) => `${key} = @${key}`)
    .join(", ");

  const values = Object.fromEntries(entries);

  values.id = id;
  values.version = expectedVersion;

  const result = db.prepare(`
    UPDATE tasks
    SET
      ${assignments},
      version = version + 1,
      updated_at = datetime('now')
    WHERE id = @id
      AND version = @version
  `).run(values);

  if (result.changes === 0) {
    return null;
  }

  return findById(id);
}

function remove(id) {

  return db.prepare(`
    DELETE FROM tasks
    WHERE id = ?
  `).run(id).changes > 0;
}

function setAttachment(id, name, filePath) {

  db.prepare(`
    UPDATE tasks
    SET
      attachment_name = ?,
      attachment_path = ?,
      version = version + 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, filePath, id);

  return findById(id);
}

function findAttachment(id) {

  return db.prepare(`
    SELECT attachment_name, attachment_path
    FROM tasks
    WHERE id = ?
  `).get(id);
}

module.exports = {
  list,
  findById,
  create,
  update,
  remove,
  setAttachment,
  findAttachment
};