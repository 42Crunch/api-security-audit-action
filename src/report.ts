/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as path from "path";
import { Summary } from "./audit/types";
import { PLATFORM_URL } from "./audit/constants";
import { getStats } from "./audit";

export function produceAnnotations(summary: Summary): any {
  const annotations = [];
  const keys = Object.keys(summary);
  for (let i = 0; i < keys.length; i++) {
    const filename = keys[i];
    const result = summary[filename];
    /* ignore individual issues for now
    if (result.issues.length > 0) {
      for (let j = 0; j < result.issues.length; j++) {
        const issue = result.issues[j];
        const annotation: any = {
          external_id: `issue-${i}-${j}`,
          annotation_type: "VULNERABILITY",
          summary: issue.description,
          path: path.relative(process.cwd(), issue.file),
          line: issue.line,
          severity: issue.severity,
        };

        if (result.apiId) {
          annotation.link = `${PLATFORM_URL}/apis/${result.apiId}/security-audit-report`;
        }

        annotations.push(annotation);
      }
    }
    */
    if (result.failures.length > 0) {
      for (let j = 0; j < result.failures.length; j++) {
        const annotation: any = {
          external_id: `failure-${i}-${j}`,
          annotation_type: "VULNERABILITY",
          result: "FAILED",
          summary: result.failures[j],
          path: filename,
          line: 0,
          //severity: "CRITICAL",
        };

        if (result.apiId) {
          annotation.link = `${PLATFORM_URL}/apis/${result.apiId}/security-audit-report`;
        }

        annotations.push(annotation);
      }
    } else {
      annotations.push({
        external_id: `success-${i}`,
        annotation_type: "VULNERABILITY",
        result: "PASSED",
        summary: "No issues found",
        path: filename,
        line: 0,
      });
    }
  }
  return annotations;
}

export function produceReport(summary: Summary): any {
  const [total, failures] = getStats(summary);

  let details: string, result: string;
  if (failures > 0) {
    result = "FAILED";
    details = `Detected ${failures} failure(s) in the ${total} OpenAPI file(s) checked`;
  } else if (Object.keys(summary).length === 0) {
    result = "FAILED";
    details = "No OpenAPI files found";
  } else {
    result = "PASSED";
    details = "No issues found";
  }

  const report = {
    title: "42Crunch REST API Static Security Testing",
    details,
    result,
    report_type: "SECURITY",
    reporter: "42Crunch",
    link: "http://platform.42crunch.com",
  };

  return report;
}
