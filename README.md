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

### 🖥️ Monitor de Programa
- Previsualización centralizada con retención de relación de aspecto dinámica (16:9, 9:16, 4:3, etc.).
- Superposiciones profesionales configurables: **Márgenes seguros** (*Safe Margins*) y **Regla de tercios**.
- Control de zoom del monitor (*Ajustar*, *50%*, *100%*).
- Menú de acciones flotante con alta prioridad de apilamiento (`z-index`) para evitar interferencias con deslizadores nativos.
- Modo pantalla completa.

### 🤖 Asistente de IA y Generación de Audio
- **Integración nativa con Tauri:** Envío de mensajes y propuestas de proyecto a modelos de lenguaje (OpenAI, Anthropic, Gemini, OpenRouter y proveedores compatibles).
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

# Suite completa de pruebas Vitest
npm test
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

- `src/App.tsx`: Ensamblado maestro, atajos de teclado globales y sistema de paneles redimensionables multieje.
- `src/features/editor/editor-store.ts`: Gestión de estado global con Zustand, historial reversible y persistencia.
- `src/features/editor/components/`:
  - `TimelinePanel.tsx`: Línea de tiempo multipista, cabeceras calibrables, regla y clips.
  - `PreviewMonitor.tsx`: Monitor de previsualización, guías de composición y controles de transporte.
  - `InspectorPanel.tsx`: Transformación de clips, mezcla, volumen y propiedades de pista.
  - `MediaLibraryPanel.tsx`: Catálogo de medios importados, filtros y vinculación.
  - `AssistantPanel.tsx` y `AudioGenerationPanel.tsx`: Asistente de IA y generación de audio con ElevenLabs.
  - `PreferencesSheet.tsx`: Configuración de proveedores IA, apariencia, temas e idioma.
- `src/features/editor/services/`: Clientes de IA, almacenamiento seguro con Tauri, catálogo de medios y localización.
- `src-tauri/`: Aplicación de escritorio Tauri v2 con plugins de credenciales (`tauri-plugin-keyring`) y sistema de archivos.
- `docs/INTERFAZ_Y_ARQUITECTURA.md`: Documento maestro de arquitectura y roadmap técnico.

