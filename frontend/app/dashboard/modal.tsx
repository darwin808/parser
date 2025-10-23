import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  FileText,
  AlertCircle,
  Download,
  Eye,
  Copy,
  Check,
  Code2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  previewOpen: Boolean | undefined;
  setPreviewOpen: () => void;
  selectedInvoice: any;
  handleCopyJSON: () => void;
  handleDownloadJSON: () => void;
  JSONViewer: React.ReactNode;

  copied: Boolean | undefined;
};
export const Modal = ({
  previewOpen,
  setPreviewOpen,
  selectedInvoice,
  handleCopyJSON,
  handleDownloadJSON,
  JSONViewer,
  copied,
}: Props) => {
  return (
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="!max-w-[80rem] sm:!max-w-[80rem] w-[95vw]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {selectedInvoice?.file_name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  View document and parsed data
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={
                selectedInvoice?.status === "completed"
                  ? "default"
                  : "secondary"
              }
            >
              {selectedInvoice?.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex gap-6 p-6 h-[calc(90vh-120px)]">
          {/* Left Side - Document Preview */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Document Preview</h3>
            </div>
            {selectedInvoice?.file_url ? (
              <div className="flex-1 border-2 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 shadow-inner">
                {selectedInvoice.file_url.endsWith(".pdf") ? (
                  <iframe
                    src={selectedInvoice.file_url}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={selectedInvoice.file_url}
                    alt={selectedInvoice.file_name}
                    className="w-full h-full object-contain p-4"
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Preview not available</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - JSON Data */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Parsed Data (JSON)</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJSON}
                  className={copied ? "border-green-500 text-green-600" : ""}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJSON}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            <div className="flex-1 relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-lg flex flex-col">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-xs font-mono text-slate-300">
                    parsed_data.json
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-700 text-slate-200"
                >
                  <Code2 className="h-3 w-3 mr-1" />
                  JSON
                </Badge>
              </div>

              <div className="flex-1 bg-slate-950 p-6 overflow-auto">
                <pre className="font-mono text-sm leading-relaxed w-full">
                  <JSONViewer data={selectedInvoice?.parsed_data} />
                </pre>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span>
                This JSON can be used directly in your applications via API
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
