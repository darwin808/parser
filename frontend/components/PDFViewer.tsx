"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: string | File;
  className?: string;
  width?: number | string;
  height?: number | string;
  containerWidth?: number | string;
  containerHeight?: number | string;
}

export default function PDFViewer({
  file,
  className = "",
  width,
  height,
  containerWidth = "100%",
  containerHeight = "800px",
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError("");
  }

  function onDocumentLoadError(error: Error) {
    setLoading(false);
    setError(`Failed to load PDF: ${error.message}`);
    console.error("PDF load error:", error);
  }

  const goToPreviousPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  return (
    <div className={`pdf-viewer-container ${className}`}>
      {/* Controls */}
      <div className="pdf-controls" style={controlsStyle}>
        <div className="navigation-controls">
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            style={buttonStyle}
          >
            Previous
          </button>
          <span style={{ margin: "0 1rem" }}>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={buttonStyle}
          >
            Next
          </button>
        </div>

        <div className="zoom-controls" style={{ marginLeft: "2rem" }}>
          <button onClick={zoomOut} style={buttonStyle}>
            Zoom Out
          </button>
          <span style={{ margin: "0 1rem" }}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} style={buttonStyle}>
            Zoom In
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && <div style={errorStyle}>{error}</div>}

      {/* PDF Document */}
      <div
        className="pdf-document-wrapper"
        style={{
          ...documentWrapperStyle,
          width: containerWidth,
          height: containerHeight,
        }}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div style={loadingStyle}>Loading PDF...</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={
              width
                ? typeof width === "string"
                  ? undefined
                  : width
                : undefined
            }
            height={
              height
                ? typeof height === "string"
                  ? undefined
                  : height
                : undefined
            }
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

// Styles
const controlsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "1rem",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #ddd",
  flexWrap: "wrap",
  gap: "1rem",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
};

const documentWrapperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "2rem",
  backgroundColor: "#525659",
  overflow: "auto",
};

const loadingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "500px",
  fontSize: "18px",
  color: "#666",
};

const errorStyle: React.CSSProperties = {
  padding: "1rem",
  backgroundColor: "#fee",
  color: "#c33",
  border: "1px solid #fcc",
  borderRadius: "4px",
  margin: "1rem",
};
