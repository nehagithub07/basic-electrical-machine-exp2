// Render the formatting used by the walkthrough without interpreting arbitrary HTML.
const formatText = (text) => String(text ?? '').split(/(\*\*[^*]+\*\*|<sub>[123]<\/sub>|\b[IR][123]\b)/g).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) {
    return <strong key={index}>{formatText(part.slice(2, -2))}</strong>
  }
  if (/^<sub>[123]<\/sub>$/.test(part)) {
    return <sub key={index}>{part.slice(5, 6)}</sub>
  }
  if (/^[IR][123]$/.test(part)) {
    return <span key={index}>{part[0]}<sub>{part[1]}</sub></span>
  }
  return part
})

const WalkthroughText = ({ text }) => <>{formatText(text)}</>

export default WalkthroughText
