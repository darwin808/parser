require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const FormData = require("form-data");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const pinoHttp = require("pino-http");

const app = express();

// ============ LOGGER SETUP ============
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
      singleLine: false,
    },
  },
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500 || err) return "error";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
  },
});

// Middleware
app.use(httpLogger);
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Setup
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Config
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Invalid file type"));
  },
});

// ============ MIDDLEWARE ============
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      req.log.warn("Authentication failed: No token provided");
      return res.status(401).json({ error: "No token" });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.log.warn({ error }, "Authentication failed: Invalid token");
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    req.log.info({ userId: user.id }, "User authenticated");
    next();
  } catch (error) {
    req.log.error({ error }, "Authentication error");
    res.status(401).json({ error: "Auth failed" });
  }
};

// ============ HELPERS ============
const cleanup = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.debug({ filePath }, "Cleaned up temporary file");
  }
};

const uploadToStorage = async (userId, fileName, filePath, fileType) => {
  const storagePath = `${userId}/${Date.now()}_${fileName}`;
  const fileBuffer = fs.readFileSync(filePath);

  logger.debug({ userId, fileName, storagePath }, "Uploading to storage");

  const { error } = await supabase.storage
    .from("invoices")
    .upload(storagePath, fileBuffer, { contentType: fileType });

  if (error) {
    logger.error({ error, storagePath }, "Storage upload failed");
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("invoices").getPublicUrl(storagePath);

  logger.info({ publicUrl }, "File uploaded successfully");
  return publicUrl;
};

const sendToLLM = async (
  filePath,
  fileName,
  fileType,
  docType,
  customFields,
) => {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath), {
    filename: fileName,
    contentType: fileType,
  });
  formData.append("document_type", docType);
  if (customFields.length > 0) {
    formData.append("custom_fields", JSON.stringify(customFields));
  }

  logger.debug(
    { fileName, docType, customFieldsCount: customFields.length },
    "Sending to LLM",
  );

  const response = await fetch(`${process.env.LLM_SERVER_URL}/parse-invoice`, {
    method: "POST",
    body: formData,
    headers: formData.getHeaders(),
    timeout: 120000,
  });

  if (!response.ok) {
    logger.error(
      { status: response.status, statusText: response.statusText },
      "LLM processing failed",
    );
    throw new Error("LLM processing failed");
  }

  const result = await response.json();
  logger.info("LLM processing completed successfully");
  return result;
};

// ============ ROUTES ============

// Health
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "express-backend",
  });
});

app.get("/api/llm/health", async (req, res) => {
  try {
    const response = await fetch(`${process.env.LLM_SERVER_URL}/health`);
    const data = await response.json();
    req.log.info({ llmStatus: data }, "LLM health check successful");
    res.json({ llm_status: "connected", llm_response: data });
  } catch (error) {
    req.log.error({ error }, "LLM health check failed");
    res.status(500).json({ llm_status: "disconnected", error: error.message });
  }
});

// Process invoice
app.post(
  "/api/invoices/process",
  auth,
  upload.single("invoice"),
  async (req, res) => {
    let filePath = null;
    try {
      if (!req.file) {
        req.log.warn("No file uploaded in request");
        return res.status(400).json({ error: "No file uploaded" });
      }

      filePath = req.file.path;
      const { id: userId } = req.user;
      const { originalname: fileName, mimetype: fileType } = req.file;
      const docType = req.body.documentType || "invoice";

      let customFields = [];
      try {
        if (req.body.customFields)
          customFields = JSON.parse(req.body.customFields);
      } catch (e) {
        req.log.warn("Failed to parse custom fields");
      }

      req.log.info({ fileName, userId, docType }, "Processing invoice");

      // Upload to storage
      const publicUrl = await uploadToStorage(
        userId,
        fileName,
        filePath,
        fileType,
      );

      // Create invoice record
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          file_url: publicUrl,
          file_name: fileName,
          status: "processing",
          document_type: docType,
          custom_fields: customFields.length > 0 ? customFields : null,
        })
        .select()
        .single();

      if (insertError) {
        req.log.error({ error: insertError }, "Database insert failed");
        throw new Error(`DB insert failed: ${insertError.message}`);
      }

      req.log.info({ invoiceId: invoice.id }, "Invoice record created");

      // Send to LLM
      const llmResult = await sendToLLM(
        filePath,
        fileName,
        fileType,
        docType,
        customFields,
      );

      if (!llmResult.success) {
        req.log.error({ error: llmResult.error }, "LLM parsing failed");
        throw new Error(llmResult.error || "LLM parsing failed");
      }

      // Update with parsed data
      const { data: updatedInvoice, error: updateError } = await supabase
        .from("invoices")
        .update({
          parsed_data: llmResult.data,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .select()
        .single();

      if (updateError) {
        req.log.error({ error: updateError }, "Invoice update failed");
        throw new Error(`Update failed: ${updateError.message}`);
      }

      cleanup(filePath);
      req.log.info(
        { invoiceId: updatedInvoice.id },
        "Invoice processed successfully",
      );

      res.json({
        success: true,
        message: "Processed successfully",
        invoice: updatedInvoice,
      });
    } catch (error) {
      req.log.error({ error, filePath }, "Invoice processing failed");
      cleanup(filePath);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Get all invoices
app.get("/api/invoices", auth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    req.log.debug({ status, limit, offset }, "Fetching invoices");

    let query = supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);

    const { data: invoices, error, count } = await query;
    if (error) throw error;

    req.log.info({ count, limit, offset }, "Invoices fetched successfully");

    res.json({
      success: true,
      invoices,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    req.log.error({ error }, "Failed to fetch invoices");
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single invoice
app.get("/api/invoices/:id", auth, async (req, res) => {
  try {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error?.code === "PGRST116") {
      req.log.warn({ invoiceId: req.params.id }, "Invoice not found");
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }
    if (error) throw error;

    req.log.info({ invoiceId: invoice.id }, "Invoice retrieved");
    res.json({ success: true, invoice });
  } catch (error) {
    req.log.error(
      { error, invoiceId: req.params.id },
      "Failed to fetch invoice",
    );
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete invoice
app.delete("/api/invoices/:id", auth, async (req, res) => {
  try {
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError?.code === "PGRST116") {
      req.log.warn(
        { invoiceId: req.params.id },
        "Invoice not found for deletion",
      );
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }
    if (fetchError) throw fetchError;

    // Delete from storage
    const urlParts = invoice.file_url.split("/");
    const bucketPath = urlParts.slice(-2).join("/");
    await supabase.storage.from("invoices").remove([bucketPath]);

    // Delete from DB
    const { error: deleteError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", req.params.id);

    if (deleteError) throw deleteError;

    req.log.info({ invoiceId: req.params.id }, "Invoice deleted successfully");
    res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    req.log.error(
      { error, invoiceId: req.params.id },
      "Failed to delete invoice",
    );
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handler
app.use((error, req, res, next) => {
  req.log.error({ error }, "Unhandled error");
  res.status(500).json({ success: false, error: error.message });
});

// Start
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info("═══════════════════════════════════════");
  logger.info("🚀 Express Backend Server");
  logger.info("═══════════════════════════════════════");
  logger.info(`📍 Running on: http://localhost:${PORT}`);
  logger.info(`🏥 Health: http://localhost:${PORT}/health`);
  logger.info(`🔗 LLM Server: ${process.env.LLM_SERVER_URL}`);
  logger.info("═══════════════════════════════════════");
});
