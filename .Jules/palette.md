## 2024-06-28 - Dynamic Log Region Accessibility
**Learning:** Dynamic log regions updated via JS (like game logs) need `role="log"` and `aria-live` for screen readers to announce new content, otherwise the updates are invisible to non-sighted users.
**Action:** Always check if dynamically updating text containers have appropriate ARIA live region attributes.
