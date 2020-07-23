/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import log from "roarr";
import {
  FullFailureConditions,
  SeverityEnum,
  SeverityPerCategory,
} from "./types";

interface Check {
  (report: any, conditions: any): string[];
}

interface Issues {
  [key: string]: {
    criticality: number;
  };
}

const checks: Check[] = [
  checkMinScore,
  checkCategoryScore,
  checkSeverity,
  checkIssueId,
  checkInvalidContact,
];

export function checkReport(
  report: any,
  conditions: FullFailureConditions
): string[] {
  let result: string[] = [];
  for (const check of checks) {
    result = result.concat(check(report, conditions));
  }
  return result;
}

function checkMinScore(
  report: any,
  conditions: FullFailureConditions
): string[] {
  log.debug("Checking minimum API score");
  if (report.score < conditions.minScore) {
    return [
      `The API score ${Math.round(
        report.score
      )} is lower than the set minimum score of ${conditions.minScore}`,
    ];
  }
  return [];
}

function checkCategoryScore(
  report: any,
  conditions: FullFailureConditions
): string[] {
  log.debug("Checking API score per category");

  const dataScore = conditions?.score?.data;
  const securityScore = conditions?.score?.security;
  const result = [];

  if (
    typeof dataScore !== "undefined" &&
    typeof report?.data?.score !== "undefined" &&
    report.data.score < dataScore
  ) {
    result.push(
      `The API data score ${Math.round(
        report.data.score
      )} is lower than the set minimum score of ${dataScore}`
    );
  }

  if (
    typeof securityScore !== "undefined" &&
    typeof report?.security?.score !== "undefined" &&
    report.security.score < securityScore
  ) {
    result.push(
      `The API security score ${Math.round(
        report.security.score
      )} is lower than the set minimum score of ${securityScore}`
    );
  }

  return result;
}

function checkIssueId(
  report: any,
  conditions: FullFailureConditions
): string[] {
  const result = [];
  const ids = conditions?.issue_id || [];
  if (ids.length > 0) {
    log.debug(`Checking if any of the following issues were found: ${ids}`);
    for (const id of ids) {
      for (const section of ["security", "data"]) {
        const issues = report[section]?.issues ?? {};
        for (const issue of Object.keys(issues)) {
          const issueWithDashes = issue.replace(/\./g, "-");
          const idRegex = new RegExp(id);
          if (idRegex.test(issueWithDashes)) {
            result.push(`Found issue "${issueWithDashes}"`);
          }
        }
      }
    }
  }

  return result;
}

function checkInvalidContact(
  report: any,
  conditions: FullFailureConditions
): string[] {
  if (conditions.invalid_contract && report.openapiState !== "valid") {
    log.debug("Checking that the API has a valid OpenAPI definition");
    return ["The OpenAPI definition is not valid"];
  }
  return [];
}

function findBySeverity(issues: Issues, severity: SeverityEnum) {
  const names: { [key in SeverityEnum]: number } = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  if (!issues) {
    return 0;
  }

  let found = 0;
  const criticality = names[severity];

  for (const issue of Object.values(issues)) {
    if (issue.criticality >= criticality) {
      found++;
    }
  }
  return found;
}

function checkSeverity(
  report: any,
  conditions: FullFailureConditions
): string[] {
  const severity = conditions.severity;
  const dataSeverity = (<SeverityPerCategory>severity)?.data;
  const securitySeverity = (<SeverityPerCategory>severity)?.security;
  const result = [];

  if (dataSeverity || securitySeverity) {
    if (dataSeverity) {
      const found = findBySeverity(report?.data?.issues, dataSeverity);
      if (found > 0) {
        result.push(
          `Found ${found} issues in category "data" with severity "${dataSeverity}" or higher`
        );
      }
    }
    if (securitySeverity) {
      const found = findBySeverity(report?.security?.issues, securitySeverity);
      if (found > 0) {
        result.push(
          `Found ${found} issues in category "security" with severity "${securitySeverity}" or higher`
        );
      }
    }
  } else if (severity) {
    const found =
      findBySeverity(report?.data?.issues, <SeverityEnum>severity) +
      findBySeverity(report?.security?.issues, <SeverityEnum>severity);
    if (found > 0) {
      result.push(
        `Found ${found} issues in with severity "${severity}" or higher`
      );
    }
  }

  return result;
}
