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
