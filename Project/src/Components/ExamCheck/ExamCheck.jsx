import { useState, useEffect } from "react";
import axios from "axios";
import SideBar from "../SideBar/Sidebar";
import UploadedExamsList from "../UploadedExamsList/UploadedExamsList";
import DetectedExams from "../DetectedExams/DetectedExams";
import ExamResults from "../ExamResults/ExamResults";
import useAuthCheck from "../../hooks/useAuthCheck";
import "./ExamCheck.css";

const ExamCheck = () => {
  useAuthCheck([1, 2]);
  const [exams, setExams] = useState([]);
  const [detectedExams, setDetectedExams] = useState([]);
  const [selectExams, setSelectExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [gradedResults, setGradedResults] = useState(null);

  const handleGradeExams = async () => {
    if (!selectedExam) {
      alert("Selecciona un examen primero.");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/exams/grade-exams`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ exam_id: selectedExam }),
          }
        );

        if (!response.ok) {
          throw new Error("Error al revisar los exámenes");
        }

        const data = await response.json();
        setGradedResults(data); // Guardar resultados
      } else {
      }
    } catch (error) {
      alert("Ocurrió un error al revisar los exámenes");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/exams/process-all`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          alert("Error inesperado en el backend:\n" + text);
          setLoading(false);
          return;
        }
        setResults(data.results);
        // Actualizar la lista de exámenes procesados después de procesar
        fetchDetectedExams();
        setLoading(false);
        //window.location.reload(); // Elimina el reload para mejor UX
      } else {
        setLoading(false);
      }
    } catch (err) {
      alert("Error al procesar los examenes");
      setLoading(false);
    }
  };

  const fetchSelectExams = async () => {
    fetch(`${process.env.REACT_APP_API_URL}/api/v1/exams/active-exams`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSelectExams(data.data);
        }
      })
      .catch((error) => {
        alert("Ocurrió un error al cargar los exámenes");
      });
  };

  const fetchDetectedExams = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/v1/uploads/get-detected-exams`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setDetectedExams(response.data);
      } else {
      }
    } catch (err) {
      alert("Error al obtener los examenes procesados");
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/v1/uploads/get-uploaded-exams`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setExams(response.data);
      } else {
        //
      }
    } catch (err) {
      alert("Error al obtener los exámenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelectExams();
    fetchExams();
    fetchDetectedExams();
  }, []);

  if (loading) {
    return <div>Cargando exámenes...</div>;
  }

  const handleClearTemp = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.delete(
          `${process.env.REACT_APP_API_URL}/api/v1/exams/clear-temp-folders`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        alert(response.data.message);
        window.location.reload();
      } else {
        //
      }
    } catch (error) {
      alert("Hubo un error al intentar limpiar las carpetas");
    }
  };

  const handleSaveResults = async () => {
    if (!gradedResults || !Array.isArray(gradedResults.results)) {
      alert("No hay resultados para guardar");
      return;
    }

    const { exam_id, results } = gradedResults;

    // debug =>

    /*results.forEach((result, index) => {
      console.log(`Resultado ${index + 1}:`);
      console.log("Matrícula:", result.matricula);
      console.log("Nombre:", result.nombre_completo);
      console.log("Calificación:", result.grade);
    });*/

    const payload = {
      exam_id,
      results: results.map((result) => ({
        matricula: result.matricula || "default",
        nombre_completo: result.nombre_completo || "default",
        grade: Number(result.score || result.grade),
      })),
    };

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/submissions/saveResults`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error("No se pudieron guardar los resultados");
        }

        alert("Resultados guardados correctamente");
      } else {
        //
      }
    } catch (error) {
      alert("Error al guardar resultados");
    }
  };

  return (
    <div>
      <SideBar />
      <div className="header">
        <h1>Procesar y revisar exámenes</h1>
      </div>
      <div className="option-content">
        <button onClick={handleClearTemp}>Borrar datos</button>
        <button onClick={handleReviewClick}>
          {loading ? "Procesando..." : "Procesar exámenes"}
        </button>
        <button onClick={handleSaveResults}>Guardar datos</button>
      </div>

      <div className="exam-check-content">
        <div className="exam-check-left-content">
          <UploadedExamsList exams={exams} loading={loading} />
        </div>

        <div className="exam-check-medium-content">
          <DetectedExams exams={detectedExams} loading={loading} />
        </div>
      </div>

      <div className="exam-processed-cotent">
        <div className="exam-check-right-content">
          <div className="input-bx-exam">
            <select
              required
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">Selecciona un examen</option>
              {selectExams.map((exam, index) => (
                <option key={index} value={exam.id}>
                  {exam.id} {exam.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGradeExams}
            disabled={loading || !selectedExam}
          >
            {loading ? "Revisando..." : "Revisar exámenes"}
          </button>

          {results && (
            <div>
              <h2>Resultados:</h2>
              {results.map((result, index) => (
                <div key={index}>
                  <h3>Examen de {result.folder}:</h3>{" "}
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}

          {gradedResults && <ExamResults results={gradedResults} />}
        </div>
      </div>
    </div>
  );
};

export default ExamCheck;
