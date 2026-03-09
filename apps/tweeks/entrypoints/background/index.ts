export default defineBackground(() => {
  chrome.action.onClicked.addListener((_tab) => {
    // Popup is configured in manifest, this is a fallback
  })
})
