'use client';
import { useState, useRef, useEffect } from "react";

interface PhotoStripProps {
    stripDataUrl: string;
    trigger: boolean;
    onComplete?: () => void;
}

export default function PhotoStrip({
    stripDataUrl,
    trigger,
    onComplete,
}: PhotoStripProps) {
    const [stripHeight, setStripHeight] = useState(470);
    const stripRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (stripRef.current) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.contentRect.height > 0) {
                        setStripHeight(entry.contentRect.height);
                    }
                }
            });
            observer.observe(stripRef.current);
            return () => observer.disconnect();
        }
    }, [stripDataUrl]);

    function handleAnimationEnd(e: React.AnimationEvent) {
        if ((e.target as HTMLElement).classList.contains("strip__drop-stage")) {
            onComplete?.();
        }
    }

    // Mask must be exactly as tall as the strip (or taller) so it starts completely hidden above.
    const feedDistance = stripHeight + 20;

    return (
        <div className="strip-wrap" style={{ 
            '--feed-distance': `-${feedDistance}px`,
            '--strip-height': `${stripHeight}px`,
        } as React.CSSProperties}>
            {/* printer slot, fixed at top */}
            <div className="strip-slot" />

            <div className="strip__mask">
                <div
                    className={`strip__feed ${trigger ? "strip__feed--play" : ""}`}
                    onAnimationEnd={handleAnimationEnd}
                >
                    <div className={`strip__drop-stage ${trigger ? "strip__drop-stage--play" : ""}`}>
                        <img 
                            ref={stripRef}
                            src={stripDataUrl} 
                            alt="Printed Photo Strip"
                            className="strip-image"
                        />
                    </div>
                </div>
            </div>

            <style>{`
                .strip-wrap {
                    position: relative;
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: center;
                    /* Ensure container height is big enough to show the dropped strip + some bounce */
                    height: calc(var(--strip-height) + 40px);
                    transition: height 0.3s;
                }

                .strip-slot {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% + 20px);
                    max-width: 420px;
                    height: 10px;
                    background: #1a1a18;
                    border-radius: 0 0 4px 4px;
                    z-index: 2;
                }

                .strip__mask {
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100%;
                    max-width: 400px;
                    height: calc(var(--strip-height) + 30px);
                    overflow: hidden;
                }

                .strip__feed {
                    transform: translateY(var(--feed-distance));
                }

                .strip__feed--play {
                    animation: feed-down 3.6s cubic-bezier(0.65, 0, 0.35, 1) forwards;
                }

                .strip__drop-stage {
                    transform: translateY(0);
                }

                .strip__drop-stage--play {
                    animation: drop-settle 0.9s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
                    animation-delay: 3.6s;
                }
                
                .strip-image {
                    width: 100%;
                    display: block;
                    filter: sepia(8%) contrast(1.03);
                    box-shadow: 0 24px 80px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.1);
                }

                @keyframes feed-down {
                    0% {
                        transform: translateY(var(--feed-distance));
                    }
                    88% {
                        transform: translateY(-18px);
                    }
                    100% {
                        transform: translateY(0px);
                    }
                }

                @keyframes drop-settle {
                    0% {
                        transform: translateY(0) rotate(0deg);
                    }
                    45% {
                        transform: translateY(22px) rotate(-1deg);
                    }
                    70% {
                        transform: translateY(10px) rotate(0.7deg);
                    }
                    88% {
                        transform: translateY(16px) rotate(-0.2deg);
                    }
                    100% {
                        transform: translateY(14px) rotate(0deg);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .strip__feed--play {
                        animation: none;
                        transform: translateY(0px);
                    }
                    .strip__drop-stage--play {
                        animation: none;
                        transform: translateY(14px);
                    }
                }
            `}</style>
        </div>
    );
}
