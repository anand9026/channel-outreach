"""Focused Playwright verification for iteration 4 template modal scroll/overflow fixes.

This file mirrors the script executed through the browser automation tool. It verifies:
- mobile 390x844 CTA/top rows stack with no horizontal overflow
- desktop 1440x800 modal body scrolls while header/footer stay pinned and preview is sticky
- tablet 800x700 collapses to single-column with no horizontal overflow
- one optional WhatsApp template submission attempt
"""

import json
import os
import random
import string

BASE_URL = "https://channel-connect-38.preview.emergentagent.com"
RESULT_PATH = "/app/test_reports/iteration4_playwright_raw.json"
SCREENSHOT_DIR = "/app/test_reports/screenshots"


async def run(page):
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    results = {"skill_lookup": "No relevant testing skill found.", "viewports": {}, "optional_submit": {}}

    async def log(msg):
        print(msg)

    async def reset_and_open_modal(width, height):
        await page.set_viewport_size({"width": width, "height": height})
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        skip = page.get_by_test_id("onboarding-skip")
        if await skip.count() > 0 and await skip.first.is_visible():
            await skip.first.click(force=True)
            await page.wait_for_timeout(700)
        cont = page.get_by_test_id("onboarding-continue")
        if await cont.count() > 0 and await cont.first.is_visible():
            await cont.first.click(force=True)
            await page.wait_for_timeout(300)
        await page.get_by_test_id("nav-templates").click(force=True)
        await page.wait_for_selector('[data-testid="new-template"]', state="visible", timeout=15000)
        await page.get_by_test_id("new-template").click(force=True)
        await page.wait_for_selector(".rx-tpl-modal", state="visible", timeout=10000)
        await page.wait_for_timeout(300)

    async def click_testid_with_fallback(testid):
        outcome = {"testid": testid, "playwright_click": True, "fallback_js_click": False, "error": None}
        locator = page.get_by_test_id(testid)
        try:
            await locator.click(force=True, timeout=5000)
        except Exception as exc:
            outcome["playwright_click"] = False
            outcome["error"] = str(exc)[:500]
            await page.locator(f'[data-testid="{testid}"]').evaluate("el => el.click()")
            outcome["fallback_js_click"] = True
        await page.wait_for_timeout(250)
        return outcome

    async def error_text():
        error_text = await page.evaluate("""() => {
            const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
        return error_text

    async def mobile_measure():
        return await page.evaluate("""() => {
            const r = (el) => {
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return {left:b.left, top:b.top, right:b.right, bottom:b.bottom, width:b.width, height:b.height};
            };
            const modal = document.querySelector('.rx-tpl-modal');
            const body = document.querySelector('.rx-tpl-body');
            const cta = document.querySelector('.rx-tpl-cta-row');
            const ctaToggle = document.querySelector('[data-testid="buttons-cta"]');
            const ctaKids = cta ? Array.from(cta.children).slice(0, 3) : [];
            const name = document.querySelector('[data-testid="tpl-name"]');
            const topRow = name ? name.closest('.rx-row') : null;
            const topFields = topRow ? Array.from(topRow.querySelectorAll(':scope > .rx-field')) : [];
            const submit = document.querySelector('[data-testid="tpl-submit"]');
            const beforeScrollTop = body ? body.scrollTop : 0;
            if (body) body.scrollTop = body.scrollHeight;
            const afterScrollTop = body ? body.scrollTop : 0;
            const doc = document.documentElement;
            const modalRect = r(modal);
            const bodyRect = r(body);
            const ctaRect = r(cta);
            const ctaToggleRect = r(ctaToggle);
            const ctaRects = ctaKids.map(r);
            const topRowRect = r(topRow);
            const topFieldRects = topFields.map(r);
            const submitRect = r(submit);
            const ctaStacked = ctaRects.length >= 3 && ctaRects[1].top >= ctaRects[0].bottom - 1 && ctaRects[2].top >= ctaRects[1].bottom - 1;
            const ctaFullWidth = ctaRect && ctaRects.length >= 3 && ctaRects.every(x => x.width >= ctaRect.width - 4);
            const topStacked = topFieldRects.length >= 3 && topFieldRects[1].top >= topFieldRects[0].bottom - 1 && topFieldRects[2].top >= topFieldRects[1].bottom - 1;
            const topFullWidth = topRowRect && topFieldRects.length >= 3 && topFieldRects.every(x => x.width >= topRowRect.width - 4);
            return {
                viewport: {innerWidth: window.innerWidth, innerHeight: window.innerHeight},
                modalRect, bodyRect, ctaRect, ctaToggleRect, ctaRects, topRowRect, topFieldRects, submitRect,
                bodyClientWidth: body ? body.clientWidth : null,
                bodyScrollWidth: body ? body.scrollWidth : null,
                bodyClientHeight: body ? body.clientHeight : null,
                bodyScrollHeight: body ? body.scrollHeight : null,
                bodyScrollTopBefore: beforeScrollTop,
                bodyScrollTopAfter: afterScrollTop,
                docClientWidth: doc.clientWidth,
                docScrollWidth: doc.scrollWidth,
                windowScrollY: window.scrollY,
                modalFitsRight: !!modalRect && modalRect.right <= window.innerWidth + 1 && modalRect.left >= -1,
                bodyNoHorizontalOverflow: !!body && body.scrollWidth <= body.clientWidth + 1,
                documentNoHorizontalOverflow: doc.scrollWidth <= window.innerWidth + 1,
                ctaStacked, ctaFullWidth, topStacked, topFullWidth,
                ctaToggleVisibleInViewport: !!ctaToggleRect && ctaToggleRect.left >= -1 && ctaToggleRect.right <= window.innerWidth + 1 && ctaToggleRect.top >= -1 && ctaToggleRect.bottom <= window.innerHeight + 1,
                bodyCanScrollVertically: !!body && body.scrollHeight > body.clientHeight + 5,
                bodyScrolledToBottom: afterScrollTop > beforeScrollTop,
                submitVisibleAfterScroll: !!submitRect && submitRect.bottom <= window.innerHeight + 1 && submitRect.top >= -1
            };
        }""")

    async def desktop_measure():
        pre = await page.evaluate("""() => {
            const r = (el) => {
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return {left:b.left, top:b.top, right:b.right, bottom:b.bottom, width:b.width, height:b.height};
            };
            const body = document.querySelector('.rx-tpl-body');
            if (body) body.scrollTop = 0;
            const modal = document.querySelector('.rx-tpl-modal');
            const head = document.querySelector('.rx-tpl-modal .rx-modal-head');
            const foot = document.querySelector('.rx-tpl-modal .rx-modal-foot');
            const preview = document.querySelector('.rx-tpl-preview-wrap');
            const form = document.querySelector('.rx-tpl-body > .rx-col');
            return {
                modalRect: r(modal), bodyRect: r(body), headRect: r(head), footRect: r(foot), previewRect: r(preview), formRect: r(form),
                bodyClientHeight: body ? body.clientHeight : null,
                bodyScrollHeight: body ? body.scrollHeight : null,
                bodyScrollTop: body ? body.scrollTop : null,
                bodyClientWidth: body ? body.clientWidth : null,
                bodyScrollWidth: body ? body.scrollWidth : null,
                gridTemplateColumns: body ? getComputedStyle(body).gridTemplateColumns : null,
                previewPosition: preview ? getComputedStyle(preview).position : null,
                windowScrollY: window.scrollY,
                documentScrollHeight: document.documentElement.scrollHeight,
                documentClientHeight: document.documentElement.clientHeight
            };
        }""")
        await page.wait_for_timeout(150)
        post = await page.evaluate("""() => {
            const r = (el) => {
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return {left:b.left, top:b.top, right:b.right, bottom:b.bottom, width:b.width, height:b.height};
            };
            const body = document.querySelector('.rx-tpl-body');
            if (body) body.scrollTop = body.scrollHeight;
            const modal = document.querySelector('.rx-tpl-modal');
            const head = document.querySelector('.rx-tpl-modal .rx-modal-head');
            const foot = document.querySelector('.rx-tpl-modal .rx-modal-foot');
            const preview = document.querySelector('.rx-tpl-preview-wrap');
            const form = document.querySelector('.rx-tpl-body > .rx-col');
            return {
                modalRect: r(modal), bodyRect: r(body), headRect: r(head), footRect: r(foot), previewRect: r(preview), formRect: r(form),
                bodyClientHeight: body ? body.clientHeight : null,
                bodyScrollHeight: body ? body.scrollHeight : null,
                bodyScrollTop: body ? body.scrollTop : null,
                bodyClientWidth: body ? body.clientWidth : null,
                bodyScrollWidth: body ? body.scrollWidth : null,
                gridTemplateColumns: body ? getComputedStyle(body).gridTemplateColumns : null,
                previewPosition: preview ? getComputedStyle(preview).position : null,
                windowScrollY: window.scrollY
            };
        }""")
        body_box = post.get("bodyRect")
        if body_box:
            await page.mouse.move(body_box["left"] + 50, body_box["top"] + 50)
            await page.mouse.wheel(0, 1200)
            await page.wait_for_timeout(150)
        wheel = await page.evaluate("""() => ({windowScrollY: window.scrollY, bodyScrollTop: document.querySelector('.rx-tpl-body')?.scrollTop ?? null})""")
        checks = {
            "bodyCanScrollVertically": post["bodyScrollHeight"] > post["bodyClientHeight"] + 5,
            "bodyScrolled": post["bodyScrollTop"] > pre["bodyScrollTop"],
            "bodyNoHorizontalOverflow": post["bodyScrollWidth"] <= post["bodyClientWidth"] + 1,
            "headPinned": abs(post["headRect"]["top"] - pre["headRect"]["top"]) <= 1 and abs(post["headRect"]["bottom"] - pre["headRect"]["bottom"]) <= 1,
            "footPinned": abs(post["footRect"]["top"] - pre["footRect"]["top"]) <= 1 and abs(post["footRect"]["bottom"] - pre["footRect"]["bottom"]) <= 1,
            "previewSticky": post["previewPosition"] == "sticky" and post["previewRect"]["top"] <= post["bodyRect"]["top"] + 8 and post["previewRect"]["left"] > post["formRect"]["left"] + post["formRect"]["width"],
            "noPageScrollDuringModalBodyScroll": pre["windowScrollY"] == 0 and post["windowScrollY"] == 0 and wheel["windowScrollY"] == 0,
            "documentNotTallerThanViewport": pre["documentScrollHeight"] <= pre["documentClientHeight"] + 1
        }
        return {"pre": pre, "post": post, "wheel": wheel, "checks": checks}

    async def tablet_measure():
        return await page.evaluate("""() => {
            const r = (el) => {
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return {left:b.left, top:b.top, right:b.right, bottom:b.bottom, width:b.width, height:b.height};
            };
            const modal = document.querySelector('.rx-tpl-modal');
            const body = document.querySelector('.rx-tpl-body');
            const preview = document.querySelector('.rx-tpl-preview-wrap');
            const doc = document.documentElement;
            const grid = body ? getComputedStyle(body).gridTemplateColumns : '';
            return {
                viewport: {innerWidth: window.innerWidth, innerHeight: window.innerHeight},
                modalRect: r(modal), bodyRect: r(body), previewRect: r(preview),
                bodyClientWidth: body ? body.clientWidth : null,
                bodyScrollWidth: body ? body.scrollWidth : null,
                docClientWidth: doc.clientWidth,
                docScrollWidth: doc.scrollWidth,
                gridTemplateColumns: grid,
                previewPosition: preview ? getComputedStyle(preview).position : null,
                modalFitsRight: !!modal && r(modal).right <= window.innerWidth + 1 && r(modal).left >= -1,
                bodyNoHorizontalOverflow: !!body && body.scrollWidth <= body.clientWidth + 1,
                documentNoHorizontalOverflow: doc.scrollWidth <= window.innerWidth + 1,
                collapsedSingleColumn: !!grid && grid.trim().split(/\s+/).length === 1,
                previewNotSticky: !!preview && getComputedStyle(preview).position === 'static'
            };
        }""")

    try:
        await log("Test plan: verify CreateTemplateModal scroll/overflow fixes at 390, 800, and 1440 widths using DOM measurements; no relevant testing skill found.")

        # Mobile primary verification
        await reset_and_open_modal(390, 844)
        results["viewports"]["390x844"] = {"clicks": {"buttons-cta": await click_testid_with_fallback("buttons-cta")}}
        await page.wait_for_timeout(500)
        results["viewports"]["390x844"].update(await mobile_measure())
        await error_text()
        await page.screenshot(path=f"{SCREENSHOT_DIR}/iteration4_mobile_390.jpg", quality=40, full_page=False)
        print("Mobile 390x844 measurements:", json.dumps(results["viewports"]["390x844"], indent=2))

        # Desktop primary verification
        await reset_and_open_modal(1440, 800)
        results["viewports"]["1440x800"] = {"clicks": {"header-image": await click_testid_with_fallback("header-image")}}
        await page.wait_for_timeout(200)
        results["viewports"]["1440x800"]["clicks"]["buttons-cta"] = await click_testid_with_fallback("buttons-cta")
        await page.wait_for_timeout(500)
        results["viewports"]["1440x800"].update(await desktop_measure())
        await error_text()
        await page.screenshot(path=f"{SCREENSHOT_DIR}/iteration4_desktop_1440.jpg", quality=40, full_page=False)
        print("Desktop 1440x800 measurements:", json.dumps(results["viewports"]["1440x800"], indent=2))

        # Secondary tablet verification
        await reset_and_open_modal(800, 700)
        results["viewports"]["800x700"] = {"clicks": {"buttons-cta": await click_testid_with_fallback("buttons-cta")}}
        await page.wait_for_timeout(500)
        results["viewports"]["800x700"].update(await tablet_measure())
        await error_text()
        await page.screenshot(path=f"{SCREENSHOT_DIR}/iteration4_tablet_800.jpg", quality=40, full_page=False)
        print("Tablet 800x700 measurements:", json.dumps(results["viewports"]["800x700"], indent=2))

        # Optional happy path: one submission attempt only.
        await reset_and_open_modal(1440, 800)
        suffix = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(5))
        template_name = f"test_scroll_v4_{suffix}"
        results["optional_submit"]["template_name"] = template_name
        await page.get_by_test_id("tpl-name").fill(template_name)
        await click_testid_with_fallback("header-text")
        await page.locator(".rx-tpl-section", has_text="Header").locator("input.rx-input").fill("Hi {1}")
        await page.locator(".rx-tpl-section", has_text="Footer").locator("input.rx-input").fill("Reply STOP")
        await click_testid_with_fallback("buttons-quick_reply")
        await page.locator(".rx-tpl-section", has_text="Buttons").locator("input.rx-input").first.fill("Yes")
        await page.get_by_test_id("tpl-submit").click(force=True)
        try:
            await page.wait_for_selector(".rx-tpl-modal", state="detached", timeout=60000)
            results["optional_submit"].update({"status": "success", "modal_closed": True})
        except Exception as submit_exc:
            err = await error_text()
            still_open = await page.locator(".rx-tpl-modal").count() > 0
            results["optional_submit"].update({"status": "timeout_or_error", "modal_still_open": still_open, "error_text": err, "exception": str(submit_exc)[:500]})
        print("Optional submit result:", json.dumps(results["optional_submit"], indent=2))

    except Exception as exc:
        results["fatal_error"] = str(exc)
        print(f"TEST FAILURE: {exc}")
        raise
    finally:
        with open(RESULT_PATH, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Wrote raw results to {RESULT_PATH}")


# The browser automation tool runs the body of run(page); this file is retained as an artifact.