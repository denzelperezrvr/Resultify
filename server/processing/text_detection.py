#!/usr/bin/env python3
"""
Script integrado para detectar cuadros en hojas de respuesta y predecir números
usando el modelo CNN entrenado.
 
Este script:
1. Detecta los cuadros más grandes en la parte superior de la imagen
2. Extrae cada cuadro como imagen individual
3. Preprocesa la imagen para el modelo
4. Predice el número usando el modelo CNN entrenado
5. Muestra resultados con visualización
"""
 
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import sys
import io

# Forzar stdout y stderr a UTF-8 para evitar errores de encoding en Windows
if sys.stdout.encoding is None or sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding is None or sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import cv2
import numpy as np
import json
import matplotlib.pyplot as plt
from PIL import Image
import argparse
import re
 
# Verificar TensorFlow
try:
    import tensorflow as tf
    from tensorflow import keras
    TF_AVAILABLE = True
    # Solo imprimir si se ejecuta como script principal
    if __name__ == "__main__":
        print(f"TensorFlow {tf.__version__} disponible")
except ImportError:
    TF_AVAILABLE = False
    if __name__ == "__main__":
        print("TensorFlow no disponible")
 
def sort_squares_reading_order(squares, tolerance_y=30):
    """
    Ordena los cuadrados en orden de lectura (izquierda a derecha, arriba hacia abajo)
    """
    if not squares:
        return []
   
    print("Ordenando recuadros en orden de lectura...")
   
    # Agrupar por líneas horizontales
    lines = []
   
    for square in squares:
        center_x, center_y = square['center']
        added_to_line = False
       
        # Buscar línea existente
        for line in lines:
            avg_y = sum(s['center'][1] for s in line) / len(line)
            if abs(center_y - avg_y) < tolerance_y:
                line.append(square)
                added_to_line = True
                break
       
        # Si no encontró línea, crear nueva
        if not added_to_line:
            lines.append([square])
   
    # Ordenar líneas por Y (de arriba hacia abajo)
    lines.sort(key=lambda line: sum(s['center'][1] for s in line) / len(line))
   
    # Dentro de cada línea, ordenar por X (de izquierda a derecha)
    for line in lines:
        line.sort(key=lambda square: square['center'][0])
   
    # Combinar todas las líneas en orden de lectura
    reading_order_squares = []
    for i, line in enumerate(lines):
        avg_y = sum(s['center'][1] for s in line) / len(line)
        print(f"  Línea {i+1}: Y≈{avg_y:.0f}, {len(line)} cuadrados")
        reading_order_squares.extend(line)
   
    return reading_order_squares
 
def detect_largest_squares(image, min_area=1000, top_fraction=0.25):
    """
    Detecta los cuadros más grandes en la parte superior de la imagen
   
    Args:
        image: Imagen de OpenCV
        min_area: Área mínima para considerar un cuadrado
        top_fraction: Fracción superior de la imagen a analizar (0.25 = primer cuarto)
   
    Returns:
        list: Lista de cuadrados detectados
        numpy.ndarray: Región analizada de la imagen
    """
    print("DETECTANDO CUADROS MÁS GRANDES")
    print("=" * 50)
   
    height, width = image.shape[:2]
    print(f"Dimensiones de imagen: {width}x{height}")
   
    # Extraer la parte superior de la imagen
    top_height = int(height * top_fraction)
    top_region = image[0:top_height, :]
   
    print(f"Analizando región superior: {width}x{top_height}")
   
    # Convertir a escala de grises
    gray = cv2.cvtColor(top_region, cv2.COLOR_BGR2GRAY)
   
    # Aplicar detección de bordes
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
   
    # Encontrar contornos
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
   
    large_squares = []
   
    print(f"Analizando {len(contours)} contornos...")
   
    for contour in contours:
        # Aproximar el contorno a un polígono
        perimeter = cv2.arcLength(contour, True)
        epsilon = 0.02 * perimeter
        approx = cv2.approxPolyDP(contour, epsilon, True)
       
        # Filtrar por número de vértices (rectangulos/cuadrados)
        if 4 <= len(approx) <= 8:
            area = cv2.contourArea(contour)
           
            # Solo cuadrados grandes
            if area >= min_area:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h if h > 0 else 0
               
                # Filtros para cuadrados reales
                if (0.5 <= aspect_ratio <= 2.0 and  # Forma rectangular
                    w >= 30 and h >= 30):  # Tamaño mínimo
                   
                    center_x = x + w // 2
                    center_y = y + h // 2
                   
                    large_squares.append({
                        'center': (center_x, center_y),
                        'bbox': (x, y, w, h),
                        'area': area,
                        'aspect_ratio': aspect_ratio,
                        'perimeter': perimeter
                    })
   
    # Ordenar por área (más grande primero)
    large_squares.sort(key=lambda x: x['area'], reverse=True)
   
    print(f"\\nENCONTRADOS {len(large_squares)} CUADROS GRANDES")
   
    return large_squares, top_region
 
def preprocess_square_image(image, target_size=(64, 64)):
    """
    Preprocesa una imagen de cuadro para el modelo, igual que en el entrenamiento.
    Args:
        image: Imagen del cuadro
        target_size: Tamaño objetivo (ancho, alto)
    Returns:
        numpy.ndarray: Imagen preprocesada (uint8, fondo blanco, centrada)
    """
    # Convertir a escala de grises si es necesario
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    h, w = gray.shape
    target_w, target_h = target_size
    ratio = min(target_w / w, target_h / h)
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    resized = cv2.resize(gray, (new_w, new_h))
    result = np.full((target_h, target_w), 255, dtype=np.uint8)  # Fondo blanco
    start_x = (target_w - new_w) // 2
    start_y = (target_h - new_h) // 2
    result[start_y:start_y + new_h, start_x:start_x + new_w] = resized
    return result
 
def preprocess_square_for_model(roi, target_size=(64, 64)):
    """
    Preprocesa una región de interés (ROI) para el modelo CNN usando el mismo pipeline que el entrenamiento.
    """
    processed = preprocess_square_image(roi, target_size)
    # Normalizar a [0, 1]
    normalized = processed.astype(np.float32) / 255.0
    # Expandir dimensiones para el modelo (batch, height, width, channels)
    model_input = np.expand_dims(np.expand_dims(normalized, axis=0), axis=-1)
    return model_input, processed
 
def load_trained_model(model_path=None):
    """
    Carga el modelo CNN entrenado
    """
    if model_path is None:
        model_path = os.path.join(os.path.dirname(__file__), "ai_models", "number_recognition_model.h5")
    if not os.path.exists(model_path):
        print(f"No se encontró el modelo: {model_path}")
        print("Asegúrate de haber entrenado el modelo primero")
        return None
    try:
        model = keras.models.load_model(model_path)
        print(f"Modelo cargado desde: {model_path}")
        return model
    except Exception as e:
        print(f"Error cargando el modelo: {e}")
        return None
 
def predict_numbers_in_squares(image, squares, model, visualize=True):
    """
    Predice números en cada cuadro usando el modelo entrenado
   
    Args:
        image: Imagen original
        squares: Lista de cuadros detectados
        model: Modelo CNN entrenado
        visualize: Si mostrar visualización
   
    Returns:
        list: Lista de predicciones
    """
    print("\nPREDICIENDO NÚMEROS CON EL MODELO...")
    print("=" * 50)

    predictions = []

    # Crear visualización si se solicita
    if visualize:
        fig, axes = plt.subplots(2, 5, figsize=(15, 8))
        axes = axes.flatten()

    for i, square in enumerate(squares[:25]):  # Limitar a 25 cuadros para visualización
        # Usar la imagen original para extraer el ROI
        x, y, w, h = square['bbox']
        center = square['center']
        margin = 5
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(image.shape[1], x + w + margin)
        y2 = min(image.shape[0], y + h + margin)
        roi = image[y1:y2, x1:x2]
        if roi.size == 0:
            print("   ROI vacío")
            continue
        # Preprocesar para el modelo usando el pipeline robusto
        model_input, processed_roi = preprocess_square_for_model(roi)
        try:
            prediction = model.predict(model_input, verbose=0)
            predicted_digit = np.argmax(prediction)
            confidence = float(np.max(prediction))
            print(f"   Predicción: {predicted_digit} (confianza: {confidence:.3f})")
            result = {
                'index': i + 1,
                'center': center,
                'bbox': (x, y, w, h),
                'predicted_digit': int(predicted_digit),
                'confidence': confidence,
                'all_probabilities': prediction[0].tolist()
            }
            predictions.append(result)
            if visualize and i < len(axes):
                axes[i].imshow(processed_roi, cmap='gray')
                axes[i].set_title(f'Cuadro {i+1}: {predicted_digit}\n(conf: {confidence:.2f})')
                axes[i].axis('off')
        except Exception as e:
            print(f"   Error en predicción: {e}")
    if visualize:
        for idx in range(len(squares), len(axes)):
            axes[idx].axis('off')
        
        plt.tight_layout()
        plt.suptitle('Predicciones del Modelo CNN', y=1.02, fontsize=16)
        plt.show()
        
    return predictions
 
def visualize_detections_and_predictions(image, squares, predictions):
    """
    Visualiza los cuadros detectados con las predicciones
    """
    visualization = image.copy()
   
    for i, (square, pred) in enumerate(zip(squares, predictions)):
        x, y, w, h = square['bbox']
        center = square['center']
        digit = pred['predicted_digit']
        confidence = pred['confidence']
       
        # Determinar color según confianza
        if confidence > 0.8:
            color = (0, 255, 0)  # Verde - alta confianza
        elif confidence > 0.5:
            color = (0, 165, 255)  # Naranja - confianza media
        else:
            color = (0, 0, 255)  # Rojo - baja confianza
       
        # Dibujar rectángulo
        cv2.rectangle(visualization, (x, y), (x + w, y + h), color, 3)
       
        # Dibujar centro
        cv2.circle(visualization, center, 5, (255, 0, 255), -1)
       
        # Añadir número predicho
        text = f"{digit} ({confidence:.2f})"
        cv2.putText(visualization, text, (x + 5, y - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
       
        # Añadir índice
        cv2.putText(visualization, str(i + 1), (x + 5, y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
   
    # Mostrar visualización
    plt.figure(figsize=(15, 10))
    plt.imshow(cv2.cvtColor(visualization, cv2.COLOR_BGR2RGB))
    plt.title(f"Cuadros Detectados y Predicciones ({len(predictions)} cuadros)")
    plt.axis('off')
    plt.show()
    
 
def process_answer_sheet(image_path, model_path=None,
                        min_area=1000, top_fraction=0.25, save_results=True):
    """
    Función principal para procesar una hoja de respuestas
   
    Args:
        image_path: Ruta de la imagen
        model_path: Ruta del modelo entrenado
        min_area: Área mínima de cuadros
        top_fraction: Fracción superior a analizar
        save_results: Si guardar resultados en JSON
   
    Returns:
        dict: Resultados del procesamiento
    """
    print("PROCESANDO HOJA DE RESPUESTAS...")
    print("=" * 60)
   
    # Verificar TensorFlow
    if not TF_AVAILABLE:
        print("TensorFlow no está disponible")
        return None
   
    # Cargar imagen
    if not os.path.exists(image_path):
        print(f"No se encontró la imagen: {image_path}")
        return None
   
    image = cv2.imread(image_path)
    if image is None:
        print(f"No se pudo cargar la imagen: {image_path}")
        return None
   
    height, width = image.shape[:2]
    print(f"Imagen cargada: {width}x{height} píxeles")
   
    # Cargar modelo
    model = load_trained_model(model_path)
    if model is None:
        return None
   
    # Detectar cuadros
    large_squares, top_region = detect_largest_squares(image, min_area, top_fraction)
   
    if not large_squares:
        print("No se detectaron cuadros")
        return None
   
    # Ordenar en orden de lectura
    reading_order_squares = sort_squares_reading_order(large_squares)
   
    # Predecir números
    predictions = predict_numbers_in_squares(top_region, reading_order_squares, model)
   
    # Visualizar resultados
    visualize_detections_and_predictions(top_region, reading_order_squares, predictions)

    # Preparar resultados (con extracción de nombre, matrícula y grupo desde la secuencia predicha)
    pred_sequence = [str(p['predicted_digit']) for p in predictions]
    sequence_str = ''.join(pred_sequence)
    nombre = sequence_str[:16]
    matricula = sequence_str[16:23]
    grupo = sequence_str[-3:]
    results = {
        'image_path': image_path,
        'image_dimensions': {'width': width, 'height': height},
        'processing_parameters': {
            'min_area': min_area,
            'top_fraction': top_fraction,
            'model_path': model_path
        },
        'squares_detected': len(large_squares),
        'squares_processed': len(predictions),
        'predictions': predictions,
        'predicted_sequence': pred_sequence,
        'nombre': nombre,
        'matricula': matricula,
        'grupo': grupo
    }
   
    # Mostrar resumen
    print("\\nRESUMEN DE RESULTADOS:")
    print("=" * 40)
    print(f"Imagen: {os.path.basename(image_path)}")
    print(f"Cuadros detectados: {len(large_squares)}")
    print(f"Predicciones realizadas: {len(predictions)}")
   
    if predictions:
        sequence = ''.join(str(p['predicted_digit']) for p in predictions)
        avg_confidence = sum(p['confidence'] for p in predictions) / len(predictions)
        print(f"Secuencia predicha: {sequence}")
        print(f"Confianza promedio: {avg_confidence:.3f}")
       
        # Mostrar predicciones individuales
        print("\\nPREDICCIONES DETALLADAS:")
        for pred in predictions:
            print(f"   Cuadro {pred['index']:2d}: {pred['predicted_digit']} "
                  f"(confianza: {pred['confidence']:.3f})")
   
    # Guardar resultados si se solicita
    if save_results:
        output_file = f"predictions_{os.path.splitext(os.path.basename(image_path))[0]}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\\nResultados guardados en: {output_file}")
   
    print("\\nPROCESAMIENTO COMPLETADO")
   
    return results
 
def main():
    """Función principal con argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Detectar y predecir números en hojas de respuesta')
    parser.add_argument('image_path', help='Ruta de la imagen a procesar')
    parser.add_argument('--model', default=None,
                       help='Ruta del modelo entrenado (default: ./ai_models/number_recognition_model.h5)')
    parser.add_argument('--min-area', type=int, default=1000,
                       help='Área mínima de cuadros (default: 1000)')
    parser.add_argument('--top-fraction', type=float, default=0.25,
                       help='Fracción superior a analizar (default: 0.25)')
    parser.add_argument('--no-save', action='store_true',
                       help='No guardar resultados en JSON')
   
    args = parser.parse_args()
   
    # Procesar imagen
    results = process_answer_sheet(
        image_path=args.image_path,
        model_path=args.model,
        min_area=args.min_area,
        top_fraction=args.top_fraction,
        save_results=not args.no_save
    )
   
    if results:
        print("\\nProcesamiento exitoso!")
    else:
        print("\\nError en el procesamiento")
 
if __name__ == "__main__":
    # Si se ejecuta directamente, usar argumentos de línea de comandos
    import sys
    if len(sys.argv) > 1:
        main()
    else:
        # Modo de ejemplo/prueba
        print("MODO DE EJEMPLO")
        print("Uso: python predict_numbers_in_sheets.py <ruta_imagen>")
        print("\\nEjemplo:")
        print("python predict_numbers_in_sheets.py hoja_respuestas.jpg")
        print("\\nOpciones adicionales:")
        print("--model: Ruta del modelo (default: number_recognition_model.h5)")
        print("--min-area: Área mínima de cuadros (default: 1000)")
        print("--top-fraction: Fracción superior (default: 0.25)")
        print("--no-save: No guardar resultados")