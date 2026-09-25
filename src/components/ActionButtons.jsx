import { useEffect, useRef, useState } from 'react'
import SectionCard from './SectionCard.jsx'
import {
  AddIcon,
  AiGuide,
  AutoConnectIcon,
  ButtonIcon,
  CheckIcon,
  CloseIcon,
  PlotIcon,
  PrintIcon,
  ResetIcon,
} from './Icons.jsx'

const buttons = [
  {
    id: 'instructions-button',
    label: 'INSTRUCTIONS',
    tone: 'action-button--gold',
    Icon: ButtonIcon,
    opensInstructions: true,
  },
  {
    id: 'ai-guide-button',
    label: 'AI GUIDE',
    tone: 'action-button--cyan',
    Icon: AiGuide,
    handlerName: 'onAiGuide',
  },
  {
    id: 'check-button',
    label: 'CHECK',
    tone: 'action-button--green',
    Icon: CheckIcon,
    handlerName: 'onCheck',
  },
  {
    id: 'auto-connect-button',
    label: 'AUTO CONNECT',
    tone: 'action-button--teal',
    Icon: AutoConnectIcon,
    handlerName: 'onAutoConnect',
  },
  {
    id: 'add-reading-button',
    label: 'ADD',
    tone: 'action-button--blue',
    Icon: AddIcon,
    handlerName: 'onAdd',
  },
  {
    id: 'plot-button',
    label: 'PLOT',
    tone: 'action-button--orange',
    Icon: PlotIcon,
    handlerName: 'onPlot',
  },
  {
    id: 'reset-button',
    label: 'RESET',
    tone: 'action-button--red',
    Icon: ResetIcon,
    handlerName: 'onReset',
  },
  {
    id: 'print-button',
    label: 'PRINT',
    tone: 'action-button--purple',
    Icon: PrintIcon,
    handlerName: 'onPrint',
  },
  
 
]

const instructionSteps = [
  {
    number: 1,
    text: 'Make connections as per the instructions given below by drag and drop the wire from the terminals, or use Autoconnect to make the connections automatically.',
    substeps: [
      'Connect power supply to the circuit (1-9, 2-10).',
      'Connect ammeters (3-11, 4-12), (5-13, 6-14) and (7-15, 8-16).',
      'Note: Click on the label to delete the connection for the corresponding terminals.',
    ],
  },
  {
    number: 2,
    text: 'Check the manual connections by clicking the ‘CHECK’ button. Autoconnect will automatically verify the connections.',
  },
  {
    number: 3,
    text: 'Set the values of resistances R1, R2 and R3 by moving the sliders on right. These values will remain constant throughout the experiment.',
  },
  {
    number: 4,
    text: "Click the 'Power' button to turn ON the power supply.",
  },
  {
    number: 5,
    text: 'Vary the voltage value by moving the voltage slider to the right side. The readings on the ammeter will change accordingly.',
  },
  {
    number: 6,
    text: "Click on the 'ADD' button to add the readings to the observation table.",
  },
  {
    number: 7,
    text: 'Repeat Steps 5 and 6 to record up to five readings.',
  },
  {
    number: 8,
    text: "Click on the 'PLOT' button to plot the graph.",
  },
  {
    number: 9,
    text: 'In the Theoretical Verification section, select a reading to verify, enter the required calculated values, and click the ‘Verify’ button to verify the reading.',
  },
  {
    number: 10,
    text: 'Click the ‘Generate Report’ button to generate the simulation report after completing at least one successful verification.',
  },
  {
    number: 11,
    text: 'Click on the ‘PRINT’ button to print the simulation or simulation report.',
  },
  {
    number: 12,
    text: 'Click on the ‘RESET’ button to refresh the simulation.',
  },
]

const ActionButtons = ({
  activeInstructionStep = 1,
  activeButtons = {},
  disabledButtons = {},
  onAdd,
  onAiGuide,
  onCheck,
  onPlot,
  onPrint,
  onReset,
  onAutoConnect,
}) => {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const activeInstructionRef = useRef(null)
  const handlers = {
    onAdd,
    onCheck,
    onPlot,
    onPrint,
    onReset,
    onAutoConnect,
    onAiGuide,
  }

  useEffect(() => {
    if (!instructionsOpen || !activeInstructionRef.current) {
      return
    }

    activeInstructionRef.current.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [activeInstructionStep, instructionsOpen])

  return (
    <SectionCard className="action-buttons-card h-[176px]" icon="buttons" id="action-buttons-panel" title="ACTION BUTTONS">
      <div className="action-buttons__grid">
        {buttons.map(({ id, label, tone, Icon, handlerName, opensInstructions }) => {
          const handler = handlers[handlerName]
          const isActive = !opensInstructions && Boolean(activeButtons[handlerName])
          const isDisabled = !opensInstructions && (!handler || disabledButtons[handlerName])
          const buttonProps = opensInstructions
            ? {
                'aria-controls': 'experiment-instructions-panel',
                'aria-expanded': instructionsOpen,
                onClick: () => setInstructionsOpen((current) => !current),
              }
            : {
                'aria-pressed': handlerName === 'onAiGuide' ? isActive : undefined,
                onClick: handler,
                title: handlerName === 'onAiGuide' && isActive ? 'Click to stop narration' : undefined,
              }

          return (
            <button
              id={id}
              key={label}
              type="button"
              className={`action-button ${tone} ${isActive ? 'action-button--active' : ''}`}
              disabled={isDisabled}
              {...buttonProps}
            >
              <Icon />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {instructionsOpen ? (
        <div
          className="action-instructions-panel"
          id="experiment-instructions-panel"
          role="region"
          aria-labelledby="experiment-instructions-title"
        >
          <div className="action-instructions-panel__header">
            <h3 id="experiment-instructions-title">Instructions</h3>
            <button
              type="button"
              className="action-instructions-panel__close"
              aria-label="Close instructions"
              onClick={() => setInstructionsOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="action-instructions-panel__body">
            <p className="action-instructions-panel__intro"><strong>AI Guide:</strong> The AI guide will assist you in performing the simulation accurately at each step.</p>
            <ol className="action-instructions-panel__steps">
              {instructionSteps.map((step) => {
                const isActive = step.number === activeInstructionStep

                return (
                  <li
                    aria-current={isActive ? 'step' : undefined}
                    className={`action-instructions-panel__step ${isActive ? 'action-instructions-panel__step--active' : ''}`}
                    key={step.number}
                    ref={isActive ? activeInstructionRef : null}
                  >
                    <strong>STEP {step.number}:</strong> {step.text}
                    {step.substeps ? (
                      <ol className="action-instructions-panel__substeps" type="a">
                        {step.substeps.map((substep) => (
                          <li key={substep}>{substep}</li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

export default ActionButtons
