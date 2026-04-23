# Local operational data

The portal reads two optional JSON files from this directory. Both are
gitignored — commit only the `*.example.json` templates.

## `drafts.json`

Populated by the Pitcher pipeline. Rendered by the **Drafts** page in the
portal and consumed by `npm run export-drafts`.

Copy the template to start:

```
cp data/drafts.example.json data/drafts.json
```

Schema per entry:

| field       | type                              | required |
| ----------- | --------------------------------- | -------- |
| `id`        | string                            | yes      |
| `to`        | email                             | yes      |
| `from`      | email                             | no       |
| `subject`   | string                            | yes      |
| `body`      | string                            | no       |
| `lead`      | string                            | no       |
| `company`   | string                            | no       |
| `status`    | `"ready"` \| `"sent"` \| `"skipped"` | no (defaults to `"ready"`) |
| `createdAt` | ISO 8601 timestamp                | no       |

Override the path with `PORTAL_DRAFTS_PATH`.

## `sentinel-status.json`

Single object written by the Sentinel scanner. Drives the status widget on
each client dashboard.

```
cp data/sentinel-status.example.json data/sentinel-status.json
```

Schema:

| field         | type                                                    |
| ------------- | ------------------------------------------------------- |
| `lastScanAt`  | ISO 8601 timestamp (or `null`)                          |
| `status`      | `"ok"` \| `"stale"` \| `"error"` \| `"unknown"`         |
| `message`     | optional freeform string surfaced in the widget         |

The widget turns amber after 24h without a scan and red after 48h (or when
`status` is `"error"`), regardless of what the file says.

Override the path with `PORTAL_SENTINEL_STATUS_PATH`.
