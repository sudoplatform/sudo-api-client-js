import {
  ConfigurationNotSetError,
  DefaultConfigurationManager,
} from '@sudoplatform/sudo-common'
import { DefaultSudoUserClient, KeyManager } from '@sudoplatform/sudo-user'
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
    },
    secureVaultService: {
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

      const apiClientManager = DefaultApiClientManager.getInstance().setConfig(
        config,
      )

      expect(() => {
        apiClientManager.getClient()
      }).toThrow(SudoUserClientNotSetError)
    })

    it('should fallback to Default configuration when apiService config not set on the ApiClientManager', () => {
      DefaultConfigurationManager.getInstance().setConfig(
        JSON.stringify(sudoUserConfig),
      )

      DefaultApiClientManager.getInstance().unsetConfig()

      const keyManager = new KeyManager()
      const sudoUserClient = new DefaultSudoUserClient(keyManager)

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

      const keyManager = new KeyManager()
      const sudoUserClient = new DefaultSudoUserClient(keyManager)

      const client = DefaultApiClientManager.getInstance()
        .setConfig(clientConfig)
        .setAuthClient(sudoUserClient)
        .getClient(clientOptions)

      expect(client).toBeDefined()
    })
  })
})
