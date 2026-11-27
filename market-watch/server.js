import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendOrigin = process.env.FRONTEND_ORIGIN;
const adminApiKey = process.env.ADMIN_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || !frontendOrigin || origin === frontendOrigin) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "20kb" }));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const configured = Boolean(supabaseUrl && supabaseServiceKey && adminApiKey);
const db = configured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  const supplied = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!adminApiKey || !sameSecret(supplied, adminApiKey)) {
    return res.status(401).json({ error: "Accès administrateur refusé." });
  }
  next();
}

function cleanText(value, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function ready(req, res, next) {
  if (!db) return res.status(503).json({
    error: "Service non configuré. La base de données et les variables serveur doivent être installées."
  });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ service: "LOGOFIE MARKET WATCH", status: "online", databaseConfigured: Boolean(db) });
});

app.post("/api/submissions", publicLimiter, ready, async (req, res) => {
  const body = req.body || {};
  const locality = cleanText(body.locality, 80);
  const marketName = cleanText(body.market_name, 100);
  const product = cleanText(body.product, 100);
  const unit = cleanText(body.unit, 30);
  const correspondentCode = cleanText(body.correspondent_code, 40);
  const notes = cleanText(body.notes, 500);
  const photoUrl = cleanText(body.photo_url, 500);
  const marketPrice = Number(body.market_price);
  const producerPrice = body.producer_price === "" || body.producer_price == null
    ? null : Number(body.producer_price);
  const quantity = body.quantity === "" || body.quantity == null
    ? null : Number(body.quantity);

  if (!locality || !marketName || !product || !unit || !validDate(body.observed_at)) {
    return res.status(400).json({ error: "Localité, marché, produit, unité et date valide sont obligatoires." });
  }
  if (!Number.isFinite(marketPrice) || marketPrice <= 0
      || (producerPrice !== null && (!Number.isFinite(producerPrice) || producerPrice <= 0))
      || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0))) {
    return res.status(400).json({ error: "Les prix et quantités doivent être des nombres positifs." });
  }
  if (photoUrl && !/^https:\/\//i.test(photoUrl)) {
    return res.status(400).json({ error: "La photo doit être fournie par une adresse HTTPS." });
  }

  const { data, error } = await db.from("market_submissions").insert({
    locality, market_name: marketName, product,
    producer_price: producerPrice, market_price: marketPrice,
    unit, quantity, observed_at: body.observed_at,
    correspondent_code: correspondentCode || null,
    notes: notes || null, photo_url: photoUrl || null,
    status: "pending"
  }).select("id,status,created_at").single();

  if (error) {
    console.error("submission insert:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer le relevé pour le moment." });
  }
  return res.status(201).json({
    message: "Relevé reçu. Il sera vérifié avant toute publication.",
    submission: data
  });
});

app.get("/api/prices", ready, async (req, res) => {
  const locality = cleanText(req.query.locality, 80);
  const product = cleanText(req.query.product, 100);
  let query = db.from("market_prices")
    .select("id,locality,market_name,product,producer_price,market_price,unit,observed_at,source_type,source_label,published_at")
    .order("observed_at", { ascending: false })
    .limit(200);
  if (locality) query = query.ilike("locality", locality);
  if (product) query = query.ilike("product", product);

  const { data, error } = await query;
  if (error) {
    console.error("prices read:", error.message);
    return res.status(500).json({ error: "Impossible de charger les prix." });
  }
  return res.json({ prices: data || [] });
});

app.get("/api/admin/submissions", adminLimiter, requireAdmin, ready, async (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status : "pending";
  const { data, error } = await db.from("market_submissions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.error("admin list:", error.message);
    return res.status(500).json({ error: "Impossible de charger les relevés." });
  }
  return res.json({ submissions: data || [] });
});

app.post("/api/admin/submissions/:id/decision", adminLimiter, requireAdmin, ready, async (req, res) => {
  const id = cleanText(req.params.id, 50);
  const decision = req.body?.decision;
  const reviewNote = cleanText(req.body?.review_note, 500);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "Identifiant ou décision invalide." });
  }

  const { data: submission, error: readError } = await db.from("market_submissions")
    .select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (readError) {
    console.error("submission read:", readError.message);
    return res.status(500).json({ error: "Impossible de vérifier ce relevé." });
  }
  if (!submission) return res.status(404).json({ error: "Relevé introuvable ou déjà traité." });

  if (decision === "reject") {
    const { error } = await db.from("market_submissions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), review_note: reviewNote || null })
      .eq("id", id).eq("status", "pending");
    if (error) {
      console.error("submission reject:", error.message);
      return res.status(500).json({ error: "Impossible de refuser ce relevé." });
    }
    return res.json({ message: "Relevé refusé. Aucun prix n'a été publié." });
  }

  const { data: published, error: publishError } = await db.from("market_prices")
    .insert({
      locality: submission.locality,
      market_name: submission.market_name,
      product: submission.product,
      producer_price: submission.producer_price,
      market_price: submission.market_price,
      unit: submission.unit,
      observed_at: submission.observed_at,
      source_type: "local_correspondent",
      source_label: submission.correspondent_code
        ? "Correspondant " + submission.correspondent_code
        : "Correspondant local",
      submission_id: submission.id
    }).select("id").single();

  if (publishError) {
    console.error("price publish:", publishError.message);
    return res.status(500).json({ error: "Publication impossible. Le relevé reste à vérifier." });
  }

  const { error: updateError } = await db.from("market_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), review_note: reviewNote || null })
    .eq("id", id).eq("status", "pending");
  if (updateError) {
    console.error("submission approve:", updateError.message);
    return res.status(500).json({
      error: "Le prix a été créé, mais le statut du relevé doit être contrôlé dans l'administration.",
      publishedPriceId: published.id
    });
  }
  return res.json({ message: "Prix validé et publié.", priceId: published.id });
});



function validPhone(value) {
  const digits = String(value || "").replace(/\\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

app.post("/api/registrations", publicLimiter, ready, async (req, res) => {
  const body = req.body || {};
  const role = cleanText(body.role, 40);
  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 30);
  const locality = cleanText(body.locality, 100);
  const activity = cleanText(body.activity, 180);
  const quantity = cleanText(body.quantity, 100);
  if (!["producer", "buyer", "transporter"].includes(role)
      || name.length < 2 || !validPhone(phone) || !locality || !activity) {
    return res.status(400).json({ error: "Rôle, nom, contact, localité ou activité invalide." });
  }
  const { data, error } = await db.from("partner_registrations").insert({
    role, name, phone, locality, activity, quantity: quantity || null, status: "pending"
  }).select("id,status,created_at").single();
  if (error) {
    console.error("registration insert:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer l'inscription." });
  }
  return res.status(201).json({ message: "Inscription reçue et en attente de validation.", registration: data });
});

app.post("/api/products", publicLimiter, ready, async (req, res) => {
  const body = req.body || {};
  const product = cleanText(body.product, 100);
  const description = cleanText(body.description, 500);
  const producer = cleanText(body.producer, 100);
  const phone = cleanText(body.phone, 30);
  const locality = cleanText(body.locality, 100);
  const photoUrl = cleanText(body.photo_url, 500);
  const quantity = Number(body.quantity);
  const unit = cleanText(body.unit || "kg", 20);
  const price = Number(body.price);
  if (!product || !description || !producer || !validPhone(phone) || !locality
      || !Number.isFinite(quantity) || quantity <= 0 || !unit
      || !Number.isFinite(price) || price <= 0 || !/^https:\\/\\//i.test(photoUrl)) {
    return res.status(400).json({ error: "Informations du produit, photo HTTPS, quantité, prix ou contact invalides." });
  }
  const { data, error } = await db.from("product_listings").insert({
    product, description, producer, phone, locality, photo_url: photoUrl,
    quantity, unit, price, status: "pending"
  }).select("id,status,created_at").single();
  if (error) {
    console.error("product insert:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer le produit." });
  }
  return res.status(201).json({ message: "Produit reçu et en attente de validation.", product: data });
});

app.post("/api/transporters", publicLimiter, ready, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 30);
  const vehicle = cleanText(body.vehicle, 60);
  const capacity = cleanText(body.capacity, 80);
  const locality = cleanText(body.locality, 100);
  const routes = cleanText(body.routes, 250);
  const rate = cleanText(body.rate, 100);
  const availability = cleanText(body.availability, 60);
  if (!name || !validPhone(phone) || !vehicle || !capacity || !locality || !routes || !availability) {
    return res.status(400).json({ error: "Profil transporteur incomplet ou invalide." });
  }
  const { data, error } = await db.from("transporter_profiles").insert({
    name, phone, vehicle, capacity, locality, routes, rate: rate || null,
    availability, status: "pending"
  }).select("id,status,created_at").single();
  if (error) {
    console.error("transporter insert:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer le profil transporteur." });
  }
  return res.status(201).json({ message: "Profil reçu et en attente de validation.", transporter: data });
});

app.get("/api/admin/market/queue", adminLimiter, requireAdmin, ready, async (_req, res) => {
  const tables = [
    ["registrations", "partner_registrations"],
    ["products", "product_listings"],
    ["transporters", "transporter_profiles"]
  ];
  const results = await Promise.all(tables.map(async ([key, table]) => {
    const { data, error } = await db.from(table).select("*")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
    return { key, data: data || [], error };
  }));
  const failed = results.find(x => x.error);
  if (failed) {
    console.error("admin market queue:", failed.error.message);
    return res.status(500).json({ error: "Impossible de charger les demandes en attente." });
  }
  const queue = {};
  for (const item of results) queue[item.key] = item.data;
  return res.json({ queue, note: "Données personnelles visibles uniquement dans cet endpoint administrateur protégé." });
});

app.post("/api/admin/market/:resource/:id/decision", adminLimiter, requireAdmin, ready, async (req, res) => {
  const tables = {
    registrations: "partner_registrations",
    products: "product_listings",
    transporters: "transporter_profiles"
  };
  const table = tables[req.params.resource];
  const id = cleanText(req.params.id, 50);
  const decision = req.body?.decision;
  const reviewNote = cleanText(req.body?.review_note, 500);
  if (!table || !/^[0-9a-f-]{36}$/i.test(id) || !["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "Ressource, identifiant ou décision invalide." });
  }
  const { data, error } = await db.from(table).update({
    status: decision === "approve" ? "approved" : "rejected",
    reviewed_at: new Date().toISOString(),
    review_note: reviewNote || null
  }).eq("id", id).eq("status", "pending")
    .select("id,status").maybeSingle();
  if (error) {
    console.error("admin market decision:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer la décision." });
  }
  if (!data) return res.status(404).json({ error: "Demande introuvable ou déjà traitée." });
  return res.json({ message: decision === "approve" ? "Demande validée." : "Demande refusée.", item: data });
});

app.get("/api/admin/finance/summary", adminLimiter, requireAdmin, ready, async (_req, res) => {
  const { data, error } = await db.from("finance_entries")
    .select("entry_type,gross_amount,commission_amount,status")
    .order("transaction_date", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("finance summary:", error.message);
    return res.status(500).json({ error: "Impossible de charger le suivi financier." });
  }
  const rows = data || [];
  const totals = {
    confirmedSales: 0,
    completedTransport: 0,
    completedExpenses: 0,
    earnedCommissions: 0,
    pendingCommissions: 0,
    entries: rows.length
  };
  for (const row of rows) {
    const amount = Number(row.gross_amount) || 0;
    const commission = Number(row.commission_amount) || 0;
    if (row.entry_type === "sale" && row.status === "confirmed") {
      totals.confirmedSales += amount;
      totals.earnedCommissions += commission;
    } else if (row.entry_type === "transport" && row.status === "completed") {
      totals.completedTransport += amount;
      totals.earnedCommissions += commission;
    } else if (row.entry_type === "expense" && row.status === "completed") {
      totals.completedExpenses += amount;
    } else if ((row.entry_type === "sale" || row.entry_type === "transport") && row.status === "pending") {
      totals.pendingCommissions += commission;
    }
  }
  for (const key of Object.keys(totals)) {
    if (key !== "entries") totals[key] = Math.round(totals[key] * 100) / 100;
  }
  return res.json({
    currency: "XOF",
    note: "Suivi déclaratif uniquement : aucun paiement ni encaissement n'est effectué par cette API.",
    totals,
    estimatedNet: Math.round((totals.earnedCommissions - totals.completedExpenses) * 100) / 100
  });
});

app.post("/api/admin/finance/entries", adminLimiter, requireAdmin, ready, async (req, res) => {
  const body = req.body || {};
  const entryType = body.entry_type;
  const label = cleanText(body.label, 120);
  const amount = Number(body.gross_amount);
  const rate = body.commission_rate == null || body.commission_rate === ""
    ? 0 : Number(body.commission_rate);
  const status = body.status || "pending";
  const transactionDate = body.transaction_date || new Date().toISOString().slice(0, 10);
  const notes = cleanText(body.notes, 500);

  if (!["sale", "transport", "expense"].includes(entryType)
      || label.length < 2
      || !Number.isFinite(amount) || amount <= 0
      || !Number.isFinite(rate) || rate < 0 || rate > 10
      || !["pending", "confirmed", "completed", "cancelled"].includes(status)
      || !validDate(transactionDate)
      || (entryType === "expense" && rate !== 0)) {
    return res.status(400).json({ error: "Type, libellé, montant, taux, statut ou date invalide." });
  }

  const { data, error } = await db.from("finance_entries").insert({
    entry_type: entryType,
    label,
    gross_amount: amount,
    commission_rate: rate,
    status,
    transaction_date: transactionDate,
    notes: notes || null
  }).select("id,entry_type,label,gross_amount,commission_rate,commission_amount,status,transaction_date,created_at").single();

  if (error) {
    console.error("finance entry insert:", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer cette écriture." });
  }
  return res.status(201).json({
    message: "Écriture de suivi enregistrée. Aucun argent n'a été encaissé.",
    entry: data
  });
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin not allowed") {
    return res.status(403).json({ error: "Origine non autorisée." });
  }
  console.error("server error:", err?.message || err);
  return res.status(500).json({ error: "Erreur serveur." });
});

app.listen(port, () => {
  console.log(`LOGOFIE MARKET WATCH API listening on port ${port}`);
  if (!configured) console.warn("Configuration incomplète : renseigner les variables Supabase et ADMIN_API_KEY.");
});
