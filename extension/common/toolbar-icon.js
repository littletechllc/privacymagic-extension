/* global chrome, OffscreenCanvas, btoa */

export const generateToolbarIcon = async (emoji) => {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');

  try {
    // Draw emoji to fill canvas boundaries
    const canvasSize = 128;

    // Set background color
    ctx.fillStyle = 'rgb(255, 255, 255, 0)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate font size to fill the canvas
    let fontSize = canvasSize;
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(emoji);
    const textHeight = metrics.actualBoundingBoxDescent + metrics.actualBoundingBoxAscent;
    fontSize = fontSize * canvasSize / textHeight;
    ctx.font = `${fontSize}px serif`;

    // Draw the emoji
    ctx.fillStyle = '#ffffff';
    ctx.fillText(emoji, canvasSize / 2, canvasSize / 2 - metrics.actualBoundingBoxDescent / 2 + metrics.actualBoundingBoxAscent / 2);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode.apply(null, uint8Array));
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Failed to create icon from canvas:', error);
  }
};

export const setToolbarIcon = async (emoji) => {
  const dataURL = await generateToolbarIcon(emoji);
  chrome.action.setIcon({ path: dataURL });
};
