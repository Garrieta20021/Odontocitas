"""
Predicción de pacientes (citas completadas) por mes usando Prophet.

Lee las citas en estado 'completada' desde PostgreSQL, las agrupa por mes y
proyecta los próximos meses (por defecto 3).

Uso:
    python prediccion_pacientes.py            # 3 meses futuros
    python prediccion_pacientes.py --meses 6  # 6 meses futuros

Variables de entorno (con valores por defecto que coinciden con docker-compose):
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=odontocitas
    DB_USER=postgres
    DB_PASSWORD=postgres
"""

import argparse
import os
import sys

import pandas as pd
from sqlalchemy import create_engine

try:
    from prophet import Prophet
except ImportError:  # pragma: no cover
    print("Falta Prophet. Instala dependencias con: pip install -r requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv

    # Carga el .env del backend si existe, para reutilizar credenciales.
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "odontocitas-api", ".env"))
except ImportError:
    pass

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}


def crear_engine():
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "odontocitas")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
    return create_engine(url)


def cargar_citas_completadas(engine) -> pd.DataFrame:
    consulta = """
        SELECT fecha_hora AS fecha
        FROM citas
        WHERE estado = 'completada'
    """
    df = pd.read_sql(consulta, engine)
    if df.empty:
        return df
    df["fecha"] = pd.to_datetime(df["fecha"], utc=True).dt.tz_localize(None)
    return df


def agrupar_por_mes(df: pd.DataFrame) -> pd.DataFrame:
    # Cuenta de citas completadas por mes (inicio de mes como marca temporal).
    serie = (
        df.set_index("fecha")
        .resample("MS")
        .size()
        .reset_index(name="y")
        .rename(columns={"fecha": "ds"})
    )
    return serie


def predecir(serie: pd.DataFrame, meses: int) -> pd.DataFrame:
    modelo = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    modelo.fit(serie)
    futuro = modelo.make_future_dataframe(periods=meses, freq="MS")
    pronostico = modelo.predict(futuro)
    return pronostico


def main():
    parser = argparse.ArgumentParser(description="Predicción de pacientes por mes (Prophet)")
    parser.add_argument("--meses", type=int, default=3, help="Meses a predecir (default: 3)")
    args = parser.parse_args()

    engine = crear_engine()
    df = cargar_citas_completadas(engine)

    if df.empty:
        print("No hay citas completadas para entrenar el modelo todavía.")
        return

    serie = agrupar_por_mes(df)
    if len(serie) < 2:
        print("Se necesitan al menos 2 meses con datos para predecir.")
        print(f"Meses con datos: {len(serie)}")
        return

    pronostico = predecir(serie, args.meses)

    # Toma solo los meses futuros (los últimos N del pronóstico).
    futuros = pronostico[["ds", "yhat"]].tail(args.meses)

    print("\nPredicción de pacientes (citas completadas):\n")
    for _, fila in futuros.iterrows():
        fecha = fila["ds"]
        etiqueta = f"{MESES_ES[fecha.month]} {fecha.year}"
        cantidad = max(0, round(fila["yhat"]))
        print(f"{etiqueta}: {cantidad} pacientes")


if __name__ == "__main__":
    main()
