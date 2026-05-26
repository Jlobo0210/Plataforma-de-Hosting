import os
import re

_ENV_VAR_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def normalize_root_path(root_path: str) -> str:
    """
    Normaliza la ruta raíz del proyecto dentro del repositorio clonado.
    Retorna "." para la raíz del repo o una ruta relativa sin prefijo "./".
    """
    if root_path is None:
        return "."

    path = root_path.strip().replace("\\", "/")
    if not path or path == ".":
        return "."

    if path.startswith("./"):
        path = path[2:]

    if path.startswith("/") or re.match(r"^[A-Za-z]:", path):
        raise ValueError("Ruta raíz inválida: no se permiten rutas absolutas")

    if "\x00" in path:
        raise ValueError("Ruta raíz inválida: caracteres no permitidos")

    parts = [part for part in path.split("/") if part not in ("", ".")]
    if ".." in parts:
        raise ValueError("Ruta raíz inválida: no se permiten rutas con ..")

    if not parts:
        return "."

    return "/".join(parts)


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def parse_env_content(text: str) -> dict[str, str]:
    """
    Parsea contenido estilo .env a un dict para inyectar en containers.run().
    Ignora líneas vacías y comentarios (#).
    """
    if not text:
        return {}

    env: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            raise ValueError(f"Línea de entorno inválida: {raw_line!r}")

        key, value = line.split("=", 1)
        key = key.strip()
        value = _strip_quotes(value.strip())

        if not key or not _ENV_VAR_NAME.match(key):
            raise ValueError(f"Nombre de variable inválido: {key!r}")

        env[key] = value

    return env


def write_build_env_files(build_context: str, env_content: str) -> None:
    """
    Escribe archivos .env en el contexto de build antes de `docker build`.

    Vite y otros bundlers leen variables en build-time desde `.env.production`.
    Ese archivo suele no estar en `.dockerignore` (a diferencia de `.env`).
    """
    if not env_content or not env_content.strip():
        return

    content = env_content if env_content.endswith("\n") else env_content + "\n"
    for filename in (".env.production", ".env", ".env.local"):
        path = os.path.join(build_context, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
