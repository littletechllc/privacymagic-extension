console.log("hello")
setTimeout(() => {
  const video = document.getElementsByClassName("html5-main-video")[0]
  if (video) {
    video.addEventListener("progress", () => {
      console.log("progress event")
      const videoContainer = document.getElementById("movie_player")
      const isAd = videoContainer?.classList.contains("ad-interrupting") ||
                   videoContainer?.classList.contains("ad-showing")
      if (isAd) {
        video.muted = true
        video.currentTime = video.duration - 0.1;
        console.log("skipped an ad")
      }
    })
  }
}, 100)