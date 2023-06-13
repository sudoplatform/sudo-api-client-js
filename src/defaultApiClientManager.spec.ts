/*
 * Copyright © 2023 Anonyome Labs, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConfigurationNotSetError,
  DefaultConfigurationManager,
  DefaultLogger,
} from '@sudoplatform/sudo-common'
import { DefaultSudoUserClient } from '@sudoplatform/sudo-user'
import { DefaultApiClientManager } from './defaultApiClientManager'
import { SudoUserClientNotSetError } from './error'
require('isomorphic-fetch')

beforeEach(() => {
  DefaultApiClientManager.getInstance().unsetConfig()
})

describe('Api Client Manager', () => {
  const sudoUserConfig = {
    federatedSignIn: {
      appClientId: '120q904mra9d5l4psmvdbrgm49',
      signInRedirectUri: 'http://localhost:3000/callback',
      signOutRedirectUri: 'http://localhost:3000/',
      webDomain: 'id-dev-fsso-sudoplatform.auth.us-east-1.amazoncognito.com',
      identityProvider: 'Auth0',
      refreshTokenLifetime: 60,
    },
    apiService: {
      apiUrl:
        'https://xy7zw5ys7rahrponv7h26vjn6y.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
    },
    identityService: {
      region: 'us-east-1',
      poolId: 'us-east-1_ZiPDToF73',
      clientId: '120q904mra9d5l4psmvdbrgm49',
      identityPoolId: 'us-east-1:8fe6d8ed-cd77-4622-b1bb-3f0c147638ad',
      apiUrl:
        'https://mqn7cjrzcrd75jpsma3xw4744a.appsync-api.us-east-1.amazonaws.com/graphql',
      apiKey: 'da2-xejsa343urfifmzkycmz3rqdom',
      bucket: 'ids-userdata-id-dev-fsso-userdatabucket2d841c35-j9x47k5042fk',
      transientBucket:
        'ids-userdata-id-dev-fsso-transientuserdatabucket0-1enoeyoho1sjl',
      registrationMethods: ['TEST', 'FSSO'],
      refreshTokenLifetime: 60,
    },
    alternativeService: {
      region: 'us-east-1',
      poolId: 'us-east-1_6NalHLdlq',
      clientId: 'pcg1ma18cluamqrif79viaj04',
      apiUrl:
        'https://u2ysyzwojzaahbsq5toulhdt4e.appsync-api.us-east-1.amazonaws.com/graphql',
      pbkdfRounds: 100000,
    },
  }

  describe('getClient', () => {
    it('should throw Error if config not set', () => {
      const apiClientManager = DefaultApiClientManager.getInstance()

      expect(() => {
        apiClientManager.getClient()
      }).toThrow(ConfigurationNotSetError)
    })

    it('should throw Error if sudoUserClient not set', () => {
      const config = {
        region: 'us-east-1',
        apiUrl: 'https://aws',
      }

      const apiClientManager =
        DefaultApiClientManager.getInstance().setConfig(config)

      expect(() => {
        apiClientManager.getClient()
      }).toThrow(SudoUserClientNotSetError)
    })

    it('should fallback to Default configuration when apiService config not set on the ApiClientManager', () => {
      DefaultConfigurationManager.getInstance().setConfig(
        JSON.stringify(sudoUserConfig),
      )

      DefaultApiClientManager.getInstance().unsetConfig()

      const sudoUserClient = new DefaultSudoUserClient()

      const clientOptions = {
        disableOffline: true,
      }

      const client = DefaultApiClientManager.getInstance()
        .setAuthClient(sudoUserClient)
        .getClient(clientOptions)

      expect(client).toBeDefined()
    })

    it('should return client when config and sudoUserClient set', () => {
      const clientConfig = {
        region: 'us-east-1',
        apiUrl: 'https://aws',
      }

      const clientOptions = {
        disableOffline: true,
      }

      DefaultConfigurationManager.getInstance().setConfig(
        JSON.stringify(sudoUserConfig),
      )

      const sudoUserClient = new DefaultSudoUserClient()

      const client = DefaultApiClientManager.getInstance()
        .setConfig(clientConfig)
        .setAuthClient(sudoUserClient)
        .getClient(clientOptions)

      expect(client).toBeDefined()
    })

    it('should return separate clients for different config namespace', () => {
      const clientConfig = {
        region: 'us-east-1',
        apiUrl: 'https://aws',
      }

      const clientOptions = {
        disableOffline: true,
      }

      DefaultConfigurationManager.getInstance().setConfig(
        JSON.stringify(sudoUserConfig),
      )

      const sudoUserClient = new DefaultSudoUserClient()

      const client = DefaultApiClientManager.getInstance()
        .setConfig(clientConfig)
        .setAuthClient(sudoUserClient)
        .getClient({ ...clientOptions, configNamespace: 'alternativeService' })

      expect(client).toBeDefined()

      const defaultClient =
        DefaultApiClientManager.getInstance().getClient(clientOptions)

      expect(defaultClient).toBeDefined()

      let privateClients = (DefaultApiClientManager.getInstance() as any)[
        '_namespacedClients'
      ]

      expect(Object.keys(privateClients).length).toEqual(2)
      expect(privateClients.apiService).toBeDefined()
      expect(privateClients.alternativeService).toBeDefined()
    })

    it('should invalidate client when sudoUserClient is reset', () => {
      const clientConfig = {
        region: 'us-east-1',
        apiUrl: 'https://aws',
      }

      const clientOptions = {
        disableOffline: true,
      }

      DefaultConfigurationManager.getInstance().setConfig(
        JSON.stringify(sudoUserConfig),
      )

      const logger1 = new DefaultLogger('sudo-user-client-1-logger')
      const logger2 = new DefaultLogger('sudo-user-client-2-logger')
      expect(logger1 === logger2).toEqual(false)

      const sudoUserClient1 = new DefaultSudoUserClient({ logger: logger1 })
      const sudoUserClient2 = new DefaultSudoUserClient({ logger: logger2 })
      expect(sudoUserClient1 === sudoUserClient2).toEqual(false)

      let client = DefaultApiClientManager.getInstance()
        .setConfig(clientConfig)
        .setAuthClient(sudoUserClient1)
        .getClient(clientOptions)

      expect(client).toBeDefined()

      let privateClients = (DefaultApiClientManager.getInstance() as any)[
        '_namespacedClients'
      ]
      expect(privateClients?.apiService).toBeDefined()

      DefaultApiClientManager.getInstance().setAuthClient(sudoUserClient2)
      privateClients = (DefaultApiClientManager.getInstance() as any)[
        '_namespacedClients'
      ]
      expect(privateClients?.apiService).toBeUndefined()

      client = DefaultApiClientManager.getInstance().getClient(clientOptions)
      privateClients = (DefaultApiClientManager.getInstance() as any)[
        '_namespacedClients'
      ]
      expect(privateClients?.apiService).toBeDefined()
    })
  })
})
