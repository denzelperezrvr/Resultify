# Formato de archivo Excel para cargar exámenes

## Instrucciones

Para cargar preguntas de examen desde un archivo Excel, sigue estos pasos:

### 1. Estructura del archivo Excel

El archivo Excel debe tener **3 columnas** con los siguientes encabezados en la primera fila:

| pregunta | respuesta_correcta | valor |
|----------|-------------------|-------|
| ¿Cuál es la capital de España? | Madrid | 5 |
| ¿Cuál es el planeta más grande del sistema solar? | Júpiter | 5 |
| ¿En qué año se descubrió América? | 1492 | 5 |

### 2. Descripción de columnas

- **pregunta**: El texto de la pregunta (requerido)
- **respuesta_correcta**: La respuesta correcta (requerido)
- **valor**: El valor/puntuación de la pregunta (requerido, número)

### 3. Cargar el archivo

1. Ve a la sección "Crear examen"
2. Completa los datos del examen (nombre, descripción, tipo, grupo, carrera)
3. Haz clic en el botón **"📊 Cargar desde Excel"**
4. Selecciona tu archivo Excel (.xlsx, .xls o .csv)
5. Las preguntas se cargarán automáticamente
6. Haz clic en **"Guardar"** para guardar el examen completo

### 4. Requisitos

- El archivo debe estar en formato `.xlsx`, `.xls` o `.csv`
- La primera fila debe contener los encabezados exactos: `pregunta`, `respuesta_correcta`, `valor`
- Todos los campos son requeridos
- El valor debe ser un número

### 5. Ejemplo de archivo

```
pregunta,respuesta_correcta,valor
¿Cuál es la capital de Francia?,París,5
¿Cuál es el río más largo del mundo?,Nilo,5
¿En qué país se originó el café?,Etiopía,5
```

### 6. Notas importantes

- Si cargas un Excel, todas las preguntas previamente agregadas manualmente se reemplazarán
- Puedes seguir agregando más preguntas manualmente después de cargar desde Excel
- Solo se carga la respuesta correcta desde el Excel; puedes agregar opciones adicionales manualmente después de cargar
