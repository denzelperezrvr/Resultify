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
    try {
      // Buscar PDFs en /server/uploads
      const uploadsPath = path.join(__dirname, "..", "..", "uploads");
      if (!fs.existsSync(uploadsPath)) {
        return res.status(500).send("No se encontró la carpeta de uploads");
      }
      // Allow optional list of pdf files from request body: { pdfFiles: ['a.pdf','b.pdf'] }
      const requestedPdfFiles = (req.body && Array.isArray(req.body.pdfFiles) && req.body.pdfFiles.length > 0) ? req.body.pdfFiles.slice() : null;
      let pdfFiles = [];
      if (requestedPdfFiles) {
        // Validate existence (keep order from requested list)
        pdfFiles = requestedPdfFiles.filter((f) => fs.existsSync(path.join(uploadsPath, f)));
      } else {
        pdfFiles = fs.readdirSync(uploadsPath).filter((file) => file.endsWith(".pdf"));
      }

      if (pdfFiles.length === 0) {
        return res.status(404).send("No se encontraron PDFs para procesar");
      }
      const limit = pLimit(10);
      const processPromises = [];
      for (const pdfFile of pdfFiles) {
        const pdfPath = path.join(uploadsPath, pdfFile);
        const pythonPath = process.env.PYTHON_PATH || 'C:\\Users\\denze\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
        const reviewScript = path.join(__dirname, "..", "..", "processing", "review_answer_sheet.py");
        const reviewCmd = `"${pythonPath}" "${reviewScript}" "${pdfPath}"`;
        const reviewPromise = new Promise((resolve) => {
          exec(reviewCmd, { cwd: path.join(__dirname, "..", "..", "processing") }, (error, stdout, stderr) => {
            if (error) {
              // console.error("Error al ejecutar review_answer_sheet.py:", error, stderr);
              return resolve({ error: true, pdfFile, stdout, stderr });
            }
            try {
              const parsed = JSON.parse(stdout.trim());
              if (Array.isArray(parsed)) {
                // Attach pdfFile to each item
                parsed.forEach((item) => {
                  if (item && typeof item === 'object') item.pdfFile = pdfFile;
                });
                resolve(parsed);
              } else if (parsed && typeof parsed === 'object') {
                parsed.pdfFile = pdfFile;
                resolve(parsed);
              } else {
                resolve({ error: true, pdfFile, stdout, stderr });
              }
            } catch (err) {
              // console.error("Error al parsear salida de review_answer_sheet.py:", err, stdout);
              resolve({ error: true, pdfFile, stdout, stderr });
            }
          });
        });
        processPromises.push(limit(() => reviewPromise));
      }
      const results = await Promise.all(processPromises);
      // Flatten results in case some entries are arrays (one PDF -> multiple pages)
      const flatResults = results.flat();
      const success = flatResults.filter((r) => !r.error);
      const failed = flatResults.length - success.length;
      res.json({
        message: "Procesamiento terminado",
        processed: success.length,
        failed,
        results: flatResults,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      path.join(__dirname, "..", "..", "uploads"),
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

// ...existing code...

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

// POST endpoint to save exam questions loaded from Excel
router.post("/upload-exam-excel", authenticateToken, async (req, res) => {
  try {
    const { exam_id, questions } = req.body;

    if (!exam_id || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "exam_id y questions requeridos",
      });
    }

    // Verificar que el examen existe
    const exam = await Exams.findByPk(exam_id);
    if (!exam) {
      return res.status(404).json({
        ok: false,
        message: "Examen no encontrado",
      });
    }

    // Procesar cada pregunta
    const savedQuestions = [];
    for (const q of questions) {
      if (!q.text || !q.score || !q.answers || q.answers.length === 0) {
        continue; // Saltar preguntas incompletas
      }

      // Crear pregunta
      const question = await Questions.create({
        exam_id,
        question_number: q.number || savedQuestions.length + 1,
        question_text: q.text,
        score_value: parseFloat(q.score) || 0,
      });

      // Crear respuesta correcta
      for (const answer of q.answers) {
        if (answer.text) {
          await Options.create({
            question_id: question.id,
            option_text: answer.text,
            is_correct: answer.isCorrect ? 1 : 0,
          });
        }
      }

      savedQuestions.push(question.id);
    }

    return res.json({
      ok: true,
      message: `${savedQuestions.length} preguntas guardadas correctamente`,
      questionIds: savedQuestions,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Error al guardar preguntas: " + err.message,
    });
  }
});

module.exports = router;


