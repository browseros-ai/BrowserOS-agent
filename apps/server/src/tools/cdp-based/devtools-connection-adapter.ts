/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type * as puppeteer from './third-party'
import { CDPSessionEvent } from './third-party'

/**
 * This class makes a puppeteer connection look like DevTools CDPConnection.
 *
 * Since we connect "root" DevTools targets to specific pages, we scope everything to a puppeteer CDP session.
 *
 * We don't have to recursively listen for 'sessionattached' as the "root" CDP session sees all child session attached
 * events, regardless how deeply nested they are.
 */
export class PuppeteerDevToolsConnection {
  readonly #connection: puppeteer.Connection
  readonly #observers = new Set<any>()
  readonly #sessionEventHandlers = new Map<string, puppeteer.Handler<unknown>>()

  constructor(session: puppeteer.CDPSession) {
    // biome-ignore lint/style/noNonNullAssertion: session always has a connection
    this.#connection = session.connection()!

    session.on(
      CDPSessionEvent.SessionAttached,
      this.#startForwardingCdpEvents.bind(this),
    )
    session.on(
      CDPSessionEvent.SessionDetached,
      this.#stopForwardingCdpEvents.bind(this),
    )

    this.#startForwardingCdpEvents(session)
  }

  send(method: any, params: any, sessionId: string | undefined): Promise<any> {
    if (sessionId === undefined) {
      throw new Error(
        'Attempting to send on the root session. This must not happen',
      )
    }
    const session = this.#connection.session(sessionId)
    if (!session) {
      // biome-ignore lint/style/useTemplate: upstream code
      throw new Error('Unknown session ' + sessionId)
    }
    // Rolled protocol version between puppeteer and DevTools doesn't necessarily match
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return session
      .send(method as any, params)
      .then((result) => ({ result }))
      .catch((error) => ({ error })) as any
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  observe(observer: any): void {
    this.#observers.add(observer)
  }

  unobserve(observer: any): void {
    this.#observers.delete(observer)
  }

  #startForwardingCdpEvents(session: puppeteer.CDPSession): void {
    const handler = this.#handleEvent.bind(
      this,
      session.id(),
    ) as puppeteer.Handler<unknown>
    this.#sessionEventHandlers.set(session.id(), handler)
    session.on('*', handler)
  }

  #stopForwardingCdpEvents(session: puppeteer.CDPSession): void {
    const handler = this.#sessionEventHandlers.get(session.id())
    if (handler) {
      session.off('*', handler)
    }
  }

  #handleEvent(
    sessionId: string,
    type: string | symbol | number,
    event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): void {
    if (
      typeof type === 'string' &&
      type !== CDPSessionEvent.SessionAttached &&
      type !== CDPSessionEvent.SessionDetached
    ) {
      // biome-ignore lint/suspicious/useIterableCallbackReturn: upstream code
      this.#observers.forEach((observer) =>
        observer.onEvent({
          method: type as any,
          sessionId,
          params: event,
        }),
      )
    }
  }
}
