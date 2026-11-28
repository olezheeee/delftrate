"use client";

// The moving background of the home page: the clip from the approved demo, fixed behind
// the page and slightly visible through the calendar.
//
// It is decoration, so it never gets in the way. A still (the clip's first frame) is there
// from the start; the clip itself starts loading only after the page is there, and takes
// the still's place once it plays. The still stays for a visitor who asked for reduced
// motion, for one whose browser refuses to play it (a phone saving power), and for one who
// asked their browser to save data or is on a slow connection, where the browser tells
// (Chrome and Edge do; Safari and Firefox do not).
//
// The clip repeats for as long as the page is open, so a small button in the corner stops
// and restarts it: motion that starts by itself must be stoppable by the visitor.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import still from "./home-background.jpg";
import styles from "./BackgroundVideo.module.css";

// A small copy of the demo's clip (index.html): 1280 by 720, 8 seconds, 2.4 MB, no sound.
// The demo's own file is 16.5 MB at an outside address.
const CLIP = "/home-background.mp4";

export function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  // True once the clip has played; it fades in over the still then. A clip that only has
  // its data, on a browser that refuses to play it, would be a frozen picture instead.
  const [ready, setReady] = useState(false);
  // What the clip is doing right now, as the browser reports it.
  const [playing, setPlaying] = useState(false);
  // The visitor stopped the clip with the button. It then stays stopped until they start
  // it again, whatever else changes.
  const stopped = useRef(false);

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
      if (calm.matches || stopped.current) {
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

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    stopped.current = playing;
    if (playing) video.pause();
    else video.play().catch(() => {});
  };

  return (
    <>
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
          onPlaying={() => {
            setReady(true);
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
        />
      </div>
      {/* Only once the clip has played: there is nothing to stop before that. */}
      {ready && (
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-label={playing ? "Pause the background video" : "Play the background video"}
          title={playing ? "Pause the background video" : "Play the background video"}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            {playing ? <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /> : <path d="M3 1.2v9.6L10.5 6z" />}
          </svg>
        </button>
      )}
    </>
  );
}
