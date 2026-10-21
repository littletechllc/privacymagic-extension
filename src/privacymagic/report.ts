import { handleAsync, logError } from '@src/common/util'

const REPORT_URL = 'https://reports.privacymagic.com/report'

const isDisplayableDomain = (domain: string): boolean => {
  if (domain.length === 0 || domain.length > 253) {
    return false
  }
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false
  }
  return /^[\p{L}\p{N}.-]+$/u.test(domain)
}

const domainFromLocation = (): string => {
  const raw = new URL(window.location.href).searchParams.get('domain') ?? ''
  const domain = raw.trim()
  return isDisplayableDomain(domain) ? domain : ''
}

const closeReportTab = async (): Promise<void> => {
  const tab = await chrome.tabs.getCurrent()
  const tabId = tab?.id
  if (tabId == null) {
    return
  }
  await chrome.tabs.remove(tabId)
}

const localized = (key: string, fallback: string): string => chrome.i18n.getMessage(key) || fallback

const postReport = async (description: string, email: string, website: string): Promise<void> => {
  const body: { description: string, email?: string, website?: string } = { description }
  if (email !== '') {
    body.email = email
  }
  if (website !== '') {
    body.website = website
  }
  const response = await fetch(REPORT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`problem report was not accepted: ${response.status}`)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reportProblemCancel')?.addEventListener('click', (event) => {
    handleAsync(async () => {
      await closeReportTab()
    }, (error) => {
      logError(error, 'error closing report problem page', event)
    })
  })

  const domainElement = document.getElementById('reportProblemDomain')
  if (domainElement == null) {
    return
  }
  const domain = domainFromLocation()
  domainElement.textContent = domain

  const form = document.getElementById('reportProblemForm')
  const descriptionInput = document.getElementById('problemDescription')
  const emailInput = document.getElementById('emailAddress')
  const websiteCheckbox = document.getElementById('sendWebsiteName')
  const submitButton = document.getElementById('reportProblemSubmit')
  const submitLabel = submitButton?.querySelector('.report-submit-label')
  const submitDots = submitButton?.querySelector('.report-submit-dots')
  const errorElement = document.getElementById('reportProblemError')
  const introElement = document.getElementById('reportProblemIntro')
  const thanksPanel = document.getElementById('reportProblemThanks')
  const thanksMessage = document.getElementById('reportProblemThanksMessage')
  const closeButton = document.getElementById('reportProblemCloseTab')
  if (
    form == null ||
    !(descriptionInput instanceof HTMLTextAreaElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(websiteCheckbox instanceof HTMLInputElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(submitLabel instanceof HTMLElement) ||
    !(submitDots instanceof HTMLElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    errorElement == null ||
    introElement == null ||
    thanksPanel == null ||
    thanksMessage == null
  ) {
    return
  }

  closeButton.addEventListener('click', (event) => {
    handleAsync(async () => {
      await closeReportTab()
    }, (error) => {
      logError(error, 'error closing report problem page', event)
    })
  })

  const hasDescription = (): boolean => descriptionInput.value.trim() !== ''

  const setSubmitWaiting = (waiting: boolean): void => {
    if (waiting) {
      submitButton.style.minWidth = `${submitButton.offsetWidth}px`
    } else {
      submitButton.style.minWidth = ''
    }
    submitButton.disabled = waiting || !hasDescription()
    submitButton.setAttribute('aria-busy', waiting ? 'true' : 'false')
    submitLabel.hidden = waiting
    submitDots.hidden = !waiting
  }

  descriptionInput.addEventListener('input', () => {
    if (submitButton.getAttribute('aria-busy') === 'true') {
      return
    }
    submitButton.disabled = !hasDescription()
  })
  setSubmitWaiting(false)

  submitButton.addEventListener('click', (event) => {
    const description = descriptionInput.value.trim()
    if (submitButton.disabled || description === '') {
      return
    }
    errorElement.hidden = true
    setSubmitWaiting(true)
    handleAsync(async () => {
      const email = emailInput.value.trim()
      const website = websiteCheckbox.checked ? domain : ''
      try {
        await postReport(description, email, website)
      } catch (error) {
        setSubmitWaiting(false)
        errorElement.hidden = false
        throw error
      }
      form.hidden = true
      introElement.hidden = true
      thanksMessage.textContent = email === ''
        ? localized(
          'reportProblemThanks',
          'Thank you very much for the report! We will look into the problem.',
        )
        : localized(
          'reportProblemThanksWithEmail',
          'Thank you very much for the report! We will look into the problem and let you know when we have a fix.',
        )
      thanksPanel.hidden = false
    }, (error) => {
      logError(error, 'error submitting problem report', event)
    })
  })
})
