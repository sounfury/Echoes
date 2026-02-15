#!/usr/bin/env python3
"""
Bark push notification for Echoes CI/CD.
Reads templates from site.config.yaml, detects markdown changes
between BEFORE_SHA and AFTER_SHA, sends scenario-based notifications.
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import yaml


# ==================== Config Helpers ====================


def load_config(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f)

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


# ==================== Git Helpers ====================

ZERO_SHA = "0" * 40


def git_diff_files(diff_filter, before, after, content_dir):
    result = subprocess.run(
        [
            "git", "-c", "core.quotePath=false",
            "diff", "--name-only",
            f"--diff-filter={diff_filter}",
            before, after, "--", content_dir,
        ],
        capture_output=True,
        text=True,
    )
    return [
        f
        for f in result.stdout.strip().split("\n")
        if f and re.search(r"\.(md|mdx)$", f)
    ]


def get_all_content_files(sha, content_dir):
    """首次推送时列出该 commit 中所有 markdown 文件。"""
    result = subprocess.run(
        [
            "git", "-c", "core.quotePath=false",
            "ls-tree", "-r", "--name-only", sha, "--", content_dir,
        ],
        capture_output=True,
        text=True,
    )
    return [
        f
        for f in result.stdout.strip().split("\n")
        if f and re.search(r"\.(md|mdx)$", f)
    ]


def get_post_title(filepath):
    return re.sub(r"\.(md|mdx)$", "", os.path.basename(filepath))


def get_post_url(filepath, site_url, content_dir):
    relative = filepath.replace(f"{content_dir}/", "", 1)
    parts = relative.split("/")
    category = parts[0]
    slug = re.sub(r"\.(md|mdx)$", "", parts[-1]).lower()
    return f"{site_url}/posts/{category}/{urllib.parse.quote(slug)}/"


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

    # Bark token 从环境变量获取
    bark_key = os.environ.get("BARK_KEY", "")
    if not bark_key:
        print("⚠️  BARK_KEY not set, skipping notification.")
        sys.exit(0)

    icon_url = bark_cfg.get("iconUrl", "")
    content_dir = "src/content/blog"

    # 使用 github.event.before / github.sha 比较，
    # 解决一次 push 多个 commit 的漏报问题
    before_sha = os.environ.get("BEFORE_SHA", "")
    after_sha = os.environ.get("AFTER_SHA", "HEAD")

    print(f"Comparing {before_sha[:8]}..{after_sha[:8]}")

    if before_sha == ZERO_SHA or not before_sha:
        # 分支首次推送
        added = get_all_content_files(after_sha, content_dir)
        modified = []
    else:
        added = git_diff_files("A", before_sha, after_sha, content_dir)
        modified = git_diff_files("M", before_sha, after_sha, content_dir)

    all_changed = list(dict.fromkeys(added + modified))
    total = len(all_changed)

    print(f"Added: {len(added)}, Modified: {len(modified)}, Total: {total}")

    # ---- 选择模板并替换占位符 ----
    click_url = ""  # 点击通知跳转的 URL

    if total == 0:
        tpl = templates["deployOnly"]
        title = tpl["title"]
        body = tpl["body"]

    elif total == 1:
        tpl = templates["singlePublish"]
        post_title = get_post_title(all_changed[0])
        post_url = get_post_url(all_changed[0], site_url, content_dir)
        title = tpl["title"].replace("{postTitle}", post_title)
        body = tpl["body"].replace("{postTitle}", post_title).replace(
            "{postUrl}", post_url
        )
        click_url = post_url

    else:
        tpl = templates["batchPublish"]
        file_list = "\n".join(f"• {get_post_title(f)}" for f in all_changed)
        title = tpl["title"].replace("{count}", str(total))
        body = (
            tpl["body"]
            .replace("{added}", str(len(added)))
            .replace("{modified}", str(len(modified)))
            .replace("{fileList}", file_list)
        )

    # ---- 调用 Bark API (POST JSON) ----
    payload = {
        "title": title,
        "body": body,
        "icon": icon_url,
    }
    if click_url:
        payload["url"] = click_url

    print(f"\n📌 Title: {title}")
    print(f"📝 Body:\n{body}")
    if click_url:
        print(f"🔗 URL: {click_url}")
    print(f"\nSending Bark notification...")

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.day.app/{bark_key}",
            data=data,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"✅ HTTP {resp.status}")
    except Exception as e:
        print(f"❌ Notification failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
