/*
Copyright © 2015 Infrared5, Inc. All rights reserved.

The accompanying code comprising examples for use solely in conjunction with Red5 Pro (the "Example Code")
is  licensed  to  you  by  Infrared5  Inc.  in  consideration  of  your  agreement  to  the  following
license terms  and  conditions.  Access,  use,  modification,  or  redistribution  of  the  accompanying
code  constitutes your acceptance of the following license terms and conditions.

Permission is hereby granted, free of charge, to you to use the Example Code and associated documentation
files (collectively, the "Software") without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The Software shall be used solely in conjunction with Red5 Pro. Red5 Pro is licensed under a separate end
user  license  agreement  (the  "EULA"),  which  must  be  executed  with  Infrared5,  Inc.
An  example  of  the EULA can be found on our website at: https://account.red5pro.com/assets/LICENSE.txt.

The above copyright notice and this license shall be included in all copies or portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,  INCLUDING  BUT
NOT  LIMITED  TO  THE  WARRANTIES  OF  MERCHANTABILITY, FITNESS  FOR  A  PARTICULAR  PURPOSE  AND
NONINFRINGEMENT.   IN  NO  EVENT  SHALL INFRARED5, INC. BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN  AN  ACTION  OF  CONTRACT,  TORT  OR  OTHERWISE,  ARISING  FROM,  OUT  OF  OR  IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
;((window, red5) => {
  const MODE_SUB = 'sub'
  const MODE_PUB = 'pub'
  const MODE_PUBSUB = 'pubsub'

  const publishContainer = document.querySelector('.publish-container')
  const subscribeContainer = document.querySelector('.subscribe-container')

  const searchParams = new URLSearchParams(window.location.search)
  const query = (param, defaultValue) => {
    return searchParams.has(param) ? searchParams.get(param) : defaultValue
  }

  const mode = query('mode', MODE_PUBSUB)
  const host = query('host', window.location.hostName)
  const app = query('app', 'live')
  const streamName = query('stream_name', 'mystream')
  const apiVersion = query('api_version', 'v1')
  const nodeGroup = query('node_group', 'default')
  const rtaUser = query('rta_user')
  const rtaPass = query('rta_pass')
  const rtaToken = query('rta_token')
  const standalone = query('standalone', 'false') === 'true'

  let publisher
  let subscriber
  const { WHIPClient, WHEPClient } = red5

  const configureAuth = params => {
    if (rtaUser && rtaPass) {
      params.user = rtaUser
      params.password = rtaPass
    }
    if (rtaToken) {
      params.token = rtaToken
    }
    return params
  }

  const getConfiguration = (client = 'whip') => {
    if (standalone) {
      return {
        host,
        app,
        streamName,
        connectionParams: configureAuth({})
      }
    }
    // Else, Stream Manager 2.0 integration.
    return {
      endpoint: `https://${host}/as/${apiVersion}/proxy/${client}/${app}/${streamName}`,
      streamName,
      connectionParams: configureAuth({
        nodeGroup
      })
    }
  }

  const onPublisherEvent = event => {
    const { type } = event
    console.log('[Publisher]', type)
  }

  const onSubscriberEvent = event => {
    const { type } = event
    if (type === 'Subscribe.Time.Update') {
      return
    }
    console.log('[Subscriber]', type)
  }

  const publish = async () => {
    try {
      let config = getConfiguration('whip')
      publisher = new red5.WHIPClient()
      publisher.on('*', onPublisherEvent)
      await publisher.init(config)
      await publisher.publish()
    } catch (e) {
      unpublish()
      alert(`Could not publish stream: ${e.message}`)
      throw e
    }
  }

  const subscribe = async () => {
    try {
      const config = getConfiguration('whep')
      subscriber = new red5.WHEPClient()
      subscriber.on('*', onSubscriberEvent)
      await subscriber.init(config)
      await subscriber.subscribe()
    } catch (e) {
      unsubscribe()
      // Retry. May be propagating.
      let t = setTimeout(async () => {
        clearTimeout(t)
        await subscribe()
      }, 2000)
    }
  }

  const unpublish = async () => {
    try {
      publisher.off('*', onPublisherEvent)
      await publisher.unpublish()
      publisher = undefined
    } catch (e) {
      // noop.
    }
  }

  const unsubscribe = async () => {
    try {
      subscriber.off('*', onSubscriberEvent)
      await subscriber.unsubscribe()
      subscriber = undefined
    } catch (e) {
      // noop.
    }
  }

  const start = async () => {
    try {
      switch (mode) {
        case MODE_SUB:
          subscribeContainer.classList.remove('hidden')
          subscribe()
          break
        case MODE_PUB:
          publishContainer.classList.remove('hidden')
          publish()
          break
        case MODE_PUBSUB:
        default:
          publishContainer.classList.remove('hidden')
          subscribeContainer.classList.remove('hidden')
          await publish()
          // Allow it to propagate.
          let t = setTimeout(async () => {
            clearTimeout(t)
            await subscribe()
          }, 2000)
      }
    } catch (e) {
      alert(`Could not start player: ${e.message}`)
    }
  }

  // Clean up on leave of page.
  window.addEventListener('beforeunload', async () => {
    await unpublish()
    await unsubscribe()
  })
  window.addEventListener('pagehide', async () => {
    await unpublish()
    await unsubscribe()
  })

  start()
})(window, window.red5prosdk)
