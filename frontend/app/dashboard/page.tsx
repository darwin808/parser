"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { invoiceAPI } from "@/lib/api";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New states for custom fields and document type
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("invoice");
  const [customFields, setCustomFields] = useState([]);
  const [showFieldsModal, setShowFieldsModal] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await invoiceAPI.getInvoices();
      setInvoices(response.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError("");
      setSuccess("");
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { field: "", description: "" }]);
  };

  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index, key, value) => {
    const updated = [...customFields];
    updated[index][key] = value;
    setCustomFields(updated);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    // Validate custom fields
    const validFields = customFields.filter(
      (f) => f.field.trim() && f.description.trim(),
    );

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      console.log("Uploading file:", selectedFile.name);
      console.log("Document type:", documentType);
      console.log("Custom fields:", validFields);

      const response = await invoiceAPI.uploadInvoice(
        selectedFile,
        documentType,
        validFields,
      );
      console.log("Upload response:", response);

      setSuccess("Document processed successfully!");
      setSelectedFile(null);
      setCustomFields([]);
      setShowFieldsModal(false);
      await fetchInvoices();

      // Reset file input
      const fileInput = document.getElementById("invoice-upload");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to upload document",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this document?")) return;

    try {
      await invoiceAPI.deleteInvoice(id);
      setSuccess("Document deleted!");
      await fetchInvoices();
    } catch (err) {
      setError("Failed to delete document");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Not authenticated</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">📄 Document Parser</h1>
          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload Document</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
              {success}
            </div>
          )}

          {/* Document Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            >
              <option value="invoice">Invoice</option>
              <option value="receipt">Receipt</option>
              <option value="purchase_order">Purchase Order</option>
              <option value="bill">Bill</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* File Selection */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
            <input
              type="file"
              id="invoice-upload"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <label
              htmlFor="invoice-upload"
              className={`cursor-pointer ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-6xl mb-4">📤</div>
              <p className="text-lg font-medium mb-2">
                {selectedFile ? selectedFile.name : "Click to select file"}
              </p>
              <p className="text-sm text-gray-500">JPG, PNG, PDF (Max 10MB)</p>
            </label>
          </div>

          {/* Custom Fields Section */}
          {selectedFile && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Fields (Optional)
                </label>
                <button
                  onClick={addCustomField}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  disabled={uploading}
                >
                  + Add Field
                </button>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Field name (e.g., PO Number)"
                        value={field.field}
                        onChange={(e) =>
                          updateCustomField(index, "field", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={uploading}
                      />
                      <input
                        type="text"
                        placeholder="Description (e.g., Purchase order number)"
                        value={field.description}
                        onChange={(e) =>
                          updateCustomField(
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={uploading}
                      />
                      <button
                        onClick={() => removeCustomField(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800 font-medium"
                        disabled={uploading}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload Button */}
          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white ${
                uploading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Processing..." : "Upload & Process"}
            </button>
          )}

          {uploading && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">
                Processing with AI...
              </p>
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Documents</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No documents yet. Upload one above!
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {invoice.file_name}
                      </h3>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            invoice.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : invoice.status === "processing"
                                ? "bg-blue-100 text-blue-800"
                                : invoice.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {invoice.status}
                        </span>
                        <span>
                          {new Date(invoice.created_at).toLocaleString()}
                        </span>
                      </div>

                      {invoice.parsed_data && (
                        <div className="bg-gray-50 rounded p-4 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-gray-600">Invoice #</p>
                              <p className="font-medium">
                                {invoice.parsed_data.invoice_number || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Vendor</p>
                              <p className="font-medium">
                                {invoice.parsed_data.vendor_name || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Date</p>
                              <p className="font-medium">
                                {invoice.parsed_data.invoice_date || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Total</p>
                              <p className="font-medium text-lg">
                                {invoice.parsed_data.currency || "$"}{" "}
                                {invoice.parsed_data.total || "0.00"}
                              </p>
                            </div>
                          </div>

                          {invoice.parsed_data.items?.length > 0 && (
                            <div className="mt-4">
                              <p className="text-gray-600 mb-2">Items:</p>
                              <ul className="space-y-1">
                                {invoice.parsed_data.items.map((item, idx) => (
                                  <li key={idx} className="text-gray-800">
                                    • {item.description} - Qty: {item.quantity}{" "}
                                    × ${item.unit_price} = ${item.total}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
