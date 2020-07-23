/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as core from '@actions/core';
import { audit, getStats } from './audit';
import { produceReport, produceAnnotations } from './report';

function getenv(names: string[]): any {
  const result: any = {};
  for (const name of names) {
    if (!(name in process.env)) {
      console.error(`Environment variable ${name} is not set, exiting.`);
      process.exit(-1);
    }
    result[name] = process.env[name];
  }
  return result;
}

async function run() {
  const apiToken = core.getInput('api-token', { required: true });
  const collectionName = core.getInput('collection-name', { required: true });
  const minScore = core.getInput('min-score', { required: true });

  console.log('got these', apiToken, collectionName, minScore);

  return;
  /*
  try {
    const summary = await audit(process.cwd(), API_TOKEN, COLLECTION_NAME, MIN_SCORE);

    const report = produceReport(summary);
    const annotations = produceAnnotations(summary);

    await submitReport(report, BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG, BITBUCKET_COMMIT);

    await submitAnnotations(annotations, BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG, BITBUCKET_COMMIT);

    return summary;
  } catch (ex) {
    console.log('Error: ', ex.message, ex?.code || '', ex?.response?.body || '');
    process.exit(-1);
  }
  */
}

(async () => {
  const summary = await run();

  /*
  const [total, failures] = getStats(summary);

  if (failures > 0 || total == 0) {
    // exit with -1 if any failures are found or no api files checked
    process.exit(-1);
  }
  */
})();
