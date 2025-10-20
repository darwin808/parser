require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const FormData = require("form-data");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer setup - accept images and PDFs
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."));
    }
  },
});

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Auth middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "express-backend",
  });
});

// Test LLM connection
app.get("/api/llm/health", async (req, res) => {
  try {
    const response = await fetch(`${process.env.LLM_SERVER_URL}/health`);
    const data = await response.json();
    res.json({
      llm_status: "connected",
      llm_response: data,
    });
  } catch (error) {
    res.status(500).json({
      llm_status: "disconnected",
      error: error.message,
    });
  }
});

// Main endpoint: Upload and process invoice
app.post(
  "/api/invoices/process",
  authenticateUser,
  upload.single("invoice"),
  async (req, res) => {
    let filePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      filePath = req.file.path;
      const userId = req.user.id;
      const fileName = req.file.originalname;
      const fileType = req.file.mimetype;

      // Extract document type and custom fields from request body
      const documentType = req.body.documentType || "invoice";
      let customFields = [];

      try {
        if (req.body.customFields) {
          customFields = JSON.parse(req.body.customFields);
        }
      } catch (parseError) {
        console.warn("⚠️  Failed to parse custom fields:", parseError.message);
      }

      console.log("📄 Processing document for user:", userId);
      console.log("📁 File:", fileName);
      console.log("📋 Type:", fileType);
      console.log("🏷️  Document Type:", documentType);
      console.log("🔧 Custom Fields:", JSON.stringify(customFields, null, 2));

      // Step 1: Upload file to Supabase Storage
      const storagePath = `${userId}/${Date.now()}_${fileName}`;
      const fileBuffer = fs.readFileSync(filePath);

      console.log("☁️  Uploading to Supabase...");
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(storagePath, fileBuffer, {
          contentType: fileType,
          upsert: false,
        });

      if (uploadError) {
        console.error("❌ Upload error:", uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("invoices").getPublicUrl(storagePath);

      console.log("✅ Uploaded to Supabase:", publicUrl);

      // Step 2: Create invoice record with 'processing' status
      console.log("💾 Creating invoice record...");
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          file_url: publicUrl,
          file_name: fileName,
          status: "processing",
          document_type: documentType,
          custom_fields: customFields.length > 0 ? customFields : null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Insert error:", insertError);
        throw new Error(`Failed to create invoice: ${insertError.message}`);
      }

      console.log("✅ Invoice created:", invoice.id);

      // Step 3: Send file + metadata to LLM server for processing
      console.log("🤖 Preparing data for LLM server...");
      const formData = new FormData();

      // Append the file
      formData.append("file", fs.createReadStream(filePath), {
        filename: fileName,
        contentType: fileType,
      });

      // Append document type
      formData.append("document_type", documentType);

      // Append custom fields as JSON string
      if (customFields.length > 0) {
        formData.append("custom_fields", JSON.stringify(customFields));
        console.log("📦 Custom fields added to request");
      }

      console.log("🚀 Sending to LLM server...");
      const llmResponse = await fetch(
        `${process.env.LLM_SERVER_URL}/parse-invoice`,
        {
          method: "POST",
          body: formData,
          headers: formData.getHeaders(),
          timeout: 120000, // 2 minutes timeout
        },
      );

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error("❌ LLM error:", errorText);
        throw new Error(`LLM processing failed: ${llmResponse.statusText}`);
      }

      const llmResult = await llmResponse.json();
      console.log("✅ LLM processing completed");

      if (!llmResult.success) {
        throw new Error(llmResult.error || "LLM parsing failed");
      }

      // Step 4: Update invoice with parsed data
      console.log("💾 Saving parsed data...");
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
        console.error("❌ Update error:", updateError);
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      console.log("✅ Complete! Invoice:", updatedInvoice.id);

      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🧹 Cleaned up temp file");
      }

      res.json({
        success: true,
        message: "Document processed successfully",
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("❌ Error:", error.message);

      // Clean up temp file
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// Get all invoices for user
app.get("/api/invoices", authenticateUser, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: invoices, error, count } = await query;

    if (error) throw error;

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
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get single invoice
app.get("/api/invoices/:id", authenticateUser, async (req, res) => {
  try {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          error: "Invoice not found",
        });
      }
      throw error;
    }

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete invoice
app.delete("/api/invoices/:id", authenticateUser, async (req, res) => {
  try {
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          error: "Invoice not found",
        });
      }
      throw fetchError;
    }

    // Delete from storage
    const urlParts = invoice.file_url.split("/");
    const bucketPath = urlParts.slice(-2).join("/");

    await supabase.storage.from("invoices").remove([bucketPath]);

    // Delete from database
    const { error: deleteError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: error.message || "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════");
  console.log("🚀 Express Backend Server");
  console.log("═══════════════════════════════════════");
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 LLM Server: ${process.env.LLM_SERVER_URL}`);
  console.log(`📋 Role: File upload & Supabase management`);
  console.log("═══════════════════════════════════════");
});
