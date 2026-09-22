import cloudinary from "./cloudinary";

// What happened on a posting morning — one small raw file per run, so the
// On Hold page can show "142 listings posted this morning · $4,215" and
// anything that couldn't post. Add-only, like the efficiency log.

const RUN_FOLDER = "ebay-listings/logs/hold-runs";

export async function writeRun(run) {
  const id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const context = {
    at: run.at,
    posted: String(run.posted ?? 0),
    failed: String(run.failed ?? 0),
    value: String(run.value ?? 0),
    // Titles of anything that couldn't post, so the page can name them.
    problems: String(run.problems || "").slice(0, 900),
  };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", folder: RUN_FOLDER, public_id: id, overwrite: false, context },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(Buffer.from(JSON.stringify(run), "utf8"));
  });
}

export async function listRuns(limit = 20) {
  const result = await cloudinary.api.resources({
    resource_type: "raw",
    type: "upload",
    prefix: `${RUN_FOLDER}/`,
    max_results: 500,
    context: true,
  });
  return (result.resources || [])
    .map((r) => {
      const c = r.context?.custom || {};
      return {
        at: c.at || r.created_at,
        posted: parseInt(c.posted, 10) || 0,
        failed: parseInt(c.failed, 10) || 0,
        value: parseFloat(c.value) || 0,
        problems: c.problems || "",
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}
