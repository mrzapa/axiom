# Axiom Brain Graph Animation Integration Guide

## Quick Start

### 1. Install Dependencies
Framer Motion is already installed as `motion` in `axiom-web/package.json`:
```json
"motion": "^12.38.0"
```

### 2. Replace Brain Graph Usage
Update your brain graph component imports:

**Before:**
```tsx
import BrainGraph3D from "@/components/brain/brain-graph-3d";

<BrainGraph3D
  data={graphData}
  selectedNodeId={selectedId}
  onSelectedNodeIdChange={setSelectedId}
/>
```

**After:**
```tsx
import { BrainGraphAnimatedWrapper } from "@/components/brain/brain-graph-animated-wrapper";

<BrainGraphAnimatedWrapper
  data={graphData}
  selectedNodeId={selectedId}
  onSelectedNodeIdChange={setSelectedId}
  isResearchMode={isResearchMode}
  isExpanding={isQueryExpanding}
  evidenceCount={evidenceItems.length}
/>
```

## Integration Patterns

### Pattern 1: Research Mode with Evidence
Shows animated evidence panels alongside the brain graph during research queries.

```tsx
"use client";

import { useState } from "react";
import { BrainGraphAnimatedWrapper } from "@/components/brain/brain-graph-animated-wrapper";
import { AnimatedEvidencePanel } from "@/components/brain/animated-evidence-panel";
import { AnimatedResearchModeIndicator } from "@/components/brain/animated-research-mode-indicator";
import type { EvidenceItem, SubQuery } from "@/components/brain/animated-evidence-panel";

export function ResearchModeView() {
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [subQueries, setSubQueries] = useState<SubQuery[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [iteration, setIteration] = useState(0);

  const handleStartResearch = async () => {
    setIsResearchMode(true);
    setIteration(0);

    // Fetch initial query results
    const response = await fetch("/api/v1/query/rag/stream", {
      method: "POST",
      body: JSON.stringify({
        question: "Your research question",
        agentic_mode: true,
      }),
    });

    // Process streaming results and update state
    const reader = response.body?.getReader();
    // ... stream handling logic
  };

  return (
    <div className="relative h-full w-full">
      <BrainGraphAnimatedWrapper
        data={graphData}
        isResearchMode={isResearchMode}
        evidenceCount={evidenceItems.length}
      />

      {isResearchMode && (
        <>
          <div className="absolute left-5 top-20">
            <AnimatedResearchModeIndicator
              iteration={iteration}
              maxIterations={3}
              subQueries={subQueries}
            />
          </div>

          <div className="absolute bottom-5 right-5">
            <AnimatedEvidencePanel
              items={evidenceItems}
              title="Research Results"
            />
          </div>
        </>
      )}
    </div>
  );
}
```

### Pattern 2: Evidence Highlighting on Node Selection
Highlight relevant evidence when a node is selected in the brain graph.

```tsx
"use client";

import { useState, useCallback } from "react";
import { BrainGraphAnimatedWrapper } from "@/components/brain/brain-graph-animated-wrapper";
import { AnimatedEvidencePanel } from "@/components/brain/animated-evidence-panel";
import type { BrainNode } from "@/components/brain/brain-graph";

export function SelectionEvidenceView() {
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [evidenceForNode, setEvidenceForNode] = useState([]);

  const handleNodeSelect = useCallback(async (node: BrainNode | null) => {
    setSelectedNode(node);

    if (node) {
      // Fetch evidence related to this node
      const response = await fetch(`/api/v1/evidence?nodeId=${node.id}`);
      const evidence = await response.json();
      setEvidenceForNode(evidence);
    } else {
      setEvidenceForNode([]);
    }
  }, []);

  return (
    <div className="relative h-full w-full flex gap-5 p-5">
      <div className="flex-1">
        <BrainGraphAnimatedWrapper
          data={graphData}
          onNodeSelect={handleNodeSelect}
        />
      </div>

      {selectedNode && evidenceForNode.length > 0 && (
        <div className="w-96">
          <AnimatedEvidencePanel
            items={evidenceForNode}
            title={`Evidence: ${selectedNode.label}`}
          />
        </div>
      )}
    </div>
  );
}
```

### Pattern 3: Scroll-based Evidence Reveal
Use intersection observer and animation hooks for scroll-triggered reveals.

```tsx
"use client";

import { useEvidenceHighlight } from "@/lib/brain-animation-hooks";
import { AnimatedEvidencePanel } from "@/components/brain/animated-evidence-panel";
import type { EvidenceItem } from "@/components/brain/animated-evidence-panel";

export function ScrollEvidenceView() {
  const items: EvidenceItem[] = [
    // ... evidence items
  ];

  const evidenceRefs = items.map((item) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { ref, isVisible } = useEvidenceHighlight(item.id);
    return { ref, isVisible };
  });

  return (
    <div className="space-y-8 overflow-y-auto">
      {items.map((item, idx) => (
        <div key={item.id} ref={evidenceRefs[idx].ref}>
          <AnimatedEvidencePanel
            items={[item]}
            isHighlighted={evidenceRefs[idx].isVisible ? item.id : null}
          />
        </div>
      ))}
    </div>
  );
}
```

## Customization

### Adjusting Animation Timing
All animations use Framer Motion's `transition` prop. Customize by creating new variant definitions:

```tsx
// In brain-animation-utils.ts
export const customEvidencePanelVariants = {
  hidden: {
    opacity: 0,
    y: 20, // Increase distance for bigger slide
    scale: 0.9, // Different start scale
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 80, // Slower spring
      damping: 20,
    },
  },
};
```

### Reduce Motion for Accessibility
Wrap components with reduced-motion detection:

```tsx
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

<BrainGraphAnimatedWrapper
  {...props}
  // Disable animations if user prefers reduced motion
/>
```

### Mobile Optimizations
Disable certain animations on touch devices to prevent jank:

```tsx
const isTouchDevice = () =>
  !!(
    navigator.maxTouchPoints ||
    navigator.msMaxTouchPoints
  );

// Conditionally pass animations
<BrainGraphAnimatedWrapper
  isResearchMode={!isTouchDevice() && isResearchMode}
  {...props}
/>
```

## Performance Tips

1. **Use AnimatePresence** - Ensures animations complete before unmounting
2. **Stagger children** - Reduces animation load by spreading over time
3. **Memoize components** - Prevent unnecessary re-renders
4. **Throttle scroll events** - Use `useAnimationThrottle` hook
5. **GPU-accelerated properties** - Stick to `transform` and `opacity`

## Debugging

### Check animation timing
```tsx
// Add to your component
useEffect(() => {
  console.log("Animation started", {
    isResearchMode,
    isExpanding,
    evidenceCount,
  });
}, [isResearchMode, isExpanding, evidenceCount]);
```

### Visualize stagger patterns
```tsx
// Temporarily increase delays to see cascade
const staggerConfig = {
  evidence: {
    delayChildren: 0.5, // Increased from 0.15
    staggerChildren: 0.2, // Increased from 0.08
  },
};
```

### Test reduced motion
```bash
# In DevTools Console
matchMedia("(prefers-reduced-motion: reduce)").matches = true;
```

## Files Created

| File | Purpose |
|------|---------|
| `brain-graph-animated-wrapper.tsx` | Main wrapper with container animations |
| `animated-evidence-panel.tsx` | Evidence items with cascade animations |
| `animated-research-mode-indicator.tsx` | Research progress and sub-query display |
| `brain-graph-animation-showcase.tsx` | Interactive demo and testing |
| `lib/brain-animation-utils.ts` | Reusable animation variants and transitions |
| `lib/brain-animation-hooks.ts` | Custom React hooks for animations |
| `BRAIN_ANIMATIONS.md` | Component documentation |

## Next Steps

1. **Test in different browser contexts** - Verify performance on Firefox, Safari, mobile
2. **Add prefers-reduced-motion support** - Accessibility is important
3. **Integrate with streaming API** - Connect to `/v1/query/rag/stream` for live updates
4. **Add audio feedback** - Sync with key animation milestones
5. **Create animation presets** - Allow users to choose animation intensity

## Questions?

Refer to [BRAIN_ANIMATIONS.md](./BRAIN_ANIMATIONS.md) for detailed component APIs and properties, or check [brain-animation-showcase.tsx](./brain-graph-animation-showcase.tsx) for live examples.
