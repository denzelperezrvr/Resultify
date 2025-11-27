import { useRef } from "react";
import SideBar from "../SideBar/Sidebar";
import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import useAuthCheck from "../../hooks/useAuthCheck";
import * as XLSX from "xlsx";
import "./NewExam.css";

const NewExam = () => {
  useAuthCheck([1, 2]);
  const navigate = useNavigate();
  const [examData, setExamData] = useState({
    title: "",
    description: "",
    exam_type_id: "",
    school_group: "",
    school_career: "",
    questions: [],
  });

  const [questions, setQuestions] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);

  const handleDownloadTemplate = () => {
    // Crear datos de ejemplo para el template
    const templateData = [
      { pregunta: "¿Cuál es la capital de España?", respuesta_correcta: "Madrid", valor: 5 },
      { pregunta: "¿Cuál es el planeta más grande del sistema solar?", respuesta_correcta: "Júpiter", valor: 5 },
      { pregunta: "¿En qué año se descubrió América?", respuesta_correcta: "1492", valor: 5 },
      { pregunta: "Escribe tu pregunta aquí", respuesta_correcta: "Escribe la respuesta correcta", valor: 5 },
    ];

    // Crear workbook y worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Preguntas");

    // Ajustar ancho de columnas
    worksheet["!cols"] = [{ wch: 40 }, { wch: 30 }, { wch: 10 }];

    // Descargar archivo
    XLSX.writeFile(workbook, "template_examen.xlsx");
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setExcelLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Mapear Excel a estructura de preguntas
      const loadedQuestions = jsonData.map((row, index) => ({
        id: Date.now() + index,
        number: index + 1,
        text: row.pregunta || "",
        score: row.valor || 0,
        answers: [
          {
            id: Date.now() + index + 1000,
            text: row.respuesta_correcta || "",
            isCorrect: true,
          },
        ],
        maxAnswers: 1,
      }));

      setQuestions(loadedQuestions);
      setExamData((prevData) => ({
        ...prevData,
        questions: loadedQuestions,
      }));
      alert(`Se cargaron ${loadedQuestions.length} preguntas correctamente`);
    } catch (error) {
      alert("Error al procesar el archivo Excel: " + error.message);
    } finally {
      setExcelLoading(false);
      event.target.value = "";
    }
  };

  const addQuestion = () => {
    const newQuestions = [
      ...questions,
      {
        id: Date.now(),
        text: "",
        number: "",
        score: "",
        answers: [],
        maxAnswers: 1,
      },
    ];

    setQuestions(newQuestions);

    setExamData((prevData) => ({
      ...prevData,
      questions: newQuestions,
    }));
  };

  const removeQuestion = (questionId) => {
    setQuestions((prevQuestions) =>
      prevQuestions.filter((q) => q.id !== questionId)
    );
    setExamData((prevData) => ({
      ...prevData,
      questions: prevData.questions.filter((q) => q.id !== questionId),
    }));
  };

  const handleQuestionChange = (id, field, value) => {
    const updatedQuestions = questions.map((q) =>
      q.id === id ? { ...q, [field]: value } : q
    );

    setQuestions(updatedQuestions);

    setExamData((prevData) => ({
      ...prevData,
      questions: updatedQuestions,
    }));
  };

  const addAnswer = (questionId) => {
    const updatedQuestions = questions.map((q) =>
      q.id === questionId && q.answers.length < q.maxAnswers
        ? {
            ...q,
            answers: [
              ...q.answers,
              { id: Date.now(), text: "", isCorrect: false },
            ],
          }
        : q
    );

    setQuestions(updatedQuestions);

    setExamData((prevData) => ({
      ...prevData,
      questions: updatedQuestions,
    }));
  };

  const handleAnswerChange = (questionId, answerId, value) => {
    const updatedQuestions = questions.map((q) =>
      q.id === questionId
        ? {
            ...q,
            answers: q.answers.map((a) =>
              a.id === answerId ? { ...a, text: value } : a
            ),
          }
        : q
    );

    setQuestions(updatedQuestions);

    setExamData((prevData) => ({
      ...prevData,
      questions: updatedQuestions,
    }));
  };

  const toggleCorrectAnswer = (questionId, answerId) => {
    const updatedQuestions = questions.map((q) =>
      q.id === questionId
        ? {
            ...q,
            answers: q.answers.map((a) =>
              a.id === answerId ? { ...a, isCorrect: !a.isCorrect } : a
            ),
          }
        : q
    );

    setQuestions(updatedQuestions);

    setExamData((prevData) => ({
      ...prevData,
      questions: updatedQuestions,
    }));
  };

  const formRef = useRef();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSubmitting) {
      submitExam();
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
  };

  const submitExam = async (e) => {
    const { questions } = examData;

    const token = localStorage.getItem("token");

    if (token) {
      const decodedToken = jwtDecode(token);
      const userId = decodedToken.id;

      const examPayload = {
        ...examData,
        created_by: userId,
        questions: questions.map((q) => ({
          question_number: q.number,
          score_value: q.score,
          question_text: q.text,
          question_type_id: 1,
          options: q.answers.map((a) => ({
            option_text: a.text,
            is_correct: a.isCorrect,
          })),
        })),
      };

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/exams/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(examPayload),
          }
        );

        const data = await response.json();
        if (response.status === 201) {
          alert("Examen creado con éxito");
          handleClear();
          navigate("/Exams");
        } else {
          alert(`Error al crear el examen: ${data.message}`);
        }
      } catch (error) {
        alert("Error al crear el examen");
      }
    }
  };

  const handleClear = () => {
    setExamData({
      title: "",
      description: "",
      exam_type_id: "",
      school_group: "",
      school_career: "",
      questions: [],
    });
    setQuestions([]);
  };
  return (
    <div>
      <SideBar />
      <div className="header">
        <h1>Crear examen</h1>
      </div>
      <div className="option-content">
        <button
          type="button"
          onClick={() => {
            formRef.current.requestSubmit();
          }}
        >
          Guardar
        </button>
        <button onClick={handleClear} type="button">
          Limpiar
        </button>
        <div className="excel-upload-section">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="excel-download-label"
          >
            ⬇️ Descargar Template
          </button>
          <label htmlFor="excel-input" className="excel-label">
            📊 Cargar desde Excel
          </label>
          <input
            id="excel-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelUpload}
            disabled={excelLoading}
            style={{ display: "none" }}
          />
        </div>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} action="">
        <div className="exam-container">
          <div className="left-content">
            <div className="input-bx">
              <label>
                Nombre <span>*</span>
              </label>
              <input
                required
                type="text"
                value={examData.title}
                onChange={(e) =>
                  setExamData({ ...examData, title: e.target.value })
                }
              />
            </div>
            <div className="input-bx">
              <label>
                Descripción <span>*</span>
              </label>
              <input
                required
                type="text"
                value={examData.description}
                onChange={(e) =>
                  setExamData({ ...examData, description: e.target.value })
                }
              />
            </div>
            <div className="input-bx">
              <label>
                Tipo de examen <span>*</span>
              </label>
              <select
                required
                value={examData.exam_type_id}
                onChange={(e) =>
                  setExamData({ ...examData, exam_type_id: e.target.value })
                }
              >
                <option value=""></option>
                <option value="1">General</option>
              </select>
            </div>
            <div className="input-bx">
              <label>
                Grupo <span>*</span>
              </label>
              <input
                required
                type="text"
                value={examData.school_group}
                onChange={(e) =>
                  setExamData({ ...examData, school_group: e.target.value })
                }
              />
            </div>
            <div className="input-bx">
              <label>
                Carrera <span>*</span>
              </label>
              <select
                required
                value={examData.school_career}
                onChange={(e) =>
                  setExamData({ ...examData, school_career: e.target.value })
                }
              >
                <option value=""></option>
                <option value="LMAD">LMAD</option>
                <option value="LCC">LCC</option>
                <option value="LM">LM</option>
                <option value="LF">LF</option>
                <option value="LSTI">LSTI</option>
                <option value="LA">LA</option>
              </select>
            </div>
          </div>
          <div className="right-content">
            <button type="button" className="add-btn" onClick={addQuestion}>
              + Agregar pregunta
            </button>
            {questions.map((question) => (
              <div key={question.id} className="question-box">
                <div className="question-detail">
                  <input
                    required
                    type="number"
                    placeholder="ID"
                    value={question.number}
                    onChange={(e) =>
                      handleQuestionChange(
                        question.id,
                        "number",
                        e.target.value
                      )
                    }
                  />
                  <input
                    type="number"
                    required
                    placeholder="Valor"
                    value={question.score}
                    onChange={(e) =>
                      handleQuestionChange(question.id, "score", e.target.value)
                    }
                  />
                </div>
                <input
                  required
                  type="text"
                  placeholder="Escribe la pregunta"
                  value={question.text}
                  onChange={(e) =>
                    handleQuestionChange(question.id, "text", e.target.value)
                  }
                />
                <div className="action-buttons">
                  <button
                    onClick={() => removeQuestion(question.id)}
                    type="button"
                    className="delete-question"
                  >
                    - Eliminar pregunta
                  </button>
                  <button
                    type="button"
                    className="add-answer-btn"
                    onClick={() => addAnswer(question.id)}
                  >
                    + Agregar respuesta
                  </button>
                </div>

                {question.answers.map((answer) => (
                  <div key={answer.id} className="answer-box">
                    <input
                      required
                      type="text"
                      placeholder="Escribe la respuesta"
                      value={answer.text}
                      onChange={(e) =>
                        handleAnswerChange(
                          question.id,
                          answer.id,
                          e.target.value
                        )
                      }
                    />
                    <div className="chbx">
                      <label htmlFor="">Marcar correcta</label>
                      <input
                        type="checkbox"
                        checked={answer.isCorrect}
                        onChange={() =>
                          toggleCorrectAnswer(question.id, answer.id)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewExam;
