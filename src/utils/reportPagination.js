// These functions are also embedded in the standalone report window.
export const getReportPageScale = (width, height, pageWidth, pageHeight) => (
  Math.min(1, pageWidth / width, pageHeight / height)
)
