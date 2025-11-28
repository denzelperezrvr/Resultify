import { useState } from "react";
import * as XLSX from "xlsx";
import "./ExamResults.css";

const ExamResults = ({ results }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);

  if (!results) return null;

  // Helper para obtener el total de preguntas del examen
  const getExamTotalQuestions = () => {
    if (results.total_questions && results.total_questions > 0) return results.total_questions;
    if (results.results && results.results.length > 0 && results.results[0].total_questions && results.results[0].total_questions > 0) return results.results[0].total_questions;
    let maxQuestions = 0;
    results.results.forEach((student) => {
      if (student.details && student.details.length > maxQuestions) {
        maxQuestions = student.details.length;
      }
    });
    return maxQuestions || 1;
  };

  // Helper para obtener el arreglo completo de detalles por estudiante
  const getFullDetails = (student) => {
    const totalQuestions = getExamTotalQuestions();
    const detailsMap = {};
    if (student.details) {
      student.details.forEach((q) => {
        detailsMap[q.question_number] = q;
      });
    }
    const fullDetails = [];
    for (let i = 1; i <= totalQuestions; i++) {
      if (detailsMap[i]) {
        fullDetails.push(detailsMap[i]);
      } else {
        fullDetails.push({
          question_number: i,
          user_answer: "blank",
          correct_answer: student.correct_answers_list ? student.correct_answers_list[i - 1] : "",
          is_correct: false,
        });
      }
    }
    return fullDetails;
  };

  const openDetails = (student) => {
    // Al abrir detalles, generamos el arreglo completo
    setSelectedStudent({ ...student, fullDetails: getFullDetails(student) });
  };

  const closeModal = () => {
    setSelectedStudent(null);
  };

  // Nueva función para exportar a Excel
  const exportToExcel = () => {
    const totalQuestions = getExamTotalQuestions();
    const data = results.results.map((student) => {
      const fullDetails = getFullDetails(student);
      const correctas = fullDetails.filter((q) => q.is_correct).length;
      return {
        Matrícula: student.matricula,
        Grupo: student.grupo,
        Calificación: student.grade,
        Correctas: `${correctas} de ${totalQuestions}`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");

    // Usa el nombre del examen en el archivo, quitando caracteres no válidos para nombres de archivo
    const examTitle = results.exam_title
      ? results.exam_title.replace(/[\\/:*?"<>|]/g, "")
      : "Examen";
    XLSX.writeFile(workbook, `Resultados_${examTitle}.xlsx`);
  };

  return (
    <div>
      <div className="results-main-content">
        <h2>Resultados del examen #{results.exam_id}</h2>
        <p>Total de exámenes procesados: {results.total_exams_processed}</p>

        {/* Botón para exportar a Excel */}
        <button onClick={exportToExcel} style={{ marginBottom: "1rem" }}>
          Exportar a Excel
        </button>

        <table className="results-table">
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Grupo</th>
              <th>Calificación</th>
              <th>Correctas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {results.results.map((student, index) => {
              const fullDetails = getFullDetails(student);
              const correctas = fullDetails.filter((q) => q.is_correct).length;
              const totalQuestions = getExamTotalQuestions();
              return (
                <tr key={index}>
                  <td>{student.matricula}</td>
                  <td>
                    {student.grupo_circulos
                      ? (Array.isArray(student.grupo_circulos)
                          ? student.grupo_circulos.map(d => (d !== null ? d : "-")).join("")
                          : typeof student.grupo_circulos === "string"
                            ? student.grupo_circulos
                            : String(student.grupo_circulos))
                      : (student.grupo || "")}
                  </td>
                  <td>{student.grade}</td>
                  <td>
                    {correctas} de {totalQuestions}
                  </td>
                  <td>
                    <button onClick={() => openDetails(student)}>
                      Ver detalles
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {selectedStudent && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Detalles de {selectedStudent.nombre_completo}</h3>
              <ul>
                {selectedStudent.fullDetails.map((question, qIndex) => (
                  <li key={qIndex}>
                    Pregunta {question.question_number}: Respuesta usuario: {question.user_answer} | Respuesta correcta: {question.correct_answer} | {question.is_correct ? "Correcta" : "Incorrecta"}
                  </li>
                ))}
              </ul>
              <button onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamResults;
