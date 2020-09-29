/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

export const PLATFORM_URL = 'https://platform.42crunch.com';
export const CONF_FILE = '42c-conf.yaml';
export const DEFAULT_PATTERNS = ['**/*.json', '**/*.yaml', '**/*.yml', '!node_modules/', '!tsconfig.json'];
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_NAME_LEN = 64;
export const ASSESSMENT_MAX_WAIT = 60000;
export const ASSESSMENT_RETRY = 5000;
