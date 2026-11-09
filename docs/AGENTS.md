# AGENTS.md — Sparta Video

> Documento de referencia para agentes de IA y colaboradores. Describe qué es el proyecto, cómo está construido, qué funciona hoy y qué se puede implementar a continuación.

---

## 1. ¿Qué es Sparta Video?

Sparta Video es un **editor de vídeo no lineal (NLE) de escritorio**, orientado a creadores de contenido para plataformas como TikTok, Reels, YouTube Shorts y producción cinematográfica. Combina una interfaz tipo Adobe Premiere con herramientas de inteligencia artificial integradas (subtítulos automáticos con Whisper, copiloto de edición con LLMs, generación de voz con ElevenLabs).

Puede ejecutarse de dos maneras:

| Modo | Comando | Característica |
|---|---|---|
| **Web** | `npm run dev` | Sin instalación, directo en Chrome/Edge |
| **Escritorio** | `npm run tauri:dev` | App nativa Windows via Tauri + Rust, sin throttling de pestaña |

---

## 2. Stack tecnológico

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 19 | UI reactiva completa |
| TypeScript | ~6.0 | Tipado estricto en todo el proyecto |
| Vite | 8 | Bundler + dev server + build |
| Tailwind CSS | 4 | Utilidades CSS; coexiste con CSS propio por tokens |
| Zustand | 5 | Estado global + historial (undo/redo) |
| Zod | 4 | Validación de esquemas en límites de servicio |
| react-resizable-panels | 4 | Layout de paneles ajustables |
| @base-ui/react | 1 | Menús y diálogos accesibles (WAI-ARIA) |
| @radix-ui/react-* | 2 | Select, Dialog primitivos |
| lucide-react | 1 | Iconografía unificada |

### Motor de medios y exportación
| Tecnología | Uso |
|---|---|
| Canvas 2D API | Compositing cuadro a cuadro para exportación |
| WebCodecs API | Codificación de vídeo H.264/VP9 hardware-acelerada |
| MediaRecorder API | Fallback de grabación WebM cuando WebCodecs no está disponible |
| OfflineAudioContext | Mezcla de audio multipista para exportación |
| mp4-muxer + webm-muxer | Empaquetado de contenedor final |
| Web Audio API | Motor de reproducción de audio en tiempo real |
| @huggingface/transformers | Modelo Whisper ejecutado en Web Worker (ONNX Runtime) |

### IA y proveedores
| Proveedor | Protocolo | Uso |
|---|---|---|
| OpenAI | REST chat/completions + Whisper ASR | Chat, subtítulos cloud, reasoning models (o1/o3) |
| Anthropic | Messages API | Chat con modelos Claude |
| Google Gemini | generateContent API | Chat con Gemini |
| Groq / Mistral / DeepSeek / OpenRouter | Compatibles OpenAI v1 | Chat genérico |
| ElevenLabs | TTS + SFX API | Generación de narración y efectos de audio |
| HuggingFace (local) | ONNX Worker | Whisper ASR offline en navegador |

### Backend (Tauri / Rust)
| Elemento | Descripción |
|---|---|
| `src-tauri/src/lib.rs` | Comandos IPC: proxy de AI APIs, gestión de credenciales |
| `keyring` (Windows Keyring) | Almacenamiento seguro de API keys en modo escritorio |
| Pool `OnceLock<Client>` | Cliente HTTP reutilizable con timeouts de 30 s |
| Targets: NSIS + MSI | Empaquetado instalador Windows |

### Almacenamiento
| Mecanismo | Qué guarda |
|---|---|
| `localStorage` | Estado parcial del proyecto (proyectos pequeños), preferencias de IA, historial de chat |
| IndexedDB | Blobs de archivos de vídeo, audio e imagen (referenciados por `assetId`) |
| Formato `.sparta` | JSON portable versionado con todo el proyecto (secuencia, pistas, assets, marcadores) |

### Calidad
| Herramienta | Estado |
|---|---|
| Vitest + Testing Library | 75/75 pruebas unitarias passing (`npm test`) |
| ESLint + oxlint | 0 errores (`npm run lint`) |
| TypeScript | Compilación limpia |
| Cargo test | 7/7 pruebas Rust |

---

## 3. Arquitectura del código

```
src/
├── App.tsx                          # Shell principal, atajos globales, layout
├── App.css                          # Estilos globales de la UI (migración pendiente)
├── index.css                        # Base CSS + tokens importados
├── styles/
│   ├── tokens.css                   # Variables semánticas de diseño (colores, tipografía, espaciado)
│   └── editor-polish.css            # Refinamientos de interacción y paneles
├── components/ui/                   # Primitivas de UI reutilizables
│   ├── button, input, slider,
│   │   select, switch, tabs,
│   │   accordion, badge,
│   │   dialog, toggle-group
│   ├── toast.tsx                    # Notificaciones accesibles (WAI-ARIA live regions)
│   └── toast-service.ts             # API imperativa para toasts
├── lib/utils.ts                     # clsx + tailwind-merge
└── features/editor/
    ├── model.ts                     # Tipos de dominio: Clip, Track, MediaItem, Keyframe, etc.
    ├── editor-store.ts              # Zustand store: estado + acciones + undo/redo + persistencia
    ├── timecode.ts                  # Conversión temporal, regla, SMPTE
    ├── components/
    │   ├── MediaLibraryPanel.tsx    # Biblioteca: catálogo, filtros, drag-and-drop
    │   ├── PreviewMonitor.tsx       # Monitor: transporte, timecode, zoom, guías
    │   ├── InspectorPanel.tsx       # Inspector: propiedades de clip, audio, movimiento
    │   ├── TimelinePanel.tsx        # Timeline: pistas, clips, herramientas, snapping
    │   ├── AssistantPanel.tsx       # Copiloto IA: chat, propuestas revisables, chips
    │   ├── AIProviderSettings.tsx   # Configuración de proveedores y perfiles IA
    │   ├── PreferencesSheet.tsx     # Drawer de preferencias (workspace, atajos)
    │   ├── ExportDialog.tsx         # Modal de exportación con perfiles y progreso
    │   ├── AudioGenerationPanel.tsx # ElevenLabs: voz y SFX con inserción en timeline
    │   ├── RenameProjectDialog.tsx  # Cambio de nombre del proyecto
    │   ├── ActionMenu.tsx           # Menú contextual reutilizable
    │   ├── StudioIcons.tsx          # Iconos SVG propios complementarios
    │   └── controls.tsx             # Primitivas de control de transporte
    ├── effects/
    │   ├── catalog.ts               # Catálogo de efectos (LUTs, pixel, transiciones) + registro
    │   ├── lut-parser.ts            # Parser de archivos .cube LUT 3D
    │   ├── pixel-effects.ts         # Efectos de píxel (brillo, contraste, saturación, etc.)
    │   └── transition-math.ts       # Cálculos de transición (fade, wipe, etc.)
    ├── render/
    │   ├── compositor.ts            # Compositor WebGL (estructura lista, integración pendiente)
    │   └── shaders.ts               # GLSL shaders para compositing GPU
    └── services/
        ├── contracts.ts             # Contratos TypeScript y esquemas Zod de servicios
        ├── ai-chat.ts               # Cliente de chat (OpenAI/Anthropic/Gemini/custom)
        ├── ai-operations.ts         # Operaciones tipadas de IA + parser + applyAIOperations
        ├── ai-preferences.ts        # Preferencias de IA expuestas al asistente
        ├── ai-provider-registry.ts  # Perfiles, catálogos y gestión de API keys
        ├── appearance-preferences.ts # Preferencias de apariencia del editor
        ├── audio-generation.ts      # ElevenLabs TTS y SFX
        ├── audio-playback.ts        # TimelineAudioEngine: mezcla multipista en tiempo real
        ├── export-engine.ts         # renderSequence: Canvas 2D + WebCodecs/MediaRecorder
        ├── keyframe-interpolation.ts # Interpolación Hermite cúbica de keyframes
        ├── locale.ts                # Función t() para texto bilingüe ES/EN
        ├── media-catalog.ts         # Validación y normalización de MediaItem
        ├── media-fit.ts             # Cálculo de fit/fill/stretch de clips en canvas
        ├── media-storage.ts         # CRUD de blobs en IndexedDB
        ├── project-file.ts          # Serialización/deserialización de .sparta
        ├── subtitle-generator.ts    # Pipeline completo de subtítulos (VAD+Whisper+LLM)
        ├── text-presets.ts          # Definición de plantillas de texto animado
        └── whisper.worker.ts        # Web Worker: modelo Whisper local via @huggingface/transformers

src-tauri/
├── src/lib.rs                       # Comandos Tauri: chat_with_provider, fetch_model_catalog, credenciales
├── src/main.rs                      # Punto de entrada nativo
├── capabilities/default.json        # Permisos IPC mínimos (fetch, dialog, path)
└── tauri.conf.json                  # Ventana 1440×900, CSP, targets NSIS+MSI
```

---

## 4. Modelo de dominio

```
Proyecto (.sparta)
├── projectName: string
├── sequence: { width, height, frameRate }
├── tracks: Track[]
│   ├── id, name, kind ('video' | 'audio')
│   └── clips: Clip[]
│       ├── id, title, start, duration, color
│       ├── sourceAssetId?              → referencia a MediaItem en IndexedDB
│       ├── kind: 'video' | 'audio' | 'adjustment'
│       ├── transform: { x, y, scaleX, scaleY, rotation }
│       ├── opacity, blendMode, fit, crop, flipH, flipV
│       ├── speed, preservePitch, freezeTime
│       ├── effects: EffectInstance[]
│       ├── transitionIn?, transitionOut?
│       ├── volume, fadeIn, fadeOut
│       ├── keyframes: Keyframe[]
│       ├── text?, textStyle?, textAnimation?  → clips de texto/subtítulo
├── assets: MediaItem[]
│   ├── id, title, detail, thumb, type, durationSeconds
│   ├── status: 'catalog-only' | 'ready' | 'missing' | 'processing' | 'error'
│   └── width?, height?, sourcePath?
├── markers: TimelineMarker[]
├── snapToFrames: boolean
├── mutedTracks: Set<string>
└── lockedTracks: Set<string>
```

**Historial (undo/redo):** El store mantiene `past[]` y `future[]` de snapshots del proyecto. Cada acción llama a `commit()` con coalescencia temporal de 800 ms para agrupar gestos continuos.

---

## 5. Estado actual de implementación

### ✅ Funcionando

| Área | Detalle |
|---|---|
| **Shell y layout** | Paneles redimensionables, barra superior, atajos globales |
| **Timeline** | Mover/trim/split clips, herramienta Razor, marcadores, snapping al cuadro, zoom, scroll sincronizado |
| **Inspector** | Propiedades de clip (transform, opacity, blend, volume, fades, keyframes como datos) |
| **Biblioteca** | Catálogo, filtros, búsqueda, lista/cuadrícula, drag-and-drop al timeline |
| **Proyecto** | Guardar/abrir `.sparta`, IndexedDB para blobs, undo/redo con historial agrupado |
| **Audio playback** | `TimelineAudioEngine` sincroniza pistas de audio con volumen y fundidos |
| **Exportación** | Canvas 2D compositing, WebCodecs (H.264/VP9) + MediaRecorder fallback, WAV PCM |
| **IA – Chat** | OpenAI / Anthropic / Gemini / Groq / compatibles; historial local por proyecto |
| **IA – Operaciones** | 15 tipos de operación tipadas (add_marker, split_clip, move_clip, set_sequence, generate_subtitles, etc.) aplicadas atómicamente con 1 undo |
| **Subtítulos** | Pipeline completo: VAD → Whisper local (Worker) → Whisper cloud → LLM fallback |
| **Plantillas de texto** | 6 presets animados (Hormozi Karaoke, Pop Pill, Cine 4K, Impact Hook, Cyber Neon, Lower Third) |
| **Audio IA** | ElevenLabs TTS + SFX con inserción directa al timeline |
| **Efectos** | Catálogo de 40+ efectos de color/grado + LUT 3D parser + pixel effects + transiciones |
| **Animaciones de clip** | Sistema de animación para imagen/vídeo: 15 presets de entrada, 13 de salida, 13 combinados (Ken Burns, pan, float, pulse…). Genera keyframes automáticos interpolados en export. |
| **Tauri** | Credential vault (Keyring), proxy AI APIs con timeout y sanitización |
| **Toast** | Sistema de notificaciones accesible (WAI-ARIA live region) |
| **Tests** | 75 unitarios Vitest + 7 Rust, ESLint 0 errores |

### ⚠️ Parcial / pendiente de conectar

| Área | Estado |
|---|---|
| **Preview de vídeo** | El monitor muestra estado vacío. La decodificación y compositing en tiempo real no está conectada al `PreviewMonitor` |
| **Miniaturas reales** | Las fichas de media usan thumbs placeholder, no fotogramas decodificados del archivo |
| **Keyframe playback** | Los keyframes se guardan en el modelo pero el motor de reproducción no los interpola durante el scrub |
| **Compositor WebGL** | `render/compositor.ts` y `shaders.ts` existen pero no se usan en el preview (solo Canvas 2D en export) |
| **Multi-selección** | El timeline solo permite seleccionar 1 clip a la vez |
| **Relocalización de medios** | El flujo de "offline media → relink" no está implementado |
| **Proxy workflow** | No hay transcodificación a baja resolución para edición fluida de archivos pesados |
| **Waveform visual** | No se muestra la forma de onda del audio en los clips del timeline |
| **Exportación de vídeo real** | El export dibuja frames de `<video>` elements mediante seeking; funciona para secuencias cortas pero puede tener timing issues en clips largos/complejos |

---

## 6. Plan de implementación por fases

Las fases están ordenadas por impacto y dependencias. Cada una incluye los archivos clave a tocar.

---

### Fase A — Preview de vídeo en tiempo real *(prioridad crítica)*

**Objetivo:** que el monitor muestre el fotograma correcto al hacer scrub y reproducción.

**Qué implementar:**
- Crear `VideoPlaybackEngine` en `services/video-playback.ts` que gestione elementos `<video>` ocultos por cada asset de vídeo.
- Conectar `PreviewMonitor.tsx` para que en cada tick de `requestAnimationFrame` se:
  1. Busquen los clips activos en el playhead.
  2. Se seek al tiempo local correcto en cada `<video>`.
  3. Se dibuje en el canvas del monitor usando el compositor (Canvas 2D en una primera versión, WebGL después).
- Usar el `TimelineAudioEngine` ya existente para sincronizar el audio.

**Archivos clave:**
- `src/features/editor/components/PreviewMonitor.tsx` — añadir loop RAF + renderizado
- `src/features/editor/services/video-playback.ts` — nuevo
- `src/features/editor/services/audio-playback.ts` — ya existe, conectar start/stop/seek

**Criterio de salida:** Scrub mueve el fotograma en el monitor; Play/Pause reproduce vídeo y audio sincronizados.

---

### Fase B — Waveform visual en el timeline

**Objetivo:** mostrar la representación visual de la onda de audio en los clips de audio/vídeo.

**Qué implementar:**
- Al importar un asset de audio/vídeo, decodificar el canal de audio con `OfflineAudioContext` y calcular RMS por ventana.
- Guardar el array de muestras comprimido en el `MediaItem` (o en una caché separada en IndexedDB).
- En `TimelinePanel.tsx`, dibujar la waveform en un `<canvas>` superpuesto sobre el clip.

**Archivos clave:**
- `src/features/editor/services/media-catalog.ts` — añadir decodificación de waveform al ingestar
- `src/features/editor/model.ts` — añadir `waveformPeaks?: number[]` a `MediaItem`
- `src/features/editor/components/TimelinePanel.tsx` — renderizado de waveform en clips de audio

---

### Fase C — Keyframes en reproducción

**Objetivo:** que la interpolación de keyframes se aplique durante scrub y playback (posición, escala, opacidad, rotación).

**Qué implementar:**
- Conectar `services/keyframe-interpolation.ts` (ya existe) al motor de preview.
- Para cada frame, calcular el valor interpolado de cada propiedad animada antes de dibujar el clip.
- Añadir navegación prev/next keyframe en el Inspector.

**Archivos clave:**
- `src/features/editor/services/keyframe-interpolation.ts` — ya existe, revisar API
- `src/features/editor/components/PreviewMonitor.tsx` — llamar a interpolación por frame
- `src/features/editor/components/InspectorPanel.tsx` — botones de navegación entre keyframes

---

### Fase D — Multi-selección en el timeline

**Objetivo:** seleccionar múltiples clips con `Shift+clic` o marquee drag, luego moverlos/eliminarlos en bloque.

**Qué implementar:**
- Cambiar `selectedClipId: string | null` en el store por `selectedClipIds: Set<string>`.
- Implementar lasso/marquee de selección rectangular en el canvas del timeline.
- Operaciones bulk: `deleteClips(ids)`, `moveClips(ids, delta)`.
- Actualizar el Inspector para mostrar propiedades compartidas cuando hay múltiple selección.

**Archivos clave:**
- `src/features/editor/editor-store.ts` — refactor de selección
- `src/features/editor/components/TimelinePanel.tsx` — lasso + Shift+clic
- `src/features/editor/components/InspectorPanel.tsx` — modo multi-clip

---

### Fase E — Compositor WebGL para preview

**Objetivo:** sustituir Canvas 2D en el preview por el compositor WebGL de `render/compositor.ts` para mayor rendimiento y soporte de efectos GPU.

**Qué implementar:**
- Inicializar el compositor en `PreviewMonitor.tsx` con el canvas WebGL.
- Por cada frame, construir la lista de clips activos ordenada por pista y compositar con los shaders existentes.
- Aplicar los efectos del catálogo (`effects/pixel-effects.ts`) via uniforms GLSL.

**Archivos clave:**
- `src/features/editor/render/compositor.ts` — ya existe estructura, completar integración
- `src/features/editor/render/shaders.ts` — revisar uniforms necesarios
- `src/features/editor/components/PreviewMonitor.tsx` — inicializar WebGL canvas

---

### Fase F — Relocalización de medios offline

**Objetivo:** cuando un asset de IndexedDB no está disponible, mostrar estado offline y permitir al usuario reapuntar a un nuevo archivo.

**Qué implementar:**
- Al cargar un proyecto, verificar qué assets existen en IndexedDB y cuáles no; marcar los ausentes como `status: 'missing'`.
- En la biblioteca, mostrar el clip con badge rojo "Offline" y botón "Relocalizar".
- Dialog de relink que abre el file picker nativo (Tauri) o `<input type="file">` (web) y actualiza el blob en IndexedDB.

**Archivos clave:**
- `src/features/editor/services/media-storage.ts` — añadir verificación de existencia
- `src/features/editor/services/project-file.ts` — marcar assets missing al cargar
- `src/features/editor/components/MediaLibraryPanel.tsx` — UI de estado offline + relink

---

### Fase G — Proxy workflow

**Objetivo:** transcodificar archivos pesados a baja resolución para edición fluida; usar original solo en export.

**Qué implementar:**
- Tras importar, generar un proxy 540p usando `OffscreenCanvas` + `MediaRecorder` o WebCodecs encode.
- Guardar el proxy blob en IndexedDB con `assetId + '-proxy'`.
- En el preview, usar siempre el proxy; en export, cambiar al original.
- Toggle en preferencias para desactivar proxies.

**Archivos clave:**
- `src/features/editor/services/media-storage.ts` — guardar/recuperar proxies
- `src/features/editor/model.ts` — añadir `proxyStatus` a `MediaItem`
- Nuevo: `src/features/editor/services/proxy-encoder.ts`

---

### Fase H — Exportación de SRT / VTT

**Objetivo:** exportar los subtítulos del timeline como archivos `.srt` o `.vtt` independientes.

**Qué implementar:**
- Recopilar todos los clips de texto/subtítulo del timeline ordenados por tiempo.
- Generar el texto SRT (`00:00:00,000 --> 00:00:02,000\nTexto`) o WebVTT.
- Botón en ExportDialog o en la barra superior.

**Archivos clave:**
- Nuevo: `src/features/editor/services/subtitle-export.ts`
- `src/features/editor/components/ExportDialog.tsx` — añadir opción SRT/VTT

---

### Fase I — Importación de SRT / VTT

**Objetivo:** importar subtítulos desde archivos externos y convertirlos en clips de texto en el timeline.

**Qué implementar:**
- Parser de `.srt` y `.vtt` que devuelva `SubtitleEntry[]`.
- Acción en la biblioteca para importar subtítulos.
- Insertar como secuencia de clips usando `addSubtitleSequence`.

**Archivos clave:**
- Nuevo: `src/features/editor/services/subtitle-import.ts`
- `src/features/editor/components/MediaLibraryPanel.tsx` — botón importar SRT/VTT

---

### Fase J — Editor de curvas de keyframes

**Objetivo:** UI visual de curvas Bézier para editar la interpolación de keyframes propiedad por propiedad.

**Qué implementar:**
- Panel plegable en el Inspector con miniatura de la curva por propiedad animada.
- Drag de handles Bézier en un `<canvas>` interno.
- Persistir los handles en el modelo de keyframe.

**Archivos clave:**
- `src/features/editor/model.ts` — añadir `easeIn?, easeOut?` a `Keyframe`
- `src/features/editor/services/keyframe-interpolation.ts` — soporte Bézier cúbico
- `src/features/editor/components/InspectorPanel.tsx` — sección de curvas

---

### Fase K — Más operaciones de IA

**Objetivo:** ampliar los tipos de `AIOperation` para cubrir más acciones de edición.

**Operaciones a añadir:**

| Tipo | Descripción |
|---|---|
| `ripple_trim` | Recortar un borde de clip y desplazar todo lo que sigue |
| `set_clip_speed` | Cambiar velocidad de reproducción (`speed` + `preservePitch`) |
| `add_adjustment_layer` | Capa de ajuste con efectos aplicados a todo lo que hay debajo |
| `set_clip_effect` | Añadir/modificar un efecto del catálogo en un clip |
| `remove_clip_effect` | Quitar un efecto específico |
| `set_clip_crop` | Ajustar los valores de recorte (`l`, `t`, `r`, `b`) |
| `freeze_frame` | Congelar el fotograma de un clip en un tiempo dado |
| `auto_balance_audio` | Operación de mezcla automática (ya existe en store) |
| `auto_scene_markers` | Añadir marcadores en los cortes detectados (ya existe en store) |

**Archivos clave:**
- `src/features/editor/services/ai-operations.ts` — añadir variantes al discriminatedUnion
- `src/features/editor/services/ai-chat.ts` — actualizar instrucciones del sistema con los nuevos tipos

---

### Fase L — Bins y organización en biblioteca

**Objetivo:** organizar los assets en carpetas/bins con etiquetas y favoritos.

**Qué implementar:**
- Añadir `binId?: string` a `MediaItem` y `Bin` al modelo de proyecto.
- UI de árbol de bins en `MediaLibraryPanel.tsx` (drag de assets entre bins).
- Filtro por bin + búsqueda por metadatos.

**Archivos clave:**
- `src/features/editor/model.ts` — tipo `Bin`
- `src/features/editor/editor-store.ts` — acciones `addBin`, `moveToBin`
- `src/features/editor/components/MediaLibraryPanel.tsx` — árbol de bins

---

### Fase M — Reencuadre automático 9:16

**Objetivo:** detectar el sujeto en clips horizontales y reencuadrar automáticamente para formato vertical.

**Qué implementar:**
- Usar la `FaceDetector` Web API o un modelo ONNX ligero para detectar el sujeto frame a frame.
- Calcular keyframes de posición X/Y que mantengan al sujeto centrado en el encuadre 9:16.
- Acción en el Inspector: "Auto-reencuadre 9:16".

**Archivos clave:**
- Nuevo: `src/features/editor/services/auto-reframe.ts`
- `src/features/editor/components/InspectorPanel.tsx` — botón de reencuadre
- `src/features/editor/editor-store.ts` — generar keyframes de transform

---

### Fase N — Workspace presets

**Objetivo:** guardar y restaurar distribuciones de paneles (como "Color", "Audio", "Edición").

**Qué implementar:**
- Serializar el estado de `react-resizable-panels` en JSON.
- Guardar hasta 4-5 presets con nombre en `localStorage`.
- Botones de workspace en la barra superior.

**Archivos clave:**
- `src/features/editor/services/appearance-preferences.ts` — añadir workspace presets
- `src/App.tsx` — persistir y restaurar layout de paneles

---

## 7. Reglas para agentes que editen este proyecto

### Código
- **Lenguaje:** TypeScript estricto. No usar `any` salvo con justificación. Todos los contratos de servicios van con esquema Zod.
- **Estado:** toda mutación del proyecto pasa por el store Zustand (`editor-store.ts`). Nunca mutar el estado directamente desde componentes.
- **Inmutabilidad:** el store usa spread para copiar objetos anidados (`copyTracks`, `copySnapshot`). Seguir ese patrón.
- **Historial:** las acciones que cambian el proyecto deben llamar a `commit()` internamente. Agrupar operaciones de la misma interacción en un solo commit.
- **Servicios:** lógica de negocio en `services/`, no en componentes. Los componentes solo llaman al store o a servicios puros.
- **Nombres:** en inglés para tipos, funciones y variables. Strings de UI en español (ES) con fallback en inglés via `t()` de `locale.ts`.

### Tests
- Cada servicio nuevo debe tener su archivo `.test.ts` en la misma carpeta.
- Usar Vitest + `@testing-library/react` para tests de componentes.
- Ejecutar `npm test` antes de dar una tarea por terminada.

### Estilo visual
- Usar los tokens CSS de `styles/tokens.css` (superficies, texto, acento, estados).
- No introducir colores hexadecimales en JS; usar variables CSS o clases Tailwind.
- Seguir la escala tipográfica: 11, 12, 13, 15, 18 px.
- Respetar `prefers-reduced-motion` en animaciones nuevas.
- Todo control interactivo debe tener foco visible (`:focus-visible` con `--accent`).

### IA
- Las operaciones propuestas por IA deben ser validadas contra `aiOperationSchema` antes de aplicarse.
- Nunca aplicar operaciones sin confirmación explícita del usuario.
- El asistente no puede leer ni escribir fuera del contexto del proyecto activo.

### Tauri
- Los comandos Rust se invocan con `invoke()` de `@tauri-apps/api/core`.
- Siempre comprobar `isTauri()` antes de usar comandos nativos; proporcionar fallback web.
- Las API keys nunca van a `localStorage` en modo Tauri; usar el llavero del OS.

---

## 8. Comandos útiles

```bash
# Desarrollo web
npm run dev

# Desarrollo escritorio (requiere Rust toolchain)
npm run tauri:dev

# Tests unitarios
npm test

# Tests en modo watch
npm run test:watch

# Linter
npm run lint

# Build web producción
npm run build

# Build instalador Windows
npm run tauri:build

# Tests Rust
cargo test --lib
# (desde src-tauri/)
```

---

## 9. Archivos de referencia importantes

| Archivo | Por qué leerlo primero |
|---|---|
| `src/features/editor/model.ts` | Tipos de dominio: empieza aquí para entender el modelo |
| `src/features/editor/editor-store.ts` | Todo el estado y las acciones; >1000 líneas |
| `src/features/editor/services/export-engine.ts` | Motor de exportación real; referencia para el pipeline de render |
| `src/features/editor/services/subtitle-generator.ts` | Pipeline completo de IA para subtítulos |
| `src/features/editor/services/ai-operations.ts` | Contrato de operaciones de IA aplicables |
| `src/features/editor/effects/catalog.ts` | 40+ efectos y cómo registrar nuevos |
| `docs/INTERFAZ_Y_ARQUITECTURA.md` | Documento maestro histórico: inventario, arquitectura objetivo y seguimiento |
