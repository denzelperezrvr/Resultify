import sys
import os
import cv2
import json
import numpy as np
import math
from pdf2image import convert_from_path

# ----------------- Configuración CV -----------------
MIN_RECT_AREA = 100
DEBUG = False  # Pon en False para producción para no ensuciar el stdout
# ----------------------------------------------------

# ==========================================
#       FUNCIONES DE VISIÓN (Lógica Robusta)
# ==========================================

def filtrar_circulos_superpuestos(circles, min_dist_threshold=20):
    if not circles: return []
    filtered = []
    circles = sorted(circles, key=lambda c: c[0][0])
    processed = [False] * len(circles)
    for i in range(len(circles)):
        if processed[i]: continue
        group = [circles[i]]
        processed[i] = True
        for j in range(i+1, len(circles)):
            if processed[j]: continue
            dist = math.hypot(circles[i][0][0]-circles[j][0][0], circles[i][0][1]-circles[j][0][1])
            if dist < min_dist_threshold:
                group.append(circles[j])
                processed[j] = True
        avg_x = int(np.mean([c[0][0] for c in group]))
        avg_y = int(np.mean([c[0][1] for c in group]))
        avg_r = int(np.mean([c[1] for c in group]))
        filtered.append(((avg_x, avg_y), avg_r))
    return filtered

_clahe_score = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))

def calcular_score_marca_mejor(gray, centro, radio):
    x, y, r = int(centro[0]), int(centro[1]), int(radio)
    h, w = gray.shape
    x1, x2 = max(0, x-r), min(w, x+r)
    y1, y2 = max(0, y-r), min(h, y+r)
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0: return 0.0

    roi_clahe = _clahe_score.apply(roi)
    mask = np.zeros_like(roi_clahe)
    cv2.circle(mask, (mask.shape[1]//2, mask.shape[0]//2), int(max(1, 0.7 * r)), 255, -1)
    
    mean_intensity = cv2.mean(roi_clahe, mask=mask)[0]
    _, roi_bin = cv2.threshold(roi_clahe, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    dark_pixels = cv2.countNonZero(cv2.bitwise_and(roi_bin, roi_bin, mask=mask))
    mask_area = cv2.countNonZero(mask)
    
    dark_ratio = dark_pixels / mask_area if mask_area > 0 else 0
    
    # Fórmula de score: pesa tanto la cantidad de negro como la intensidad media inversa
    score = (dark_ratio * 3000) + (255.0 - mean_intensity) * 5.0
    return score

def agrupar_filas(circulos, expected_rows, radio_prom):
    if not circulos: return [[] for _ in range(expected_rows)]
    
    circulos.sort(key=lambda c: c[0][1]) # Ordenar por Y
    filas = []
    fila_actual = [circulos[0]]
    
    umbral_salto = radio_prom * 1.8
    
    for i in range(1, len(circulos)):
        if abs(circulos[i][0][1] - fila_actual[-1][0][1]) < umbral_salto:
            fila_actual.append(circulos[i])
        else:
            filas.append(sorted(fila_actual, key=lambda c: c[0][0]))
            fila_actual = [circulos[i]]
    filas.append(sorted(fila_actual, key=lambda c: c[0][0]))

    # Si hay más filas de las esperadas, nos quedamos con las más pobladas/prominentes
    if len(filas) > expected_rows:
        filas.sort(key=len, reverse=True)
        filas = filas[:expected_rows]
        filas.sort(key=lambda f: np.mean([c[0][1] for c in f])) # Reordenar Y

    while len(filas) < expected_rows:
        filas.append([])
        
    return filas

def procesar_bloque(gray, bloque, config):
    """
    Procesa un bloque (Matrícula, Grupo o Respuestas) y devuelve:
    - resultados_fila: Lista de valores (índices o letras)
    - ganadores: Datos para debug/visualización (no usado en JSON final, pero útil internamente)
    """
    circulos = bloque["circulos"]
    filas_exp = config["filas"]
    cols_exp = config["columnas"]
    tipo = config["tipo"]

    if not circulos: return [None] * filas_exp, []

    radio_prom = int(np.mean([c[1] for c in circulos]))
    filas = agrupar_filas(circulos, filas_exp, radio_prom)

    all_x = [c[0][0] for c in circulos]
    if not all_x: return [None] * filas_exp, []
    
    min_x, max_x = min(all_x), max(all_x)
    espaciado_x = (max_x - min_x) / (cols_exp - 1) if cols_exp > 1 else 0

    resultados_fila = []
    ganadores = []

    for fila_idx, fila in enumerate(filas):
        candidatos = []
        if not fila:
            resultados_fila.append(None)
            continue
        
        mapa_cols = {int(round((c[0][0] - min_x) / (espaciado_x + 1e-9))): c for c in fila}
        
        for col in range(cols_exp):
            if col in mapa_cols:
                candidatos.append(mapa_cols[col])
            else:
                # Interpolación simple si falta un círculo
                if len(fila) > 0:
                    puntos_y = [c[0][1] for c in fila]
                    pred_y = int(np.mean(puntos_y))
                    candidatos.append(((int(min_x + col * espaciado_x), pred_y), radio_prom))
        
        scores = [calcular_score_marca_mejor(gray, c[0], c[1]) for c in candidatos]
        
        # Lógica de decisión (threshold simple relativo)
        if not scores:
            resultados_fila.append(None)
            continue
            
        best_idx = int(np.argmax(scores))
        # Opcional: Verificar si la diferencia con el segundo es suficiente
        # sorted_scores = sorted(scores, reverse=True)
        # if len(sorted_scores) > 1 and (sorted_scores[0] - sorted_scores[1] < 50): best_idx = -1

        if best_idx != -1:
            elegido = candidatos[best_idx]
            if tipo in ["matricula", "grupo"]:
                valor = best_idx # 0-9
                resultados_fila.append(valor)
                ganadores.append(str(valor))
            else:
                valor = chr(ord('A') + best_idx) # A-E
                resultados_fila.append(valor)
                ganadores.append(valor)
        else:
            resultados_fila.append(None)

    return resultados_fila, ganadores

def asignar_bloques_espacial(rect_contours):
    if len(rect_contours) < 3: return {}
    
    rects = []
    for c in rect_contours:
        x, y, w, h = cv2.boundingRect(c)
        rects.append({"bbox": (x, y, w, h)})

    # 1. Ordenar por Y (arriba a abajo)
    rects.sort(key=lambda r: r["bbox"][1])
    respuestas = rects[-1] # El de más abajo es respuestas
    
    top_rects = rects[:-1]
    # 2. Ordenar los de arriba por X (izquierda a derecha)
    top_rects.sort(key=lambda r: r["bbox"][0])
    
    if len(top_rects) >= 2:
        matricula = top_rects[0]
        grupo = top_rects[1]
    else:
        matricula = top_rects[0]
        grupo = top_rects[0] # Fallback por si acaso

    return {"matricula": matricula, "grupo": grupo, "respuestas": respuestas}

def procesar_examen_completo(image_path, num_questions=20):
    """
    Función maestra que ejecuta toda la lógica de visión y devuelve
    los datos estructurados.
    """
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("No se pudo leer la imagen.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5,5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 19, 3)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    rectangle_contours = [c for c in contours if len(cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)) == 4 and cv2.contourArea(c) > MIN_RECT_AREA]

    if len(rectangle_contours) < 3:
        # Fallback o error si no se encuentran los 3 bloques
        # Si falla, devolvemos estructuras vacías
        return [], [], []

    bloques_asignados = asignar_bloques_espacial(rectangle_contours)
    
    # Configuración dinámica
    tipo_configs = {
        "matricula": {
            "filas": 7, "columnas": 10, "tipo": "matricula",
            "hough_params": {"dp": 1, "minDist": 15, "param1": 50, "param2": 15, "minRadius": 5, "maxRadius": 20}
        },
        "grupo": {
            "filas": 3, "columnas": 10, "tipo": "grupo",
            "hough_params": {"dp": 1, "minDist": 15, "param1": 50, "param2": 15, "minRadius": 5, "maxRadius": 20}
        },
        "respuestas": {
            "filas": num_questions, "columnas": 5, "tipo": "respuestas",
            "hough_params": {"dp": 1, "minDist": 20, "param1": 50, "param2": 16, "minRadius": 8, "maxRadius": 25}
        }
    }

    resultados_finales = {}

    for tipo, cfg in tipo_configs.items():
        bloque_data = bloques_asignados[tipo]
        x, y, w, h = bloque_data["bbox"]
        
        roi_gray = gray[y:y+h, x:x+w]
        roi_gray_blurred = cv2.GaussianBlur(roi_gray, (3, 3), 0)

        circles_hough = cv2.HoughCircles(roi_gray_blurred, cv2.HOUGH_GRADIENT, **cfg["hough_params"])
        
        detected_circles = []
        if circles_hough is not None:
            circles_hough = np.uint16(np.around(circles_hough[0, :]))
            for (cx_r, cy_r, r) in circles_hough:
                detected_circles.append(((x + cx_r, y + cy_r), int(r)))

        radio_prom = np.mean([r for _, r in detected_circles]) if detected_circles else 10
        circulos_unicos = filtrar_circulos_superpuestos(detected_circles, min_dist_threshold=radio_prom * 1.5)
        
        bloque_data["circulos"] = circulos_unicos
        
        if not circulos_unicos:
            resultados_finales[tipo] = [None] * cfg["filas"]
            continue

        vals, _ = procesar_bloque(gray, bloque_data, cfg)
        resultados_finales[tipo] = vals

    # Formatear salida como la app espera
    # Respuestas: [{"question_number": 1, "answer": "A"}, ...]
    respuestas_struct = []
    raw_resp = resultados_finales.get("respuestas", [])
    for i, r in enumerate(raw_resp):
        if r is not None:
            respuestas_struct.append({"question_number": i + 1, "answer": r})

    # Matricula: Lista de ints (o None)
    matricula_list = resultados_finales.get("matricula", [])
    
    # Grupo: Lista de ints (o None)
    grupo_list = resultados_finales.get("grupo", [])

    return matricula_list, grupo_list, respuestas_struct

# ==========================================
#            MAIN APP LOGIC
# ==========================================

def main():
    # Verificación de argumentos
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Uso: python3 review_answer_sheet.py <imagen_o_pdf>"}))
        return

    input_path = sys.argv[1]
    NUM_PREGUNTAS = 20

    # Detectar si es PDF y convertir a imagen(s)
    ext = os.path.splitext(input_path)[1].lower()
    results_output = []
    detected_exams_dir = os.path.join(os.path.dirname(__file__), "detected_exams")
    os.makedirs(detected_exams_dir, exist_ok=True)

    if ext == ".pdf":
        try:
            poppler_path = os.environ.get("POPPLER_PATH")
            if poppler_path:
                images = convert_from_path(input_path, poppler_path=poppler_path)
            else:
                images = convert_from_path(input_path)
            if not images:
                print(json.dumps({"error": "No se pudo convertir el PDF a imagen.", "pdfFile": os.path.basename(input_path)}))
                return

            # Procesar cada página como examen independiente
            for page_idx, pil_img in enumerate(images, start=1):
                temp_img_path = os.path.join(os.path.dirname(__file__), f"__temp_review_img__page_{page_idx}.png")
                try:
                    pil_img.save(temp_img_path, "PNG")

                    matricula_circulos, grupo_circulos, detected_answers = procesar_examen_completo(temp_img_path, NUM_PREGUNTAS)

                    nombre = "No detectado"
                    base_name = os.path.splitext(os.path.basename(input_path))[0]
                    file_name = f"{base_name}_page_{page_idx}"

                    result = {
                        "nombre": nombre,
                        "matricula": ''.join(str(d) if d is not None else '-' for d in matricula_circulos) if matricula_circulos else '',
                        "grupo": ''.join(str(d) if d is not None else '-' for d in grupo_circulos) if grupo_circulos else '',
                        "preguntas_detectadas": detected_answers,
                        "matricula_circulos": matricula_circulos,
                        "grupo_circulos": grupo_circulos,
                        "imagen_procesada": temp_img_path,
                        "pdfFile": os.path.basename(input_path),
                        "page": page_idx
                    }

                    output_path = os.path.join(detected_exams_dir, f"reviewed_{file_name}.json")
                    try:
                        with open(output_path, "w", encoding="utf-8") as f:
                            json.dump(result, f, indent=4, ensure_ascii=False)
                    except Exception as save_err:
                        sys.stderr.write(f"[ERROR] No se pudo guardar el archivo: {save_err}\n")

                    results_output.append(result)
                except Exception as page_err:
                    results_output.append({"error": str(page_err), "pdfFile": os.path.basename(input_path), "page": page_idx})
                finally:
                    if os.path.exists(temp_img_path):
                        try:
                            os.remove(temp_img_path)
                        except Exception:
                            pass

            # Imprimir array de resultados para que el backend pueda parsearlo (solo stdout)
            sys.stdout.write(json.dumps(results_output) + "\n")
            sys.stdout.flush()
            return
        except Exception as e:
            sys.stdout.write(json.dumps({"error": f"Error al convertir PDF: {str(e)}", "pdfFile": os.path.basename(input_path)}) + "\n")
            sys.stdout.flush()
            return

    else:
        image_path = input_path

    # Si no es PDF, procesar la única imagen y devolver como array con un solo elemento
    try:
        matricula_circulos, grupo_circulos, detected_answers = procesar_examen_completo(image_path, NUM_PREGUNTAS)
        nombre = "No detectado"
        folder_name = os.path.basename(os.path.dirname(image_path))
        file_name = os.path.basename(image_path).replace(".png", "").replace(".jpg", "").replace(".jpeg", "")
        result = {
            "nombre": nombre,
            "matricula": ''.join(str(d) if d is not None else '-' for d in matricula_circulos),
            "grupo": ''.join(str(d) if d is not None else '-' for d in grupo_circulos),
            "preguntas_detectadas": detected_answers,
            "matricula_circulos": matricula_circulos,
            "grupo_circulos": grupo_circulos,
            "imagen_procesada": image_path
        }
        output_path = os.path.join(detected_exams_dir, f"reviewed_{folder_name}_{file_name}.json")
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=4, ensure_ascii=False)
        except Exception as save_err:
            sys.stderr.write(f"[ERROR] No se pudo guardar el archivo: {save_err}\n")
        #print(json.dumps([result]))
    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e), "pdfFile": os.path.basename(input_path)}) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()