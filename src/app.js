const express = require("express");
const session = require("express-session");

const SQLiteStoreFactory = require("connect-sqlite3");

const path = require("node:path");
const fs = require("node:fs");

const helmet = require("helmet");

const config = require("./config");

const tasksRouter = require("./routes/tasks.routes");

const {
  AppError,
  errorHandler
} = require("./errors");

const SQLiteStore = SQLiteStoreFactory(session);

function createApp() {

  const app = express();

  app.set("io", {
    emit() {}
  });

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(express.json({
    limit: "100kb"
  }));

  fs.mkdirSync(
    path.resolve("./data"),
    { recursive: true }
  );

  // Sesiones persistentes.
  const sessionMiddleware = session({

    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.resolve("./data")
    }),

    secret: config.sessionSecret,

    resave: false,

    saveUninitialized: false,

    cookie: {

      httpOnly: true,

      sameSite: "lax",

      secure: config.isProduction,

      maxAge: 1000 * 60 * 60 * 8
    }
  });

  app.use(sessionMiddleware);

  createApp.sessionMiddleware = sessionMiddleware;

  // Iniciar sesión.
  app.post("/api/session/login", (req, res, next) => {

    const { username, password } = req.body || {};

    // Credenciales.
    if (
      username !== "administrador" ||
      password !== "demo012"
    ) {

      return next(
        new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Usuario o contraseña incorrectos"
        )
      );
    }

    // Regeneración de sesión.
    req.session.regenerate(error => {

      if (error) return next(error);

      req.session.user = {
        id: 1,
        username: "administrador"
      };

      req.session.save(saveError => {

        if (saveError) return next(saveError);

        res.json({
          data: {
            user: req.session.user
          }
        });
      });
    });
  });

  app.get("/api/session", (req, res) => {

    if (!req.session.user) {

      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Debes iniciar sesión"
      );
    }

    res.json({
      data: {
        user: req.session.user
      }
    });
  });

  // Cierre de sesión.
  app.delete("/api/session", (req, res, next) => {

    req.session.destroy(error => {

      if (error) return next(error);

      res.clearCookie("connect.sid");

      res.status(204).end();
    });
  });

  // Protección de rutas de datos.
  app.use(
    "/api/tasks",

    (req, res, next) => {

      if (!req.session.user) {

        return next(
          new AppError(
            401,
            "UNAUTHENTICATED",
            "Inicia sesión para acceder a las tareas"
          )
        );
      }

      next();
    },

    tasksRouter
  );

  // API
  app.use("/api", (_req, _res, next) => {

    next(
      new AppError(
        404,
        "ROUTE_NOT_FOUND",
        "Ruta API no encontrada"
      )
    );
  });

  // Interfaz web.
  app.use(express.static(
    path.join(__dirname, "..", "public")
  ));

  // Middleware.
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,

  getSessionMiddleware: () =>
    createApp.sessionMiddleware
};