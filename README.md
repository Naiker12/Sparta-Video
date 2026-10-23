# Sparta Video

Prototipo local de un editor de vídeo de escritorio para Windows, construido con React, TypeScript y Vite. Permite modificar una secuencia estructurada de demostración, sincroniza el monitor ilustrativo, el inspector y la línea de tiempo, mantiene deshacer/rehacer de las operaciones integradas y guarda parte del modelo en el navegador.

**Todavía no** decodifica medios importados, reproduce vídeo/audio real, compone la secuencia, genera un archivo final ni conecta un proveedor de IA. La importación actual cataloga metadatos y no conserva el archivo fuente. El inventario completo, las interacciones, la arquitectura y el plan de evolución de la interfaz están consolidados en [docs/INTERFAZ_Y_ARQUITECTURA.md](docs/INTERFAZ_Y_ARQUITECTURA.md).

La paleta base se define con variables de diseño semánticas. El estado de guardado refleja el resultado real del almacenamiento local; si el navegador no permite guardar la distribución de paneles, esta se conserva solo durante la sesión actual.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run build
npm run lint
npm test
```

## Probar la demostración

- Renombra el proyecto desde el menú de nombre; la secuencia se conserva al recargar en el mismo navegador.
- Arrastra un medio de muestra a la línea de tiempo o haz doble clic para añadirlo.
- Prueba mover, recortar, cortar con Razor (`C`), insertar marcador (`M`) y deshacer/rehacer.
- Selecciona un clip y cambia posición, escala, rotación, opacidad o valores de audio en el inspector. El monitor muestra una composición ilustrativa con parte de las propiedades visuales.
- Cambia la frecuencia de cuadros o la resolución en el menú de secuencia; el código de tiempo y el avance cuadro a cuadro usan la frecuencia elegida.
- Usa `Space`, flechas, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` y `Ctrl/Cmd+K`.
- «Import media» cataloga metadatos; los archivos no se conservan ni reproducen en esta fase.
- Exportación y Sparta AI indican sus límites de demostración; no producen un vídeo ni editan el proyecto.
- Los proveedores simulados validan contratos de medios, exportación e IA; la vista previa de exportación informa progreso y puede cancelarse, sin escribir un archivo.

## Arquitectura del prototipo

- `src/App.tsx`: estructura principal, atajos, importación, preferencias y diálogo de exportación.
- `src/features/editor/editor-store.ts`: modelo compartido, persistencia del navegador e historial reversible.
- `src/features/editor/model.ts`: tipos de secuencia, clip, pista, medio y marcador, además de los datos iniciales de demostración.
- `src/features/editor/timecode.ts`: conversión y presentación temporal según la frecuencia de cuadros.
- `src/features/editor/services/`: contratos validados y proveedores simulados sustituibles.
- `src/features/editor/components/`: biblioteca, monitor, inspector, línea de tiempo, asistente, diálogos y controles.
- `docs/INTERFAZ_Y_ARQUITECTURA.md`: documento maestro único de interfaz, estado funcional, estructura, librerías, requisitos del editor de vídeo con IA, arquitectura objetivo, referencias y fases.
