# Sparta Video — especificación de producto y evolución de la interfaz

**Versión:** 0.4 · **Fecha:** 23 de octubre de 2026  
**Estado actual:** demostración local de edición estructural. La decodificación de medios, la reproducción audiovisual real, la composición final, el renderizado y la conexión con un proveedor de IA siguen pendientes.

Este documento separa el comportamiento que existe hoy de los requisitos futuros. Las imágenes y los documentos compartidos por el usuario sirven como referencias de producto; sus textos no se interpretan como autorización para ejecutar acciones externas. Para el comportamiento comprobado de cada control, consulta la [guía funcional](../GUIA_UI.md) y el [inventario de la interfaz](INVENTARIO_UI.md).

## 1. Visión del producto

Sparta Video aspira a ser un editor de escritorio para Windows que combine edición multipista con asistencia de IA revisable. El proyecto debe ser una estructura clara y recuperable. Una propuesta de IA debe mostrar sus cambios, permitir revisarlos y exigir una acción explícita antes de modificar el proyecto.

### Principios de diseño

1. **Estado compartido:** biblioteca, secuencia, monitor, inspector, línea de tiempo y asistente deben consultar el mismo proyecto.
2. **Reglas fuera de la presentación:** los componentes muestran el estado y solicitan acciones; el modelo central valida y aplica los cambios.
3. **Edición reversible:** los cambios de contenido deben poder deshacerse y rehacerse, con agrupación razonable de gestos continuos.
4. **Privacidad visible:** informar qué datos permanecen en el equipo y cuándo un proveedor remoto recibe medios o contexto.
5. **Interfaz receptiva:** decodificación, análisis, generación de miniaturas y renderizado deben trabajar en segundo plano, mostrar progreso y poder cancelarse.
6. **Estados sinceros:** diferenciar con claridad las funciones reales, las demostraciones, las tareas en curso, los errores y las acciones todavía no disponibles.
7. **Accesibilidad:** ofrecer nombres accesibles, foco visible, navegación por teclado, límites claros y alternativas a los gestos exclusivos de ratón.
8. **Dependencias justificadas:** cada biblioteca debe responder a una necesidad concreta y no duplicar un sistema ya adoptado.

## 2. Mapa de la interfaz

| Área | Propósito | Funciones previstas |
| --- | --- | --- |
| Barra superior | Identidad del proyecto y acciones generales | Cambiar nombre, ajustar secuencia, deshacer/rehacer, preferencias y exportación |
| Biblioteca de medios | Encontrar y organizar los elementos del proyecto | Buscar, filtrar, ordenar, importar, seleccionar e insertar medios |
| Monitor | Mostrar el resultado en el tiempo actual | Reproducir, pausar, buscar, avanzar cuadros, mostrar guías y ampliar |
| Inspector | Editar el elemento seleccionado | Propiedades de clip, audio, movimiento y fotogramas clave |
| Línea de tiempo | Organizar clips y pistas | Seleccionar, mover, recortar, dividir, marcar, ajustar a cuadros y cambiar zoom |
| Asistente | Ayudar a analizar y proponer cambios | Contexto del proyecto, adjuntos, propuestas revisables y aplicación explícita |
| Preferencias | Configurar el espacio de trabajo | Apariencia, animaciones, ajuste a cuadros, atajos y distribución de paneles |
| Exportación | Preparar y crear el archivo final | Formato, tamaño, frecuencia de cuadros, destino, progreso, cancelación y resultado |

## 3. Estado real: conectado, simulado y pendiente

### Funciona en la demostración

- La pantalla de edición organiza biblioteca, monitor, inspector, asistente y línea de tiempo; los paneles se pueden redimensionar y el asistente se pliega en ventanas compactas.
- La biblioteca busca, filtra vídeo/audio/imagen, ordena, selecciona e importa fichas básicas de catálogo. También permite insertar medios de muestra mediante doble clic o arrastrar y soltar.
- El modelo compartido mantiene nombre, secuencia, pistas, clips, catálogo, marcadores, ajuste a cuadros y estados de silencio/bloqueo. Una parte se guarda en el almacenamiento local del navegador.
- Se puede cambiar resolución y frecuencia de cuadros de la secuencia de muestra. La frecuencia elegida gobierna el código de tiempo y la alineación de las operaciones a cuadros.
- La línea de tiempo permite mover y recortar clips, dividirlos con Razor, crear pistas y marcadores, cambiar zoom, encuadrar el contenido y expandir el área de pistas.
- Deshacer/rehacer cubre las operaciones de edición integradas. El historial restaura la selección y agrupa ciertos cambios consecutivos de una misma propiedad.
- La regla mueve el cabezal con clic o arrastre. El cálculo considera el desplazamiento horizontal; el desplazamiento vertical mantiene sincronizados los nombres de pistas y sus clips.
- El inspector modifica posición, escala, rotación, opacidad, modo de mezcla y valores de audio del modelo. La escena ilustrativa refleja algunas propiedades visuales.
- Preferencias conecta ajuste a cuadros, animaciones de interfaz y distribución de paneles. El estado de guardado indica escritura local correcta, pendiente o fallida y permite reintentar cuando corresponde.
- Los contratos de medios, exportación y propuestas de IA tienen validación de datos. Los controles principales tienen nombres accesibles y las pestañas admiten navegación por teclado.

### Simulado o limitado

- La biblioteca de medios es un catálogo. La importación no conserva el archivo binario ni una ruta recuperable y no crea miniaturas desde el contenido.
- El monitor muestra una ilustración de costa. No decodifica el medio, no refleja la composición real de la línea de tiempo ni garantiza que el fotograma corresponda al cabezal.
- El transporte avanza un reloj de demostración. No reproduce vídeo ni audio sincronizados.
- Las propiedades de audio, los modos de mezcla y los fotogramas clave se guardan como datos, pero no se aplican a un motor audiovisual. Los fotogramas clave todavía no se interpolan.
- Las formas de onda son decorativas. El control de calidad de vista previa cambia su etiqueta, no la resolución de una decodificación.
- El asistente usa una respuesta simulada y no modifica el proyecto. No hay proveedor conectado ni adjuntos activos.
- La exportación valida opciones y muestra progreso cancelable, pero no produce un archivo.
- El almacenamiento local del navegador no equivale a un archivo de proyecto portable, una copia de seguridad ni una sincronización entre equipos.

### Aún no implementado

- Crear, abrir, guardar como, migrar y relocalizar proyectos en un formato portable.
- Mantener referencias válidas a medios importados, comprobar si están disponibles y permitir volver a enlazarlos.
- Decodificar vídeo e imágenes, reproducir audio sincronizado y mostrar el fotograma real en el monitor.
- Componer capas, aplicar transformaciones, mezcla, volumen, fundidos y fotogramas clave interpolados.
- Renderizar y exportar un archivo audiovisual reproducible.
- Conectar un proveedor de IA con privacidad configurable, propuestas estructuradas, vista previa de cambios, aprobación y deshacer.
- Guardado automático configurable, escala de interfaz y gestión completa de varios proyectos.

## 4. Contratos de interacción

### Controles

- Todo control visible debe ejecutar una acción comprobable o indicar claramente que está deshabilitado y por qué.
- Los controles de solo icono deben tener nombre accesible y una descripción emergente útil.
- Los conmutadores deben anunciar su estado; las pestañas deben exponer selección y admitir teclado.
- Los valores numéricos deben mostrar unidades, respetar límites y actualizar una sola propiedad del modelo.
- Los indicadores de guardado deben referirse al almacenamiento real que se completó; importar una ficha o iniciar una simulación no debe anunciar que se guardó el archivo de origen ni que se produjo un vídeo.

### Menús y diálogos

| Flujo | Apertura | Confirmación y cierre | Resultado esperado |
| --- | --- | --- | --- |
| Cambiar nombre | Menú del proyecto | Guardar un nombre válido; cancelar o Escape descarta el borrador | El título y las vistas relacionadas usan el nombre actualizado |
| Ajustes de secuencia | Menú de secuencia | Elegir resolución y frecuencia | Las etiquetas, el código de tiempo y el ajuste a cuadros usan esos valores |
| Preferencias | Botón superior o menú del proyecto | Cerrar; solo guardar ajustes conectados | Los cambios persisten según el estado indicado |
| Importar medios | Biblioteca | Elegir archivos o cancelar | Informar qué fichas se añadieron y cuáles se omitieron |
| Exportar | Botón «Export» | Iniciar o cancelar la tarea | Mostrar opciones, progreso y resultado real; el prototipo actual solo simula el progreso |
| Propuesta de IA futura | Conversación | Revisar, aplicar o rechazar | Mostrar las operaciones exactas; aplicar como un grupo reversible |

Los menús deben poder abrirse desde un control identificable, cerrarse con Escape y responder al teclado. Una acción pendiente no debe aparentar éxito. Los diálogos deben mantener el foco dentro mientras están abiertos y devolverlo al control que los abrió al cerrarse.

### Gestos de edición

- Arrastrar un medio de la biblioteca a una pista inserta una ficha del catálogo. En la implementación actual esto no conserva el archivo fuente.
- Arrastrar el cuerpo de un clip lo mueve; arrastrar un extremo del clip seleccionado cambia su duración, respetando un mínimo de un cuadro.
- Razor divide en el punto donde se hace clic sobre el clip, no en la posición anterior del cabezal. El corte se alinea a un cuadro y debe dejar claro cuál de los segmentos quedó seleccionado.
- La regla mueve el cabezal con clic o arrastre. Los marcadores deben poder crearse, enfocarse, moverse y eliminarse también sin depender exclusivamente del clic derecho.
- Bloquear una pista debe impedir insertar, mover, recortar, dividir o eliminar sus clips. Silenciar debe afectar el audio cuando exista reproducción real; hoy solo cambia el dato visual/modelado.
- El desplazamiento de la línea de tiempo debe permanecer dentro de su panel. Los nombres de pistas y el contenido deben desplazarse juntos, mientras la regla sigue visible.

## 5. Modelo de datos y límites de responsabilidad

- **Proyecto:** identificador, nombre, versión del esquema, secuencia, referencias de medios, pistas, marcadores y ajustes.
- **Medio:** identificador, tipo, metadatos, referencia durable al archivo, disponibilidad, miniatura y errores. La referencia durable todavía no existe en el prototipo.
- **Secuencia:** ancho, alto, frecuencia/base temporal, duración derivada y ajustes de audio.
- **Pista:** orden, tipo, nombre, estado de silencio/bloqueo y clips.
- **Clip:** referencia al medio, rango en la secuencia, rango de origen, transformación, opacidad, modo de mezcla, volumen, fundidos y fotogramas clave.
- **Historial:** operaciones reversibles, con límites de memoria y agrupación de gestos continuos.
- **Servicios:** importación, análisis, miniaturas, decodificación, audio, IA y renderizado. Cada contrato debe definir entrada, salida, progreso, cancelación y errores.

La interfaz presenta información y solicita acciones. El modelo central valida las reglas de edición. Los servicios realizan tareas externas al modelo. Las implementaciones de demostración deben identificarse como tales y poder sustituirse sin reescribir los componentes.

La persistencia futura debe usar un archivo versionado con migraciones y rutas relocalizables. No se deben almacenar archivos de vídeo grandes dentro del almacenamiento del navegador. El guardado deberá ser atómico, recuperable y comunicar con precisión si quedan cambios sin guardar.

## 6. Fases de evolución y criterios de salida

### Fase 0 — Integridad de la interfaz y del modelo

Consolidar las acciones que ya existen, sus estados vacíos y de error, el historial reversible y la persistencia local. Cada vista debe reflejar una misma edición; después de recargar debe recuperarse el subconjunto anunciado como guardado. La interfaz debe funcionar sin desbordamiento de página en los tamaños objetivo.

### Fase 1 — Proyectos y medios confiables

Crear el formato de proyecto versionado, crear/abrir/guardar/guardar como, conservar referencias a medios, comprobar rutas, relocalizar archivos y generar metadatos y miniaturas reales. Criterio de salida: al reabrir el proyecto se recuperan secuencia, clips y medios; las referencias rotas se explican y pueden corregirse.

### Fase 2 — Vista previa y edición audiovisual

Elegir formatos compatibles, decodificar vídeo e imágenes, reproducir audio sincronizado, definir rangos de origen y componer las capas. Aplicar transformaciones, mezcla, volumen, fundidos y fotogramas clave interpolados. Criterio de salida: el monitor coincide con el cabezal cuadro a cuadro y el audio corresponde a las pistas y propiedades visibles.

### Fase 3 — Renderizado y exportación

Seleccionar el motor y los formatos, implementar presets, destino, progreso, cancelación y recuperación de errores. Criterio de salida: la exportación crea un archivo reproducible con dimensiones, frecuencia de cuadros y audio correctos, sin bloquear la interfaz.

### Fase 4 — Asistencia de IA revisable

Definir proveedores y política de privacidad, contexto y adjuntos, propuestas estructuradas, comparación de cambios, aprobación/rechazo y deshacer agrupado. Criterio de salida: ninguna propuesta modifica el proyecto sin aprobación; cada cambio se valida y puede revertirse por completo.

Accesibilidad, rendimiento, observabilidad, validación y documentación son requisitos de todas las fases.

## 7. Validación necesaria

- Comprobar reglas del modelo: límites de recorte, cortes, ajuste a cuadros, identificadores, cambios de frecuencia, marcadores y deshacer/rehacer.
- Comprobar flujos de interfaz: diálogos, acciones, selección vacía, controles deshabilitados, errores de importación y sincronía entre línea de tiempo e inspector.
- Revisar con teclado y lector de pantalla, además de ratón, en resoluciones de escritorio y ventanas compactas.
- Revisar desplazamiento, foco, persistencia y acciones repetidas para evitar estados visuales que no coincidan con el modelo.
- Cuando se conecten importación, reproducción o exportación reales, validar también cancelación, errores, rendimiento y archivos de salida.

## 8. Decisiones pendientes

Antes de comprometer compatibilidad hay que elegir el motor de decodificación/renderizado, los formatos soportados, el empaquetado de Windows, el formato de proyecto, la política de caché y los proveedores de IA. Las decisiones deben evaluarse con prototipos que midan compatibilidad, rendimiento, tamaño de instalación, mantenimiento y privacidad.
