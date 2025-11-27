import React, { useRef, useState, useEffect } from "react";
import "./UploadedExamsList.css";

const UploadedExamsList = ({ exams, loading, onUpload, onSelectionChange }) => {
  const fileInputRef = useRef();
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    // Reset selection if exams list changes
    setSelected((prev) => prev.filter((s) => exams.includes(s)));
  }, [exams]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      fileInputRef.current.value = "";
    }
  };

  const toggleSelect = (filename) => {
    setSelected((prev) => {
      const next = prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename];
      if (onSelectionChange) onSelectionChange(next);
      return next;
    });
  };

  if (loading) return <div>Cargando exámenes...</div>;

  return (
    <div>
      <div className="exams-list-container">
        <div className="exams-list-content">
          <h2>Exámenes cargados</h2>
          <form>
            <input
              type="file"
              accept="application/pdf"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </form>
          {exams.length === 0 ? (
            <p>No hay exámenes cargados.</p>
          ) : (
            <ul>
              {exams.map((exam, index) => (
                <li key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(exam)}
                      onChange={() => toggleSelect(exam)}
                    />
                    <span style={{ marginLeft: 8 }}>{exam}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadedExamsList;
