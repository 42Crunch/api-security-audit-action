/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as fs from "fs";
import { relative, resolve, dirname } from "path";
import yaml from "js-yaml";

import parser from "json-schema-ref-parser";
import url from "json-schema-ref-parser/lib/util/url";
import Pointer from "json-schema-ref-parser/lib/pointer";
import $Ref from "json-schema-ref-parser/lib/ref";
import { parseJsonPointer, joinJsonPointer } from "../pointer";
import { JsonMapping, MappingTreeNode } from "./types";

const destinationMap = {
  v2: {
    parameters: ["parameters"],
    schema: ["definitions"],
    responses: ["responses"],
  },

  v3: {
    parameters: ["components", "parameters"],
    schema: ["components", "schemas"],
    responses: ["components", "responses"],
    examples: ["components", "examples"],
    requestBody: ["components", "requestBodies"],
    callbacks: ["components", "callbacks"],
    headers: ["components", "headers"],
    links: ["components", "links"],
  },
};

function parseDocument(rootDir: string, filename: string) {
  if (filename.toLowerCase().endsWith(".json")) {
    return JSON.parse(
      fs.readFileSync(resolve(rootDir, filename), { encoding: "utf-8" })
    );
  }
  return yaml.safeLoad(resolve(rootDir, filename));
}

function resolver(rootDir: string) {
  return {
    order: 10,
    canRead: (file: any) => {
      return url.isFileSystemPath(file.url);
    },
    read: async (file: any) => {
      return fs.readFileSync(resolve(rootDir, url.toFileSystemPath(file.url)), {
        encoding: "utf-8",
      });
    },
  };
}

export function getOpenApiVersion(parsed: any): string {
  const swaggerVersionValue = parsed["swagger"];
  const openApiVersionValue = parsed["openapi"];

  if (swaggerVersionValue === "2.0") {
    return "v2";
  } else if (
    openApiVersionValue &&
    typeof openApiVersionValue === "string" &&
    openApiVersionValue.match(/^3\.0\.\d(-.+)?$/)
  ) {
    return "v3";
  }

  return null;
}

function mangle(value: string) {
  return value.replace(/~/g, "-").replace(/\//g, "-").replace(/\#/g, "");
}

function set(target: any, path: string[], value: any) {
  const head = path.slice(0, -1);
  const last = path[path.length - 1];
  let current = target;
  for (const key of head) {
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }

  // check if the destination already exist
  if (current[last]) {
    throw new Error(
      `Unable to merge, object already exists at path: #/${path.join(
        "/"
      )}/${last}`
    );
  }
  current[last] = value;
}

function insertMapping(
  root: MappingTreeNode,
  path: string[],
  value: JsonMapping
) {
  let current = root;
  for (const segment of path) {
    if (!current.children[segment]) {
      current.children[segment] = { value: null, children: {} };
    }
    current = current.children[segment];
  }
  // TODO check that current.value is empty
  current.value = value;
}

export function findMapping(
  root: MappingTreeNode,
  pointer: string
): JsonMapping {
  const path = parseJsonPointer(pointer);
  let current = root;
  let i = 0;
  for (; i < path.length && current.children[path[i]]; i++) {
    current = current.children[path[i]];
  }

  const { file, hash } = current.value;

  if (i < path.length) {
    const remaining = path.slice(i, path.length);
    return { file, hash: hash + joinJsonPointer(remaining) };
  }

  return { file, hash };
}

export async function bundle(
  rootDir: string,
  filename: string
): Promise<[any, MappingTreeNode]> {
  const parsed = parseDocument(rootDir, filename);
  const cwd = dirname(resolve(rootDir, filename)) + "/";
  const state = {
    version: null,
    parsed: null,
    mapping: { value: null, children: {} },
  };

  const bundled = await parser.bundle(parsed, {
    cwd,
    resolve: { http: false, file: resolver(rootDir) },
    hooks: {
      onParse: (parsed) => {
        state.parsed = parsed;
        state.version = getOpenApiVersion(parsed);
      },
      onRemap: (entry) => {
        const filename = url.toFileSystemPath(entry.file);

        // FIXME implement remap for openapi v2 and $ref location based remap
        const hashPath = Pointer.parse(entry.hash);

        if (hashPath[0] == "components") {
          // TODO check that hashPath == 'schemas' or 'parameters', etc.
          const targetFileName = relative(cwd, filename);
          let path = [
            "components",
            hashPath[1],
            mangle(targetFileName) + "-" + hashPath[2],
          ];
          if (hashPath.length > 3) {
            path = path.concat(hashPath.slice(3));
          }
          set(state.parsed, path, entry.value);
          insertMapping(state.mapping, path, {
            file: filename,
            hash: entry.hash,
          });
          return Pointer.join("#", path);
        }

        const path = Pointer.parse(entry.pathFromRoot);
        const parentKey = path[path.length - 1];
        const grandparentKey = path[path.length - 2];
        const destinations = destinationMap[state.version];

        const destination = destinations[parentKey]
          ? destinations[parentKey]
          : destinations[grandparentKey]
          ? destinations[grandparentKey]
          : null;
        if (destination) {
          const ref = entry.$ref.$ref;
          const mangled = mangle(ref);
          const path = destination.concat([mangled]);
          set(state.parsed, path, entry.value);
          insertMapping(state.mapping, path, {
            file: filename,
            hash: entry.hash,
          });
          return Pointer.join("#", path);
        }

        insertMapping(state.mapping, path, {
          file: filename,
          hash: entry.hash,
        });

        entry.$ref = entry.parent[entry.key] = $Ref.dereference(
          entry.$ref,
          entry.value
        );
      },
    },
  });

  return [bundled, state.mapping];
}

export function isOpenAPI(rootDir: string, filename: string) {
  const parsed =
    filename.toLowerCase().endsWith("yaml") ||
    filename.toLowerCase().endsWith("yml")
      ? parseYaml(rootDir, filename)
      : parseJson(rootDir, filename);
  if (parsed && parsed.swagger && parsed.swagger == "2.0") {
    return true;
  } else if (
    parsed &&
    parsed.openapi &&
    typeof parsed.openapi === "string" &&
    parsed.openapi.match(/^3\.0\.\d(-.+)?$/)
  ) {
    return true;
  }
  return false;
}

export function parseYaml(rootDir: string, filename: string) {
  try {
    return yaml.safeLoad(
      fs.readFileSync(resolve(rootDir, filename), { encoding: "utf-8" })
    );
  } catch (e) {
    throw new Error(
      `Exception when trying to parse the file ${filename}: ${e.message}`
    );
  }
}

export function parseJson(rootDir: string, filename: string) {
  try {
    return JSON.parse(
      fs.readFileSync(resolve(rootDir, filename), { encoding: "utf-8" })
    );
  } catch (e) {
    throw new Error(
      `Exception when trying to parse the file ${filename}: ${e.message}`
    );
  }
}
