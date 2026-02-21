"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Upload, Loader2, FileText, Download } from "lucide-react";
import { getDocuments, uploadDocument, deleteDocument } from "@/actions/documents";
import { format } from "date-fns";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Document = {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
  publishedDate: Date | null;
};

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function loadDocuments() {
    const docs = await getDocuments();
    setDocuments(docs);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleUpload(formData: FormData) {
    setUploading(true);
    try {
      await uploadDocument(formData);
      await loadDocuments();
      setDialogOpen(false);
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const categoryLabels: Record<string, string> = {
    minutes: "Meeting Minutes",
    agm: "AGM",
    policy: "Policy",
    report: "Report",
    other: "Other",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Upload and manage meeting minutes, AGM documents, and policies.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a PDF or document file. It will be publicly accessible on the website.
              </DialogDescription>
            </DialogHeader>
            <form action={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title *</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select name="category" required defaultValue="minutes">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Meeting Minutes</SelectItem>
                    <SelectItem value="agm">AGM</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishedDate">Document Date</Label>
                <Input type="date" id="publishedDate" name="publishedDate" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <Input
                  type="file"
                  id="file"
                  name="file"
                  required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
              </div>
              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {documents.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <FolderOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No documents yet</CardTitle>
            <CardDescription>Upload your first document to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {categoryLabels[doc.category] || doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {doc.publishedDate
                      ? format(doc.publishedDate, "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </Button>
                      <DeleteButton
                        id={doc.id}
                        action={deleteDocument}
                        label="Delete document"
                        description="This will permanently delete the document file and its record."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
