/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import log from "roarr";
import got, { HTTPError } from "got";
import FormData from "form-data";
import { RemoteApi, ApiStatus, RemoteApiError } from "./types";
import {
  PLATFORM_URL,
  USER_AGENT,
  ASSESSMENT_MAX_WAIT,
  ASSESSMENT_RETRY,
} from "./constants";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleHttpError(err: any): RemoteApiError {
  if (
    err instanceof HTTPError &&
    err?.response?.statusCode === 409 &&
    (<any>err?.response?.body)?.error === "limit reached"
  ) {
    return {
      statusCode: err.response.statusCode,
      error: err.response.body,
      description: `You have reached your maximum number of APIs. Please sign into ${PLATFORM_URL} and upgrade your account.`,
    };
  } else if (
    err instanceof HTTPError &&
    err?.response?.statusCode === 403 &&
    (<any>err?.response?.body)?.error === "invalid authorization"
  ) {
    return {
      statusCode: err.response.statusCode,
      error: err.response.body,
      description: `Forbidden to access, check that ID of your mapped API is correct.`,
    };
  }
  throw err;
}

export async function listApis(
  collectionId: string,
  apiToken: string
): Promise<any> {
  const { body } = await got(`api/v1/collections/${collectionId}/apis`, {
    prefixUrl: PLATFORM_URL,
    method: "GET",
    responseType: "json",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiToken,
      "User-Agent": USER_AGENT,
    },
  });
  return body;
}

export async function listCollections(apiToken: string): Promise<any> {
  const { body } = await got("api/v1/collections", {
    prefixUrl: PLATFORM_URL,
    method: "GET",
    responseType: "json",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiToken,
      "User-Agent": USER_AGENT,
    },
  });
  return body;
}

export async function deleteApi(apiId: string, apiToken: string) {
  log.debug(`Delete API ID: ${apiId}`);
  const { body } = await got(`api/v1/apis/${apiId}`, {
    prefixUrl: PLATFORM_URL,
    method: "DELETE",
    responseType: "json",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiToken,
      "User-Agent": USER_AGENT,
    },
  });
  return body;
}

export async function createApi(
  collectionId: string,
  name: string,
  contents: Buffer,
  apiToken: string
): Promise<RemoteApi | RemoteApiError> {
  log.debug(`Create API name: ${name} collection ID: ${collectionId}`);
  const form = new FormData();
  form.append("specfile", contents.toString("utf-8"), {
    filename: "swagger.json",
    contentType: "application/json",
  });
  form.append("name", name);
  form.append("cid", collectionId);

  try {
    const { body } = <any>await got("api/v1/apis", {
      prefixUrl: PLATFORM_URL,
      method: "POST",
      body: form,
      responseType: "json",
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiToken,
        "User-Agent": USER_AGENT,
      },
    });
    return {
      id: body.desc.id,
      previousStatus: { lastAssessment: new Date(0), isProcessed: false },
    };
  } catch (err) {
    return handleHttpError(err);
  }
}

export async function readApiStatus(
  apiId: string,
  apiToken: string
): Promise<ApiStatus> {
  log.debug(`Read API ID: ${apiId}`);
  const { body } = <any>await got(`api/v1/apis/${apiId}`, {
    prefixUrl: PLATFORM_URL,
    method: "GET",
    responseType: "json",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiToken,
      "User-Agent": USER_AGENT,
    },
  });

  const lastAssessment = body?.assessment?.last
    ? new Date(body.assessment.last)
    : new Date(0);
  const isProcessed = body.assessment.isProcessed;

  return {
    isProcessed,
    lastAssessment,
  };
}

export async function updateApi(
  apiId: string,
  contents: Buffer,
  apiToken: string
): Promise<RemoteApi | RemoteApiError> {
  log.debug(`Update API ID: ${apiId}`);

  try {
    const previousStatus = await readApiStatus(apiId, apiToken);

    const { body } = <any>await got(`api/v1/apis/${apiId}`, {
      prefixUrl: PLATFORM_URL,
      method: "PUT",
      json: { specfile: contents.toString("base64") },
      responseType: "json",
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiToken,
        "User-Agent": USER_AGENT,
      },
    });

    return {
      id: body.desc.id,
      previousStatus,
    };
  } catch (err) {
    return handleHttpError(err);
  }
}

export async function createCollection(
  name: string,
  apiToken: string
): Promise<any> {
  log.debug(`Create collection: ${name}`);
  const { body } = await got("api/v1/collections", {
    prefixUrl: PLATFORM_URL,
    method: "POST",
    json: { name, isShared: false },
    responseType: "json",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiToken,
      "User-Agent": USER_AGENT,
    },
  });
  return body;
}

export async function readAssessment(
  api: RemoteApi,
  apiToken: string
): Promise<any> {
  log.debug(`Reading assessment report for API ID: ${api.id}`);

  const start = Date.now();
  let now = Date.now();
  while (now - start < ASSESSMENT_MAX_WAIT) {
    const status = await readApiStatus(api.id, apiToken);
    const ready =
      status.isProcessed &&
      status.lastAssessment.getTime() >
        api.previousStatus!.lastAssessment.getTime();
    if (ready) {
      const { body } = <any>(
        await got(`api/v1/apis/${api.id}/assessmentreport`, {
          prefixUrl: PLATFORM_URL,
          method: "GET",
          responseType: "json",
          headers: {
            Accept: "application/json",
            "X-API-KEY": apiToken,
            "User-Agent": USER_AGENT,
          },
        })
      );
      const report = JSON.parse(
        Buffer.from(body.data, "base64").toString("utf8")
      );
      return report;
    }
    log.debug(
      `Assessment report for API ID: ${api.id} is not ready, retrying.`
    );
    await delay(ASSESSMENT_RETRY);
    now = Date.now();
  }
  throw new Error(
    `Timed out while waiting for the assessment report for API ID: ${api.id}`
  );
}
