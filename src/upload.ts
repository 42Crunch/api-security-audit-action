/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import { Octokit } from '@octokit/core';
import * as core from '@actions/core';
import * as url from 'url';
import zlib from 'zlib';

import { Sarif } from './sarif';

export function getRequiredInput(name: string): string {
  return core.getInput(name, { required: true });
}

export function getRequiredEnvParam(paramName: string): string {
  const value = process.env[paramName];
  if (value === undefined || value.length === 0) {
    throw new Error(`${paramName} environment variable must be set`);
  }
  core.debug(`${paramName}=${value}`);
  return value;
}

export function getRef(): string {
  // Will be in the form "refs/heads/master" on a push event
  // or in the form "refs/pull/N/merge" on a pull_request event
  const ref = getRequiredEnvParam('GITHUB_REF');

  // For pull request refs we want to convert from the 'merge' ref
  // to the 'head' ref, as that is what we want to analyse.
  // There should have been some code earlier in the workflow to do
  // the checkout, but we have no way of verifying that here.
  const pull_ref_regex = /refs\/pull\/(\d+)\/merge/;
  if (pull_ref_regex.test(ref)) {
    return ref.replace(pull_ref_regex, 'refs/pull/$1/head');
  } else {
    return ref;
  }
}

export async function uploadSarif(sarif: Sarif) {
  const octokit = new Octokit({ auth: getRequiredInput('github-token') });

  const [owner, repo] = getRequiredEnvParam('GITHUB_REPOSITORY').split('/');
  const ref = getRef();
  const commit_sha = getRequiredEnvParam('GITHUB_SHA');
  const zipped_sarif = zlib.gzipSync(JSON.stringify(sarif)).toString('base64');

  await octokit.request('POST /repos/:owner/:repo/code-scanning/sarifs', {
    owner,
    repo,
    commit_sha,
    ref,
    sarif: zipped_sarif,
    tool_name: '42Crunch REST API Static Security Testing',
    checkout_uri: url.pathToFileURL(process.cwd()).toString(),
  });
}
