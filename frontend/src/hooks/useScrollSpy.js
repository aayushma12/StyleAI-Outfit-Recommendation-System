import { useState, useEffect, useRef, useCallback } from 'react';

// Tracks which of several page sections is currently in view (via
// IntersectionObserver) and exposes a scrollTo() helper — previously
// implemented independently, with slightly different tuning, in both
// StyleProfileView.jsx and SettingsView.jsx.
export default function useScrollSpy({
  initialId,
  datasetKey = 'sec',
  threshold = 0.2,
  rootMargin = '-80px 0px -55% 0px',
} = {}) {
  const [active, setActive] = useState(initialId);
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.dataset[datasetKey]); }),
      { threshold, rootMargin }
    );
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refFor = useCallback(id => el => { sectionRefs.current[id] = el; }, []);

  const scrollTo = useCallback(id => {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return { active, setActive, refFor, scrollTo };
}
