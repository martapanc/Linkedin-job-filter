// @ts-nocheck
globalThis.__plasmoInternalPortMap = new Map()

import { default as messagesAnalyzeJob } from "~background/messages/analyzeJob"

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  switch (request?.name) {
    
    default:
      break
  }

  return true
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.name) {
    case "analyzeJob":
  messagesAnalyzeJob({
    ...request,
    sender
  }, {
    send: (p) => sendResponse(p)
  })
  break
    default:
      break
  }

  return true
})

chrome.runtime.onConnect.addListener(function(port) {
  globalThis.__plasmoInternalPortMap.set(port.name, port)
  port.onMessage.addListener(function(request) {
    switch (port.name) {
      
      default:
        break
    }
  })
})

