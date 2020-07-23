/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import { Kind, Node } from "./types";
import { parseJson, JsonNode } from "./json";
import { parseYaml, findYamlNodeAtOffset, YamlNode } from "./yaml";
import { Schema } from "js-yaml";

function parse(
  text: string,
  languageId: string,
  schema: Schema
): [Node, any[]] {
  return languageId === "yaml" ? parseYaml(text, schema) : parseJson(text);
}

export {
  parse,
  parseYaml,
  parseJson,
  findYamlNodeAtOffset,
  Kind,
  Node,
  JsonNode,
  YamlNode,
};
