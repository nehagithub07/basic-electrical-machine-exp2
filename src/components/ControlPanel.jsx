import ObservationTable from './ObservationTable.jsx'
import ResistanceSlider from './ResistanceSlider.jsx'
import SectionCard from './SectionCard.jsx'

const ControlPanel = ({
  locked,
  observations,
  onGenerateReport,
  reportGenerated,
  r1,
  r2,
  r3,
  setR1,
  setR2,
  setR3,
}) => (
  <>
    <SectionCard className="h-[212px]" icon="sliders" id="resistance-controls" title="RESISTANCE SLIDERS">
      <div className="flex flex-col gap-[18px] px-[26px] pt-[26px]">
        <ResistanceSlider disabled={locked} label="R1" onChange={setR1} value={r1} />
        <ResistanceSlider disabled={locked} label="R2" onChange={setR2} value={r2} />
        <ResistanceSlider disabled={locked} label="R3" onChange={setR3} value={r3} />
      </div>
    </SectionCard>

    <ObservationTable observations={observations} onGenerateReport={onGenerateReport} reportGenerated={reportGenerated} />
  </>
)

export default ControlPanel
