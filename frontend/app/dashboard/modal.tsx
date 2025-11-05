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
import PDFViewer from "@/components/PDFViewer";

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
        <DialogHeader className="px-6 pt-6 pb-4 border-b-[4px] border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary border-[3px] border-black flex items-center justify-center brutalist-shadow-sm">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
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
              <div className="flex-1 border-[4px] border-black overflow-hidden bg-secondary brutalist-shadow">
                <PDFViewer
                  file={selectedInvoice?.file_url}
                  width={300}
                  containerWidth="350px"
                  containerHeight="400px"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-[4px] border-dashed border-black bg-secondary">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground font-bold">Preview not available</p>
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
                  className={copied ? "border-primary bg-accent text-primary" : ""}
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

            <div className="flex-1 relative overflow-hidden border-[4px] border-black brutalist-shadow flex flex-col">
              <div className="bg-black px-4 py-3 border-b-[4px] border-black flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 bg-destructive border-[2px] border-black"></div>
                    <div className="w-3 h-3 bg-[#F59E0B] border-[2px] border-black"></div>
                    <div className="w-3 h-3 bg-primary border-[2px] border-black"></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    parsed_data.json
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-white text-black border-[2px] border-black"
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

            <div className="flex items-center gap-2 text-xs bg-accent border-[3px] border-black p-3 mt-4 brutalist-shadow-sm">
              <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">
                This JSON can be used directly in your applications via API
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
