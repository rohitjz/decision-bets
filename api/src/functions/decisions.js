const { app } = require("@azure/functions");
const { TableClient, odata } = require("@azure/data-tables");

const TABLE = "decisions";
const CONN =
  process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || "UseDevelopmentStorage=true";

let clientPromise;
async function table() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = TableClient.fromConnectionString(CONN, TABLE, { allowInsecureConnection: true });
      await client.createTable().catch((err) => {
        if (err.statusCode !== 409) throw err;
      });
      return client;
    })();
  }
  return clientPromise;
}

// Decisions are partitioned per user, so one person's list is a single fast query.
function partition(request) {
  const user = (request.query.get("user") || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(user)) return null;
  return user;
}

const json = (status, body) => ({
  status,
  jsonBody: body,
  headers: { "Cache-Control": "no-store" },
});

// Table Storage has no JSON column type, so the outcome array is stored as a string.
function toEntity(user, d) {
  return {
    partitionKey: user,
    rowKey: d.id,
    title: String(d.title || "").slice(0, 300),
    outcomes: JSON.stringify(d.outcomes || []).slice(0, 30000),
    ev: Number(d.ev) || 0,
    totalOdds: Number(d.totalOdds) || 0,
    premortem: String(d.premortem || "").slice(0, 4000),
    review: d.review ? JSON.stringify(d.review).slice(0, 8000) : "",
    createdAt: d.createdAt || new Date().toISOString(),
  };
}

function fromEntity(e) {
  const parse = (v, fallback) => {
    try {
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    id: e.rowKey,
    title: e.title,
    outcomes: parse(e.outcomes, []),
    ev: e.ev,
    totalOdds: e.totalOdds,
    premortem: e.premortem,
    review: parse(e.review, null),
    createdAt: e.createdAt,
  };
}

app.http("decisions", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "decisions",
  handler: async (request, context) => {
    const user = partition(request);
    if (!user) return json(400, { error: "A valid ?user= id is required." });

    try {
      const client = await table();

      if (request.method === "GET") {
        const items = [];
        const query = client.listEntities({
          queryOptions: { filter: odata`PartitionKey eq ${user}` },
        });
        for await (const e of query) items.push(fromEntity(e));
        return json(200, items);
      }

      const body = await request.json();
      if (!body || !body.id || !body.title) {
        return json(400, { error: "id and title are required." });
      }
      const entity = toEntity(user, body);
      await client.createEntity(entity);
      return json(201, fromEntity(entity));
    } catch (err) {
      context.error(err);
      if (err.statusCode === 409) return json(409, { error: "That decision already exists." });
      return json(500, { error: "Storage request failed." });
    }
  },
});

app.http("decision", {
  methods: ["PATCH", "DELETE"],
  authLevel: "anonymous",
  route: "decisions/{id}",
  handler: async (request, context) => {
    const user = partition(request);
    if (!user) return json(400, { error: "A valid ?user= id is required." });

    const id = request.params.id;
    try {
      const client = await table();

      if (request.method === "DELETE") {
        await client.deleteEntity(user, id);
        return { status: 204 };
      }

      const patch = await request.json();
      const update = { partitionKey: user, rowKey: id };
      if (patch.review !== undefined) update.review = JSON.stringify(patch.review).slice(0, 8000);
      if (patch.title !== undefined) update.title = String(patch.title).slice(0, 300);
      if (patch.premortem !== undefined) update.premortem = String(patch.premortem).slice(0, 4000);

      await client.updateEntity(update, "Merge");
      return json(200, { ok: true });
    } catch (err) {
      context.error(err);
      if (err.statusCode === 404) return json(404, { error: "Decision not found." });
      return json(500, { error: "Storage request failed." });
    }
  },
});
