const fs = require("node:fs");

const repo = require("../repository/tasks.repository");

const {
  AppError,
  notFound
} = require("../errors");

function ensureTask(id) {

  const task = repo.findById(id);

  if (!task) {
    throw notFound(`No existe la tarea ${id}`);
  }

  return task;
}

function list(filters) {
  return repo.list(filters);
}

function get(id) {
  return ensureTask(id);
}

function create(data) {
  return repo.create(data);
}

function update(id, patch, expectedVersion) {

  const current = ensureTask(id);

  if (current.version !== expectedVersion) {

    throw new AppError(
      409,
      "VERSION_CONFLICT",
      "La tarea fue modificada por otro usuario"
    );
  }

  const updated = repo.update(
    id,
    patch,
    expectedVersion
  );

  if (!updated) {
    throw new AppError(
      409,
      "VERSION_CONFLICT",
      "No se pudo actualizar la tarea"
    );
  }

  return updated;
}

function remove(id) {

  ensureTask(id);

  const attachment = repo.findAttachment(id);

  repo.remove(id);

  if (attachment?.attachment_path) {

    fs.promises.unlink(attachment.attachment_path)
      .catch(error => {
        if (error.code !== "ENOENT") {
          console.error("Error eliminando archivo:", error);
        }
      });
  }
}

function attach(id, file) {

  ensureTask(id);

  return repo.setAttachment(
    id,
    file.originalname,
    file.path
  );
}

function attachment(id) {

  const file = ensureTask(id);

  if (
    !file.attachment_name ||
    !file.attachment_path
  ) {
    throw notFound(
      "La tarea no tiene archivo adjunto"
    );
  }

  return {
    name: file.attachment_name,
    path: file.attachment_path
  };
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  attach,
  attachment
};