# 🎬 Axiom Brain Graph Animations - Quick Reference

## TL;DR - Get Started in 2 Minutes

### Step 1: Import the wrapper
```tsx
import { BrainGraphAnimatedWrapper } from "@/components/brain/brain-graph-animated-wrapper";
```

### Step 2: Replace your brain graph
```tsx
// Old
<BrainGraph3D data={graphData} />

// New
<BrainGraphAnimatedWrapper data={graphData} />
```

### Step 3: Add research mode (optional)
```tsx
<BrainGraphAnimatedWrapper
  data={graphData}
  isResearchMode={true}
  evidenceCount={3}
/>
```

That's it! You've got animations. 🎉

---

## Component Cheat Sheet

### BrainGraphAnimatedWrapper
Use this to wrap your brain graph. Automatically handles:
- Container fade-in
- Research mode indicator
- Evidence panel cascades

**Props:**
```tsx
isResearchMode?: boolean      // Show research UI
isExpanding?: boolean         // Trigger expansion rings
evidenceCount?: number        // Show evidence cascade
...brainGraphProps            // All BrainGraph3D props work
```

### AnimatedEvidencePanel
Shows evidence with sliding animations and staggered reveals.

**Props:**
```tsx
items: EvidenceItem[]
isHighlighted?: string | null
onItemClick?: (item: EvidenceItem) => void
onItemHover?: (id: string | null) => void
title?: ReactNode
```

**EvidenceItem structure:**
```tsx
{
  id: string
  source: string
  citation: string
  confidence: number           // 0-1
  excerpt?: string
}
```

### AnimatedResearchModeIndicator
Shows research progress with sub-query cascade.

**Props:**
```tsx
iteration: number     // Current iteration (1, 2, 3...)
maxIterations: number // Total iterations (usually 3)
subQueries: SubQuery[]
isExpanding?: boolean
onSubQueryClick?: (id: string) => void
```

**SubQuery structure:**
```tsx
{
  id: string
  text: string
  status: "pending" | "processing" | "complete"
  confidence?: number  // Added when complete
}
```

---

## Common Patterns

### Pattern 1: Research Mode Start to Finish
```tsx
const [isResearchMode, setIsResearchMode] = useState(false);
const [subQueries, setSubQueries] = useState([]);

const startResearch = async () => {
  setIsResearchMode(true);
  
  // Add initial query
  setSubQueries([{
    id: "1",
    text: "Initial question",
    status: "processing"
  }]);
  
  // Fetch and update
  // ... update status to "complete" when done
};

return (
  <BrainGraphAnimatedWrapper
    data={graphData}
    isResearchMode={isResearchMode}
  />
);
```

### Pattern 2: Evidence on Node Click
```tsx
const handleNodeSelect = (node) => {
  // Fetch evidence for this node
  const evidence = await fetchNodeEvidence(node.id);
  setEvidenceItems(evidence);
};

return (
  <div className="flex gap-5">
    <BrainGraphAnimatedWrapper
      data={graphData}
      onNodeSelect={handleNodeSelect}
    />
    {evidenceItems.length > 0 && (
      <AnimatedEvidencePanel items={evidenceItems} />
    )}
  </div>
);
```

### Pattern 3: Scroll-Based Highlights
```tsx
import { useEvidenceHighlight } from "@/lib/brain-animation-hooks";

const { ref, isVisible } = useEvidenceHighlight("evidence-id");

return (
  <div ref={ref}>
    <AnimatedEvidencePanel
      items={[item]}
      isHighlighted={isVisible ? item.id : null}
    />
  </div>
);
```

---

## Animation Variants Library

All pre-built animations are in `brain-animation-utils.ts`:

| Variant | Use Case |
|---------|----------|
| `evidencePanelVariants` | Evidence item reveals |
| `subQueryVariants` | Sub-query list items |
| `nodeRevealVariants` | Graph node appears |
| `citationHighlightVariants` | Citation selection |
| `expansionRingVariants` | Query expansion |
| `shimmerVariants` | Loading skeletons |

### Using custom variants:
```tsx
import { evidencePanelVariants } from "@/lib/brain-animation-utils";
import { motion } from "motion";

<motion.div
  variants={evidencePanelVariants}
  initial="hidden"
  animate="visible"
/>
```

---

## Custom Hooks

### useEvidenceHighlight
Detects when evidence scrolls into view:
```tsx
const { ref, isVisible } = useEvidenceHighlight("id");
// ref → attach to DOM element
// isVisible → boolean, true when in viewport
```

### useAnimationDebounce
Debounce animation triggers:
```tsx
const debouncedHover = useAnimationDebounce(hoveredId, 150);
// Delays state update by 150ms to prevent animation spam
```

### useNumericAnimation
Smooth number tweens:
```tsx
const animatedScore = useNumericAnimation(0.92, 1000);
// Smoothly counts from current to 0.92 over 1000ms
```

### useResearchExpansion
Track research expansion state:
```tsx
const isExpanding = useResearchExpansion(isActive);
// Returns true when expansion rings should show
```

---

## Timing Values (ms)

- Container fade: **600**
- Evidence cascade base: **150**
- Evidence stagger per item: **80**
- Spring animations: **400**
- Sub-query transitions: **300**
- Progress bar fill: **500**
- Fast transitions: **150**

---

## Performance Tips

✅ **DO:**
- Stagger many items (use `staggerChildren` config)
- Use `AnimatePresence` for proper exit animations
- Memoize components to prevent re-renders
- Throttle scroll events with `useAnimationThrottle`

❌ **DON'T:**
- Animate properties besides `transform` and `opacity`
- Create many simultaneous animations (batch with stagger)
- Forget to cleanup in `useEffect` returns
- Use animations on every state change

---

## Testing with Showcase

Test all animations without real data:
```tsx
import BrainGraphAnimationShowcase from "@/components/brain/brain-graph-animation-showcase";

<BrainGraphAnimationShowcase demoMode={true} data={mockData} />
```

Click buttons to:
- Start research mode
- Trigger query expansion
- Watch cascading animations
- Verify timing and smoothness

---

## Troubleshooting

### Animations not playing?
1. Check `motion` is imported: `import { motion } from "motion"`
2. Verify component is wrapping content in `<motion.div>`
3. Use DevTools to check for CSS conflicts

### Jank or stuttering?
1. Check if animating non-GPU properties (avoid `width`, `height`)
2. Use `useAnimationThrottle` for high-frequency updates
3. Reduce stagger delays to speed up cascades
4. Profile with DevTools Performance tab

### Items not cascading?
1. Verify `staggerChildren` is set in parent variants
2. Check child has proper `variants` prop
3. Ensure `AnimatePresence` wraps exit animations
4. Use `layoutId` for shared layout animations

---

## Dark Mode & Accessibility

### Respect user preferences
```tsx
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// Skip animations if user prefers reduced motion
{!prefersReducedMotion && <AnimatedEvidencePanel ... />}
```

### Mobile optimization
Reduce animations on touch devices:
```tsx
const isTouchDevice = () => !!navigator.maxTouchPoints;

<BrainGraphAnimatedWrapper
  isResearchMode={!isTouchDevice() && isResearchMode}
/>
```

---

## Files Created

| File | Purpose |
|------|---------|
| `animated-evidence-panel.tsx` | Evidence display with cascades |
| `animated-research-mode-indicator.tsx` | Research progress UI |
| `brain-graph-animated-wrapper.tsx` | Main container wrapper |
| `brain-graph-animation-showcase.tsx` | Interactive demo |
| `lib/brain-animation-utils.ts` | Animation variants & configs |
| `lib/brain-animation-hooks.ts` | Custom React hooks |
| `BRAIN_ANIMATIONS.md` | Full component docs |
| `BRAIN_ANIMATION_INTEGRATION.md` | Integration guide |
| `BRAIN_ANIMATION_IMPLEMENTATION.md` | Implementation summary |

---

## Need More Help?

- **Component details** → See `BRAIN_ANIMATIONS.md`
- **Integration patterns** → See `BRAIN_ANIMATION_INTEGRATION.md`
- **Implementation details** → See `BRAIN_ANIMATION_IMPLEMENTATION.md`
- **Live examples** → Run `BrainGraphAnimationShowcase` with `demoMode={true}`
- **Source code** → Check TypeScript comments in component files

---

## What's Next?

1. Test with real data from `/v1/query/rag/stream`
2. Add `prefers-reduced-motion` support
3. Integrate with chat UI for evidence display
4. Add audio sync on key animations
5. Create animation intensity presets (subtle/normal/prominent)

---

**Framer Motion v12.38.0** is already installed. You're good to go! 🚀
