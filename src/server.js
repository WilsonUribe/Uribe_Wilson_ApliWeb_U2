require("dotenv").config();

const http = require("node:http");

const { Server } = require("socket.io");

const { createApp, getSessionMiddleware } =
  require("./app");

const config = require("./config");

const app = createApp();

const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 1e6
});

// Compartir sesiones HTTP con Socket.IO.
io.engine.use(getSessionMiddleware());

// Autoriza las conexiones.
io.use((socket, next) => {

  if (!socket.request.session?.user) {

    return next(
      new Error("unauthorized")
    );
  }

  next();
});

app.set("io", io);

// Inicio del servidor.
server.listen(config.port, () => {

  console.log(
    `Servidor iniciado en http://localhost:${config.port}`
  );
});

// Cierre controlado.
function shutdown() {

  io.close(() => {

    server.close(() => {
      process.exit(0);
    });

  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);