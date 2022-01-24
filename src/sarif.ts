/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as url from "url";
import { resolve } from "path";
import { FileAuditMap } from "@xliic/cicd-core-node/lib/types";
import TurndownService from "turndown";
import got from "got";

export interface Sarif {
  $schema?: string;
  version: "2.1.0";
  runs: Run[];
}

export interface Run {
  tool: {
    driver: {
      name: string;
      informationUri: string;
      rules: Rule[];
    };
  };
  artifacts: Artifact[];
  results: Result[];
}

export interface Artifact {
  location: {
    uri: url.URL;
  };
}

export interface Result {
  ruleId?: string;
  ruleIndex?: number;
  level?: "notApplicable" | "pass" | "note" | "warning" | "error" | "open";
  message?: {
    text?: string;
  };
  locations?: Location[];
}

export interface Location {
  physicalLocation?: {
    id?: number;
    artifactLocation: {
      uri: url.URL;
      index: number;
    };
    region?: Region;
  };
}

export interface Region {
  startLine?: number;
  startColumn?: number;
}

export interface Rule {
  id: string;
  shortDescription?: {
    text?: string;
  };
  helpUri?: string;
  help?: {
    text?: string;
  };
  properties?: {
    tags?: string[];
    [k: string]: any;
  };
}

const ARTICLES_URL = "https://platform.42crunch.com/kdb/audit-with-yaml.json";

export async function getArticles(): Promise<any> {
  try {
    const response = await got(ARTICLES_URL);
    const articles = JSON.parse(response.body);
    return articles;
  } catch (error) {
    throw new Error(`Failed to read articles.json: ${error}`);
  }
}

function getResultLevel(
  issue
): "notApplicable" | "pass" | "note" | "warning" | "error" | "open" {
  const criticalityToSeverity = {
    1: "note",
    2: "note",
    3: "warning",
    4: "error",
    5: "error",
  };

  return criticalityToSeverity[issue.criticality];
}

const fallbackArticle = {
  description: {
    text: `<p>Whoops! Looks like there has been an oversight and we are missing a page for this issue.</p>
             <p><a href="https://apisecurity.io/contact-us/">Let us know</a> the title of the issue, and we make sure to add it to the encyclopedia.</p>`,
  },
};

function articleById(articles: any, id: string) {
  function partToText(part) {
    if (!part || !part.sections) {
      return "";
    }
    return part.sections
      .map((section) => `${section.text || ""}${section?.code?.json || ""}`)
      .join("");
  }

  const article = articles[id] || fallbackArticle;

  return [
    article ? article.description.text : "",
    partToText(article.example),
    partToText(article.exploit),
    partToText(article.remediation),
  ].join("");
}

export async function produceSarif(summary: FileAuditMap): Promise<Sarif> {
  const sarifResults: Result[] = [];
  const sarifFiles = {};

  const sarifRules = {};
  const sarifRuleIndices = {};
  let nextRuleIndex = 0;
  const sarifArtifactIndices = {};
  let nextArtifactIndex = 0;

  const turndownService = new TurndownService();

  const articles = await getArticles();

  const sarifLog: Sarif = {
    version: "2.1.0",
    $schema: "http://json.schemastore.org/sarif-2.1.0-rtm.4",
    runs: [
      {
        tool: {
          driver: {
            name: "42Crunch REST API Static Security Testing",
            informationUri: "https://42crunch.com/",
            rules: [],
          },
        },
        results: sarifResults,
        artifacts: [],
      },
    ],
  };

  for (const filename of summary.keys()) {
    const absoluteFile = resolve(filename);
    const result = summary.get(filename)!;
    if ("errors" in result) {
      continue;
    }

    if (result.issues) {
      for (const issue of result.issues) {
        if (typeof sarifFiles[issue.file] === "undefined") {
          sarifArtifactIndices[issue.file] = nextArtifactIndex++;
          sarifFiles[issue.file] = {
            location: {
              uri: url.pathToFileURL(issue.file),
            },
          };
        }

        const sarifRepresentation: Result = {
          level: getResultLevel(issue),
          ruleId: issue.id,
          message: {
            text: issue.description,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: url.pathToFileURL(issue.file),
                  index: sarifArtifactIndices[issue.file],
                },
                region: {
                  startLine: issue.line,
                  startColumn: 1,
                },
              },
            },
          ],
        };

        sarifResults.push(sarifRepresentation);

        if (typeof sarifRules[issue.id] === "undefined") {
          sarifRuleIndices[issue.id] = nextRuleIndex++;

          let helpUrl = "https://support.42crunch.com";
          const article = articles[issue.id];
          if (article) {
            const version = issue.id.startsWith("v3-") ? "oasv3" : "oasv2";
            const group = article.group;
            const subgroup = article.subgroup;
            helpUrl = `https://apisecurity.io/encyclopedia/content/${version}/${group}/${subgroup}/${issue.id}.htm`;
          }

          const helpText = turndownService.turndown(
            articleById(articles, issue.id)
          );

          // Create a new entry in the rules dictionary.
          sarifRules[issue.id] = {
            id: issue.id,
            shortDescription: {
              text: issue.description,
            },
            helpUri: helpUrl, //meta.docs.url,
            help: {
              text: helpText,
            },
            properties: {
              category: "Other", //meta.docs.category,
            },
          };
        }

        sarifRepresentation.ruleIndex = sarifRuleIndices[issue.id];
      }
    }

    /* Do not report failures for the time being
    if (result.failures && result.failures.length > 0) {
      for (let i = 0; i < result.failures.length; i++) {
        const failure = result.failures[i];

        // Only add it if not already there.
        if (typeof sarifFiles[absoluteFile] === 'undefined') {
          sarifArtifactIndices[absoluteFile] = nextArtifactIndex++;
          sarifFiles[absoluteFile] = {
            location: {
              uri: url.pathToFileURL(absoluteFile),
            },
          };
        }

        const failureRuleId = `failure-${i}`;

        const sarifRepresentation: Result = {
          level: 'error',
          ruleId: failureRuleId,
          message: {
            text: failure,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: url.pathToFileURL(absoluteFile),
                  index: sarifArtifactIndices[absoluteFile],
                },
              },
            },
          ],
        };

        sarifResults.push(sarifRepresentation);

        // each failure gets uinique rule
        sarifRuleIndices[failureRuleId] = nextRuleIndex++;
        sarifRules[failureRuleId] = {
          id: failureRuleId,
          shortDescription: {
            text: failure,
          },
          helpUri: 'http://support.42crunch.com', //meta.docs.url,
          help: {
            text: failure,
          },
          properties: {
            category: 'Other', //meta.docs.category,
          },
        };
      }
    }
    */
  }

  if (Object.keys(sarifFiles).length > 0) {
    sarifLog.runs[0].artifacts = [];

    Object.keys(sarifFiles).forEach(function (path) {
      sarifLog.runs[0].artifacts.push(sarifFiles[path]);
    });
  }

  if (Object.keys(sarifRules).length > 0) {
    Object.keys(sarifRules).forEach(function (ruleId) {
      let rule = sarifRules[ruleId];
      sarifLog.runs[0].tool.driver.rules.push(rule);
    });
  }

  return sarifLog;
}
