# Content queue

`queue.json` is the list of posts the scheduler will publish in order, one
every `POST_INTERVAL_HOURS` (default 5).

## Rules

- `media_url` **must be a publicly reachable URL** (https). Instagram fetches
  the media itself — it does not accept local file uploads.
  - For images: JPEG, public URL, under 8 MB.
  - For videos (Reels): MP4, H.264, AAC audio, under 100 MB, 3-90 sec.
- `media_type` is `"image"` or `"video"`.
- `caption` supports hashtags and emoji. Max 2,200 chars.
- Leave `posted`, `posted_at`, and `media_id` as-is; the scheduler writes them.

## Where to host the media

Cheap options:
- Cloudinary (free tier)
- AWS S3 public bucket
- Any web host you already own

Once the file is uploaded, copy its public URL into `media_url`.

## Adding more posts

Just append more objects to the JSON array. The scheduler walks top-to-bottom
and skips anything already marked `"posted": true`.
