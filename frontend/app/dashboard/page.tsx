"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { invoiceAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("invoice");
  const [customFields, setCustomFields] = useState([]);

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

    const validFields = customFields.filter(
      (f) => f.field.trim() && f.description.trim(),
    );

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      const response = await invoiceAPI.uploadInvoice(
        selectedFile,
        documentType,
        validFields,
      );

      setSuccess("Document processed successfully!");
      setSelectedFile(null);
      setCustomFields([]);
      await fetchInvoices();

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Not authenticated</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Document Parser
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Upload Section */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Upload invoices, receipts, or other documents for AI-powered
              parsing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Document Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select
                value={documentType}
                onValueChange={setDocumentType}
                disabled={uploading}
              >
                <SelectTrigger id="document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>File Upload</Label>
              <div className="relative">
                <Input
                  type="file"
                  id="invoice-upload"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <label
                  htmlFor="invoice-upload"
                  className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    selectedFile
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent"
                  } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload
                      className={`w-12 h-12 mb-4 ${selectedFile ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <p className="mb-2 text-sm font-medium">
                      {selectedFile ? (
                        <span className="text-primary">
                          {selectedFile.name}
                        </span>
                      ) : (
                        <span>Click to upload or drag and drop</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, PDF (Max 10MB)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Custom Fields */}
            {selectedFile && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Custom Fields (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomField}
                    disabled={uploading}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                {customFields.length > 0 && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Field name (e.g., PO Number)"
                          value={field.field}
                          onChange={(e) =>
                            updateCustomField(index, "field", e.target.value)
                          }
                          disabled={uploading}
                        />
                        <Input
                          placeholder="Description"
                          value={field.description}
                          onChange={(e) =>
                            updateCustomField(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          disabled={uploading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomField(index)}
                          disabled={uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Process
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {invoices.length} document{invoices.length !== 1 ? "s" : ""}{" "}
              processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">
                  Loading documents...
                </p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No documents yet. Upload one above to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <Card key={invoice.id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              {invoice.file_name}
                            </h3>
                            <Badge
                              variant={
                                invoice.status === "completed"
                                  ? "default"
                                  : invoice.status === "processing"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {invoice.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(invoice.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(invoice.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {invoice.parsed_data && (
                        <>
                          <Separator className="my-4" />
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Invoice #
                              </p>
                              <p className="font-medium">
                                {invoice.parsed_data.invoice_number || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Vendor
                              </p>
                              <p className="font-medium">
                                {invoice.parsed_data.vendor_name || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Date
                              </p>
                              <p className="font-medium">
                                {invoice.parsed_data.invoice_date || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Total
                              </p>
                              <p className="font-semibold text-lg">
                                {invoice.parsed_data.currency || "$"}{" "}
                                {invoice.parsed_data.total || "0.00"}
                              </p>
                            </div>
                          </div>

                          {invoice.parsed_data.items?.length > 0 && (
                            <>
                              <Separator className="my-4" />
                              <div>
                                <p className="text-sm font-medium mb-3">
                                  Line Items
                                </p>
                                <div className="space-y-2">
                                  {invoice.parsed_data.items.map(
                                    (item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between items-center p-3 rounded-lg bg-muted/50 text-sm"
                                      >
                                        <span className="flex-1">
                                          {item.description}
                                        </span>
                                        <span className="text-muted-foreground mx-2">
                                          Qty: {item.quantity}
                                        </span>
                                        <span className="text-muted-foreground mx-2">
                                          @ ${item.unit_price}
                                        </span>
                                        <span className="font-medium">
                                          ${item.total}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
