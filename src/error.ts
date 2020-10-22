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
