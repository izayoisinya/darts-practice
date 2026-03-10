// ===============================
// デバイス判定関数
// ===============================
function detectDevice() {
  
  const body = document.body
  const ua = navigator.userAgent
  
  body.classList.remove(
    "phone", "tablet", "desktop", "portrait", "landscape"
  )
  
  const isPhone =
    /iPhone|Android.*Mobile/i.test(ua)
  
  const isTablet =
    /iPad|Android(?!.*Mobile)/i.test(ua)
  
  if (isPhone) body.classList.add("phone")
  else if (isTablet) body.classList.add("tablet")
  else body.classList.add("desktop")
  
  if (window.innerHeight > window.innerWidth)
    body.classList.add("portrait")
  else
    body.classList.add("landscape")
}

detectDevice()

window.addEventListener("resize", detectDevice)
window.addEventListener("orientationchange", detectDevice)