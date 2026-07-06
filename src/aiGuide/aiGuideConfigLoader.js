const FALLBACK_LOCALE = 'en'

const aiGuideAudioModules = import.meta.glob('../audios/*', {
  eager: true,
  import: 'default',
  query: '?url',
})

const getLocalizedValue = (value, locale, fallbackLocale) => {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  return (
    value[locale]
    ?? value[fallbackLocale]
    ?? value[FALLBACK_LOCALE]
    ?? Object.values(value).find((entry) => typeof entry === 'string')
    ?? ''
  )
}

export const isConfiguredAudioSource = (audio) => Boolean(audio && audio !== '#')

const resolveAiGuideAudio = (audio) => {
  if (!audio || audio === '#') {
    return audio ?? '#'
  }

  if (typeof audio !== 'string') {
    return '#'
  }

  const fileName = audio.replaceAll('\\', '/').split('/').at(-1)

  return aiGuideAudioModules[`../audios/${fileName}`] ?? audio
}

export const loadAiGuideConfig = (config, locale = FALLBACK_LOCALE) => {
  const defaultLocale = config?.defaultLocale ?? FALLBACK_LOCALE
  const resolvedLocale = locale || defaultLocale
  const rawSteps = Array.isArray(config?.steps) ? config.steps : []

  return {
    defaultLocale,
    guideName: getLocalizedValue(config?.guideName, resolvedLocale, defaultLocale)
      || config?.guideName
      || 'AI Guide',
    locale: resolvedLocale,
    locales: config?.locales ?? [defaultLocale],
    steps: rawSteps
      .map((step, index) => ({
        ...step,
        audio: resolveAiGuideAudio(step?.audio),
        id: String(step?.id ?? index + 1),
        text: getLocalizedValue(step?.text, resolvedLocale, defaultLocale),
      }))
      .filter((step) => step.text),
  }
}
