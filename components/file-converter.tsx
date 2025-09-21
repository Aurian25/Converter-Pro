"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, ImageIcon, Download, ArrowRight, CheckCircle } from "lucide-react"
import jsPDF from "jspdf"

interface FileWithPreview extends File {
  preview?: string
}

interface ConvertedFile {
  filename: string
  url: string
}

const supportedFormats = {
  document: ["pdf", "docx", "doc", "txt", "rtf"],
  presentation: ["pptx", "ppt", "odp"],
  image: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"],
  other: ["csv", "xlsx", "xls"],
}

const formatCategories = {
  pdf: "document",
  docx: "document",
  doc: "document",
  txt: "document",
  rtf: "document",
  pptx: "presentation",
  ppt: "presentation",
  odp: "presentation",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  bmp: "image",
  webp: "image",
  svg: "image",
  csv: "other",
  xlsx: "other",
  xls: "other",
}

export function FileConverter() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [outputFormat, setOutputFormat] = useState<string>("")
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [error, setError] = useState<string>("")

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }),
    )
    setFiles((prev) => [...prev, ...filesWithPreview])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
      "application/rtf": [".rtf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  })

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toLowerCase() || ""
  }

  const getAvailableOutputFormats = () => {
    if (files.length === 0) return []

    const inputFormat = getFileExtension(files[0].name)
    const inputCategory = formatCategories[inputFormat as keyof typeof formatCategories]

    if (!inputCategory) return []

    let availableFormats: string[] = []

    if (inputCategory === "image") {
      // Images can convert to other image formats and PDF
      availableFormats = [
        ...supportedFormats.image.filter((format) => format !== inputFormat),
        "pdf", // Allow image to PDF conversion
      ]
    } else if (inputFormat === "pdf") {
      // PDF can convert to images and other document formats
      availableFormats = [
        ...supportedFormats.image, // Allow PDF to image conversion
        ...supportedFormats.document.filter((format) => format !== "pdf"),
      ]
    } else if (inputCategory === "document") {
      // Documents can convert to other document formats and PDF
      availableFormats = [
        ...supportedFormats.document.filter((format) => format !== inputFormat),
        "pdf", // Ensure PDF is always available for documents
      ]
    } else {
      // For other categories, show same category formats
      availableFormats = supportedFormats[inputCategory as keyof typeof supportedFormats].filter(
        (format) => format !== inputFormat,
      )
    }

    return availableFormats
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setOutputFormat("")
    setConvertedFiles([])
  }

  const convertImageToPdf = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        try {
          const pdf = new jsPDF()
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          // Calculate dimensions to fit the image in PDF page
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = pdf.internal.pageSize.getHeight()
          const imgRatio = img.width / img.height
          const pdfRatio = pdfWidth / pdfHeight

          let finalWidth, finalHeight
          if (imgRatio > pdfRatio) {
            finalWidth = pdfWidth
            finalHeight = pdfWidth / imgRatio
          } else {
            finalHeight = pdfHeight
            finalWidth = pdfHeight * imgRatio
          }

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          const imgData = canvas.toDataURL("image/jpeg", 0.95)
          pdf.addImage(imgData, "JPEG", 0, 0, finalWidth, finalHeight)

          const pdfBlob = pdf.output("blob")
          resolve(pdfBlob)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(file)
    })
  }

  const convertImageFormat = async (file: File, targetFormat: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error("Failed to convert image"))
              }
            },
            `image/${targetFormat === "jpg" ? "jpeg" : targetFormat}`,
            0.95,
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(file)
    })
  }

  const handleConvert = async () => {
    if (files.length === 0 || !outputFormat) return

    setIsConverting(true)
    setProgress(0)
    setError("")

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const inputFormat = getFileExtension(file.name)

        setProgress((i / files.length) * 50)

        let convertedBlob: Blob

        // Handle different conversion types
        if (inputFormat === "png" || inputFormat === "jpg" || inputFormat === "jpeg") {
          if (outputFormat === "pdf") {
            convertedBlob = await convertImageToPdf(file)
          } else {
            convertedBlob = await convertImageFormat(file, outputFormat)
          }
        } else {
          // For other formats, fall back to server-side conversion
          const formData = new FormData()
          formData.append("file", file)
          formData.append("outputFormat", outputFormat)

          const response = await fetch("/api/convert", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`Server conversion failed: ${response.statusText}`)
          }

          convertedBlob = await response.blob()
        }

        setProgress(((i + 1) / files.length) * 100)

        // Create download URL for the converted file
        const url = URL.createObjectURL(convertedBlob)
        const filename = `${file.name.split(".")[0]}.${outputFormat}`

        setConvertedFiles((prev) => [...prev, { filename, url }])
      }
    } catch (error) {
      console.error("Conversion error:", error)
      setError(error instanceof Error ? error.message : "Conversion failed. Please try again.")
    } finally {
      setIsConverting(false)
    }
  }

  const downloadFile = (filename: string, url: string) => {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename)
    const category = formatCategories[ext as keyof typeof formatCategories]

    switch (category) {
      case "image":
        return <ImageIcon className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4 text-balance">Universal File Converter</h1>
        <p className="text-xl text-muted-foreground text-balance">
          Convert your documents, presentations, and images between formats instantly
        </p>
      </div>

      {/* Main Converter Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload & Convert Files
          </CardTitle>
          <CardDescription>
            Drag and drop your files or click to browse. Supports PDF, DOCX, PPTX, images, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg text-primary">Drop your files here...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground">Supports: PDF, DOCX, PPTX, JPG, PNG, and more</p>
              </div>
            )}
          </div>

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Uploaded Files</h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.name)}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <Badge variant="secondary">{getFileExtension(file.name).toUpperCase()}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format Selection */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Convert To</h3>
              <div className="flex items-center gap-4">
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select output format" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableOutputFormats().map((format) => (
                      <SelectItem key={format} value={format}>
                        {format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-sm">
                  {outputFormat ? outputFormat.toUpperCase() : "Select format"}
                </Badge>
              </div>
            </div>
          )}

          {/* Convert Button */}
          {files.length > 0 && outputFormat && (
            <Button onClick={handleConvert} disabled={isConverting} className="w-full" size="lg">
              {isConverting ? "Converting..." : "Convert Files"}
            </Button>
          )}

          {/* Progress */}
          {isConverting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Converting files...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Converted Files */}
          {convertedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-green-700">Conversion Complete!</h3>
              </div>
              <div className="space-y-2">
                {convertedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.filename)}
                      <div>
                        <p className="font-medium">{file.filename}</p>
                        <p className="text-sm text-muted-foreground">Ready for download</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {outputFormat.toUpperCase()}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => downloadFile(file.filename, file.url)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Document Conversion</h3>
            <p className="text-sm text-muted-foreground">
              Convert DOCX to PDF/TXT, TXT to PDF, and more document formats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Image Processing</h3>
            <p className="text-sm text-muted-foreground">Convert between JPG, PNG, WebP and create PDFs from images</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Instant Download</h3>
            <p className="text-sm text-muted-foreground">Get your converted files ready for download in seconds</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Your files are processed securely and deleted after conversion.</p>
      </div>
    </div>
  )
}
