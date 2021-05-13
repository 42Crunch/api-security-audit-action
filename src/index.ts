/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as core from "@actions/core";
import { audit } from "@xliic/cicd-core-node";
import { produceSarif } from "./sarif";
import { uploadSarif } from "./upload";
import { Logger, SharingType } from "@xliic/cicd-core-node/lib/types";

function logger(levelName: string): Logger {
  const levels = {
    FATAL: 5,
    ERROR: 4,
    WARN: 3,
    INFO: 2,
    DEBUG: 1,
  };

  const level = levels[levelName.toUpperCase()] ?? levels.INFO;

  return {
    debug: (message: string) => {
      if (levels.DEBUG >= level) {
        console.log(message);
      }
    },
    info: (message: string) => {
      if (levels.INFO >= level) {
        console.log(message);
      }
    },
    warning: (message: string) => {
      if (levels.WARN >= level) {
        console.log(message);
      }
    },
    error: (message: string) => {
      if (levels.ERROR >= level) {
        console.log(message);
      }
    },
    fatal: (message: string) => {
      if (levels.FATAL >= level) {
        console.log(message);
      }
    },
  };
}

function getInputValue(input: string, options: any, defaultValue: any): any {
  const value = core.getInput(input, { required: false });
  if (typeof value === "undefined") {
    return defaultValue;
  }

  if (options.hasOwnProperty(value)) {
    return options[value];
  }

  console.log(
    `Unexpected value for input "${input}" using default value instead`
  );

  return defaultValue;
}

function env(name: string): string {
  if (typeof process.env[name] === "undefined") {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return process.env[name]!;
}

(async () => {
  try {
    const githubServerUrl = env("GITHUB_SERVER_URL");
    const githubRepository = env("GITHUB_REPOSITORY");
    const githubRef = env("GITHUB_REF");
    const apiToken = core.getInput("api-token", { required: false });
    const minScore = core.getInput("min-score", { required: true });
    const uploadToCodeScanning = core.getInput("upload-to-code-scanning", {
      required: true,
    });
    const ignoreFailures = core.getInput("ignore-failures", { required: true });
    const userAgent = `GithubAction-CICD/2.0`;
    const platformUrl = core.getInput("platform-url", { required: true });
    const logLevel = core.getInput("log-level", { required: true });

    const repositoryUrl = `${githubServerUrl}/${githubRepository}`;

    if (!githubRef.startsWith("refs/heads/")) {
      core.setFailed("Unable to retrieve the branch name.");
      return;
    }
    const branchName = githubRef.substring("refs/heads/".length);

    const shareEveryone = getInputValue(
      "share-everyone",
      {
        OFF: undefined,
        READ_ONLY: SharingType.ReadOnly,
        READ_WRITE: SharingType.ReadWrite,
      },
      undefined
    );

    const result = await audit({
      rootDir: process.cwd(),
      referer: repositoryUrl,
      userAgent,
      apiToken,
      onboardingUrl:
        "https://docs.42crunch.com/latest/content/tasks/integrate_github_actions.htm",
      platformUrl,
      logger: logger(logLevel),
      lineNumbers: uploadToCodeScanning !== "false",
      branchName,
      repoName: repositoryUrl,
      cicdName: "github",
      minScore,
      shareEveryone,
    });

    if (uploadToCodeScanning !== "false") {
      core.info("Uploading results to Code Scanning");
      const sarif = produceSarif(result!.summary);
      await uploadSarif(sarif);
    }

    if (ignoreFailures == "false") {
      if (result!.failures > 0) {
        core.setFailed(`Completed with ${result!.failures} failure(s)`);
      } else if (result!.summary.size === 0) {
        core.setFailed("No OpenAPI files found");
      }
    } else {
      core.info("Configued to ignore failures");
    }
  } catch (ex) {
    core.setFailed(
      `Error: ${ex.message} ${(ex?.code || "", ex?.response?.body || "")}`
    );
  }
})();
