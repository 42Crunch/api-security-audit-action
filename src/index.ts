/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as core from '@actions/core';
import { audit, getStats } from './audit';

async function run() {
  const apiToken = core.getInput('api-token', { required: true });
  const collectionName = core.getInput('collection-name', { required: true });
  const minScore = core.getInput('min-score', { required: true });

  try {
    const summary = await audit(process.cwd(), apiToken, collectionName, minScore);

    return summary;
  } catch (ex) {
    core.setFailed(`Error: ${(ex.message, ex?.code || '', ex?.response?.body || '')}`);
  }
}

(async () => {
  const summary = await run();

  const [total, failures] = getStats(summary);

  if (failures > 0) {
    core.setFailed(`Completed with ${failures} failure(s)`);
  } else if (total === 0) {
    core.setFailed('No OpenAPI files found');
  }
})();
