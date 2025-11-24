import sys
import os
import cv2
import json
import text_detection  # Importa tu script de detección
"""
def detect_marked_answers(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    answers = []
    y_positions = [
        492, 565, 653, 730, 806,
        898, 974, 1053, 1135, 1209,
        1289, 1368, 1452, 1533, 1609,
        1693, 1770, 1853, 1933, 2014
    ]
    alveolos = {
        "a": 201,
        "b": 398,
        "c": 598,
        "d": 799,
        "e": 999
    }

    for i, y in enumerate(y_positions):
        row_scores = []
        for option, x in alveolos.items():
            roi = gray[y - 25:y + 25, x - 25:x + 25]
            laplacian = cv2.Laplacian(roi, cv2.CV_64F)
            score = laplacian.var()
            row_scores.append((option, score))

        row_scores.sort(key=lambda x: x[1], reverse=True)
        best_option, best_score = row_scores[0]
        second_score = row_scores[1][1]

        if best_score > 15 and (best_score - second_score > 2):
            answers.append({"question_number": i + 1, "answer": best_option})

    return answers
"""
def detect_marked_answers(image_path, num_questions=20, y_start=825, y_end=2014, alveolos=None, roi_size=12, debug=False):
    import numpy as np
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    if alveolos is None:
        alveolos = {
            "a": 300,
            "b": 600,
            "c": 900,
            "d": 1200,
            "e": 1500
        }

    # Calcular posiciones Y automáticamente si no se pasan
    y_end = y_start + (num_questions - 1) * 120
    if num_questions > 1:
        y_positions = np.linspace(y_start, y_end, num_questions, dtype=int)
    else:
        y_positions = [y_start]

    answers = []
    for i, y in enumerate(y_positions):
        row_scores = []
        for option, x in alveolos.items():
            roi = gray[y - roi_size:y + roi_size, x - roi_size:x + roi_size]
            if roi is None or roi.size == 0:
                continue
            # Preprocesamiento: binarización y ecualización
            roi_eq = cv2.equalizeHist(roi)
            _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            # Score: mezcla de píxeles oscuros y varianza del Laplaciano
            dark_pixels = np.sum(roi_bin < 128)
            laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
            lap_var = laplacian.var()
            score = dark_pixels + lap_var * 0.5  # Ajusta el peso según resultados
            row_scores.append((option, score, dark_pixels, lap_var))
            if debug:
                print(f"Q{i+1} {option}: dark={dark_pixels}, lap_var={lap_var:.2f}, score={score:.2f}")
        if len(row_scores) < 2:
            if debug:
                print(f"Q{i+1}: No suficientes opciones válidas para comparar.")
            continue
        row_scores.sort(key=lambda x: x[1], reverse=True)
        best_option, best_score, best_dark, best_lap = row_scores[0]
        second_score = row_scores[1][1]

        # Ajusta los umbrales según tus pruebas
        if best_score > 200 and (best_score - second_score > 20):
            answers.append({"question_number": i + 1, "answer": best_option})
        elif debug:
            print(f"Q{i+1}: No marca clara (best={best_score:.2f}, second={second_score:.2f})")

    return answers
def detect_marked_matricula(image_path,
                            start_x=561,
                            start_y=760,
                            spacing_x=41.75,
                            spacing_y=41.75,
                            box_size=9,
                            rows=7,
                            cols=10,
                            debug=False):
    """
    Detecta la matrícula marcada en la hoja de respuestas como matriz de cuadros.
    Devuelve una lista de 7 dígitos (uno por fila), donde cada dígito es la columna seleccionada en esa fila (0-9).
    El orden es: primera fila = primer dígito.
    """
    import cv2
    import numpy as np

    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    matricula_detectada = []

    for row in range(rows):
        col_scores = []
        for col in range(cols):
            x = int(start_x + col * spacing_x)
            y = int(start_y - row * spacing_y)
            roi = gray[y - box_size:y + box_size, x - box_size:x + box_size]
            if roi.shape[0] == 0 or roi.shape[1] == 0:
                continue
            roi_eq = cv2.equalizeHist(roi)
            _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            dark_pixels = np.sum(roi_bin < 128)
            laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
            lap_var = laplacian.var()
            score = dark_pixels + lap_var * 0.5
            col_scores.append((col, score, dark_pixels, lap_var))
            if debug:
                print(f"Matrícula Fila {row} Col {col}: dark={dark_pixels}, lap_var={lap_var:.2f}, score={score:.2f}")
        if col_scores:
            col_scores.sort(key=lambda x: x[1], reverse=True)
            best_col, best_score, best_dark, best_lap = col_scores[0]
            matricula_detectada.append(best_col)
            if debug:
                print(f"Matrícula Fila {row}: Mejor columna detectada = {best_col} (score={best_score:.2f}, dark={best_dark}, lap_var={best_lap:.2f}) | Todos los scores: {[(c, round(s,2)) for c,s,_,_ in col_scores]}")
        else:
            matricula_detectada.append(None)
    # Invertir el orden para que la primera fila sea el primer dígito
    matricula_detectada = matricula_detectada[::-1]
    return matricula_detectada

def detect_marked_grupo(image_path,
                        start_x=1693,
                        start_y=593,
                        spacing_x=41.75,
                        spacing_y=41.75,
                        box_size=9,
                        rows=3,
                        cols=10,
                        debug=False):
    """
    Detecta el grupo marcado en la hoja de respuestas como matriz de cuadros.
    Devuelve una lista de 3 dígitos (uno por fila), donde cada dígito es la columna seleccionada en esa fila (0-9).
    El orden es: primera fila = primer dígito.
    """
    import cv2
    import numpy as np

    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    grupo_detectado = []

    for row in range(rows):
        col_scores = []
        for col in range(cols):
            x = int(start_x + col * spacing_x)
            y = int(start_y - row * spacing_y)
            roi = gray[y - box_size:y + box_size, x - box_size:x + box_size]
            if roi.shape[0] == 0 or roi.shape[1] == 0:
                continue
            roi_eq = cv2.equalizeHist(roi)
            _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            dark_pixels = np.sum(roi_bin < 128)
            laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
            lap_var = laplacian.var()
            score = dark_pixels + lap_var * 0.5
            col_scores.append((col, score, dark_pixels, lap_var))
            if debug:
                print(f"Grupo Fila {row} Col {col}: dark={dark_pixels}, lap_var={lap_var:.2f}, score={score:.2f}")
        if col_scores:
            col_scores.sort(key=lambda x: x[1], reverse=True)
            best_col, best_score, best_dark, best_lap = col_scores[0]
            grupo_detectado.append(best_col)
            if debug:
                print(f"Grupo Fila {row}: Mejor columna detectada = {best_col} (score={best_score:.2f}, dark={best_dark}, lap_var={best_lap:.2f}) | Todos los scores: {[(c, round(s,2)) for c,s,_,_ in col_scores]}")
        else:
            grupo_detectado.append(None)
    # Invertir el orden para que la primera fila sea el primer dígito
    grupo_detectado = grupo_detectado[::-1]
    return grupo_detectado

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Uso: python3 review_answer_sheet.py <imagen>"}))
        return

    image_path = sys.argv[1]
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("No se pudo abrir la imagen")

        # Parámetros para matrícula y grupo (de acuerdo a visualize_rois.py)
        mat_rows = 7
        mat_cols = 10
        grupo_rows = 3
        grupo_cols = 10

        # Matrícula
        matricula_circulos = detect_marked_matricula(
            image_path,
            start_x=561,
            start_y=760,
            spacing_x=41.75,
            spacing_y=41.75,
            box_size=9,
            rows=mat_rows,
            cols=mat_cols,
            debug=False
        )

        # Grupo
        grupo_circulos = detect_marked_grupo(
            image_path,
            start_x=1693,
            start_y=593,
            spacing_x=41.75,
            spacing_y=41.75,
            box_size=9,
            rows=grupo_rows,
            cols=grupo_cols,
            debug=False
        )
        print(f"[DEBUG] grupo_circulos detectado: {grupo_circulos}")

        nombre = "No detectado"
        num_questions = 20
        detected = detect_marked_answers(image_path, num_questions=num_questions)

        folder_name = os.path.basename(os.path.dirname(image_path))
        file_name = os.path.basename(image_path).replace(".png", "")

        result = {
            "nombre": nombre,
            "matricula": ''.join(str(d) if d is not None else '-' for d in matricula_circulos),
            "grupo": ''.join(str(d) if d is not None else '-' for d in grupo_circulos),
            "preguntas_detectadas": detected,
            "matricula_circulos": matricula_circulos,
            "grupo_circulos": grupo_circulos,
            "imagen_procesada": image_path
        }

        detected_exams_dir = os.path.join(os.path.dirname(__file__), "detected_exams")
        output_path = os.path.join(detected_exams_dir, f"reviewed_{folder_name}_{file_name}.json")
        print(f"[LOG] Intentando guardar en: {output_path}")
        try:
            os.makedirs(detected_exams_dir, exist_ok=True)
            test_path = os.path.join(detected_exams_dir, "__test_write__.tmp")
            with open(test_path, "w") as test_file:
                test_file.write("ok")
            os.remove(test_path)
            print("[LOG] Permiso de escritura OK en detected_exams")
        except Exception as perm_err:
            print(f"[ERROR] Permiso de escritura en {detected_exams_dir}: {perm_err}")
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=4, ensure_ascii=False)
            print(f"[LOG] Archivo guardado correctamente: {output_path}")
        except Exception as save_err:
            print(f"[ERROR] No se pudo guardar el archivo: {save_err}")

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
