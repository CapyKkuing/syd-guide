import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function useTodayMotion(scope: RefObject<HTMLDivElement | null>) {
  useGSAP(() => {
    if (
      import.meta.env.MODE === "test"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    gsap.from("[data-motion-hero]", {
      autoAlpha: 0,
      duration: 0.75,
      ease: "power3.out",
      y: 28
    });

    gsap.utils.toArray<HTMLElement>("[data-motion-scrub]").forEach((heading) => {
      gsap.fromTo(
        heading,
        { autoAlpha: 0.45, yPercent: 28 },
        {
          autoAlpha: 1,
          ease: "none",
          scrollTrigger: {
            end: "top 42%",
            scrub: 0.5,
            start: "top 88%",
            trigger: heading
          },
          yPercent: 0
        }
      );
    });

    gsap.utils.toArray<HTMLElement>("[data-motion-stack]").forEach((card, index) => {
      gsap.from(card, {
        duration: 0.55,
        ease: "power2.out",
        scale: 0.985,
        scrollTrigger: {
          start: "top 90%",
          toggleActions: "play none none reverse",
          trigger: card
        },
        y: 20 + Math.min(index, 3) * 6
      });
    });
  }, { scope });
}
