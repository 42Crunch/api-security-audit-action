/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as core from "@actions/core";
import { audit, getStats } from "@xliic/cicd-core-node";
import { produceSarif } from "./sarif";
import { uploadSarif } from "./upload";

function logger(levelName: string) {
  const levels = {
    FATAL: 5,
    ERROR: 4,
    WARN: 3,
    INFO: 2,
    DEBUG: 1,
  };

  const level = levels[levelName] ?? levels.INFO;

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

(async () => {
  try {
    const apiToken = core.getInput("api-token", { required: false });
    const collectionName = core.getInput("collection-name", { required: true });
    const minScore = core.getInput("min-score", { required: true });
    const uploadToCodeScanning = core.getInput("upload-to-code-scanning", {
      required: true,
    });
    const ignoreFailures = core.getInput("ignore-failures", { required: true });
    const referer = `https://github.com/${process.env["GITHUB_REPOSITORY"]}`;
    const userAgent = `GithubAction-CICD/1.0`;
    const platformUrl = core.getInput("platform-url", { required: true });
    const logLevel = core.getInput("log-level", { required: true });

    const summary = await audit(process.cwd(), collectionName, minScore, {
      referer,
      userAgent,
      apiToken,
      onboardingUrl:
        "https://docs.42crunch.com/latest/content/tasks/integrate_github_actions.htm",
      platformUrl,
      logger: logger(logLevel),
    });

    if (uploadToCodeScanning !== "false") {
      core.info("Uploading results to Code Scanning");
      const sarif = produceSarif(summary);
      await uploadSarif(sarif);
    }

    if (ignoreFailures == "false") {
      const [total, failures] = getStats(summary);
      if (failures > 0) {
        core.setFailed(`Completed with ${failures} failure(s)`);
      } else if (total === 0) {
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
