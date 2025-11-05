"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { invoiceAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  FolderOpen,
  Settings,
  Bell,
  Search,
  DollarSign,
  FileCheck,
  Clock,
  Menu,
  Download,
  Eye,
  Filter,
  Calendar,
  BarChart3,
  LogOut,
} from "lucide-react";
import { Modal } from "./modal";

// JSON Syntax Highlighter Component
const JSONViewer = ({ data }) => {
  const syntaxHighlight = (json) => {
    if (!json) return "";

    json = JSON.stringify(json, null, 2);
    json = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "text-blue-400"; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-purple-400"; // key
          } else {
            cls = "text-green-400"; // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-yellow-400"; // boolean
        } else if (/null/.test(match)) {
          cls = "text-red-400"; // null
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
  };

  return (
    <div
      className="json-viewer"
      dangerouslySetInnerHTML={{ __html: syntaxHighlight(data) }}
    />
  );
};

function DashboardContent() {
  const { user, signOut } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");

  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("invoice");
  const [customFields, setCustomFields] = useState([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [copied, setCopied] = useState(false);

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

  const stats = {
    total: invoices.length,
    completed: invoices.filter((inv) => inv.status === "completed").length,
    processing: invoices.filter((inv) => inv.status === "processing").length,
    totalAmount: invoices
      .filter((inv) => inv.parsed_data?.total)
      .reduce((sum, inv) => sum + parseFloat(inv.parsed_data.total || 0), 0)
      .toFixed(2),
  };

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

  const handlePreview = (invoice) => {
    setSelectedInvoice(invoice);
    setPreviewOpen(true);
    setCopied(false);
  };

  const handleCopyJSON = () => {
    if (selectedInvoice?.parsed_data) {
      const jsonString = JSON.stringify(selectedInvoice.parsed_data, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadJSON = () => {
    if (selectedInvoice?.parsed_data) {
      const jsonString = JSON.stringify(selectedInvoice.parsed_data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedInvoice.file_name.replace(/\.[^/.]+$/, "")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } bg-secondary border-r-[4px] border-black transition-all duration-300 flex flex-col`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b-[4px] border-black">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary border-[2px] border-black flex items-center justify-center brutalist-shadow-sm">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg">DocParse</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={!sidebarOpen ? "mx-auto" : ""}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => setActiveView("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2 border-[3px] transition-colors font-bold uppercase tracking-wide ${activeView === "dashboard" ? "bg-primary text-white border-black brutalist-shadow" : "bg-white text-black border-black hover:bg-accent"}`}
            >
              <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium text-xs">Dashboard</span>}
            </button>
            <button
              onClick={() => setActiveView("documents")}
              className={`w-full flex items-center gap-3 px-3 py-2 border-[3px] transition-colors font-bold uppercase tracking-wide ${activeView === "documents" ? "bg-primary text-white border-black brutalist-shadow" : "bg-white text-black border-black hover:bg-accent"}`}
            >
              <FolderOpen className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium text-xs">Documents</span>}
            </button>
            <button
              onClick={() => setActiveView("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2 border-[3px] transition-colors font-bold uppercase tracking-wide ${activeView === "analytics" ? "bg-primary text-white border-black brutalist-shadow" : "bg-white text-black border-black hover:bg-accent"}`}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium text-xs">Analytics</span>}
            </button>
          </nav>

          <div className="p-4 border-t-[4px] border-black space-y-2">
            {/* User Profile */}
            <div
              className={`flex items-center gap-3 ${!sidebarOpen && "justify-center"}`}
            >
              <Avatar className="h-9 w-9 border-[2px] border-black">
                <AvatarFallback className="bg-primary text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Free Plan</p>
                </div>
              )}
            </div>

            {/* Logout Button */}
            {sidebarOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full text-destructive hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-white border-b-[4px] border-black flex items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search documents..." className="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white border-[4px] border-black brutalist-shadow-lg">
                <CardHeader className="pb-3">
                  <CardDescription className="text-muted-foreground uppercase font-bold text-xs">
                    Total Documents
                  </CardDescription>
                  <CardTitle className="text-4xl font-black">
                    {stats.total}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <FileText className="h-4 w-4" />
                    <span>All time</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white border-[4px] border-black brutalist-shadow-lg">
                <CardHeader className="pb-3">
                  <CardDescription className="text-white/90 uppercase font-bold text-xs">
                    Completed
                  </CardDescription>
                  <CardTitle className="text-4xl font-black">
                    {stats.completed}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-white/90 font-medium">
                    <FileCheck className="h-4 w-4" />
                    <span>
                      {stats.total > 0
                        ? ((stats.completed / stats.total) * 100).toFixed(0)
                        : 0}
                      % success
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[4px] border-black brutalist-shadow-lg">
                <CardHeader className="pb-3">
                  <CardDescription className="text-muted-foreground uppercase font-bold text-xs">
                    Processing
                  </CardDescription>
                  <CardTitle className="text-4xl font-black">
                    {stats.processing}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <Clock className="h-4 w-4" />
                    <span>In queue</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-accent text-black border-[4px] border-black brutalist-shadow-lg">
                <CardHeader className="pb-3">
                  <CardDescription className="text-black/70 uppercase font-bold text-xs">
                    Total Value
                  </CardDescription>
                  <CardTitle className="text-4xl font-black">
                    ${stats.totalAmount}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-black/70 font-medium">
                    <DollarSign className="h-4 w-4" />
                    <span>Processed</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upload Section */}
            <Card className="border-[4px] border-black border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Upload className="h-5 w-5 text-primary" />
                  Upload New Document
                </CardTitle>
                <CardDescription>
                  Upload documents for AI parsing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="document-type">Document Type</Label>
                    <Select
                      value={documentType}
                      onValueChange={setDocumentType}
                      disabled={uploading}
                    >
                      <SelectTrigger id="document-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">📄 Invoice</SelectItem>
                        <SelectItem value="receipt">🧾 Receipt</SelectItem>
                        <SelectItem value="purchase_order">
                          📋 Purchase Order
                        </SelectItem>
                        <SelectItem value="bill">💵 Bill</SelectItem>
                        <SelectItem value="other">📑 Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>File Upload</Label>
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
                      className={`flex items-center justify-center h-[42px] px-4 border-[3px] border-dashed cursor-pointer font-medium ${selectedFile ? "border-primary bg-accent text-primary" : "border-black hover:bg-accent"}`}
                    >
                      {selectedFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-bold text-primary truncate">
                            {selectedFile.name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Upload className="h-4 w-4" />
                          <span>Choose file</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {selectedFile && customFields.length > 0 && (
                  <div className="space-y-2">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Field name"
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

                {selectedFile && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCustomField}
                      disabled={uploading}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Custom Field
                    </Button>
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
                    {uploading && <Progress value={66} className="h-1" />}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Documents</CardTitle>
                    <CardDescription>
                      Latest processed documents
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">
                      No documents yet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Upload your first document above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <Card
                        key={invoice.id}
                        className="group hover:shadow-[6px_6px_0px_0px_#000000] transition-all"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-12 h-12 bg-primary border-[3px] border-black flex items-center justify-center flex-shrink-0 brutalist-shadow-sm">
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-base truncate">
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
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {new Date(
                                        invoice.created_at,
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {new Date(
                                        invoice.created_at,
                                      ).toLocaleTimeString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePreview(invoice)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(invoice.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {invoice.parsed_data && (
                            <>
                              <Separator className="my-4" />
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Invoice #
                                  </p>
                                  <p className="font-semibold">
                                    {invoice.parsed_data.invoice_number || "—"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Vendor
                                  </p>
                                  <p className="font-semibold">
                                    {invoice.parsed_data.vendor_name || "—"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Date
                                  </p>
                                  <p className="font-semibold">
                                    {invoice.parsed_data.invoice_date || "—"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground font-medium uppercase">
                                    Total
                                  </p>
                                  <p className="font-black text-xl text-primary">
                                    {invoice.parsed_data.currency || "$"}
                                    {invoice.parsed_data.total || "0.00"}
                                  </p>
                                </div>
                              </div>

                              {invoice.parsed_data.items?.length > 0 && (
                                <>
                                  <Separator className="my-4" />
                                  <div>
                                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                                      <span>Line Items</span>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {invoice.parsed_data.items.length}
                                      </Badge>
                                    </p>
                                    <div className="space-y-2">
                                      {invoice.parsed_data.items
                                        .slice(0, 3)
                                        .map((item, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm"
                                          >
                                            <span className="flex-1 font-medium truncate">
                                              {item.description}
                                            </span>
                                            <div className="flex items-center gap-4 text-muted-foreground">
                                              <span className="text-xs">
                                                Qty:{" "}
                                                <span className="font-semibold text-foreground">
                                                  {item.quantity}
                                                </span>
                                              </span>
                                              <span className="text-xs">
                                                @ ${item.unit_price}
                                              </span>
                                              <span className="font-bold text-foreground min-w-[80px] text-right">
                                                ${item.total}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      {invoice.parsed_data.items.length > 3 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                          +
                                          {invoice.parsed_data.items.length - 3}{" "}
                                          more items
                                        </p>
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
      </div>

      {/* Enhanced Preview Modal */}
      <Modal
        previewOpen={previewOpen}
        selectedInvoice={selectedInvoice}
        setPreviewOpen={setPreviewOpen}
        handleCopyJSON={handleCopyJSON}
        handleDownloadJSON={handleDownloadJSON}
        JSONViewer={JSONViewer}
        copied={copied}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
