#!/usr/bin/env python3
"""
Bark notification for Echoes CI/CD.

Supported trigger sources:
1) push in Echoes repo: detect markdown changes via git diff
2) repository_dispatch from blog repo: read changed files from payload env

This script is intentionally implemented for a single-level category layout:
  content/blog/<CATEGORY>/<POST>.md(x)
or
  src/content/blog/<CATEGORY>/<POST>.md(x)
"""

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

import yaml


ZERO_SHA = "0" * 40
MARKDOWN_RE = re.compile(r"\.(md|mdx)$", re.IGNORECASE)
CONTENT_ROOTS = ("src/content/blog", "content/blog")


# ==================== Config Helpers ====================


def load_config(filepath):
    with open(filepath, "r", encoding="utf-8") as file:
        loaded = yaml.safe_load(file)

    if not isinstance(loaded, dict):
        raise ValueError("site.config.yaml root must be an object")

    return loaded


def require_config_path(config, *keys):
    current = config
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            raise KeyError(".".join(keys))
        current = current[key]
    return current


# ==================== Path Helpers ====================


def normalize_path(filepath):
    path = str(filepath).replace("\\", "/").strip()
    while path.startswith("./"):
        path = path[2:]
    return path


def unique_keep_order(items):
    return list(dict.fromkeys(items))


def filter_markdown_files(files):
    filtered = []
    for filepath in files:
        normalized = normalize_path(filepath)
        if normalized and MARKDOWN_RE.search(normalized):
            filtered.append(normalized)
    return unique_keep_order(filtered)


def parse_json_list_env(name):
    raw = os.environ.get(name, "").strip()
    if not raw or raw.lower() == "null":
        return []

    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        print(f"⚠️ Invalid JSON in {name}, ignored.")
        return []

    if not isinstance(value, list):
        return []

    str_items = [item for item in value if isinstance(item, str)]
    return filter_markdown_files(str_items)


def strip_content_root(filepath):
    normalized = normalize_path(filepath)
    for root in CONTENT_ROOTS:
        prefix = f"{root}/"
        if normalized.startswith(prefix):
            return normalized[len(prefix):]
        if normalized == root:
            return ""
    return normalized


def parse_single_level_article(filepath):
    """
    Return (category, slug) only when path strictly matches:
    <root>/<category>/<filename>.md(x)
    """
    relative = strip_content_root(filepath)
    if not relative:
        return None

    parts = [part for part in relative.split("/") if part]
    if len(parts) != 2:
        return None

    category, filename = parts
    if not category or not filename:
        return None
    if not MARKDOWN_RE.search(filename):
        return None

    slug = re.sub(r"\.(md|mdx)$", "", filename, flags=re.IGNORECASE)
    if not slug:
        return None

    return category, slug


def get_post_title(filepath):
    parsed = parse_single_level_article(filepath)
    if parsed:
        return parsed[1]

    basename = os.path.basename(normalize_path(filepath))
    return re.sub(r"\.(md|mdx)$", "", basename, flags=re.IGNORECASE)


def get_post_url(filepath, site_url):
    parsed = parse_single_level_article(filepath)
    if not parsed:
        return f"{site_url}/"

    category, slug = parsed
    encoded_category = urllib.parse.quote(category, safe="")
    encoded_slug = urllib.parse.quote(slug, safe="")
    return f"{site_url}/posts/{encoded_category}/{encoded_slug}/"


def validate_single_level_files(files):
    valid = []
    invalid = []
    for filepath in files:
        if parse_single_level_article(filepath):
            valid.append(filepath)
        else:
            invalid.append(filepath)
    return unique_keep_order(valid), unique_keep_order(invalid)


# ==================== Git Helpers ====================


def run_git_get_lines(args):
    result = subprocess.run(
        ["git", "-c", "core.quotePath=false", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip().splitlines()


def git_diff_files(diff_filter, before, after, content_dir):
    lines = run_git_get_lines(
        [
            "diff",
            "--name-only",
            f"--diff-filter={diff_filter}",
            before,
            after,
            "--",
            content_dir,
        ]
    )
    return filter_markdown_files(lines)


def get_all_content_files(sha, content_dir):
    lines = run_git_get_lines(
        ["ls-tree", "-r", "--name-only", sha, "--", content_dir]
    )
    return filter_markdown_files(lines)


def resolve_changes_from_push(before_sha, after_sha, content_dir):
    if before_sha == ZERO_SHA or not before_sha:
        added = get_all_content_files(after_sha, content_dir)
        modified = []
    else:
        added = git_diff_files("A", before_sha, after_sha, content_dir)
        modified = git_diff_files("M", before_sha, after_sha, content_dir)

    all_changed = unique_keep_order(added + modified)
    return added, modified, all_changed


def resolve_changes_from_dispatch():
    changed = parse_json_list_env("DISPATCH_CHANGED_FILES")
    added = parse_json_list_env("DISPATCH_ADDED_FILES")
    modified = parse_json_list_env("DISPATCH_MODIFIED_FILES")

    if not changed:
        changed = unique_keep_order(added + modified)

    # 兼容只上报 changed_files 的场景
    if changed and not added and not modified:
        added = changed.copy()

    return added, modified, unique_keep_order(changed)


# ==================== Bark Helpers ====================


def build_message(templates, site_url, added, modified, all_changed):
    total = len(all_changed)
    click_url = ""

    if total == 0:
        tpl = templates["deployOnly"]
        title = tpl["title"]
        body = tpl["body"]
    elif total == 1:
        tpl = templates["singlePublish"]
        post_title = get_post_title(all_changed[0])
        post_url = get_post_url(all_changed[0], site_url)
        title = tpl["title"].replace("{postTitle}", post_title)
        body = tpl["body"].replace("{postTitle}", post_title).replace(
            "{postUrl}", post_url
        )
        click_url = post_url
    else:
        tpl = templates["batchPublish"]
        file_list = "\n".join(f"• {get_post_title(path)}" for path in all_changed)
        title = tpl["title"].replace("{count}", str(total))
        body = (
            tpl["body"]
            .replace("{added}", str(len(added)))
            .replace("{modified}", str(len(modified)))
            .replace("{fileList}", file_list)
        )

    return title, body, click_url


def send_bark(bark_key, icon_url, title, body, click_url):
    payload = {"title": title, "body": body, "icon": icon_url}
    if click_url:
        payload["url"] = click_url

    if os.environ.get("NOTIFY_DRY_RUN", "").lower() in {"1", "true", "yes"}:
        print("DRY RUN: skip Bark API call")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.day.app/{bark_key}",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        print(f"✅ HTTP {response.status}")


# ==================== Main ====================


def main():
    try:
        config = load_config("src/config/site.config.yaml")
        site_url = require_config_path(config, "site", "url").rstrip("/")
        bark_cfg = require_config_path(config, "ops", "bark")
        templates = require_config_path(bark_cfg, "templates")
    except Exception as err:
        print(f"❌ Invalid site.config.yaml: {err}")
        sys.exit(1)

    bark_key = os.environ.get("BARK_KEY", "")
    if not bark_key:
        print("⚠️ BARK_KEY not set, skipping notification.")
        sys.exit(0)

    icon_url = bark_cfg.get("iconUrl", "")
    content_dir = "src/content/blog"
    event_name = os.environ.get("EVENT_NAME", "push")

    if event_name == "repository_dispatch":
        source_repo = os.environ.get("DISPATCH_SOURCE_REPO", "")
        source_ref = os.environ.get("DISPATCH_SOURCE_REF", "")
        source_sha = os.environ.get("DISPATCH_SOURCE_SHA", "")
        event_id = os.environ.get("DISPATCH_EVENT_ID", "")
        print(
            f"Event: repository_dispatch, source={source_repo}, "
            f"ref={source_ref}, sha={source_sha[:8]}, event_id={event_id}"
        )
        added, modified, all_changed = resolve_changes_from_dispatch()
    elif event_name == "push":
        before_sha = os.environ.get("BEFORE_SHA", "")
        after_sha = os.environ.get("AFTER_SHA", "HEAD")
        print(f"Event: push, comparing {before_sha[:8]}..{after_sha[:8]}")
        added, modified, all_changed = resolve_changes_from_push(
            before_sha, after_sha, content_dir
        )
    else:
        print(f"Event: {event_name}, fallback to deployOnly notification.")
        added, modified, all_changed = [], [], []

    valid_added, invalid_added = validate_single_level_files(added)
    valid_modified, invalid_modified = validate_single_level_files(modified)
    valid_changed, invalid_changed = validate_single_level_files(all_changed)

    if valid_changed and not valid_added and not valid_modified:
        # dispatch 仅传 changed_files 时，默认按新增计数
        valid_added = valid_changed.copy()

    invalid_files = unique_keep_order(invalid_added + invalid_modified + invalid_changed)
    if invalid_files:
        print("⚠️ Ignored non-single-level files:")
        for path in invalid_files:
            print(f"  - {path}")

    print(
        "Valid single-level changes -> "
        f"added: {len(valid_added)}, modified: {len(valid_modified)}, "
        f"total: {len(valid_changed)}"
    )

    title, body, click_url = build_message(
        templates, site_url, valid_added, valid_modified, valid_changed
    )

    print(f"\n📌 Title: {title}")
    print(f"📝 Body:\n{body}")
    if click_url:
        print(f"🔗 URL: {click_url}")
    print("\nSending Bark notification...")

    try:
        send_bark(bark_key, icon_url, title, body, click_url)
    except Exception as err:
        print(f"❌ Notification failed: {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
