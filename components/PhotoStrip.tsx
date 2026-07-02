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
    const [phase, setPhase] = useState<'hidden' | 'feeding' | 'settling' | 'done'>('hidden');

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

    // Drive animation phases with timeouts instead of CSS keyframes
    useEffect(() => {
        if (!trigger) return;
        setPhase('feeding');
        const feedTimer = setTimeout(() => setPhase('settling'), 3600);
        const settleTimer = setTimeout(() => {
            setPhase('done');
            onComplete?.();
        }, 4500);
        return () => { clearTimeout(feedTimer); clearTimeout(settleTimer); };
    }, [trigger, onComplete]);

    const feedDistance = stripHeight + 20;

    // Compute transform based on phase
    let feedTransform = `translateY(-${feedDistance}px)`;
    let dropTransform = 'translateY(0) rotate(0deg)';
    let transition = '';

    if (phase === 'feeding') {
        feedTransform = 'translateY(0px)';
        transition = 'transform 3.6s cubic-bezier(0.65, 0, 0.35, 1)';
    } else if (phase === 'settling' || phase === 'done') {
        feedTransform = 'translateY(0px)';
        dropTransform = 'translateY(14px) rotate(0deg)';
        transition = phase === 'settling' ? 'transform 0.9s cubic-bezier(0.34, 1.4, 0.64, 1)' : '';
    }

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 400,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            height: stripHeight + 40,
            transition: 'height 0.3s',
        }}>
            {/* Printer slot */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% + 20px)',
                maxWidth: 420,
                height: 10,
                background: '#1a1a18',
                borderRadius: '0 0 4px 4px',
                zIndex: 2,
            }} />

            {/* Mask */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: 400,
                height: stripHeight + 30,
                overflow: 'hidden',
            }}>
                {/* Feed container */}
                <div style={{
                    transform: feedTransform,
                    transition: transition,
                }}>
                    {/* Drop stage */}
                    <div style={{
                        transform: dropTransform,
                        transition: phase === 'settling' ? 'transform 0.9s cubic-bezier(0.34, 1.4, 0.64, 1)' : 'none',
                    }}>
                        <img
                            ref={stripRef}
                            src={stripDataUrl}
                            alt="Printed Photo Strip"
                            style={{
                                width: '100%',
                                display: 'block',
                                filter: 'sepia(8%) contrast(1.03)',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.1)',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
