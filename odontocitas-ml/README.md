# Odontocitas ML — Predicción de pacientes

Script de predicción de demanda (citas completadas) por mes usando
[Prophet](https://facebook.github.io/prophet/).

## Requisitos

- Python 3.9+
- PostgreSQL de Odontocitas en ejecución (Docker o local)

## Instalación

```bash
cd odontocitas-ml
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Uso

```bash
python prediccion_pacientes.py            # predice 3 meses
python prediccion_pacientes.py --meses 6  # predice 6 meses
```

Salida esperada (ejemplo):

```
Predicción de pacientes (citas completadas):

Julio 2026: 185 pacientes
Agosto 2026: 192 pacientes
Septiembre 2026: 201 pacientes
```

## Configuración de base de datos

Toma las credenciales desde variables de entorno (o desde
`../odontocitas-api/.env` si existe). Valores por defecto:

| Variable | Default |
|----------|---------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `odontocitas` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `postgres` |

## Notas

- El modelo necesita al menos 2 meses con datos para entrenar.
- Cuantos más meses históricos de citas completadas existan, mejor será la
  predicción (Prophet capta estacionalidad anual).
