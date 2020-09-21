/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as core from '@actions/core';
import { audit, getStats } from './audit';
import { produceSarif } from './sarif';
import { uploadSarif } from './upload';

(async () => {
  try {
    const apiToken = core.getInput('api-token', { required: true });
    const collectionName = core.getInput('collection-name', { required: true });
    const minScore = core.getInput('min-score', { required: true });
    const uploadToCodeScanning = core.getInput('upload-to-code-scanning', { required: true });
    const ignoreFailures = core.getInput('ignore-failures', { required: true });

    const summary = await audit(process.cwd(), apiToken, collectionName, minScore);

    if (uploadToCodeScanning !== 'false') {
      core.info('Uploading results to Code Scanning');
      const sarif = produceSarif(summary);
      await uploadSarif(sarif);
    }

    if (ignoreFailures == 'false') {
      const [total, failures] = getStats(summary);
      if (failures > 0) {
        core.setFailed(`Completed with ${failures} failure(s)`);
      } else if (total === 0) {
        core.setFailed('No OpenAPI files found');
      }
    } else {
      core.info('Configued to ignore failures');
    }
  } catch (ex) {
    core.setFailed(`Error: ${ex.message} ${(ex?.code || '', ex?.response?.body || '')}`);
  }
})();
