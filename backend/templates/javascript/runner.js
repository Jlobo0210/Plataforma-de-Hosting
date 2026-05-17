const express = require("express");
const acorn = require("acorn");
const app = express();

app.use(express.json());

function detectEntrypoint(code) {
  try {
    const tree = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: "script",
    });

    for (const node of tree.body) {
      if (node.type === "FunctionDeclaration") {
        return { name: node.id.name, params: getParamNames(node) };
      }
      if (
        node.type === "VariableDeclaration" &&
        node.declarations[0].init &&
        (node.declarations[0].init.type === "ArrowFunctionExpression" ||
          node.declarations[0].init.type === "FunctionExpression")
      ) {
        return {
          name: node.declarations[0].id.name,
          params: getParamNames(node.declarations[0].init),
        };
      }
    }
  } catch (e) {
    console.error("Error parseando el código:", e.message);
  }
  return null;
}

// Obtener los nombres de los parámetros en orden
function getParamNames(funcNode) {
  return funcNode.params.map((param) => {
    // Con default: (a = 10) → nombre es "a"
    if (param.type === "AssignmentPattern") {
      return param.left.name;
    }
    // Simple: (a) → nombre es "a"
    return param.name;
  });
}

const userCode = process.env.USER_CODE || "";
const entrypoint = detectEntrypoint(userCode);
console.log(`✅ Usando función: ${entrypoint?.name}`);
console.log(`✅ Parámetros detectados: ${entrypoint?.params}`);

const moduleExports = {};
const wrappedCode = `
  ${userCode}
  moduleExports['${entrypoint?.name}'] = ${entrypoint?.name};
`;

try {
  eval(wrappedCode);
} catch (e) {
  console.error("Error ejecutando el código del usuario:", e.message);
  process.exit(1);
}

const userFunction = moduleExports[entrypoint?.name];

if (!userFunction || typeof userFunction !== "function") {
  console.error(`No se encontró la función '${entrypoint?.name}'`);
  process.exit(1);
}

console.log(`✅ Función '${entrypoint?.name}' lista`);

async function execute(params) {
  try {
    // Mapear el objeto de params a argumentos en el orden correcto
    // { a: "5", b: "3" } + ["a", "b"] → sumar("5", "3")
    const args = entrypoint.params.map((paramName) => params[paramName]);

    const result = await Promise.resolve(userFunction(...args));
    return { status: 200, body: { result } };
  } catch (err) {
    if (err instanceof TypeError) {
      return {
        status: 400,
        body: { error: `Parámetros inválidos: ${err.message}` },
      };
    }
    return { status: 500, body: { error: err.message } };
  }
}

app.get("/", async (req, res) => {
  const params = req.query;
  const { status, body } = await execute(params);
  res.status(status).json(body);
});

app.post("/", async (req, res) => {
  const queryParams = req.query;
  const bodyParams =
    typeof req.body === "object" && req.body !== null ? req.body : {};

  const params = { ...queryParams, ...bodyParams };
  const { status, body } = await execute(params);
  res.status(status).json(body);
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Microservicio corriendo en puerto 8080");
});
