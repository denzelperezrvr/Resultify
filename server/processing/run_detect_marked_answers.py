import sys
import cv2
from review_answer_sheet import detect_marked_answers

if len(sys.argv) < 2:
    print("Uso: python run_detect_marked_answers.py <ruta_a_page_1.png>")
    sys.exit(1)

image_path = sys.argv[1]

image = cv2.imread(image_path)
if image is None:
    raise ValueError(f"No se pudo abrir la imagen: {image_path}")

# Puedes ajustar num_questions, y_start, y_end, debug según tu caso
answers = detect_marked_answers(image_path, debug=True, num_questions=5, y_start=600)

print("\nRespuestas detectadas:")
for ans in answers:
    print(f"Pregunta {ans['question_number']}: {ans['answer'].upper()}")
