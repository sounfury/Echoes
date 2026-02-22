#!/usr/bin/env python3
"""
Bark notification for Echoes CI/CD.

Rules:
1) push in Echoes repo: only send deploy success notification.
2) repository_dispatch from blog repo:
   - exactly one changed article and it is newly published -> single publish template
   - all other changed scenarios -> batch publish template

Path rule:
- only the first path segment is treated as category
- deeper segments are preserved in URL path, but not treated as category levels
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import OrderedDict

import yaml


MARKDOWN_RE = re.compile(r"\.(md|mdx)$", re.IGNORECASE)
CONTENT_ROOTS = ("src/content/blog", "content/blog")


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


def normalize_path(filepath):
    path = str(filepath).replace("\\", "/").strip()
    while path.startswith("./"):
        path = path[2:]
    return path


def unique_keep_order(items):
    return list(OrderedDict.fromkeys(items))


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


def parse_article_path(filepath):
    """
    Accept:
      <category>/<...>/<post>.md(x)
    Category is always the first segment.
    """
    relative = strip_content_root(filepath)
    if not relative:
        return None

    parts = [part for part in relative.split("/") if part]
    if len(parts) < 2:
        return None

    filename = parts[-1]
    if not MARKDOWN_RE.search(filename):
        return None

    slug = re.sub(r"\.(md|mdx)$", "", filename, flags=re.IGNORECASE)
    if not slug:
        return None

    route_parts = [*parts[:-1], slug]
    category = parts[0]
    return category, route_parts


def get_article_key(filepath):
    parsed = parse_article_path(filepath)
    if not parsed:
        return None
    _, route_parts = parsed
    return "/".join(route_parts)


def build_valid_article_map(files):
    valid = OrderedDict()
    invalid = []

    for filepath in files:
        key = get_article_key(filepath)
        if not key:
            invalid.append(normalize_path(filepath))
            continue
        if key not in valid:
            valid[key] = normalize_path(filepath)

    return valid, unique_keep_order(invalid)


def get_post_title(filepath):
    parsed = parse_article_path(filepath)
    if parsed:
        _, route_parts = parsed
        return route_parts[-1]

    basename = os.path.basename(normalize_path(filepath))
    return re.sub(r"\.(md|mdx)$", "", basename, flags=re.IGNORECASE)


def get_post_url(filepath, site_url):
    parsed = parse_article_path(filepath)
    if not parsed:
        return f"{site_url}/"

    _, route_parts = parsed
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in route_parts)
    return f"{site_url}/posts/{encoded_path}/"


def build_message(templates, site_url, mode, single_file):
    # 优先使用模板中配置的 url，脚本动态生成的可覆盖它
    def tpl_url(tpl):
        return tpl.get("url", "")

    if mode == "deployFail":
        tpl = templates["deployFail"]
        return tpl["title"], tpl["body"], tpl_url(tpl)

    if mode == "single":
        tpl = templates["singlePublish"]
        post_title = get_post_title(single_file)
        post_url = get_post_url(single_file, site_url)
        title = tpl["title"].replace("{postTitle}", post_title).replace(
            "{postUrl}", post_url
        )
        body = tpl["body"].replace("{postTitle}", post_title).replace("{postUrl}", post_url)
        # 动态生成的文章 url 优先，其次读模板配置
        click_url = post_url or tpl_url(tpl)
        return title, body, click_url

    if mode == "batch":
        tpl = templates["batchPublish"]
        return tpl["title"], tpl["body"], tpl_url(tpl)

    tpl = templates["deployOnly"]
    return tpl["title"], tpl["body"], tpl_url(tpl)


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

    # 部署失败时由 workflow 设置 NOTIFY_STATUS=failure 来触发告警
    notify_status = os.environ.get("NOTIFY_STATUS", "success").lower()
    if notify_status == "failure":
        print("Deploy failed, sending failure notification.")
        title, body, click_url = build_message(templates, site_url, "deployFail", "")
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
        return

    event_name = os.environ.get("EVENT_NAME", "push")
    mode = "deploy"
    single_file = ""
    changed_map = OrderedDict()
    newly_published_map = OrderedDict()

    if event_name == "repository_dispatch":
        source_repo = os.environ.get("DISPATCH_SOURCE_REPO", "")
        source_ref = os.environ.get("DISPATCH_SOURCE_REF", "")
        source_sha = os.environ.get("DISPATCH_SOURCE_SHA", "")
        event_id = os.environ.get("DISPATCH_EVENT_ID", "")
        print(
            f"Event: repository_dispatch, source={source_repo}, "
            f"ref={source_ref}, sha={source_sha[:8]}, event_id={event_id}"
        )

        changed_files = parse_json_list_env("DISPATCH_CHANGED_FILES")
        newly_published_files = parse_json_list_env("DISPATCH_NEWLY_PUBLISHED_FILES")

        changed_map, invalid_changed = build_valid_article_map(changed_files)
        newly_published_map, invalid_newly = build_valid_article_map(newly_published_files)

        invalid_files = unique_keep_order(invalid_changed + invalid_newly)
        if invalid_files:
            print("⚠️ Ignored non-article files:")
            for path in invalid_files:
                print(f"  - {path}")

        changed_keys = list(changed_map.keys())
        newly_keys = [key for key in newly_published_map.keys() if key in changed_map]
        print(
            "Resolved article changes -> "
            f"changed: {len(changed_keys)}, newly_published: {len(newly_keys)}"
        )

        if len(changed_keys) == 1 and len(newly_keys) == 1 and changed_keys[0] == newly_keys[0]:
            mode = "single"
            single_file = changed_map[changed_keys[0]]
        elif changed_keys:
            mode = "batch"
        else:
            mode = "deploy"
    else:
        if event_name != "push":
            print(f"Event: {event_name}, fallback to deployOnly notification.")
        else:
            print("Event: push, deploy-only notification.")

    title, body, click_url = build_message(templates, site_url, mode, single_file)

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
