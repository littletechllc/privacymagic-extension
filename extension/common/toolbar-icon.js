export const setToolbarIcon = async (emoji) => {
  const canvas = new OffscreenCanvas(128, 128)
  const ctx = canvas.getContext('2d')

  try {
    // Draw emoji to fill canvas boundaries
    const canvasSize = 128

    // Set background color
    ctx.fillStyle = 'rgb(255, 255, 255, 0)'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Calculate font size to fill the canvas
    let fontSize = canvasSize
    ctx.font = `${fontSize}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const metrics = ctx.measureText(emoji)
    const textWidth = metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft
    const textHeight = metrics.actualBoundingBoxDescent + metrics.actualBoundingBoxAscent
    fontSize = fontSize * canvasSize / textHeight
    ctx.font = `${fontSize}px serif`

    // Draw the emoji
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji, canvasSize / 2 , canvasSize / 2 - metrics.actualBoundingBoxDescent / 2 + metrics.actualBoundingBoxAscent / 2)

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const base64 = btoa(String.fromCharCode.apply(null, uint8Array))
    const dataURL = `data:image/png;base64,${base64}`
    chrome.action.setIcon({path: dataURL})
  } catch (error) {
    console.error('Failed to create icon from canvas:', error)
    // Fallback: just use the existing PNG files
    chrome.action.setIcon({
      path: {
        "16": "logo/logo-16.png",
        "32": "logo/logo-32.png",
        "48": "logo/logo-48.png",
        "128": "logo/logo-128.png"
      }
    })
  }
}
