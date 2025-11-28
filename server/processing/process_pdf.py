import sys
import fitz  # PyMuPDF
import os
from PIL import Image
 
def pdf_to_images(pdf_path, unique_id):
    # Crear directorio de salida
    output_dir = os.path.join(os.path.dirname(__file__), "output_images", unique_id)
    os.makedirs(output_dir, exist_ok=True)
   
    # Abrir el PDF
    pdf_document = fitz.open(pdf_path)
    total_pages = len(pdf_document)
   
    for page_num in range(total_pages):
        # Obtener la página
        page = pdf_document.load_page(page_num)
       
        # Convertir a imagen (300 DPI para buena calidad)
        mat = fitz.Matrix(300/72, 300/72)  # matriz de transformación para 300 DPI
        pix = page.get_pixmap(matrix=mat)
       
        # Guardar como PNG
        img_path = os.path.join(output_dir, f"page_{page_num + 1}.png")
        pix.save(img_path)
        print(f"Imagen guardada: {img_path}")
   
    pdf_document.close()
    print(f"Conversión completada. {total_pages} páginas procesadas.")
 
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python process_pdf_alternative.py <pdf_path> <unique_id>")
        sys.exit(1)
   
    pdf_path = sys.argv[1]
    unique_id = sys.argv[2]
   
    if not os.path.exists(pdf_path):
        print(f"Error: El archivo {pdf_path} no existe.")
        sys.exit(1)
   
    pdf_to_images(pdf_path, unique_id)