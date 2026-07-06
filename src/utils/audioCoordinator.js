const AUDIO_EXCLUSIVE_EVENT = 'app-audio:exclusive-play'

export const dispatchExclusiveAudioStart = (sourceId) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(AUDIO_EXCLUSIVE_EVENT, {
    detail: { sourceId },
  }))
}

export const addExclusiveAudioListener = (sourceId, onInterrupt) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleExclusiveAudio = (event) => {
    if (event.detail?.sourceId === sourceId) {
      return
    }

    onInterrupt?.()
  }

  window.addEventListener(AUDIO_EXCLUSIVE_EVENT, handleExclusiveAudio)

  return () => window.removeEventListener(AUDIO_EXCLUSIVE_EVENT, handleExclusiveAudio)
}
