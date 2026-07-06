import { AnimatePresence, motion } from 'framer-motion'

import { useWalkthrough } from '../useWalkthrough.js'
import Spotlight from './Spotlight.jsx'
import WalkthroughPopup from './WalkthroughPopup.jsx'

const WalkthroughOverlay = () => {
  const {
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    currentStep,
    isOpen,
    isPositioningTarget,
    isReportStep,
    next,
    previous,
    skipToReport,
    targetRect,
    totalSteps,
  } = useWalkthrough()

  return (
    <AnimatePresence>
      {isOpen && activeStep ? (
        <motion.div
          aria-live="polite"
          className="walkthrough-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div aria-hidden="true" className="walkthrough-interaction-shield" />
          <Spotlight rect={isPositioningTarget ? null : targetRect} />
          <AnimatePresence mode="wait">
            {!isPositioningTarget && targetRect ? (
              <WalkthroughPopup
                activeStep={activeStep}
                autoPlayAudio={autoPlayAudioForStep}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                currentStep={currentStep}
                isReportStep={isReportStep}
                key={activeStep.id}
                onClose={close}
                onNext={next}
                onPrevious={previous}
                onSkip={skipToReport}
                targetRect={targetRect}
                totalSteps={totalSteps}
              />
            ) : null}
          </AnimatePresence>
          <span className="sr-only">
            Step {currentStep} of {totalSteps}: {activeStep.title}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default WalkthroughOverlay
