# Dependencias del Proyecto Resultify

Este documento contiene todas las dependencias necesarias para ejecutar el proyecto Resultify en otro equipo.

## Requisitos del Sistema

- **Node.js**: v16 o superior
- **npm**: v8 o superior
- **Python**: 3.8 o superior
- **MySQL**: 5.7 o superior (o MariaDB equivalente)
- **Poppler** (para Windows): Necesario para conversión de PDF a imágenes

---

## 1. Dependencias Frontend (React)

### Ubicación: `Project/package.json`

#### Core Dependencies
- **react**: ^19.0.0 - Framework principal
- **react-dom**: ^19.0.0 - Renderización DOM
- **react-router-dom**: ^7.4.0 - Enrutamiento

#### HTTP & Auth
- **axios**: ^1.8.2 - Cliente HTTP
- **jwt-decode**: ^4.0.0 - Decodificación de JWT

#### Excel Handling
- **xlsx**: ^0.18.5 - Lectura/escritura de archivos Excel

#### UI & Components
- **lucide-react**: ^0.477.0 - Iconos

#### Development
- **react-scripts**: 5.0.1 - Scripts de React
- **autoprefixer**: ^10.4.21 - PostCSS
- **postcss**: ^8.5.3 - CSS processing
- **tailwindcss**: ^4.0.17 - Utility-first CSS (opcional)

#### Testing
- **@testing-library/react**: ^16.2.0
- **@testing-library/jest-dom**: ^6.6.3
- **@testing-library/user-event**: ^13.5.0
- **web-vitals**: ^2.1.4

### Instalación Frontend

```bash
cd Project
npm install
```

---

## 2. Dependencias Backend (Node.js)

### Ubicación: `server/package.json`

#### Framework & Server
- **express**: ^4.21.2 - Framework web
- **cors**: ^2.8.5 - Control de CORS

#### Database
- **mysql2**: ^3.13.0 - Driver MySQL
- **sequelize**: ^6.37.6 - ORM

#### Authentication & Security
- **bcrypt**: ^6.0.0 - Hash de contraseñas
- **jsonwebtoken**: ^9.0.2 - JWT tokens
- **dotenv**: ^16.4.7 - Variables de entorno

#### File Handling
- **multer**: ^1.4.5-lts.2 - Upload de archivos
- **file-saver**: ^2.0.5 - Descarga de archivos
- **xlsx**: ^0.18.5 - Lectura/escritura de Excel

#### Utilities
- **p-limit**: ^3.1.0 - Limitar concurrencia

### Instalación Backend

```bash
cd server
npm install
```

---

## 3. Dependencias Python

### Ubicación: `server/processing/`

Python 3.8+ es requerido. Las siguientes librerías son necesarias:

#### Procesamiento de Imágenes
- **opencv-python** (cv2): ^4.8.0 - Visión por computadora
- **numpy**: ^1.24.0 - Cálculos numéricos
- **pillow**: ^10.0.0 - Procesamiento de imágenes PIL/Pillow

#### Conversión PDF
- **pdf2image**: ^1.16.0 - Conversión PDF a imagen
- **python-poppler**: ^0.3.0 - Binding para Poppler (alternativa a usar POPPLER_PATH)

#### Generación PDF
- **reportlab**: ^4.0.0 - Generación de PDFs

#### Utilidades
- **python-dotenv**: ^1.0.0 - Variables de entorno

### Archivo de Requisitos Python

Crear archivo `requirements.txt` en la raíz del proyecto:

```
opencv-python==4.8.0.76
numpy==1.24.3
pillow==10.0.0
pdf2image==1.16.3
reportlab==4.0.4
python-dotenv==1.0.0
```

### Instalación Python

```bash
pip install -r requirements.txt
```

---

## 4. Configuración de Variables de Entorno

### Backend (.env)

Crear archivo `.env` en `server/`:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=resultify
DB_PORT=3306

# JWT
JWT_SECRET=tu_clave_secreta_segura

# Server
PORT=3001
NODE_ENV=development

# Python
PYTHON_PATH=C:\Users\tu_usuario\AppData\Local\Programs\Python\Python311\python.exe

# Poppler (Windows - requerido para pdf2image)
POPPLER_PATH=C:\Program Files\poppler\Library\bin
```

### Frontend (.env)

Crear archivo `.env` en `Project/`:

```env
REACT_APP_API_URL=http://localhost:3001/api/v1
```

---

## 5. Base de Datos MySQL

### Crear base de datos

```sql
CREATE DATABASE resultify;
USE resultify;
```

Luego ejecutar los scripts SQL en la carpeta `db/`:

```bash
# En orden:
mysql -u root -p resultify < db/tables.sql
mysql -u root -p resultify < db/functions.sql
mysql -u root -p resultify < db/triggers.sql
mysql -u root -p resultify < db/views.sql
mysql -u root -p resultify < db/stored_procedures/sp_*.sql
```

---

## 6. Instalación de Poppler (Windows)

Necesario para `pdf2image`:

### Opción 1: Descargar binarios

1. Descargar desde: https://github.com/oschwartz10612/poppler-windows/releases/
2. Extraer en: `C:\Program Files\poppler`
3. Establecer `POPPLER_PATH` en `.env`

### Opción 2: Usar Chocolatey

```bash
choco install poppler
```

---

## 7. Pasos de Instalación Completa

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd Resultify
```

### 2. Instalar Python y dependencias

```bash
pip install -r requirements.txt
```

### 3. Instalar Poppler (si es Windows)

Seguir instrucciones de la sección 6.

### 4. Configurar Backend

```bash
cd server
npm install
cp .env.example .env  # Editar con tus valores
```

### 5. Configurar Frontend

```bash
cd ../Project
npm install
cp .env.example .env  # Editar con tus valores
```

### 6. Configurar Base de Datos

```bash
mysql -u root -p < db/tables.sql
mysql -u root -p < db/functions.sql
mysql -u root -p < db/triggers.sql
mysql -u root -p < db/views.sql
```

### 7. Ejecutar el proyecto

**Terminal 1 - Backend:**

```bash
cd server
npm start
```

**Terminal 2 - Frontend:**

```bash
cd Project
npm start
```

---

## 8. Verificación

### Verificar Node.js y npm

```bash
node --version
npm --version
```

### Verificar Python

```bash
python --version
pip list | grep -E "opencv|numpy|pdf2image|reportlab"
```

### Verificar MySQL

```bash
mysql -u root -p -e "SELECT VERSION();"
```

### Verificar Poppler (Windows)

```bash
where pdfimages
# O verificar en la ruta configurada
```

---

## 9. Solución de Problemas

### Error: "Cannot find module 'express'"

```bash
cd server && npm install
```

### Error: "Module not found: 'cv2'"

```bash
pip install opencv-python
```

### Error: "POPPLER_PATH not found" (Windows)

1. Descargar Poppler desde GitHub
2. Extraer y configurar `POPPLER_PATH` en `.env`
3. Reiniciar aplicación

### Error: "Connection refused" en MySQL

```bash
# Iniciar servicio MySQL
net start MySQL80
# O en Mac/Linux
brew services start mysql
```

### Error: "Port 3001 already in use"

```bash
# Cambiar puerto en .env
PORT=3002
```

---

## 10. Versiones Recomendadas

| Software | Versión |
|----------|---------|
| Node.js | 18.x o 20.x |
| npm | 9.x o 10.x |
| Python | 3.9 o 3.11 |
| MySQL | 5.7 o 8.0 |
| React | 19.0.0 |
| Express | 4.21.2 |

---

## 11. Contacto y Soporte

Para problemas de instalación, consultar:
- Issues en el repositorio
- Documentación oficial de cada librería
- Logs de error en consola
