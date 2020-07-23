/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as fs from "fs";
import { Issue, MappingTreeNode } from "./types";
import { parse, Node } from "../ast";
import { findMapping } from "./parse";
import { mapLineOffsets } from "line-chomper";
import { Readable } from "stream";

const parsedFiles = {};
const linezFiles = {};

export async function getIssues(
  filename: string,
  assessment,
  mapping: MappingTreeNode
): Promise<any[]> {
  let issues = [];
  const jsonPointerIndex = assessment.index;

  if (assessment.data) {
    issues = issues.concat(
      await transformIssues(
        assessment.data.issues,
        jsonPointerIndex,
        filename,
        mapping
      )
    );
  }

  if (assessment.security) {
    issues = issues.concat(
      await transformIssues(
        assessment.security.issues,
        jsonPointerIndex,
        filename,
        mapping
      )
    );
  }

  if (assessment.warnings) {
    issues = issues.concat(
      await transformIssues(
        assessment.warnings.issues,
        jsonPointerIndex,
        filename,
        mapping,
        1
      )
    );
  }

  if (assessment.semanticErrors) {
    issues = issues.concat(
      await transformIssues(
        assessment.semanticErrors.issues,
        jsonPointerIndex,
        filename,
        mapping
      )
    );
  }

  if (assessment.validationErrors) {
    issues = issues.concat(
      await transformIssues(
        assessment.validationErrors.issues,
        jsonPointerIndex,
        filename,
        mapping
      )
    );
  }

  issues.sort((a, b) => b.score - a.score);

  return issues;
}

function findLine(lines: Line[], range: [number, number]): number {
  const [start, end] = range;
  for (const line of lines) {
    if (line.offset > start) {
      return line.line;
    }
  }
  return 0;
}

async function findIssueLocation(
  filename: string,
  mappings: MappingTreeNode,
  pointer: string
): Promise<[string, number, Node]> {
  const [root, lines] = await getParsed(filename);
  const node = root.find(pointer);
  if (node) {
    const line = findLine(lines, node.getRange());
    return [filename, line, node];
  } else {
    const mapping = findMapping(mappings, pointer);
    if (mapping) {
      const [root, lines] = await getParsed(mapping.file);
      const node = root.find(mapping.hash);
      const line = findLine(lines, node.getRange());
      return [mapping.file, line, node];
    }
  }
  throw new Error(`Cannot find entry for pointer: ${pointer}`);
}

interface Line {
  line: number;
  offset: number;
}

async function getOffsets(text: string): Promise<Line[]> {
  return new Promise((resolve, reject) => {
    mapLineOffsets(Readable.from([text]), 1, (err, offsets) => {
      if (err) {
        reject(err);
      } else {
        resolve(offsets);
      }
    });
  });
}

async function getParsed(filename: string): Promise<[Node, any]> {
  if (!parsedFiles[filename]) {
    const text = fs.readFileSync(filename, { encoding: "utf-8" });
    if (
      filename.toLowerCase().endsWith(".yaml") ||
      filename.toLowerCase().endsWith(".yml")
    ) {
      const [parsed, errors] = parse(text, "yaml", null);
      parsedFiles[filename] = parsed;
    } else {
      const [parsed, errors] = parse(text, "json", null);
      parsedFiles[filename] = parsed;
    }
    linezFiles[filename] = await getOffsets(text);
  }

  return [parsedFiles[filename], linezFiles[filename]];
}

const criticalityToSeverity = {
  1: "LOW",
  2: "LOW",
  3: "MEDIUM",
  4: "HIGH",
  5: "CRITICAL",
};

async function transformIssues(
  issues: any,
  jsonPointerIndex,
  filename: string,
  mapping: MappingTreeNode,
  defaultCriticality: number = 5
): Promise<Issue[]> {
  const result = [];
  for (const id of Object.keys(issues)) {
    const issue = issues[id];
    for (const subIssue of issue.issues) {
      const pointer = jsonPointerIndex[subIssue.pointer];
      const [file, line, node] = await findIssueLocation(
        filename,
        mapping,
        pointer
      );
      const criticality = issue.criticality
        ? issue.criticality
        : defaultCriticality;
      result.push({
        id,
        description: subIssue.specificDescription
          ? subIssue.specificDescription
          : issue.description,
        pointer: pointer,
        file,
        line,
        range: node.getRange(),
        score: subIssue.score ? Math.abs(subIssue.score) : 0,
        displayScore: transformScore(subIssue.score ? subIssue.score : 0),
        criticality,
        severity: criticalityToSeverity[criticality],
      });
    }
  }

  return result;
}

function transformScore(score: number): string {
  const rounded = Math.abs(Math.round(score));
  if (score === 0) {
    return "0";
  } else if (rounded >= 1) {
    return rounded.toString();
  }
  return "less than 1";
}
