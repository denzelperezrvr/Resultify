import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
import os

def generar_hoja_respuestas(nombre_archivo, num_preguntas=20):
    c = canvas.Canvas(nombre_archivo, pagesize=letter)
    width, height = letter

    # Encabezado (se mantiene en la posición alta)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(1 * inch, height - 0.5 * inch, "Hoja de Respuestas")

    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, height - 0.9 * inch, "Nombre del Alumno:")
    line_x1 = 2.8 * inch
    line_x2 = line_x1 + 3.5 * inch
    line_y = height - 0.95 * inch
    c.line(line_x1, line_y, line_x2, line_y)

    # Matrícula
    c.drawString(1 * inch, height - 1.4 * inch, "Matrícula:")
    circle_size = 4  # Mantener tamaño
    mat_rows = 7
    mat_cols = 10
    text_width_matricula = c.stringWidth("Matrícula:", "Helvetica", 12)
    start_x_matricula = 1 * inch + text_width_matricula + 10
    start_y_matricula = height - 1.20 * inch
    spacing_x_mat = circle_size * 2 + 6 # MÁS SEPARACIÓN HORIZONTAL
    spacing_y_mat = circle_size * 2 + 6  # MÁS SEPARACIÓN VERTICAL
    c.setFont("Helvetica", 6)
    for col in range(mat_cols):
        x = start_x_matricula + col * spacing_x_mat
        y_num = start_y_matricula + 10
        c.drawCentredString(x, y_num, str(col))
    for row in range(mat_rows):
        for col in range(mat_cols):
            x = start_x_matricula + col * spacing_x_mat
            y = start_y_matricula - row * spacing_y_mat
            c.circle(x, y, circle_size, stroke=1, fill=0)

    padding = 7
    rect_x = start_x_matricula - circle_size - padding
    rect_y = start_y_matricula - (mat_rows - 1) * spacing_y_mat - circle_size - padding
    rect_width = (mat_cols - 1) * spacing_x_mat + 2 * circle_size + 2 * padding
    rect_height = (mat_rows - 1) * spacing_y_mat + 2 * circle_size + 2 * padding
    c.rect(rect_x, rect_y, rect_width, rect_height)

    c.setFont("Helvetica", 12)

    # Grupo
    c.drawString(5.0 * inch, height - 1.4 * inch, "Grupo:")
    text_width_grupo = c.stringWidth("Grupo:", "Helvetica", 12)
    grupo_cols = 10
    grupo_rows = 3
    start_x_grupo = 5.0 * inch + text_width_grupo + 10
    start_y_grupo = height - 1.20 * inch
    spacing_x_grupo = circle_size * 2 + 6  # MÁS SEPARACIÓN HORIZONTAL
    spacing_y_grupo = circle_size * 2 + 6  # MÁS SEPARACIÓN VERTICAL
    c.setFont("Helvetica", 6)
    for col in range(grupo_cols):
        x = start_x_grupo + col * spacing_x_grupo
        y_num = start_y_grupo + 10
        c.drawCentredString(x, y_num, str(col))
    for row in range(grupo_rows):
        for col in range(grupo_cols):
            x = start_x_grupo + col * spacing_x_grupo
            y = start_y_grupo - row * spacing_y_grupo
            c.circle(x, y, circle_size, stroke=1, fill=0)

    rect_x_g = start_x_grupo - circle_size - padding
    rect_y_g = start_y_grupo - (grupo_rows - 1) * spacing_y_grupo - circle_size - padding
    rect_width_g = (grupo_cols - 1) * spacing_x_grupo + 2 * circle_size + 2 * padding
    rect_height_g = (grupo_rows - 1) * spacing_y_grupo + 2 * circle_size + 2 * padding
    c.rect(rect_x_g, rect_y_g, rect_width_g, rect_height_g)

    c.setFont("Helvetica", 12)

    # Burbujas de preguntas
    # --- BAJAR MÁS LA SECCIÓN DE RESPUESTAS ---
    start_y = height - 2.8 * inch - 0.5 * inch  # BAJAR MEDIA PULGADA EXTRA
    pregunta_altura = 0.35 * inch  # Reducido de 0.4 para que quepan 20 preguntas
    opciones = ["A", "B", "C", "D", "E"]
    radio = 5
    padding_q = 10

    # Coordenadas del recuadro de preguntas
    top_y_q = start_y + radio + padding_q + 3
    bottom_y_q = start_y - (num_preguntas - 1) * pregunta_altura - radio - padding_q + 3
    left_x_q = 0.9 * inch
    right_x_q = 1.0 * inch + (len(opciones) - 1) * 1 * inch + radio + padding_q

    c.rect(left_x_q, bottom_y_q, right_x_q - left_x_q, top_y_q - bottom_y_q)

    c.setFont("Helvetica-Bold", 10)
    y_letras = top_y_q + 5
    for j, op in enumerate(opciones):
        x = 1.0 * inch + j * 1 * inch
        c.drawCentredString(x, y_letras, op)

    for i in range(1, num_preguntas + 1):
        y = start_y - (i - 1) * pregunta_altura
        c.setFont("Helvetica", 10)
        c.drawString(0.6 * inch, y, f"{i}.")

        for j, op in enumerate(opciones):
            x = 1.0 * inch + j * 1 * inch
            c.circle(x, y + 3, radio, stroke=1, fill=0)

        if y < 1 * inch:
            c.showPage()
            start_y = height - 1.5 * inch

    c.save()
    print(f"PDF generado: {nombre_archivo}")

# El código para ejecutar desde la terminal se mantiene igual
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python tu_script.py <exam_id> <num_preguntas> <safe_title>")
        sys.exit(1)
    
    exam_id = sys.argv[1]
    num_preguntas = int(sys.argv[2])
    safe_title = sys.argv[3] if len(sys.argv) > 3 else "exam"
    
    # Crear carpeta de PDFs generados si no existe
    generated_pdfs_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
    os.makedirs(generated_pdfs_dir, exist_ok=True)
    
    # Crear nombre de archivo con exam_id y title
    nombre_archivo = os.path.join(generated_pdfs_dir, f"answer_sheet_{exam_id}_{safe_title}.pdf")
    
    # Generar la hoja de respuestas
    generar_hoja_respuestas(nombre_archivo, num_preguntas)