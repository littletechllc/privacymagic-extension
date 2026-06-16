import { createSafeGetter, createSafeMethod, createSafeSetter, objectDefinePropertiesSafe, objectGetOwnPropertyDescriptorSafe, redefineMethods, redefinePrototypeFields } from '@src/content_scripts/helpers/monkey-patch'
import { weakSetHasSafe, weakSetAddSafe } from '@src/content_scripts/helpers/safe'
import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { applyPatchesToGlobalObject } from '../helpers/patch'

const iframe = (globalObject: GlobalScope): undefined => {
  if (globalObject.HTMLIFrameElement === undefined) {
    return
  }

  // ## iframe hardening ##
  //
  // In a couple of cases, the iframe's window global object
  // is accessed, via iframe.contentWindow or iframe.contentDocument.defaultView,
  // before the iframe has been hardened. We need to harden it first.
  //
  // Case #1: https://browserleaks.com/javascript has an
  // <iframe sandbox="allow-same-origin">. Because this iframe doesn't have
  // 'allow-scripts', the extension's content script doesn't run in the iframe's
  // context. Nonetheless, the parent frame can evaluate code in the sandboxed
  // iframe using the iframe's contentWindow property, e.g.
  // iframe.contentWindow.eval('navigator.hardwareConcurrency'), and retrieve
  // unhardened values. It can also directly access the iframe's contentWindow
  // properties, e.g. iframe.contentWindow.location.href, and retrieve unhardened
  // values.
  //
  // Case #2: In https://abrahamjuliot.github.io/creepjs/tests/iframes.html,
  // a same-origin iframe is created and immediately accessed in the same
  // task as the iframe creation. In this case, the iframe remains unhardened.
  //
  // To prevent this bypass we apply our patches to the iframe's contentWindow
  // object property, which is a global object similar to the global object of
  // the parent frame.
  //
  // TODO: Can we prevent hardening patches from running a second time?

  const contentWinSet = new WeakSet<Window>()

  const getContentWindowSafe = createSafeGetter(globalObject.HTMLIFrameElement, 'contentWindow')
  const getContentDocumentSafe = createSafeGetter(globalObject.HTMLIFrameElement, 'contentDocument')
  const getDefaultViewSafe = createSafeGetter(globalObject.Document, 'defaultView')

  const ensureContentWindowIsHardened = (contentWin: Window | undefined | null): void => {
    if (contentWin == null || weakSetHasSafe(contentWinSet, contentWin)) {
      return
    }
    applyPatchesToGlobalObject(contentWin as GlobalScope)
    weakSetAddSafe(contentWinSet, contentWin)
  }

  redefinePrototypeFields(globalObject.HTMLIFrameElement, {
    contentWindow(this: HTMLIFrameElement) {
      const contentWin = getContentWindowSafe(this)
      ensureContentWindowIsHardened(contentWin)
      return contentWin
    },
    contentDocument(this: HTMLIFrameElement) {
      const contentDoc = getContentDocumentSafe(this)
      ensureContentWindowIsHardened(contentDoc == null ? undefined : getDefaultViewSafe(contentDoc))
      return contentDoc
    }
  })

  // For cases where an iframe is created and immediately accessed in the same
  // task as the iframe creation, the iframe remains unhardened. To prevent this
  // bypass we scan the iframe and all its children for unhardened nodes and
  // harden them.

  const elementQuerySelectorAllSafe = createSafeMethod(globalObject.Element, 'querySelectorAll')
  const documentFragmentQuerySelectorAllSafe = createSafeMethod(globalObject.DocumentFragment, 'querySelectorAll')
  const documentQuerySelectorAllSafe = createSafeMethod(globalObject.Document, 'querySelectorAll')
  const nodeListForEachSafe = createSafeMethod(globalObject.NodeList, 'forEach')
  const parentNodeGetter = createSafeGetter(globalObject.Node, 'parentNode')

  const registeredIframeSet = new WeakSet<HTMLIFrameElement>()

  const registerIframe = (iframe: HTMLIFrameElement): void => {
    if (weakSetHasSafe(registeredIframeSet, iframe)) {
      return
    }
    weakSetAddSafe(registeredIframeSet, iframe)
    ensureContentWindowIsHardened(getContentWindowSafe(iframe))
    iframe.addEventListener('load', () => {
      ensureContentWindowIsHardened(getContentWindowSafe(iframe))
    })
  }

  const scanAndHarden = (node: unknown): void => {
    if (node instanceof globalObject.HTMLIFrameElement) {
      registerIframe(node)
      return
    }
    if (node instanceof globalObject.Element) {
      nodeListForEachSafe(elementQuerySelectorAllSafe(node, 'iframe'), (f) => {
        registerIframe(f as HTMLIFrameElement)
      })
    } else if (node instanceof globalObject.Document) {
      nodeListForEachSafe(documentQuerySelectorAllSafe(node, 'iframe'), (f) => {
        registerIframe(f as HTMLIFrameElement)
      })
    } else if (node instanceof globalObject.DocumentFragment) {
      nodeListForEachSafe(documentFragmentQuerySelectorAllSafe(node, 'iframe'), (f) => {
        registerIframe(f as HTMLIFrameElement)
      })
    }
  }

  const scanAndHardenNodes = (nodes: unknown[]): void => {
    for (const node of nodes) {
      scanAndHarden(node)
    }
  }

  // ## Node hardening ##

  const originalAppendChild = createSafeMethod(globalObject.Node, 'appendChild')
  const originalInsertBefore = createSafeMethod(globalObject.Node, 'insertBefore')
  const originalReplaceChild = createSafeMethod(globalObject.Node, 'replaceChild')

  redefineMethods(globalObject.Node.prototype, {
    appendChild(this: Node, node: Node) {
      const result = originalAppendChild(this, node)
      scanAndHarden(node)
      return result
    },
    insertBefore<T extends Node>(this: Node, newNode: T, referenceNode: Node | null) {
      const result = originalInsertBefore(this, newNode, referenceNode) as T
      scanAndHarden(newNode)
      return result
    },
    replaceChild<T extends Node>(this: Node, newNode: T, oldNode: T) {
      const result = originalReplaceChild(this, newNode, oldNode) as T
      scanAndHarden(newNode)
      return result
    }
  })

  // ## Element hardening ##

  const originalAppend = createSafeMethod(globalObject.Element, 'append')
  const originalPrepend = createSafeMethod(globalObject.Element, 'prepend')
  const originalReplaceChildren = createSafeMethod(globalObject.Element, 'replaceChildren')
  const originalBefore = createSafeMethod(globalObject.Element, 'before')
  const originalAfter = createSafeMethod(globalObject.Element, 'after')
  const originalReplaceWith = createSafeMethod(globalObject.Element, 'replaceWith')
  const originalInsertAdjacentHTML = createSafeMethod(globalObject.Element, 'insertAdjacentHTML')
  const originalInsertAdjacentElement = createSafeMethod(globalObject.Element, 'insertAdjacentElement')

  redefineMethods(globalObject.Element.prototype, {
    append(this: Element, ...nodes: (string | Node)[]) {
      originalAppend(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    prepend(this: Element, ...nodes: (string | Node)[]) {
      originalPrepend(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    replaceChildren(this: Element, ...nodes: (string | Node)[]) {
      originalReplaceChildren(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    before(this: Element, ...nodes: (string | Node)[]) {
      originalBefore(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    after(this: Element, ...nodes: (string | Node)[]) {
      originalAfter(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    replaceWith(this: Element, ...nodes: (string | Node)[]) {
      originalReplaceWith(this, ...nodes)
      scanAndHardenNodes(nodes)
    },
    insertAdjacentHTML(this: Element, position: InsertPosition, html: string) {
      originalInsertAdjacentHTML(this, position, html)
      scanAndHarden(parentNodeGetter(this) ?? this)
    },
    insertAdjacentElement(this: Element, position: InsertPosition, element: Element) {
      const result = originalInsertAdjacentElement(this, position, element)
      scanAndHarden(element)
      return result
    }
  })

  // ## Range hardening ##

  const originalInsertNode = createSafeMethod(globalObject.Range, 'insertNode')
  const originalSurroundContents = createSafeMethod(globalObject.Range, 'surroundContents')

  redefineMethods(globalObject.Range.prototype, {
    insertNode(this: Range, node: Node) {
      const result = originalInsertNode(this, node)
      scanAndHarden(node)
      return result
    },
    surroundContents(this: Range, node: Node) {
      const result = originalSurroundContents(this, node)
      scanAndHarden(node)
      return result
    }
  })

  // ## Document hardening ##

  const originalWrite = createSafeMethod(globalObject.Document, 'write')
  const originalWriteln = createSafeMethod(globalObject.Document, 'writeln')
  const originalExecCommand = createSafeMethod(globalObject.Document, 'execCommand')

  redefineMethods(globalObject.Document.prototype, {
    write(this: Document, ...html: string[]) {
      originalWrite(this, ...html)
      scanAndHarden(this)
    },
    writeln(this: Document, ...args: string[]) {
      originalWriteln(this, ...args)
      scanAndHarden(this)
    },
    execCommand(this: Document, command: string, showUI?: boolean, value?: string) {
      const result = originalExecCommand(this, command, showUI, value)
      scanAndHarden(this)
      return result
    }
  })

  // ## innerHTML/outerHTML hardening ##

  const originalInnerHTMLSetter = createSafeSetter(globalObject.Element, 'innerHTML')
  const originalOuterHTMLSetter = createSafeSetter(globalObject.Element, 'outerHTML')
  const innerHTMLDescriptor = objectGetOwnPropertyDescriptorSafe(globalObject.Element.prototype, 'innerHTML')
  const outerHTMLDescriptor = objectGetOwnPropertyDescriptorSafe(globalObject.Element.prototype, 'outerHTML')

  objectDefinePropertiesSafe(globalObject.Element.prototype, {
    innerHTML: {
      ...innerHTMLDescriptor,
      set (this: Element, value: string) {
        originalInnerHTMLSetter(this, value)
        scanAndHarden(this)
      }
    },
    outerHTML: {
      ...outerHTMLDescriptor,
      set (this: Element, value: string) {
        const parentNode = parentNodeGetter(this)
        originalOuterHTMLSetter(this, value)
        scanAndHarden(parentNode ?? this)
      }
    }
  })

  // ## Already-parsed iframes hardening ##

  scanAndHarden(globalObject.document)

  // ## Harden any new or updated iframes ##)

  const observerCallback = (mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        nodeListForEachSafe(mutation.addedNodes, (node) => {
          scanAndHarden(node)
        })
      }
    }
  }

  const observer = new globalObject.MutationObserver(observerCallback)
  observer.observe(globalObject.document, {
    childList: true,
    subtree: true
  })

  // Stop observing the document for mutations after the DOMContentLoaded event has fired.
  if (globalObject.document.readyState === 'loading') {
    globalObject.document.addEventListener('DOMContentLoaded', () => {
      observer.disconnect()
    })
  } else {
    observer.disconnect()
  }
}

export default iframe
