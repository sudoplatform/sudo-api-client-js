/*
 * Copyright © 2023 Anonyome Labs, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Sudo User Client has not been set before
 * trying to create an Api Client
 */
export class SudoUserClientNotSetError extends Error {
  constructor() {
    super('Sudo User Client has not been set.')
    this.name = 'SudoUserClientNotSetError'
  }
}
