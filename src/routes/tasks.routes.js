const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const multer = require("multer");
const { randomUUID } = require("node:crypto");

const config = require("../config");
const service = require("../services/tasks.service");

const {
  taskSchema,
  updateTaskSchema,
  validate
} = require("../validation");

const { AppError } = require("../errors");

const router = express.Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

function parseId(value) {

  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "El ID debe ser un entero positivo"
    );
  }

  return Number(value);
}

function notify(req, event, data) {
  req.app.get("io").emit(event, data);
}

// Configuración de almacenamiento.
const storage = multer.diskStorage({

  destination: (_req, _file, callback) => {
    callback(null, config.uploadDir);
  },

  filename: (_req, file, callback) => {

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${randomUUID()}${extension}`
    );
  }
});

// Validación de archivos.
const upload = multer({

  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_req, file, callback) => {

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain"
    ];

    if (!allowed.includes(file.mimetype)) {

      return callback(
        new AppError(
          415,
          "UNSUPPORTED_FILE",
          "Tipo de archivo no permitido"
        )
      );
    }

    callback(null, true);
  }
});

// "GET" listado de tareas.
router.get("/", (req, res) => {

  const { status, q } = req.query;

  const validStatuses = [
    "pendiente",
    "en_progreso",
    "completada"
  ];

  if (status && !validStatuses.includes(status)) {

    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Filtro de estado no válido"
    );
  }

  if (
    q &&
    (typeof q !== "string" || q.length > 100)
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "El filtro de búsqueda debe tener hasta 100 caracteres"
    );
  }

  const tasks = service.list({ status, q });

  res.json({
    data: tasks
  });
});

// "POST" creación de tarea.
router.post("/", (req, res) => {

  const data = validate(taskSchema, req.body);

  const task = service.create(data);

  notify(req, "task:created", task);

  res
    .status(201)
    .location(`/api/tasks/${task.id}`)
    .json({
      data: task
    });
});

// GET: consultar tarea.
router.get("/:id", (req, res) => {

  const id = parseId(req.params.id);

  const task = service.get(id);

  res.json({
    data: task
  });
});

// "PATCH" actualiza tareas.
router.patch("/:id", (req, res) => {

  const id = parseId(req.params.id);

  const versionHeader = req.get("If-Match");

  if (!versionHeader) {

    throw new AppError(
      428,
      "PRECONDITION_REQUIRED",
      "Debes enviar la versión de la tarea mediante If-Match"
    );
  }

  const expectedVersion = Number(
    versionHeader.replaceAll('"', "")
  );

  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new AppError(
      400,
      "INVALID_VERSION",
      "La versión enviada no es válida"
    );
  }

  const patch = validate(
    updateTaskSchema,
    req.body
  );

  const task = service.update(
    id,
    patch,
    expectedVersion
  );

  notify(req, "task:updated", task);

  res.json({
    data: task
  });
});

// "DELETE" eliminar tarea.
router.delete("/:id", (req, res) => {

  const id = parseId(req.params.id);

  service.remove(id);

  notify(req, "task:deleted", { id });

  res.status(204).end();
});

// "POST" Subir archivo.
router.post(
  "/:id/attachment",

  (req, res, next) => {

    try {
      service.get(parseId(req.params.id));
      next();
    } catch (error) {
      next(error);
    }
  },

  upload.single("file"),

  (req, res) => {

    if (!req.file) {

      throw new AppError(
        400,
        "FILE_REQUIRED",
        "Debes adjuntar un archivo en el campo file"
      );
    }

    const id = parseId(req.params.id);

    const task = service.attach(id, req.file);

    notify(req, "task:updated", task);

    res.status(201).json({
      data: task
    });
  }
);

// Descargar archivo.
router.get("/:id/attachment", (req, res, next) => {

  try {

    const id = parseId(req.params.id);

    const file = service.attachment(id);

    res.download(
      file.path,
      file.name,
      error => {
        if (error) next(error);
      }
    );

  } catch (error) {
    next(error);
  }
});

module.exports = router;