/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";
import { parseYaml } from "./parse";
import {
  FileApiIdMap,
  FileApiMap,
  AuditConfig,
  Mapping,
  FullFailureConditions,
} from "./types";
import { CONF_FILE, DEFAULT_PATTERNS, UUID_REGEX } from "./constants";
import schema from "./schema.json";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function readConfig(
  rootDir: string,
  minScore: number
): {
  discoveryPatterns: any;
  mappedFiles: FileApiIdMap | null;
  failureConditions: FullFailureConditions;
} {
  let discoveryPatterns: any = DEFAULT_PATTERNS;
  let mappedFiles = null;
  let failureConditions: FullFailureConditions = { minScore };
  const confFilePath = path.join(rootDir, CONF_FILE);
  if (fs.existsSync(confFilePath)) {
    const audit = validateConfig(parseYaml(rootDir, CONF_FILE), confFilePath);

    // discovery section
    if (audit?.discovery === false) {
      // discovery is disabled
      discoveryPatterns = null;
    } else if (audit?.discovery?.search) {
      // discovery patterns specified
      discoveryPatterns = audit.discovery.search;
    }

    // mapping section
    if (audit?.mapping) {
      mappedFiles = checkMappedFiles(audit.mapping);
    }

    // failure conditions
    if (audit.fail_on) {
      failureConditions = { ...failureConditions, ...audit.fail_on };
    }
  }

  return { discoveryPatterns, mappedFiles, failureConditions };
}

function validateConfig(config: any, configFilePath: string): AuditConfig {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(config);
  if (!valid) {
    console.log(
      `Validation errors in "${configFilePath}":`,
      JSON.stringify(validate.errors, null, 2)
    );
    throw new ConfigError("Invalid configuration file");
  }
  return config.audit;
}

function checkMappedFiles(mappedFiles: Mapping): FileApiIdMap {
  const fileMap: FileApiIdMap = {};
  const uniqueIds: { [id: string]: string } = {};
  for (const [filename, id] of Object.entries(mappedFiles)) {
    if (!fs.existsSync(filename)) {
      throw new ConfigError(
        `The file "${filename}" listed in the 'mapping' section of the config file does not exist.`
      );
    }

    if (!UUID_REGEX.test(id)) {
      throw new ConfigError(
        `The API ID for the file "${filename}" listed in the 'mapping' section of the config file is not a valid UUID.`
      );
    }

    if (uniqueIds[id]) {
      throw new ConfigError(
        `Found duplicate API Id in mappings: "${uniqueIds[id]}" is mapped to the same API Id ${id} as "${filename}"`
      );
    }

    uniqueIds[id] = filename;
    fileMap[filename] = id;
  }

  return fileMap;
}
