const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const authenticateToken = require("../middleware/authMiddleware.middleware");

// Configurar multer para guardar el archivo temporalmente
const upload = multer({ dest: "uploads/" });
const PYTHON_PATH = "C:\\Users\\denze\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";

// Obtener los nombres de las imágenes en la carpeta 'output_images'
router.get("/get-uploaded-images", authenticateToken, (req, res) => {
  try {
    const dirPath = path.join(__dirname, "../processing/output_images/");
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        return res.status(500).send("Error al leer la carpeta");
      }
      res.json(files);
    });
  } catch (err) {
    res.status(500).json({ err: "Error interno del servidor" });
  }
});

// Obtener los nombres de los exámenes subidos en la carpeta 'uploads'
router.get("/get-uploaded-exams", authenticateToken, (req, res) => {
  const uploadsFolder = path.join(__dirname, "..", "..", "uploads");
  fs.readdir(uploadsFolder, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error al leer los exámenes subidos" });
    }
    // Filtrar solo archivos PDF
    const pdfs = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
    res.json(pdfs);
  });
});

// Obtener los nombres de los exámenes procesados en la carpeta 'detected_exams'
router.get("/get-detected-exams", authenticateToken, (req, res) => {
  const detectedFolder = path.join(__dirname, "..", "..", "processing", "detected_exams");
  fs.readdir(detectedFolder, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error al leer los exámenes procesados" });
    }
    // Filtrar solo archivos JSON
    const detectedExams = files.filter((file) => file.toLowerCase().endsWith(".json"));
    res.json(detectedExams);
  });
});

// cargar archivos
router.post(
  "/upload",
  authenticateToken,
  upload.array("files", 50),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send("No se subió ningún archivo");
    }
    try {
      req.files.forEach((file) => {
        // Asegura que el archivo tenga extensión .pdf y nombre original
        let originalName = file.originalname;
        if (!originalName.toLowerCase().endsWith('.pdf')) {
          originalName += '.pdf';
        }
        const oldPath = path.join(__dirname, "..", "..", "uploads", file.filename);
        const newPath = path.join(__dirname, "..", "..", "uploads", originalName);
        fs.renameSync(oldPath, newPath);
      });
      res.json({ message: "Archivos PDF subidos correctamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al guardar los archivos PDF" });
    }
  }
);
module.exports = router;
