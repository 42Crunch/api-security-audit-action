/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import globby from 'globby';
import log from 'roarr';
import { HTTPError } from 'got';
import * as path from 'path';
import { listCollections, listApis, createCollection, createApi, updateApi, deleteApi, readAssessment } from './api';
import {
  FileApiMap,
  Summary,
  FileApiIdMap,
  MappingTreeNode,
  RemoteApi,
  RemoteApiError,
  RemoteApiWithMapping,
  AuditOptions,
} from './types';
import { AuditError } from './error';
import { checkReport } from './checks';
import { bundle, isOpenAPI } from './parse';
import { ConfigError, readConfig } from './config';
import { PLATFORM_URL, MAX_NAME_LEN, UUID_REGEX } from './constants';
import { getIssues } from './issues';

export function getStats(summary: Summary): [number, number] {
  let filesWithFailures = 0;
  const values = Object.values(summary);
  for (const result of values) {
    if (result.failures.length > 0) {
      filesWithFailures++;
    }
  }
  return [values.length, filesWithFailures];
}

function displayReport(summary: Summary) {
  for (const [filename, result] of Object.entries(summary)) {
    console.log(`Audited ${filename}, the API score is ${Math.round(result.score)}`);
    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        console.log(`    ${failure}`);
      }
    } else {
      console.log(`    No blocking issues found.`);
    }
    if (result.apiId) {
      console.log(`    Details:`);
      console.log(`    ${PLATFORM_URL}/apis/${result.apiId}/security-audit-report`);
    }
    console.log('');
  }
}

function withMapping(
  remote: RemoteApi | RemoteApiError,
  mapping: MappingTreeNode,
): RemoteApiWithMapping | RemoteApiError {
  if ('error' in remote) {
    return remote;
  }
  return { ...remote, mapping };
}

async function uploadMappedFiles(
  rootDir: string,
  mappedFiles: FileApiIdMap,
  options: AuditOptions,
): Promise<FileApiMap> {
  const result: FileApiMap = {};
  for (const [filename, apiId] of Object.entries(mappedFiles)) {
    const [parsed, mapping] = await bundle(rootDir, filename);
    const apiData = Buffer.from(JSON.stringify(parsed), 'utf8');
    result[filename] = withMapping(await updateApi(apiId, apiData, options), mapping);
  }
  return result;
}

async function uploadFilesToCollection(
  rootDir: string,
  filenames: string[],
  collectionId: string,
  options: AuditOptions,
): Promise<FileApiMap> {
  const result: FileApiMap = {};

  await purgeCollection(collectionId, options);

  for (const filename of filenames) {
    const [parsed, mapping] = await bundle(rootDir, filename);
    const apiName = makeName(filename);
    const apiData = Buffer.from(JSON.stringify(parsed), 'utf8');
    result[filename] = withMapping(await createApi(collectionId, apiName, apiData, options), mapping);
  }

  return result;
}

async function discoverOpenApiFiles(rootDir: string, discoveryPatterns: any, mappedFiles: FileApiIdMap | null) {
  const discoveredFilenames = await findOpenapiFiles(rootDir, discoveryPatterns);

  const filteredFilenames = discoveredFilenames.filter((filename) => {
    if (mappedFiles && mappedFiles[filename]) {
      log.debug(`This file is mapped to an existing ID and is excluded from the discovery process: ${filename}`);
      return false;
    }
    return true;
  });

  log.debug(`Looking for OpenAPI contents in: ${filteredFilenames}`);

  const openapiFilenames = filteredFilenames.filter((filename) => isOpenAPI(rootDir, filename));

  log.debug(`Discovered OpenAPI files: ${openapiFilenames}`);

  return openapiFilenames;
}

function makeName(filename: string) {
  return filename.replace(/[^A-Za-z0-9_\-\.\ ]/g, '-').substring(0, MAX_NAME_LEN);
}

async function findOpenapiFiles(rootDir: string, patterns: string[]) {
  log.debug(`Looking for OpenAPI files in: ${patterns}`);
  const paths = await globby(patterns, { cwd: rootDir });
  return paths;
}

async function createOrFindCollectionId(name: string, options: AuditOptions) {
  log.debug(`Checking for the collection name: ${name}`);
  const collections = await listCollections(options);

  const existingCollectionId = collections?.list.filter((collection: any) => collection.desc.name === name)?.pop()?.desc
    ?.id;

  if (existingCollectionId) {
    log.debug(`Found an existing collection ID: ${existingCollectionId}`);
    return existingCollectionId;
  } else {
    const {
      desc: { id: newCollectionId },
    } = await createCollection(name, options);
    log.debug(`Created a new collection ID: ${newCollectionId}`);
    return newCollectionId;
  }
}

async function purgeCollection(collectionId: string, options: AuditOptions) {
  log.debug(`Removing all existing APIs from the collection ID ${collectionId}`);
  const apis = await listApis(collectionId, options);

  for (const api of apis.list) {
    log.debug(`Delete API ID ${api.desc.id}`);
    await deleteApi(api.desc.id, options);
  }
}

async function perform_audit(
  rootDir: string,
  collectionName: string,
  minScore: string,
  options: AuditOptions,
): Promise<Summary> {
  /*  
  if (!apiToken) {
    throw new AuditError(`Missing the API token, see ${ONBOARDING_URL}`);
  }

  if (!UUID_REGEX.test(apiToken)) {
    throw new AuditError(`Invalid API token, see ${ONBOARDING_URL}`);
  }
  */

  const minScoreNumber = parseInt(minScore, 10);
  if (isNaN(minScoreNumber) || minScoreNumber < 0 || minScoreNumber > 100) {
    throw new AuditError('Invalid value set for "Min Score", the value must be between 0 and 100');
  }

  const { discoveryPatterns, mappedFiles, failureConditions } = readConfig(rootDir, minScoreNumber);

  const summary: Summary = {};

  if (discoveryPatterns) {
    const openapiFilenames = await discoverOpenApiFiles(rootDir, discoveryPatterns, mappedFiles);
    const collectionId = await createOrFindCollectionId(makeName(collectionName), options);
    const fileMap = await uploadFilesToCollection(rootDir, openapiFilenames, collectionId, options);

    for (const [filename, remote] of Object.entries(fileMap)) {
      if ('error' in remote) {
        const description = remote.description
          ? remote.description
          : `Unexpected error: ${remote.statusCode} ${remote.error}`;
        summary[filename] = {
          apiId: null,
          score: 0,
          failures: [description],
          issues: [],
        };
      } else {
        const report = await readAssessment(remote, options);

        const issues = await getIssues(path.resolve(rootDir, filename), report, remote.mapping);
        const failures = checkReport(report, failureConditions);
        summary[filename] = {
          apiId: remote.id,
          score: report.score,
          issues,
          failures,
        };
      }
    }
  }

  if (mappedFiles) {
    const updatedMappedFiles = await uploadMappedFiles(rootDir, mappedFiles, options);

    for (const [filename, remote] of Object.entries(updatedMappedFiles)) {
      if ('error' in remote) {
        const description = remote.description
          ? remote.description
          : `Unexpected error: ${remote.statusCode} ${remote.error}`;
        summary[filename] = {
          apiId: null,
          score: 0,
          failures: [description],
          issues: [],
        };
      } else {
        const report = await readAssessment(remote, options);
        const issues = await getIssues(path.resolve(rootDir, filename), report, remote.mapping);
        const failures = checkReport(report, failureConditions);
        summary[filename] = {
          apiId: remote.id,
          score: report.score,
          failures,
          issues,
        };
      }
    }
  }

  displayReport(summary);

  const [total, failures] = getStats(summary);
  if (failures > 0) {
    console.log(`Detected ${failures} failures in the ${total} OpenAPI files checked`);
  } else if (total === 0) {
    console.log('No OpenAPI files found.');
  }

  return summary;
}

export async function audit(
  rootDir: string,
  collectionName: string,
  minScore: string,
  options: AuditOptions,
): Promise<Summary> {
  try {
    return await perform_audit(rootDir, collectionName, minScore, options);
  } catch (err) {
    if (err instanceof AuditError) {
      throw err;
    } else if (err instanceof HTTPError && err?.response?.statusCode === 401) {
      throw new AuditError(
        `Received 'Unauthorized' response to an API call. Check that the API token is correct. See the config instructions ${options.onboardingUrl} or contact support@42crunch.com for support.`,
      );
    } else if (err instanceof ConfigError) {
      throw new AuditError(`Config file error: ${err.message}`);
    } else {
      console.log(err.message);
      if (err?.response) {
        console.log(err?.response?.body);
      }
      console.log(err.stack);
      throw new AuditError(
        `Unexpected exception "${err.message} ${err.response ? JSON.stringify(err?.response?.body) : ''}"`,
      );
    }
  }
}
