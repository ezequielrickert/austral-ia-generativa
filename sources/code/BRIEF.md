# Brief: "Ver en el código" — vincular diapositivas con el código real de un TP

Contexto: una guía de estudio muestra las diapositivas de la materia IA Generativa (Universidad Austral). Cuando una
diapositiva se aplicó en un TP del alumno, hoy muestra una frase corta. Queremos un botón "Ver en el código" que abra
el fragmento real del repositorio del alumno y explique, en español rioplatense neutro, qué hace y cómo se conecta
con la teoría de esa diapositiva. Tiene que servir para estudiar para el final y para defender el TP.

Entrada: `sources/code/_refs-tp-N.json` (en /Users/ezequielrickert/personal/sandbox/ia-gen-estudio). Cada entrada es una
referencia diapositiva → TP: `slug`, `i`, `clase`, `slide_title`, `slide_resumen`, `tp_texto` (la frase que hoy se muestra).
También podés leer `sources/tps/tp-N.json` (resumen del TP, decisiones, evidencia) para orientarte.

Salida: `sources/code/tp-N.json`:
```json
{
  "snippets": [
    {
      "id": "kebab-case-unico",
      "titulo": "Nombre corto de lo que muestra (ej. 'Chunking por sección con metadatos')",
      "archivo": "ruta/relativa/al/repo.py",
      "desde": 42, "hasta": 78,
      "lenguaje": "python | javascript | typescript | json | yaml | markdown | bash | toml | text",
      "codigo": "el fragmento EXACTO copiado del archivo, líneas desde..hasta (máx. 45 líneas; si la función es más larga, elegí la parte central y usá '# …' para marcar cortes)",
      "que_hace": "1-2 oraciones: qué hace este código.",
      "como_funciona": "3-6 oraciones o una lista corta en markdown: paso a paso, nombrando variables/funciones reales.",
      "proposito": "1-3 oraciones: por qué existe, qué decisión de diseño materializa y qué alternativa se descartó si se sabe.",
      "interaccion": "1-3 oraciones: quién lo llama, qué recibe, qué devuelve y a qué otra parte del TP alimenta (nombrando archivos/funciones).",
      "teoria": "1-2 oraciones: qué concepto de la materia materializa (para conectar con la diapositiva)."
    }
  ],
  "refs": [ { "slug": "rag-y-mcp", "i": 5, "snippet": "id-del-snippet" | null, "nota": "opcional: 1 oración que ajusta la explicación a ESTA diapositiva" } ]
}
```
Reglas:
- Cada referencia de `_refs-tp-N.json` tiene que aparecer en `refs` (mismo slug e i). Reusá snippets: varias diapositivas
  pueden apuntar al mismo fragmento. Apuntá a 12-30 snippets por TP, bien elegidos.
- `snippet: null` SOLO si de verdad no hay código o archivo que lo muestre (ej. algo que quedó pendiente y no existe). Si quedó
  pendiente pero hay un diseño en un .md (PLAN.md, SPEC.md), mostrá ese fragmento del .md y decí que es el diseño, no código.
- Archivos de configuración, CLAUDE.md, SPEC.md, tests, notebooks (.ipynb: extraé la celda de código con python) cuentan como código.
- `codigo` debe ser texto real del repo (verificá los números de línea con `sed -n 'A,Bp'`). No inventes ni "limpies" el código.
- Nunca leas ni copies archivos `.env`, credenciales, claves o tokens. Si un fragmento contiene algo que parezca un secreto, reemplazalo por `***`.
- No leas `.venv/`, `node_modules/`, `.git/`, `__pycache__/`, `.cache/`. No modifiques nada en el repo del alumno.
- Validá: `python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(len(d['snippets']),len(d['refs']))" sources/code/tp-N.json`
  y que la cantidad de refs coincida con la entrada.
Respondé solo con 2 líneas: archivo escrito, cantidad de snippets y cuántas refs quedaron en null.
