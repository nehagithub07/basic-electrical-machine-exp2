import aiGuideConfig from '../aiGuide/aiGuideConfig.json'

export const ALERT_AUDIO_PLACEHOLDER = '#'

const alertAudioModules = import.meta.glob('../audios/*', {
  eager: true,
  import: 'default',
  query: '?url',
})

const audioOnlyStepIds = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 23, 26, 32])

const STEP_TITLES = {
  1: 'Welcome to the AI Guide',
  2: 'Walkthrough Complete',
  11: 'Connections Complete',
  12: 'Wrong Connection',
  13: 'Wrong Connection',
  14: 'Missing Connections',
  15: 'Auto Connect Complete',
  18: 'Check Connections First',
  19: 'Connections Verified',
  20: 'Set Resistance Values',
  21: 'Resistance Values Selected',
  22: 'Power Supply On',
  23: 'Voltage Selected',
  24: 'Reading Added',
  25: 'Duplicate Reading',
  26: 'Second Reading Added',
  28: 'Five Readings Recorded',
  29: 'Reading Limit Reached',
  30: 'Graph Plotted',
  31: 'Simulation Reset',
  32: 'Print Simulation',
  34: 'Missing Values',
  35: 'Missing Value',
  36: 'Incorrect Calculations',
  37: 'KCL Verified',
  38: 'Report Generated',
}

const getAlertAudio = (audio) => {
  if (!audio || audio === ALERT_AUDIO_PLACEHOLDER) {
    return ALERT_AUDIO_PLACEHOLDER
  }

  const fileName = audio.replaceAll('\\', '/').split('/').at(-1)
  return alertAudioModules[`../audios/${fileName}`] ?? ALERT_AUDIO_PLACEHOLDER
}

// The guide and alerts use the same exact script and recording for each event.
// audioSpeech is fallback metadata; a recording and synthesized speech must not both play.
export const getInstructionStep = (guideStepId) => {
  const step = aiGuideConfig.steps.find((entry) => entry.id === Number(guideStepId))

  if (!step) {
    throw new RangeError(`Unknown instruction step: ${guideStepId}`)
  }

  return {
    audio: getAlertAudio(step.audio),
    audioOnly: audioOnlyStepIds.has(step.id),
    audioSpeech: step.text,
    description: step.text,
    guideStepId: step.id,
    title: STEP_TITLES[step.id] ?? 'Connection Instructions',
  }
}

export const ALERT_AUDIO = {
  aiGuideClick: getInstructionStep(1).audio,
  walkthroughComplete: getInstructionStep(2).audio,
  connect1To9: getInstructionStep(3).audio,
  connect2To10: getInstructionStep(4).audio,
  connect3To11: getInstructionStep(5).audio,
  connect4To12: getInstructionStep(6).audio,
  connect5To13: getInstructionStep(7).audio,
  connect6To14: getInstructionStep(8).audio,
  connect7To15: getInstructionStep(9).audio,
  connect8To16: getInstructionStep(10).audio,
  allConnectionsCompleted: getInstructionStep(11).audio,
  wrongConnection: getInstructionStep(12).audio,
  multipleWrongConnections: getInstructionStep(13).audio,
  firstCheckClick: getInstructionStep(14).audio,
  autoConnect: getInstructionStep(15).audio,
  firstPowerSupplyClick: getInstructionStep(18).audio,
  connectionsVerified: getInstructionStep(19).audio,
  resistanceRequired: getInstructionStep(20).audio,
  resistanceSet: getInstructionStep(21).audio,
  powerSupplyTurnOn: getInstructionStep(22).audio,
  voltageSet: getInstructionStep(23).audio,
  firstReadingAdded: getInstructionStep(24).audio,
  duplicateReading: getInstructionStep(25).audio,
  secondReadingAdded: getInstructionStep(26).audio,
  fiveReadingsAdded: getInstructionStep(28).audio,
  maxReadings: getInstructionStep(29).audio,
  graphPlotted: getInstructionStep(30).audio,
  reset: getInstructionStep(31).audio,
  print: getInstructionStep(32).audio,
  verificationMissingMultiple: getInstructionStep(34).audio,
  verificationMissingOne: getInstructionStep(35).audio,
  verificationIncorrect: getInstructionStep(36).audio,
  verificationCorrect: getInstructionStep(37).audio,
  reportGenerated: getInstructionStep(38).audio,
}

export const EXPERIMENT_ALERTS = {
  circuitConnectionsCompleted: {
    ...getInstructionStep(15),
    stepNumber: 1,
    target: '#resistance-controls',
    type: 'success',
  },
  allConnectionsCompleted: {
    ...getInstructionStep(11),
    stepNumber: 1,
    target: '#check-button',
    type: 'success',
  },
  incorrectNodeConnection: {
    ...getInstructionStep(12),
    stepNumber: 1,
    target: '#circuit-panel',
    type: 'error',
  },
  connectionsVerified: {
    ...getInstructionStep(19),
    stepNumber: 2,
    target: '#resistance-controls',
    type: 'success',
  },
  requiredConnectionsFirst: {
    ...getInstructionStep(14),
    stepNumber: 2,
    target: '#circuit-panel',
    type: 'warning',
  },
  multipleWrongConnections: {
    ...getInstructionStep(13),
    stepNumber: 2,
    target: '#circuit-panel',
    type: 'error',
  },
  adjustResistance: {
    ...getInstructionStep(20),
    stepNumber: 3,
    target: '#resistance-controls',
    type: 'info',
  },
  resistanceValuesSelected: {
    ...getInstructionStep(21),
    stepNumber: 3,
    target: '#power-toggle-button',
    type: 'success',
  },
  powerOn: {
    ...getInstructionStep(22),
    stepNumber: 4,
    target: '#voltage-control',
    type: 'success',
  },
  cannotStartPower: {
    ...getInstructionStep(18),
    stepNumber: 4,
    target: '#check-button',
    type: 'warning',
  },
  voltageSet: {
    ...getInstructionStep(23),
    stepNumber: 5,
    target: '#add-reading-button',
    type: 'info',
  },
  readingAdded: {
    ...getInstructionStep(24),
    stepNumber: 6,
    target: '#observation-table-panel',
    type: 'success',
  },
  readingAlreadyExists: {
    ...getInstructionStep(25),
    stepNumber: 6,
    target: '#voltage-control',
    type: 'warning',
  },
  secondReadingAdded: {
    ...getInstructionStep(26),
    stepNumber: 6,
    target: '#voltage-control',
    type: 'info',
  },
  fiveReadingsRecorded: {
    ...getInstructionStep(28),
    stepNumber: 7,
    target: '#plot-button',
    type: 'success',
  },
  maxReadingsReached: {
    ...getInstructionStep(29),
    stepNumber: 7,
    target: '#plot-button',
    type: 'warning',
  },
  graphPlotted: {
    ...getInstructionStep(30),
    stepNumber: 9,
    target: '#verification-panel',
    type: 'success',
  },
  reportGenerated: {
    ...getInstructionStep(38),
    stepNumber: 10,
    target: '#generate-report-button',
    type: 'success',
  },
  verificationMissingMultiple: {
    ...getInstructionStep(34),
    target: '#verification-panel',
    type: 'warning',
  },
  verificationMissingOne: {
    ...getInstructionStep(35),
    target: '#verification-panel',
    type: 'warning',
  },
  verificationIncorrect: {
    ...getInstructionStep(36),
    target: '#verification-panel',
    type: 'error',
  },
  verificationCorrect: {
    ...getInstructionStep(37),
    target: '#generate-report-button',
    type: 'success',
  },
  resetSuccess: {
    ...getInstructionStep(31),
    stepNumber: 11,
    target: '#circuit-panel',
    type: 'success',
  },
  print: {
    ...getInstructionStep(32),
    stepNumber: 10,
    target: '#print-button',
    type: 'info',
  },
}
