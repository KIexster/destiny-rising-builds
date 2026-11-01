# Destiny Rising Builds (prototipo)

Herramientas web de fans hechas con los datos del propio juego. Es un sitio estático, sin servidor ni base de datos, que se puede publicar gratis en GitHub Pages.

## Contenido

- `docs/index.html`: portada.
- `docs/emanare.html`, `emanare.js` y `style.css`: **calculadora de Emanare**. Tablero de las temporadas 4, 5 y 6, en español e inglés.
- `docs/data/emanare.json`: datos generados; no se editan a mano.
- `tools/build_emanare.py`: genera ese JSON a partir de las tablas del cliente.
- `docs/builds.html` y `builds.js`: **builds de personajes**. Usan `docs/data/builds.json` y las imágenes de `docs/img/`, que genera `tools/build_builds.py`.

## Builds de personajes

Es el equipamiento que recomienda el propio juego (`Builds_Recomendadas_20261101/LEEME.md`) para 22 personajes:
- **Builds:** 3 por personaje, con nombre, descripción y valoración de Ataque, Supervivencia y Control (los nombres de la pantalla de conjuntos del juego).
- **Piezas:** la de cada ranura, con su efecto. Los `{valores}` se rellenan con `SkillLiteParamData`, como rango PvE de base a máximo.
- **Atributos:** los que conviene buscar.
- **Armas:** por ranura y rareza.
- **Compañeros:** los de afinidad 2–3. Cassian, Efrideet, Siorra y Tariq aún no tienen datos de afinidad en el juego.

El enlace `builds.html#h109/2` abre directamente un personaje y su build. No incluye estadísticas de uso de los jugadores: el cliente no las tiene.

Para regenerarla tras un parche:
1. Extraer las tablas con `python Herramientas/inspect_tables.py Builds_Recomendadas_<fecha> Client/Data/ArtifactRecommendSuitLaunchData …`; la lista completa está en el LEEME de esa carpeta.
2. Ejecutar `python tools/build_builds.py`, que avisa si falta algún nombre o imagen.

## Calculadora de Emanare

- **Reglas:** las mismas que en el juego.
  - Un nodo se desbloquea si su nodo anterior está desbloqueado y el Nodo de núcleo tiene el nivel necesario.
  - Los nodos de atributo suben de nivel uno a uno: hasta 3 niveles en los anillos 1–7 y hasta 10 en el anillo 8. Cada mejora tiene su coste y su requisito de núcleo.
  - Al bajar el núcleo o quitar un nodo, se quita lo que deja de ser válido, incluida la rama que dependía de él.
- **Totales:** atributos, Poder del personaje, nodos activos y al máximo, y coste total en Lumen y materiales, con los nombres oficiales en cada idioma.
- **Objetivo por fase:**
  - lo que falta para dejar al máximo una fase de la temporada (por defecto, la siguiente al núcleo del tablero), desde el tablero o desde la fase anterior al máximo;
  - con la columna «Tengo» calcula lo que falta, y esas cantidades se guardan solo en el navegador (`localStorage`);
  - Apollo Companion le pasa tus materiales con `&h=id.cantidad-…`, que no se vuelve a escribir en el enlace;
  - lo pidieron jugadores en una encuesta: unos 40 de 70 querían saber «qué me falta para la próxima fase».
- **Datos de una temporada:** `python tools/export_emanare_season.py 6` exporta la temporada a JSON y CSV (nodos, niveles, núcleo y coste de cada fase) en `../Emanare_S6_Export`.
- **Compartir:** el estado se guarda en la URL (`#s=6&c=7&n=418.3-104.1…`), así que un enlace reproduce una build.
- **Comprobación:** con el núcleo a nivel 10 y todo desbloqueado, los totales de la página coinciden exactamente con un cálculo independiente hecho sobre las tablas en bruto (117 nodos, 65.775 de poder, 26 materiales y 10 atributos).
- **No incluye:** el aura de los nodos de personaje (depende del poder de tus personajes) ni los atributos aleatorios de las gemas. La página lo indica.

## Regenerar los datos tras un parche

1. Extraer las tablas: `python Herramientas/inspect_emanare_tables.py Client/Data/CostData Client/Data/AttributeData`. Necesita MuMu con el juego y `adb connect 127.0.0.1:16384`.
2. Si cambian los textos, apuntar `LANGS` de `tools/build_emanare.py` a los archivos de idioma nuevos.
3. Ejecutar `python tools/build_emanare.py`, que avisa si queda algún nombre sin resolver.

Los textos de las tablas son hashes MurmurHash3 de 32 bits de su clave TID; está explicado en `Emanare_Tablas_20261030/LEEME.md`.

## Ver la web en local

`python -m http.server 8731 --directory docs` y abrir http://localhost:8731. Abrir el HTML directamente desde el disco no sirve, porque el navegador bloquea la carga del JSON.

## Publicar en GitHub Pages (gratis)

1. Crear un repositorio, por ejemplo `destiny-rising-builds`, y subir esta carpeta.
2. En Settings → Pages, elegir la rama `main` y la carpeta `/docs`.
3. La web queda en `https://<usuario>.github.io/destiny-rising-builds/`.

Proyecto de fans sin ánimo de lucro: sin anuncios ni pagos, y avisando de que no está afiliado a NetEase ni a Bungie. No publicar contenido del juego que aún no haya salido.
