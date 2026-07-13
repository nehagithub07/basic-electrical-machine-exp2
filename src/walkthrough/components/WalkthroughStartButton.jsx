import { motion } from 'framer-motion'

import { useWalkthrough } from '../useWalkthrough.js'

const WalkthroughStartButton = ({ variant = 'floating' }) => {
  const { experimentName, isOpen, start, totalSteps } = useWalkthrough()
  const isSideTab = variant === 'side-tab'

  if (isOpen || totalSteps === 0) {
    return null
  }

  return (
    <motion.button
      aria-label={`Start walkthrough for ${experimentName}`}
      className={`walkthrough-start-button walkthrough-start-button--${variant}`}
      id="walkthrough-start-button"
      initial={isSideTab ? { opacity: 0, x: -16 } : { opacity: 0, y: 16 }}
      animate={isSideTab ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => start()}
      type="button"
    >
      <span className="walkthrough-start-button__spark" aria-hidden="true" />
      <span>Start Walkthrough</span>
    </motion.button>
  )
}

export default WalkthroughStartButton
