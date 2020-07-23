/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuditError.prototype);
  }
}
