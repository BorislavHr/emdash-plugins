# Changelog

## 1.0.0

First release.

- Sends an IndexNow notice when an entry is published, unpublished or deleted: its page, the pages
  that list it (`also`) and its term pages.
- Sends only when `enabled` is true and the site runs at `siteUrl`.
- The key from the options or the environment, and a key file at the root (`keyLocation`).
