const FALLBACK_LOCALE = 'en'

const walkthroughAudioModules = import.meta.glob('./walkthrough-audios/*', {
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

const resolveWalkthroughAudio = (audio) => {
  if (!audio || audio === '#') {
    return audio ?? '#'
  }

  if (typeof audio !== 'string') {
    return '#'
  }

  const normalizedAudio = audio.replaceAll('\\', '/')

  return walkthroughAudioModules[normalizedAudio] ?? audio
}

export const loadWalkthroughConfig = (config, locale = FALLBACK_LOCALE) => {
  const defaultLocale = config?.defaultLocale ?? FALLBACK_LOCALE
  const resolvedLocale = locale || defaultLocale
  const rawSteps = Array.isArray(config?.steps) ? config.steps : []

  return {
    audio: config?.audio ?? {},
    defaultLocale,
    experimentName: getLocalizedValue(config?.experimentName, resolvedLocale, defaultLocale)
      || config?.experimentName
      || 'Experiment Walkthrough',
    locale: resolvedLocale,
    locales: config?.locales ?? [defaultLocale],
    steps: rawSteps
      .filter((step) => step?.target)
      .map((step, index) => ({
        ...step,
        audio: resolveWalkthroughAudio(step.audio),
        description: getLocalizedValue(step.description, resolvedLocale, defaultLocale),
        id: String(step.id ?? index + 1),
        placement: step.placement ?? 'bottom',
        title: getLocalizedValue(step.title, resolvedLocale, defaultLocale),
      })),
  }
}
