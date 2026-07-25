"""
Focused Playwright verification notes for the reported template-creation scroll bug.

Executed through mcp_browser_automation against http://localhost:3000/messages:
- Desktop 1440x800: open Messages > New template, expand Header=Image and Buttons=CTA,
  confirm modal body scrolls, header/footer stay pinned, sticky preview remains visible,
  and overscroll does not move window.scrollY.
- Responsive 800x700: confirm modal grid collapses to one column, modal body scrolls,
  Template name and Buttons section are both reachable by scrolling the modal body.
- Mobile 390x844: confirm remaining horizontal overflow in the modal.
- Happy-path submit attempted once with name test_scroll_check_<timestamp>, Header=Text,
  Footer, Buttons=Quick replies; no POST response was observed within 45 seconds.

Key failing metrics captured:
MOBILE_390_METRICS = {
  "modal": {"left": 20, "right": 394.390625, "width": 374.390625},
  "bodyScroll": {"width": 443, "clientWidth": 374},
  "doc": {"scrollWidth": 753, "clientWidth": 390},
  "ctaGrid": "140px 87.7656px 87.7656px 25px"
}
"""
