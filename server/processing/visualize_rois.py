import sys
import os
import cv2
import matplotlib.pyplot as plt
import numpy as np
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter

# Usa la lógica de detect_marked_answers
ALVEOLOS = {
    "a": 300,
    "b": 600,
    "c": 900,
    "d": 1200,
    "e": 1500
}

if len(sys.argv) < 2:
    print("Uso: python visualize_rois.py <ruta_a_page_1.png> [num_preguntas]")
    sys.exit(1)

image_path = sys.argv[1]
num_questions = int(sys.argv[2]) if len(sys.argv) > 2 else 20

y_start = 825
y_end = y_start + (num_questions -1) * 120
roi_size = 12

y_positions = np.linspace(y_start, y_end, num_questions, dtype=int)

image = cv2.imread(image_path)
if image is None:
    print(f"No se pudo abrir la imagen: {image_path}")
    sys.exit(1)

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
image_draw = image.copy()

plt.figure(figsize=(10, 18))
plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

for i, y in enumerate(y_positions):
    row_scores = []
    for option, x in ALVEOLOS.items():
        roi = gray[y - roi_size:y + roi_size, x - roi_size:x + roi_size]
        roi_eq = cv2.equalizeHist(roi)
        _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        dark_pixels = (roi_bin < 128).sum()
        laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
        lap_var = laplacian.var()
        score = dark_pixels + lap_var * 0.5
        row_scores.append((option, score, dark_pixels, lap_var))
    row_scores.sort(key=lambda x: x[1], reverse=True)
    best_option, best_score, best_dark, best_lap = row_scores[0]
    # Dibuja el ROI de la opción detectada
    x = ALVEOLOS[best_option]
    top_left = (x - roi_size, y - roi_size)
    bottom_right = (x + roi_size, y + roi_size)
    cv2.rectangle(image_draw, top_left, bottom_right, (255, 0, 0), 3)  # Azul para la opción detectada
    plt.text(x, y, best_option.upper(), color='blue', fontsize=12, ha='center', va='center', bbox=dict(facecolor='white', alpha=0.7, edgecolor='none'))
    print(f"Pregunta {i+1}: Mejor opción detectada = {best_option.upper()} (score={best_score:.2f}, dark={best_dark}, lap_var={best_lap:.2f}) | Todos los scores: {[(o, round(s,2)) for o,s,_,_ in row_scores]}")
    # Dibuja los otros ROIs en verde
    for option, x in ALVEOLOS.items():
        if option != best_option:
            top_left = (x - roi_size, y - roi_size)
            bottom_right = (x + roi_size, y + roi_size)
            cv2.rectangle(image_draw, top_left, bottom_right, (0, 255, 0), 1)

# plt.title('Detección de burbujas marcadas (azul) y áreas de búsqueda (verde)')
# plt.axis('off')
# plt.tight_layout()
# plt.imshow(cv2.cvtColor(image_draw, cv2.COLOR_BGR2RGB))
# plt.show()

# --- VISUALIZAR MATRÍCULA (7 filas x 10 columnas, lógica por fila, usando cuadros) ---
# Cada fila representa un dígito de la matrícula, cada columna (0-9) es una opción posible

box_size = 9  # Tamaño del cuadro (radio equivalente)
mat_rows = 7
mat_cols = 10

# Usa los mismos parámetros que en tu PDF/generador
start_x_matricula = 561
start_y_matricula = 760
spacing_x_mat = 41.75
spacing_y_mat = 41.75

matricula_detectada = []

for row in range(mat_rows):
    col_scores = []
    for col in range(mat_cols):
        x = int(start_x_matricula + col * spacing_x_mat)
        y = int(start_y_matricula - row * spacing_y_mat)
        roi = gray[y - box_size:y + box_size, x - box_size:x + box_size]
        if roi.shape[0] == 0 or roi.shape[1] == 0:
            continue
        roi_eq = cv2.equalizeHist(roi)
        _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        dark_pixels = (roi_bin < 128).sum()
        laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
        lap_var = laplacian.var()
        score = dark_pixels + lap_var * 0.5
        col_scores.append((col, score, dark_pixels, lap_var))
    if col_scores:
        col_scores.sort(key=lambda x: x[1], reverse=True)
        best_col, best_score, best_dark, best_lap = col_scores[0]
        matricula_detectada.append(best_col)
        # Dibuja el cuadro detectado en azul
        x = int(start_x_matricula + best_col * spacing_x_mat)
        y = int(start_y_matricula - row * spacing_y_mat)
        top_left = (x - box_size, y - box_size)
        bottom_right = (x + box_size, y + box_size)
        cv2.rectangle(image_draw, top_left, bottom_right, (255, 0, 0), 2)
        plt.text(x, y, str(best_col), color='blue', fontsize=8, ha='center', va='center', bbox=dict(facecolor='white', alpha=0.7, edgecolor='none'))
        print(f"Matrícula Fila {row}: Mejor columna detectada = {best_col} (score={best_score:.2f}, dark={best_dark}, lap_var={best_lap:.2f}) | Todos los scores: {[(c, round(s,2)) for c,s,_,_ in col_scores]}")
        # Dibuja los otros cuadros en verde
        for col, _, _, _ in col_scores[1:]:
            x_other = int(start_x_matricula + col * spacing_x_mat)
            top_left_other = (x_other - box_size, y - box_size)
            bottom_right_other = (x_other + box_size, y + box_size)
            cv2.rectangle(image_draw, top_left_other, bottom_right_other, (0, 255, 0), 1)

# Invertir el orden para que la primera fila sea el primer dígito
matricula_detectada = matricula_detectada[::-1]

grupo_rows = 3
grupo_cols = 10

start_x_grupo = 1693
start_y_grupo = 593
spacing_x_grupo = 41.75
spacing_y_grupo = 41.75

grupo_detectado = []
for row in range(grupo_rows):
    col_scores = []
    for col in range(grupo_cols):
        x = int(start_x_grupo + col * spacing_x_grupo)
        y = int(start_y_grupo - row * spacing_y_grupo)
        roi = gray[y - box_size:y + box_size, x - box_size:x + box_size]
        if roi.shape[0] == 0 or roi.shape[1] == 0:
            continue
        roi_eq = cv2.equalizeHist(roi)
        _, roi_bin = cv2.threshold(roi_eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        dark_pixels = (roi_bin < 128).sum()
        laplacian = cv2.Laplacian(roi_bin, cv2.CV_64F)
        lap_var = laplacian.var()
        score = dark_pixels + lap_var * 0.5
        col_scores.append((col, score, dark_pixels, lap_var))
    if col_scores:
        col_scores.sort(key=lambda x: x[1], reverse=True)
        best_col, best_score, best_dark, best_lap = col_scores[0]
        grupo_detectado.append(best_col)
        # Dibuja el cuadro detectado en azul
        x = int(start_x_grupo + best_col * spacing_x_grupo)
        y = int(start_y_grupo - row * spacing_y_grupo)
        top_left = (x - box_size, y - box_size)
        bottom_right = (x + box_size, y + box_size)
        cv2.rectangle(image_draw, top_left, bottom_right, (255, 0, 0), 2)
        plt.text(x, y, str(best_col), color='blue', fontsize=8, ha='center', va='center', bbox=dict(facecolor='white', alpha=0.7, edgecolor='none'))
        print(f"Grupo Fila {row}: Mejor columna detectada = {best_col} (score={best_score:.2f}, dark={best_dark}, lap_var={best_lap:.2f}) | Todos los scores: {[(c, round(s,2)) for c,s,_,_ in col_scores]}")
        # Dibuja los otros cuadros en verde
        for col, _, _, _ in col_scores[1:]:
            x_other = int(start_x_grupo + col * spacing_x_grupo)
            top_left_other = (x_other - box_size, y - box_size)
            bottom_right_other = (x_other + box_size, y + box_size)
            cv2.rectangle(image_draw, top_left_other, bottom_right_other, (0, 255, 0), 1)

# plt.title('Detección de matrícula (azul: marcado, verde: candidatos)\nMatrícula detectada: ' + ''.join(str(d) for d in matricula_detectada))
# plt.axis('off')
# plt.tight_layout()
# plt.imshow(cv2.cvtColor(image_draw, cv2.COLOR_BGR2RGB))
# plt.show()

plt.title('Detección de grupo (azul: marcado, verde: candidatos)\nGrupo detectado: ' + ''.join(str(d) for d in grupo_detectado))
plt.axis('off')
plt.tight_layout()
plt.imshow(cv2.cvtColor(image_draw, cv2.COLOR_BGR2RGB))
plt.show()


