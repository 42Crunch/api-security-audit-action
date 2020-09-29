/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

export interface ApiStatus {
  isProcessed: boolean;
  lastAssessment: Date;
}

export interface RemoteApi {
  id: string;
  previousStatus: ApiStatus;
}

export interface JsonMapping {
  file: string;
  hash: string;
}

export interface MappingTreeNode {
  value: JsonMapping;
  children: {
    [key: string]: MappingTreeNode;
  };
}

export interface RemoteApiWithMapping extends RemoteApi {
  mapping: MappingTreeNode;
}

export interface RemoteApiError {
  statusCode: number | null;
  error: any;
  description: string | null;
}

export interface FileApiMap {
  [filename: string]: RemoteApiWithMapping | RemoteApiError;
}

export interface FileApiIdMap {
  [filename: string]: string;
}

export interface Issue {
  id: string;
  description: string;
  pointer: string;
  score: number;
  displayScore: string;
  criticality: number;
  file: string;
  line: number;
  severity: string;
}

export interface Summary {
  [filename: string]: {
    apiId: string | null;
    score: number;
    failures: string[];
    issues: Issue[];
  };
}

export type SeverityEnum = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type DiscoveryDisabled = false;

export interface AuditConfig {
  fail_on?: FailureConditions;
  mapping?: Mapping;
  discovery?: Discovery | DiscoveryDisabled;
}

export interface FailureConditions {
  invalid_contract?: boolean;
  issue_id?: string[];
  severity?: SeverityPerCategory | SeverityEnum;
  score?: {
    data?: number;
    security?: number;
  };
}

export interface FullFailureConditions extends FailureConditions {
  minScore: number; // doesn't come from a confg file, configured in inputs
}

export interface SeverityPerCategory {
  data?: SeverityEnum;
  security?: SeverityEnum;
}

export interface Mapping {
  [k: string]: string;
}

export interface Discovery {
  search?: string[];
}

export interface AuditOptions {
  referer: string;
  userAgent: string;
  apiToken: string;
  onboardingUrl: string;
}
