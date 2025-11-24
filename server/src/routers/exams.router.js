const router = require("express").Router();
const authenticateToken = require("../middleware/authMiddleware.middleware");
const Exams = require("../models/exams.model");
const Questions = require("../models/questions.model");
const Options = require("../models/options.model");
const sequelize = require("../connection");
const pool = require("../mysql");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { QueryTypes } = require("sequelize");
const pLimit = require("p-limit");

const deleteFilesRecursively = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    const entries = fs.readdirSync(folderPath);
    entries.forEach((entry) => {
      const entryPath = path.join(folderPath, entry);
      const stats = fs.lstatSync(entryPath);

      if (stats.isDirectory()) {
        // Si es una carpeta, llamar recursivamente
        deleteFilesRecursively(entryPath);
        fs.rmdirSync(entryPath); // después de vaciarla, eliminar carpeta
      } else {
        // Si es un archivo, eliminarlo
        fs.unlinkSync(entryPath);
      }
    });
  }
};

// Consultar todos los examenes
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [result] = await sequelize.query("select * from vShowExams;");

    if (result.length === 0) {
      return res.status(409).json({
        ok: false,
        status: 409,
        message: "empty",
      });
    }

    return res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Error fetching exam data",
    });
  }
});

// Consultar examenes activos
router.get("/active-exams", async (req, res) => {
  try {
    const [result] = await sequelize.query("select * from vShowActiveExams");

    if (result.length === 0) {
      return res.status(409).json({
        ok: false,
        status: 409,
        message: "empty",
      });
    }

    return res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Error fetching exam data",
    });
  }
});

// Consultar examen y detalles
router.get("/details/:examId", authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId, 10);

  if (isNaN(examId)) {
    return res.status(400).json({ message: "Invalid exam ID" });
  }

  try {
    const connection = await pool.getConnection();

    const [results] = await connection.query("CALL get_exam_by_id(?);", [
      examId,
    ]);

    connection.release();

    const [examInfo, questions, options] = results;

    return res.status(200).json({
      exam: examInfo?.[0] || null,
      questions: questions || [],
      options: options || [],
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Crear examen
router.post("/create", authenticateToken, async (req, res) => {
  const {
    title,
    description,
    exam_type_id,
    school_group,
    school_career,
    created_by,
    questions, // Array de preguntas
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    //  1.- crear examen
    const newExam = await Exams.create(
      {
        title,
        description,
        exam_type_id,
        school_group,
        school_career,
        created_by,
      },
      { transaction }
    );

    // 2.- Insertar preguntas
    for (const q of questions) {
      const newQuestion = await Questions.create(
        {
          exam_id: newExam.id,
          question_number: q.question_number,
          score_value: q.score_value,
          question_text: q.question_text,
          question_type_id: q.question_type_id,
        },
        { transaction }
      );

      // 3.- Insertar opciones(respuestas) para cada pregunta
      const optionsToInsert = q.options.map((opt) => ({
        question_id: newQuestion.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct,
      }));

      await Options.bulkCreate(optionsToInsert, { transaction });
    }

    // 4 .- Confirmar transaccion
    await transaction.commit();

    // Generar hoja de respuestas PDF
    const examId = newExam.id;
    const numQuestions = questions.length;

    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "processing",
      "generate_answer_sheet.py"
    );

    const safeTitle = title.replace(/\s+/g, "_");

    // Usa 'python' en vez de 'python3' para compatibilidad Windows/Linux
    const command = `python "${scriptPath}" "${examId}" "${numQuestions}" "${safeTitle}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Error al generar PDF:", error, stderr);
      } else {
        console.log(stdout);
      }
      // Siempre responder al cliente aunque falle la hoja
      res.status(201).json({
        message: "Exam created successfully",
        pdfGenerated: !error,
      });
    });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: "Error creating exam", err });
  }
});

// Generar hoja de respuestas
router.post("/create-answer-sheet", authenticateToken, async (req, res) => {
  const { examId, questions, title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Falta el título del examen" });
  }

  try {
    const numQuestions = questions.length;
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "processing",
      "generate_answer_sheet.py"
    );

    const safeTitle = title.replace(/\s+/g, "_");

    const command = `python "${scriptPath}" "${examId}" "${numQuestions}" "${safeTitle}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Error al generar PDF:", error, stderr);
      } else {
        console.log(stdout);
      }
      res.status(201).json({
        message: "Exam created successfully",
        pdfGenerated: !error,
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Error creating exam", err });
  }
});

// Revisar examen
router.post("/grade-exams", authenticateToken, async (req, res) => {
  try {
    const { exam_id } = req.body;

    const detectedExamsFolder = path.join(__dirname, "..", "..", "processing", "detected_exams");

    if (!fs.existsSync(detectedExamsFolder)) {
      return res
        .status(400)
        .json({ error: "No se encontró la carpeta de exámenes detectados." });
    }

    const files = fs
      .readdirSync(detectedExamsFolder)
      .filter((file) => file.endsWith(".json"));

    if (files.length === 0) {
      return res
        .status(400)
        .json({ error: "No hay archivos JSON para procesar." });
    }

    const questions = await sequelize.query(
      `
      SELECT q.id AS question_id, q.question_text, o.option_text, o.is_correct
      FROM Questions q
      JOIN Options o ON q.id = o.question_id
      WHERE q.exam_id = ?
      ORDER BY q.id ASC
      `,
      { replacements: [exam_id], type: QueryTypes.SELECT }
    );

    if (questions.length === 0) {
      return res
        .status(404)
        .json({ error: "No se encontraron preguntas para este examen." });
    }

    // Mapear respuestas correctas por número de pregunta
  // Eliminado: correctAnswersMap y scoreValueMap duplicados

    // Mapear valores de score por número de pregunta
    // CORRECCIÓN: Traer score_value en la consulta SQL
    const questionsWithScore = await sequelize.query(
      `SELECT q.id AS question_id, q.question_number, q.score_value, o.option_text, o.is_correct
       FROM Questions q
       JOIN Options o ON q.id = o.question_id
       WHERE q.exam_id = ?
       ORDER BY q.question_number ASC, o.id ASC`,
      { replacements: [exam_id], type: QueryTypes.SELECT }
    );

    // Mapear respuestas correctas y score_value por número de pregunta
    const correctAnswersMap = {};
    const scoreValueMap = {};
    for (const q of questionsWithScore) {
      if (q.is_correct) {
        correctAnswersMap[q.question_number] = q.option_text.trim().toLowerCase();
        scoreValueMap[q.question_number] = q.score_value ? Number(q.score_value) : 1;
      }
    }

    const results = [];

    for (const file of files) {
      const filePath = path.join(detectedExamsFolder, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      const detectedAnswers = data.preguntas_detectadas || [];

      let totalQuestions = detectedAnswers.length;
      let correctCount = 0;
      let totalScore = 0;
      let details = [];

      for (let i = 0; i < detectedAnswers.length; i++) {
        const detected = detectedAnswers[i];
        const questionNumber = parseInt(detected.question_number); // Asegurar que es número
        const userAnswer = detected.answer.trim().toLowerCase();
        const correctAnswer = correctAnswersMap[questionNumber];
        const scoreValue = scoreValueMap[questionNumber] || 1;

        const isCorrect = userAnswer === correctAnswer;

        if (isCorrect) {
          correctCount++;
          totalScore += scoreValue;
        }

        details.push({
          question_number: questionNumber,
          user_answer: userAnswer,
          correct_answer: correctAnswer,
          is_correct: isCorrect,
          score_value: scoreValue,
        });
      }

      // La calificación ahora es la suma de los score_value de las preguntas correctas
      const grade = totalScore;

      results.push({
        image_name: data.nombre_imagen || file,
        matricula: data.matricula?.trim() || "No detectada",
        nombre_completo: data.nombre_completo?.trim() || "No detectado",
        grupo: (Array.isArray(data.grupo_circulos)
          ? data.grupo_circulos.map(d => (d !== null ? d : "-")).join("")
          : typeof data.grupo_circulos === "string"
            ? data.grupo_circulos
            : data.grupo?.trim() || "No detectado"),
        total_questions: totalQuestions,
        correct_answers: correctCount,
        grade: grade.toFixed(2),
        details,
      });
    }

    return res.json({
      exam_id,
      total_exams_processed: results.length,
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al procesar los exámenes." });
  }
});

router.post("/process-all", async (req, res) => {
  try {
    const outputImagesPath = path.join(
      __dirname,
      "..",
      "..",
      "processing",
      "output_images"
    );

    if (!fs.existsSync(outputImagesPath)) {
      return res
        .status(500)
        .send("No se encontró la carpeta de imágenes procesadas");
    }

    const folders = fs
      .readdirSync(outputImagesPath)
      .filter((folder) =>
        fs.statSync(path.join(outputImagesPath, folder)).isDirectory()
      );

    if (folders.length === 0) {
      return res.status(404).send("No se encontraron exámenes procesados");
    }

    const limit = pLimit(20); // Limita a n procesos simultáneos
    const processPromises = [];

    for (const folder of folders) {
      const folderPath = path.join(outputImagesPath, folder);
      const files = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".png"));

      for (const image of files) {
        const imagePath = path.join(folderPath, image);
        const scriptPath = path.join(__dirname, "..", "..", "processing", "review_answer_sheet.py");
        // Forzar cwd al directorio de procesamiento
        const processingCwd = path.join(__dirname, "..", "..", "processing");
        const command = `"${process.env.PYTHON_PATH || 'C:\\Users\\denze\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'}" "${scriptPath}" "${imagePath}"`;
        // Log detallado antes de ejecutar
        console.log("[PROCESS-ALL] Ejecutando comando:", command);
        console.log("[PROCESS-ALL] cwd:", processingCwd);
        const promise = limit(
          () =>
            new Promise((resolve) => {
              exec(command, { cwd: processingCwd }, (error, stdout, stderr) => {
                // Log de salida y error
                console.log(`[PROCESS-ALL][${image}] STDOUT:\n`, stdout);
                if (stderr) {
                  console.error(`[PROCESS-ALL][${image}] STDERR:\n`, stderr);
                }
                // Mostrar debug de grupo si existe en la salida
                if (stdout && stdout.includes('grupo_circulos')) {
                  const match = stdout.match(/grupo_circulos detectado: (.*)/);
                  if (match) {
                    console.log(`[DEBUG][${image}] grupo_circulos detectado:`, match[1]);
                  }
                }
                // Verificar si el archivo JSON fue generado correctamente
                const jsonFileName = path.basename(image, ".png") + ".json";
                const jsonFilePath = path.join(__dirname, "..", "..", "processing", "detected_exams", jsonFileName);
                const jsonExists = fs.existsSync(jsonFilePath);
                if (error) {
                  console.error("Error al ejecutar review_answer_sheet.py:", error, stderr);
                  return resolve({ error: true, image, folder, jsonExists, stdout, stderr });
                }
                try {
                  // Si el script imprime JSON, intentar parsear
                  const result = JSON.parse(stdout.trim());
                  result.folder = folder;
                  result.imageName = image;
                  result.jsonExists = jsonExists;
                  resolve(result);
                } catch (err) {
                  // Si no es JSON, devolver salida y error
                  console.error("Error al parsear salida de review_answer_sheet.py:", err, stdout);
                  resolve({ error: true, image, folder, jsonExists, stdout, stderr });
                }
              });
            })
        );
        processPromises.push(promise);
      }
    }

    const results = await Promise.all(processPromises);
    const success = results.filter((r) => !r.error);
    const failed = results.length - success.length;

    res.json({
      message: "Procesamiento terminado",
      processed: success.length,
      failed,
      results: success,
    });
  } catch (err) {
    res.status(500).send("Error en el procesamiento general");
  }
});

// Borrar todas las hojas de respuesta
router.delete("/clear-sheets-folder", authenticateToken, (req, res) => {
  try {
    const foldersToClear = [
      path.join(__dirname, "..", "..", "processing", "generated_pdfs"),
    ];

    foldersToClear.forEach((folderPath) => {
      deleteFilesRecursively(folderPath);
    });

    res.json({ message: "Archivos eliminados correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al limpiar los archivos" });
  }
});

// Borrar datos temporales (pdf uploads,imagenes generadas, json generados)
router.delete("/clear-temp-folders", authenticateToken, (req, res) => {
  try {
    const foldersToClear = [
      path.join(__dirname, "..", "..", "processing", "detected_exams"), // <-- Agregado aquí
      path.join(__dirname, "..", "uploads"),
      path.join(__dirname, "..", "..", "processing", "output_images"),
    ];

    foldersToClear.forEach((folderPath) => {
      deleteFilesRecursively(folderPath);
    });

    res.json({ message: "Carpetas temporales limpiadas exitosamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al limpiar carpetas" });
  }
});

// mostrar hojas de respuesta
router.get("/list-answer-sheets", authenticateToken, (req, res) => {
  const dir = path.join(__dirname, "..", "..", "processing", "generated_pdfs");

  fs.readdir(dir, (err, files) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "No se pudieron leer los archivos" });
    }

    const pdfs = files.filter((file) => file.endsWith(".pdf"));

    res.json(pdfs);
  });
});

router.get("/download-answer-sheet-file/:filename", (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "processing",
    "generated_pdfs",
    fileName
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Archivo no encontrado");
  }

  res.sendFile(filePath);
});

// DELETE all processed exam JSONs in detected_exams
router.delete("/detected-exams", authenticateToken, async (req, res) => {
  const detectedExamsDir = path.join(__dirname, "..", "..", "processing", "detected_exams");
  try {
    if (!fs.existsSync(detectedExamsDir)) {
      return res.status(404).json({ ok: false, message: "Directory not found" });
    }
    const files = fs.readdirSync(detectedExamsDir);
    let deletedCount = 0;
    files.forEach((file) => {
      const filePath = path.join(detectedExamsDir, file);
      if (fs.lstatSync(filePath).isFile() && file.endsWith(".json")) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    return res.json({ ok: true, deleted: deletedCount });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error deleting files" });
  }
});

module.exports = router;
