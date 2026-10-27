# Sparta Video

Editor de vídeo de escritorio profesional en desarrollo para Windows, construido con **React 19**, **TypeScript**, **Rust** y **Tauri v2**. Diseñado con la estética y el sistema de componentes de alto rendimiento de Sparta Agent, integrando flujos de trabajo tradicionales de edición no lineal (NLE) con capacidades avanzadas de IA.

---

## Características Principales

### 🎬 Edición y Línea de Tiempo
- **Distribución calibrable y arrastrable:**
  - **Divisor horizontal redimensionable:** Arrastra la barra divisoria entre el Monitor de Programa / Inspector y la Línea de Tiempo para calibrar con precisión el espacio vertical asignado a la previsualización o a las pistas.
  - **Ancho de cabeceras de pista calibrable:** Arrastra el borde derecho de las cabeceras de pista (`PISTAS`) para ajustar el ancho visible de los nombres y controles de pista.
  - **Paneles flotantes y división flexible:** Biblioteca de medios, monitor, inspector y asistente IA organizados con `react-resizable-panels`, con persistencia automática de la distribución y opción de restablecimiento rápido.
  - **Expansión rápida:** Botón para expandir la línea de tiempo al 84% de la vista para edición multipista intensiva.
- **Herramientas de edición:**
  - Selección (`V`) y cuchilla / Razor (`C`).
  - Mover y recortar clips por los extremos con retroalimentación visual de duración y desplazamiento.
  - Marcadores de línea de tiempo (`M`) con navegación rápida y eliminación contextual.
  - Ajuste inteligente a fotogramas (*Snapping*) con guías visuales de alineación.
  - Zoom dinámico de la línea de tiempo (deslizador, rueda de ratón con `Ctrl` y encajar secuencia).
  - Formas de onda de audio sintéticas y densidad de pistas seleccionable (compacta, normal y expandida).
  - Deshacer y rehacer ilimitados (`Ctrl+Z` / `Ctrl+Shift+Z`).

### 🎞️ Interpolación de Fotogramas Clave (Keyframes)
- **Animación y Movimiento Suave:** Sistema de interpolación de fotogramas clave con curvas cúbicas Hermite y *smoothstep*.
- **Propiedades animables:** Posición (X/Y), Escala (X/Y), Rotación y Opacidad/Fundidos.
- **Sincronización en tiempo real:** Los cambios se reflejan de forma inmediata durante el desplazamiento del cabezal en el monitor y se renderizan cuadro a cuadro durante la exportación.
- **Gestión en el Inspector:** Añade, navega o elimina fotogramas clave por segundo con actualización reactiva según los deslizadores y cajas numéricas.

### 🔊 Motor de Audio Multipista en Tiempo Real
- **Sincronización Web Audio API:** `TimelineAudioEngine` gestiona la reproducción simultánea de clips de audio y vídeo según la posición del cabezal.
- **Controles por clip y pista:** Ganancia y volumen independiente (0% a 150%), fundidos de entrada (*fade-in*) y salida (*fade-out*) configurables y silenciamiento (*Mute*) de pistas.
- **Preescucha interactiva:** Controles de transporte interactivos (Reproducir, Pausar, Salto al inicio/final, Fotograma previo/siguiente).

### 📦 Exportación y Renderizado
- **Compositor Canvas 2D:** Renderizado fotograma a fotograma respetando capas, transformaciones matriciales, rotaciones y opacidades de cada clip.
- **Mezcla de Audio Fuera de Línea:** `OfflineAudioContext` para la mezcla y balanceo exacto de todas las pistas antes de la codificación.
- **Preajustes de exportación integrados:**
  - `1080p Full HD (Web / YouTube)`: 1920 × 1080 · 30 fps · 8 Mbps (WebM/MP4).
  - `4K Ultra HD`: 3840 × 2160 · 30 fps · 25 Mbps.
  - `1080p Vertical (TikTok / Reels / Shorts)`: 1080 × 1920 · 30 fps · 8 Mbps.
  - `720p HD Rápido`: 1280 × 720 · 30 fps · 4 Mbps.
  - `Master de Audio WAV`: Mezcla a 48 kHz / 16-bit PCM estéreo sin compresión.
- **Diálogo de exportación:** Barra de progreso en vivo por cuadros, porcentaje y cancelación segura abortable. Descarga directa con nombre de archivo automático.

### 💾 Portabilidad de Proyecto y Almacenamiento Local
- **Formato `.sparta` portable:** Exportación e importación de proyectos en formato JSON estandarizado y validado rigurosamente con esquemas **Zod**.
- **Persistencia en IndexedDB:** Caché de recursos multimedia pesados (vídeos, imágenes y audios generados) directamente en el almacenamiento local de la aplicación.
- **Inserción directa de Audio IA:** La locución o efectos generados con ElevenLabs se pueden insertar directamente en la biblioteca y en la línea de tiempo en un solo clic.

### 🍞 Sistema de Notificaciones Toast Accesible
- Notificaciones no intrusivas con diseño *glassmorphism* Sparta en la esquina inferior derecha.
- Variantes para éxito, información, advertencia y error con regiones accesibles `role="status"` y compatibilidad WCAG 2.2.

### 🖥️ Monitor de Programa
- Previsualización centralizada con retención de relación de aspecto dinámica (16:9, 9:16, 4:3, etc.).
- Superposiciones profesionales configurables: **Márgenes seguros** (*Safe Margins*) y **Regla de tercios**.
- Control de zoom del monitor (*Ajustar*, *50%*, *100%*).
- Menú de acciones flotante con alta prioridad de apilamiento (`z-index`) para evitar interferencias con deslizadores nativos.
- Modo pantalla completa.

### 🤖 Asistente de IA y Generación de Audio
- **Integración nativa con Tauri:** Envío de mensajes y propuestas de proyecto a modelos de lenguaje (OpenAI, Anthropic, Gemini, OpenRouter y proveedores compatibles).
- **Propuestas ejecutables de edición:** El asistente puede emitir sugerencias directas de edición (ajuste de duración, cortes o mezcla) que el usuario puede aplicar de inmediato.
- **Seguridad en autenticación:** Cabecera `x-goog-api-key` en Rust y TypeScript para evitar exposición de credenciales en URL.
- **Almacenamiento seguro de credenciales:** Las API Keys se protegen mediante el llavero de credenciales de Windows (`keyring`).
- **Estudio de Audio IA:** Generación de locuciones y efectos de sonido con ElevenLabs, preescucha en tiempo real y descarga de audio.
- Memoria contextual por proyecto con historial persistente.

### 🎨 Personalización y Apariencia
- Selector de tema (Oscuro, Claro, Sistema).
- Paletas de acento cromático Sparta (Azul Sparta, Esmeralda, Violeta, Ámbar, Rosa).
- Control de animaciones de interfaz y atajos de teclado completos.

---

## Requisitos

- **Node.js**: v20.19+ o v22.12+
- **npm**: v10+
- **Para compilación de escritorio**: Rust/Cargo (estable), MSVC C++ Build Tools y WebView2 para Windows.

---

## Puesta en Marcha

### Instalación de dependencias
```bash
npm install
```

### Ejecutar en modo desarrollo web
```bash
npm run dev
```

### Ejecutar como aplicación de escritorio Tauri
```bash
npm run tauri:dev
```

---

## Validación y Pruebas

```bash
# Compilación TypeScript y empaquetado Vite
npm run build

# Verificación de linter ESLint
npm run lint

# Suite completa de pruebas Vitest (60 tests)
npm test

# Suite de pruebas unitarias de Rust
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

---

## Atajos de Teclado Clave

| Atajo | Acción |
| :--- | :--- |
| `Espacio` | Reproducir / Pausar |
| `V` | Herramienta de Selección |
| `C` | Herramienta de Corte (Razor) |
| `M` | Añadir marcador en el cabezal |
| `Ctrl + Z` | Deshacer |
| `Ctrl + Shift + Z` | Rehacer |
| `Ctrl + K` | Buscar en biblioteca de medios |
| `[` / `]` | Navegar entre marcadores |
| `\` | Encajar secuencia en pantalla |
| `Supr` / `Backspace` | Eliminar marcador o clip seleccionado |

---

## Arquitectura del Proyecto

- `src/App.tsx`: Ensamblado maestro, atajos de teclado globales, barra de herramientas y diálogo de exportación.
- `src/features/editor/editor-store.ts`: Gestión de estado global con Zustand, historial reversible y persistencia.
- `src/features/editor/components/`:
  - `TimelinePanel.tsx`: Línea de tiempo multipista, cabeceras calibrables, regla y clips.
  - `PreviewMonitor.tsx`: Monitor de previsualización, interpolación de fotogramas clave, guías y transporte.
  - `InspectorPanel.tsx`: Transformación de clips, keyframes, mezcla, volumen y propiedades de pista.
  - `MediaLibraryPanel.tsx`: Catálogo de medios importados, filtros y vinculación con IndexedDB.
  - `ExportDialog.tsx`: Modal de configuración de exportación, selector de preajustes y barra de progreso.
  - `AssistantPanel.tsx` y `AudioGenerationPanel.tsx`: Asistente de IA y generación de audio con ElevenLabs.
  - `PreferencesSheet.tsx`: Configuración de proveedores IA, apariencia, temas e idioma.
- `src/features/editor/services/`:
  - `export-engine.ts`: Motor de exportación y renderizado en lienzo con mezcla de audio y descarga.
  - `keyframe-interpolation.ts`: Motor matemático de interpolación cúbica de posición, escala y opacidad.
  - `audio-playback.ts`: Motor Web Audio API de reproducción y sincronización en tiempo real.
  - `project-file.ts`: Servicio de serialización y validación Zod para archivos de proyecto `.sparta`.
  - `media-storage.ts`: Capa de persistencia multimedia en IndexedDB.
  - `ai-chat.ts` y `ai-operations.ts`: Clientes de IA y generador de propuestas de edición contextuales.
- `src/components/ui/`: Sistema de componentes de interfaz, incluyendo el componente `toast.tsx`.
- `src-tauri/`: Aplicación de escritorio Tauri v2 con plugins de credenciales (`tauri-plugin-keyring`) y sistema de archivos.
- `docs/INTERFAZ_Y_ARQUITECTURA.md`: Documento maestro de arquitectura y hoja de ruta técnica completada.

