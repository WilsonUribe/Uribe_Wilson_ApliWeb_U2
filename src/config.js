const path = require("node:path");

module.exports = {
  port: Number(process.env.PORT || 3000),

  dbFile: path.resolve(
    process.env.DB_FILE || "./data/app.sqlite"
  ),

  uploadDir: path.resolve(
    process.env.UPLOAD_DIR || "./uploads"
  ),

  sessionSecret:
    process.env.SESSION_SECRET ||
    "secreto-solo-para-desarrollo",

  isProduction: process.env.NODE_ENV === "production"
};