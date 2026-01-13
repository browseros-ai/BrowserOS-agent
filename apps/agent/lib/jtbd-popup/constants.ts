export const JTBD_POPUP_CONSTANTS = {
  // Show popup after this many messages
  MESSAGE_THRESHOLD: 15,
  // Show to 1 in N users (samplingId % N === 0)
  // Set to 1 to show to everyone
  SAMPLING_DIVISOR: 1,
} as const
