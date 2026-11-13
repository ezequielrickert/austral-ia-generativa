# IA Generativa · Guía de estudio

Sitio estático para estudiar IA Generativa (Universidad Austral, 2º cuatrimestre 2026).
Cada clase muestra las diapositivas originales de la materia y, al lado, una nota breve por diapositiva:
qué se dice, palabras clave, diapositivas relacionadas de otras clases y, cuando corresponde,
un recordatorio de dónde se aplicó en los TPs.

Hecho con [Zola](https://www.getzola.org) (generador de sitios estáticos en Rust). No necesita Node ni dependencias.

## Correr localmente

```sh
brew install zola            # o: cargo install --locked zola
python3 scripts/build_data.py
zola serve                   # http://127.0.0.1:1111
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `sources/` | Datos de origen: contenido por clase (`clases/`), TPs (`tps/`), notas por diapositiva (`notes/`) y texto de cada diapositiva (`slides/`). Es lo único que se edita a mano. |
| `scripts/build_data.py` | Genera `data/` (lo que leen las plantillas), `content/` (una página por clase y por TP) y `static/data/` (búsqueda y práctica). |
| `scripts/process_decks.py` | Copia las presentaciones del repo de la materia comprimiendo imágenes y videos. Solo hace falta si cambian las diapositivas. |
| `static/decks/<slug>/` | Las presentaciones originales (reveal.js), una por carpeta. |
| `templates/` | Plantillas Tera: `index.html` (inicio), `clase.html` (visor), `tp.html`, `glosario.html`, `practica.html`. |
| `static/js/` | `viewer.js` (sincroniza la diapositiva con la nota), `practice.js` (opción múltiple, tarjetas, desarrollo), `site.js` (búsqueda, tema, progreso). |

## Editar una nota

Las notas están en `sources/notes/<slug>.notes.json`, una entrada por diapositiva (`i` = índice, 0 = portada):

```json
{ "i": 5, "resumen": "…", "claves": ["rag"], "tp": [{ "tp": 4, "texto": "…" }],
  "ver": [{ "ref": "como-se-entrena-un-llm#52", "por": "…" }], "clave_examen": true }
```

Después: `python3 scripts/build_data.py` y recargar.

## Publicar en GitHub Pages

1. Crear un repositorio y subir esta carpeta a la rama `main`.
2. En *Settings → Pages*, elegir **GitHub Actions** como fuente.
3. El workflow `.github/workflows/deploy.yml` construye y publica en cada push.

El progreso (diapositivas vistas, marcadas, respuestas) se guarda en el navegador (`localStorage`).
