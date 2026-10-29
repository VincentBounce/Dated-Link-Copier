#!/usr/bin/env python3
"""Builds shortcut/Clean Link.shortcut: Get Clipboard, run shortcut/clean-link.js in a data: page, Set Clipboard.

TRACKING and readableLinks() are copied from background.js, so the shortcut cleans with the extension's own list.
Usage: python3 tools/make_shortcut.py [--js out.js]   (--js: also writes the assembled script, for testing)
The file is signed with `shortcuts sign` (macOS, signed in to iCloud) so it opens on iPhone and Mac.
"""
import os, plistlib, re, subprocess, sys, tempfile, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shortcut", "Clean Link.shortcut")


def script():
    background = open(os.path.join(ROOT, "background.js")).read()
    tracking = re.search(r"const tracking = (/.*/);\n", background).group(1)
    readable = re.search(r"\n(// Links as the address bar.*?\nfunction readableLinks\(.*?\n}\n)", background, re.S).group(1)
    js = open(os.path.join(ROOT, "shortcut", "clean-link.js")).read()
    return js.replace("/*TRACKING*/", tracking).replace("/*READABLE_LINKS*/\n", readable)


def output(action, name):
    return {"OutputUUID": action["WFWorkflowActionParameters"]["UUID"], "Type": "ActionOutput", "OutputName": name}


def attachment(action, name):
    return {"Value": output(action, name), "WFSerializationType": "WFTextTokenAttachment"}


def text_with(before, action, name, after=""):
    """Text where the output of `action` is inserted between `before` and `after`."""
    return {"Value": {"string": before + "￼" + after,
                      "attachmentsByRange": {f"{{{len(before.encode('utf-16-le')) // 2}, 1}}": output(action, name)}},
            "WFSerializationType": "WFTextTokenString"}


def act(identifier, **params):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions." + identifier,
            "WFWorkflowActionParameters": {"UUID": str(uuid.uuid4()).upper(), **params}}


def workflow():
    # The clipboard goes into the page as base64 (no quoting issue), and the page itself as a base64 data: URL
    # (no "#" or "%" issue); the page writes the cleaned text, read back as text. Get Contents of Web Page
    # needs its URL as a text token (as in Detrackor): given as a plain attachment, it returns nothing
    clip = act("getclipboard")
    # As text first: a link copied on iOS is a URL item, which Base64 Encode would download (the page's HTML)
    clip_text = act("gettext", WFTextActionText=text_with("", clip, "Clipboard"))
    clip64 = act("base64encode", WFInput=attachment(clip_text, "Text"), WFEncodeMode="Encode", WFBase64LineBreakMode="None")
    page = act("gettext", WFTextActionText=text_with(
        '<!doctype html><meta charset="utf-8"><pre id="out"></pre><script>\n' + script()
        + '\nconst clip = new TextDecoder().decode(Uint8Array.from(atob("', clip64, "Base64 Encoded",
        '"), c => c.charCodeAt(0)));\ndocument.getElementById("out").textContent = cleanText(clip);\n</script>'))
    page64 = act("base64encode", WFInput=attachment(page, "Text"), WFEncodeMode="Encode", WFBase64LineBreakMode="None")
    url = act("url", WFURLActionURL=text_with("data:text/html;charset=utf-8;base64,", page64, "Base64 Encoded"))
    contents = act("getwebpagecontents", WFInput=text_with("", url, "URL"))
    text = act("detect.text", WFInput=attachment(contents, "Contents of Web Page"))
    # The page's text ends with a line break
    cleaned = act("text.replace", WFInput=text_with("", text, "Text"), WFReplaceTextFind=r"^\s+|\s+$",
                  WFReplaceTextReplace="", WFReplaceTextRegularExpression=True)
    setclip = act("setclipboard", WFInput=attachment(cleaned, "Updated Text"))
    notify = act("notification", WFNotificationActionTitle="Link cleaned",
                 WFNotificationActionBody=text_with("", cleaned, "Updated Text"), WFNotificationActionSound=False)
    return {
        "WFWorkflowActions": [clip, clip_text, clip64, page, page64, url, contents, text, cleaned, setclip, notify],
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 463140863, "WFWorkflowIconGlyphNumber": 59761},
        "WFWorkflowImportQuestions": [],
        "WFWorkflowTypes": [],
        "WFWorkflowInputContentItemClasses": ["WFStringContentItem", "WFURLContentItem"],
        "WFWorkflowOutputContentItemClasses": [],
        "WFQuickActionSurfaces": [],
        "WFWorkflowHasShortcutInputVariables": False,
    }


if __name__ == "__main__":
    if "--js" in sys.argv:
        open(sys.argv[sys.argv.index("--js") + 1], "w").write(script())
    with tempfile.TemporaryDirectory() as tmp:
        unsigned = os.path.join(tmp, "Clean Link.shortcut")
        plistlib.dump(workflow(), open(unsigned, "wb"), fmt=plistlib.FMT_BINARY)
        subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", OUT], check=True)
    print(OUT)
