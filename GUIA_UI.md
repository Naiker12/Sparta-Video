# Sparta Video — guía funcional de la interfaz

Esta guía describe la demostración local actual. La aplicación permite modificar los datos de una secuencia de muestra y conservar parte del modelo en el almacenamiento del navegador. **Todavía no** decodifica archivos importados, reproduce vídeo o audio, compone las capas ni crea una exportación final. El inventario detallado está en [docs/INVENTARIO_UI.md](docs/INVENTARIO_UI.md) y el plan por fases en [docs/PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md).

Las etiquetas de controles se escriben entre comillas tal como aparecen actualmente en la aplicación, que conserva varios rótulos en inglés. Las instrucciones y explicaciones de este documento están en español.

## Resumen por área

| Área | Qué se puede hacer | Qué significa hoy |
| --- | --- | --- |
| Proyecto | Renombrar, cambiar secuencia, deshacer/rehacer, abrir preferencias | Modifica el modelo guardado en navegador; no genera un archivo portátil. |
| Biblioteca | Buscar, filtrar vídeo/audio/imagen, ordenar, importar y añadir medios | Importar crea una ficha de catálogo; no conserva el archivo fuente. |
| Monitor | Mover el tiempo, reproducir/pausar, avanzar cuadros y activar guías | Muestra una ilustración de costa, no el fotograma de la secuencia. |
| Inspector | Cambiar transformación, opacidad, mezcla, propiedades de audio y fotogramas clave | Guarda datos; no los procesa en un motor audiovisual. |
| Línea de tiempo | Mover/recortar/dividir clips, pistas, marcadores, zoom, ajuste y desplazamiento | Edita el modelo estructural; no reproduce ni compone clips reales. |
| Asistente | Escribir, sugerir y enviar una petición | Respuesta de demostración, sin proveedor de IA ni cambios aplicados. |
| Exportar | Ver los ajustes de muestra e iniciar/cancelar progreso | Simulación cancelable; no se genera un vídeo. |

## Proyecto y barra superior

- Haz clic en el nombre del proyecto para abrir el menú. «Rename project» permite guardar un nombre no vacío. Cancelar, Escape o cerrar descartan el borrador.
- «Duplicate project» solo muestra un aviso: la duplicación todavía no está implementada. El avatar «JD» es decorativo.
- «Sequence settings» permite cambiar resolución (1920×1080, 1280×720 o 1080×1920) y frecuencia (24, 30 o 60 fps). Esto cambia el modelo, los rótulos, el timecode y la alineación a cuadros; no gobierna un render.
- «Undo» y «Redo» recorren el historial de operaciones compatibles. No incluyen el cabezal, reproducción, zoom, herramienta o distribución de paneles.
- El estado superior y el estado inferior de la línea de tiempo reflejan el guardado: «Demo · not saved», «Saved in this browser», «Saving…» o «Save failed». Si falla, «Retry» vuelve a intentar guardar el modelo actual.
- El guardado local no es un archivo `.sparta` ni una copia de seguridad. El modelo persistido incluye nombre, secuencia, pistas y clips, catálogo de medios, marcadores, ajuste a cuadros, silencio y bloqueo. No guarda el archivo fuente, el historial ni el estado de vista.

## Biblioteca e importación

- «Search media» busca por nombre. El botón × limpia la consulta; `Ctrl/Cmd+K` lleva el foco al campo.
- «Filter media» permite mostrar todo, solo vídeo, solo audio o solo imágenes. «Library options» permite ordenar por nombre y elegir el tipo.
- Un clic selecciona una tarjeta. Doble clic añade un clip a la primera pista compatible desbloqueada. También se puede arrastrar un medio a una pista.
- «Import media» abre el selector del sistema. Se validan nombre y tipo MIME para vídeo, audio e imagen; si algunos archivos no son compatibles, la interfaz informa cuántos se omitieron.
- La importación solo añade metadatos de catálogo. No copia ni retiene el objeto `File`, no guarda una ruta recuperable y no crea una miniatura real. Tras cerrar o recargar, no se garantiza acceso al archivo.
- Las imágenes tienen filtro e icono propios. Su inserción se representa como un clip de vídeo de duración de muestra, sin mostrar los píxeles originales.
- La tarjeta del proyecto abre Preferencias; no abre una lista de proyectos.

## Monitor e inspector

- «Play/Pause» avanza o pausa un reloj de muestra según los fps de la secuencia. Los botones de cuadro anterior/siguiente avanzan un cuadro.
- «Safe margins» y «Title overlay» activan guías gráficas. «Preview quality» cambia la etiqueta Full/Half/Quarter, no la calidad de una decodificación.
- La escena de costa del monitor es una ilustración. Refleja algunas propiedades visuales del clip seleccionado, como posición, escala, rotación y opacidad, pero no contiene el medio importado.
- En «Clip» se editan posición, escala, rotación, escala uniforme, opacidad y modo de mezcla. El menú del inspector permite restablecer valores o copiar el nombre; copiar informa éxito o error.
- En «Audio» se guardan volumen y fundidos de entrada/salida, sin procesar sonido.
- En «Motion» se agregan o quitan fotogramas clave de posición y escala en el tiempo actual. Aún no hay interpolación ni curvas.
- Los clips en una pista bloqueada son de solo lectura. Si está seleccionado un medio sin clip, «Add to timeline» intenta añadirlo en el cabezal actual.

## Línea de tiempo — zona inferior

- Haz clic o arrastra sobre la regla para mover el cabezal. Con «Snap» activado, se alinea a un cuadro. El cálculo incluye el desplazamiento horizontal de la línea de tiempo.
- Arrastrar el cuerpo del clip lo mueve; arrastrar un borde del clip seleccionado lo recorta. Con «Snap» activo, inicio y recortes se ajustan a cuadros. La duración mínima es un cuadro.
- «Razor (C)» corta en el punto donde se hace clic sobre un clip y ajusta el corte a un cuadro. Si el punto queda demasiado cerca del borde, no se crean dos partes.
- «Select (V)» activa selección. `C` activa Razor, `V` selección y `M` agrega un marcador en el cabezal.
- «Add marker at playhead» añade un marcador. Clic en el marcador mueve el cabezal; clic derecho lo elimina. Todavía falta una acción visible para eliminar marcadores con teclado o pantalla táctil.
- «Add track» crea una pista de vídeo o audio. Los botones de mute y bloqueo guardan estado. El bloqueo impide mover, recortar, dividir, borrar, editar o insertar clips en esa pista; mute aún no silencia sonido real.
- Si los clips de una pista se solapan, se distribuyen en subfilas para mantener sus etiquetas legibles.
- Cuando hay más pistas que espacio, el desplazamiento vertical de los nombres y los clips queda sincronizado. La regla de tiempo permanece fija arriba.
- «Show clip names» y «Show audio waveforms» cambian la representación visual. Las formas de onda son decorativas, no se calculan desde el audio.
- «Fit sequence» encuadra la duración del contenido. Los botones y el deslizador ajustan el zoom entre 25% y 240%. «Expand timeline» reserva temporalmente más alto a las pistas y oculta la zona superior.
- Al soltar un medio sobre una pista, se intenta insertar en esa pista compatible y desbloqueada. Al soltar en el espacio general se usa la primera pista compatible disponible.
- Deshacer/rehacer incluye cambios compatibles de clips, cortes, marcadores, pistas, nombre, secuencia, catálogo, snapping y mute/bloqueo. Los cambios rápidos de una misma propiedad del inspector pueden agruparse en un paso.

## Preferencias

- «General» muestra el estado de guardado, cambia snapping y permite restaurar el layout.
- «Appearance» permite activar/desactivar «Interface animations»; la preferencia se guarda en este navegador. «Sparta dark» es el único tema disponible. «UI scale» está deshabilitado con una explicación.
- «Shortcuts» muestra atajos. Las categorías son navegables con flechas, Inicio y Fin.
- Los divisores de panel se arrastran o se ajustan con teclado. Si el almacenamiento del layout no funciona, sus proporciones se conservan solo hasta cerrar la sesión.

## Asistente y exportación

- Las sugerencias del asistente rellenan el borrador. `Enter` envía y `Shift+Enter` crea una línea. El proveedor de demostración devuelve una propuesta estructurada con cero cambios aplicables; no modifica la secuencia. Proveedor y adjuntos están deshabilitados.
- El diálogo «Export video» muestra nombre, MP4/H.264, resolución, frecuencia de cuadros y duración de la secuencia. «Export preview» inicia una simulación de progreso cancelable; no escribe un archivo. Cancelar, Escape, cerrar o hacer clic fuera detiene la simulación.

## Atajos y gestos

| Acción | Entrada |
| --- | --- |
| Reproducir o pausar | `Space` |
| Avanzar o retroceder un cuadro | `←` / `→` |
| Deshacer / rehacer | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` |
| Enfocar la búsqueda | `Ctrl/Cmd+K` |
| Selección / Razor | `V` / `C` |
| Agregar marcador | `M` |
| Borrar el clip seleccionado | `Delete` / `Backspace` |
| Añadir medio | Doble clic o arrastrar desde biblioteca |
| Mover/recortar clip | Arrastrar el cuerpo o un extremo |
| Dividir clip | Activar Razor y hacer clic en el punto de corte |
| Buscar tiempo | Clic o arrastre en la regla |
| Redimensionar panel | Arrastrar el divisor; flechas con el divisor enfocado |

Los atajos globales no se ejecutan mientras se escribe, se activa un botón o se navega por pestañas/diálogos. Backspace evita la navegación atrás del navegador cuando elimina un clip seleccionado.

## Desbordamiento y presentación

La aplicación mantiene el editor dentro de la ventana de escritorio. La regla y las pistas se desplazan dentro de la zona de la línea de tiempo; la biblioteca, el asistente y las preferencias desplazan su contenido en sus propios paneles. La barra vertical de la página no debería usarse para recorrer pistas.


