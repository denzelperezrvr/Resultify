const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const usersRouter = require("../routers/users.router");
const examsRouter = require("../routers/exams.router");
const uploadsRouter = require("../routers/uploads.router");
const submissionsRouter = require("../routers/submissions.router");

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("This is express");
});

// routers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/exams", examsRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/submissions", submissionsRouter);

app.use((err, req, res, next) => {
  res.status(500).json({
    ok: false,
    message: "Ocurrió un error en el servidor",
    error: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : undefined,
  });
});

module.exports = app;
