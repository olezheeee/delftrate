"use client";

// The moving background of the home page: the clip from the approved demo, fixed behind
// the page and slightly visible through the calendar.
//
// It is decoration, so it never gets in the way. A still (the clip's first frame) is there
// from the start; the clip itself starts loading only after the page is there, and takes
// the still's place once it can play. The still stays for a visitor who asked for reduced
// motion, and for one who asked their browser to save data or is on a slow connection,
// where the browser tells (Chrome and Edge do; Safari and Firefox do not).
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import still from "./home-background.jpg";
import styles from "./BackgroundVideo.module.css";

// A small copy of the demo's clip (index.html): 1280 by 720, 8 seconds, 2.4 MB, no sound.
// The demo's own file is 16.5 MB at an outside address.
const CLIP = "/home-background.mp4";

export function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  // True once the clip has a frame to show; it fades in over the still then.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const network = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (network?.saveData || ["slow-2g", "2g", "3g"].includes(network?.effectiveType ?? "")) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let asked = false;
    const follow = () => {
      // With reduced motion nothing moves: the still stays, or the clip stops where it is.
      if (calm.matches) {
        video.pause();
        return;
      }
      if (!asked) {
        asked = true;
        // React sets `muted` too late for some browsers, and they refuse to play a clip
        // that is not muted.
        video.muted = true;
        video.src = CLIP;
      }
      video.play().catch(() => {});
    };

    // After everything else on the page, so the clip never delays the calendar.
    if (document.readyState === "complete") follow();
    else window.addEventListener("load", follow, { once: true });
    calm.addEventListener("change", follow);
    return () => {
      window.removeEventListener("load", follow);
      calm.removeEventListener("change", follow);
      // Leaving the page stops the download. The clip fades in again when the visitor
      // comes back.
      video.pause();
      video.removeAttribute("src");
      video.load();
      setReady(false);
    };
  }, []);

  return (
    <div className={styles.plate} aria-hidden="true">
      {/* Not lazy: it fills the first view. */}
      <Image src={still} alt="" fill sizes="100vw" loading="eager" className={styles.still} />
      <video
        ref={ref}
        className={styles.clip}
        data-ready={ready ? "" : undefined}
        muted
        loop
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="none"
        tabIndex={-1}
        onLoadedData={() => setReady(true)}
      />
    </div>
  );
}
