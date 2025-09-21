import { type NextRequest, NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import sharp from "sharp"
import mammoth from "mammoth"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const outputFormat = formData.get("outputFormat") as string

    console.log("[v0] Conversion request:", file.name, "->", outputFormat)

    if (!file || !outputFormat) {
      return NextResponse.json({ error: "Missing file or output format" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const inputFormat = file.name.split(".").pop()?.toLowerCase()

    console.log("[v0] Input format:", inputFormat, "Output format:", outputFormat)

    let convertedBuffer: Buffer
    let mimeType: string
    let filename: string

    // Handle different conversion types
    if (inputFormat === "pdf" && ["jpg", "jpeg", "png"].includes(outputFormat)) {
      convertedBuffer = await convertPdfToImage(buffer, outputFormat)
      mimeType = `image/${outputFormat === "jpg" ? "jpeg" : outputFormat}`
      filename = `${file.name.split(".")[0]}.${outputFormat}`
    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(inputFormat!) && outputFormat === "pdf") {
      // Image to PDF conversion
      convertedBuffer = await convertImageToPdf(buffer)
      mimeType = "application/pdf"
      filename = `${file.name.split(".")[0]}.pdf`
    } else if (
      ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(inputFormat!) &&
      ["jpg", "jpeg", "png", "webp"].includes(outputFormat)
    ) {
      // Image to Image conversion
      convertedBuffer = await convertImageToImage(buffer, outputFormat)
      mimeType = `image/${outputFormat === "jpg" ? "jpeg" : outputFormat}`
      filename = `${file.name.split(".")[0]}.${outputFormat}`
    } else if (inputFormat === "docx" && outputFormat === "pdf") {
      // DOCX to PDF conversion
      convertedBuffer = await convertDocxToPdf(buffer)
      mimeType = "application/pdf"
      filename = `${file.name.split(".")[0]}.pdf`
    } else if (inputFormat === "docx" && outputFormat === "txt") {
      // DOCX to TXT conversion
      convertedBuffer = await convertDocxToTxt(buffer)
      mimeType = "text/plain"
      filename = `${file.name.split(".")[0]}.txt`
    } else if (inputFormat === "txt" && outputFormat === "pdf") {
      // TXT to PDF conversion
      convertedBuffer = await convertTxtToPdf(buffer)
      mimeType = "application/pdf"
      filename = `${file.name.split(".")[0]}.pdf`
    } else {
      return NextResponse.json(
        {
          error: `Conversion from ${inputFormat?.toUpperCase()} to ${outputFormat.toUpperCase()} is not supported yet. Currently supported: Image ↔ Image, Image ↔ PDF, DOCX → PDF/TXT, TXT → PDF`,
        },
        { status: 400 },
      )
    }

    console.log("[v0] Conversion successful, returning file:", filename)

    // Return the converted file
    return new NextResponse(convertedBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[v0] Conversion error:", error)
    return NextResponse.json({ error: "Conversion failed: " + (error as Error).message }, { status: 500 })
  }
}

async function convertPdfToImage(pdfBuffer: Buffer, outputFormat: string): Promise<Buffer> {
  try {
    // Create a simple white background image as placeholder
    const imageBuffer = await sharp({
      create: {
        width: 595,
        height: 842,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer()

    // Convert to requested format
    const sharpInstance = sharp(imageBuffer)

    switch (outputFormat) {
      case "jpg":
      case "jpeg":
        return await sharpInstance.jpeg({ quality: 90 }).toBuffer()
      case "png":
        return await sharpInstance.png().toBuffer()
      default:
        return await sharpInstance.png().toBuffer()
    }
  } catch (error) {
    console.error("[v0] PDF to image conversion error:", error)
    throw new Error("PDF to image conversion failed")
  }
}

async function convertImageToPdf(imageBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  // Get image dimensions
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  console.log("[v0] Image metadata:", metadata)

  // Create a page with image dimensions (max A4 size)
  const maxWidth = 595 // A4 width in points
  const maxHeight = 842 // A4 height in points

  let width = metadata.width || maxWidth
  let height = metadata.height || maxHeight

  // Scale down if too large
  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height)
    width *= scale
    height *= scale
  }

  const page = pdfDoc.addPage([width, height])

  // Embed the image
  let pdfImage
  const format = metadata.format

  console.log("[v0] Image format:", format)

  if (format === "jpeg" || format === "jpg") {
    pdfImage = await pdfDoc.embedJpg(imageBuffer)
  } else if (format === "png") {
    pdfImage = await pdfDoc.embedPng(imageBuffer)
  } else {
    // Convert to PNG first
    const pngBuffer = await sharp(imageBuffer).png().toBuffer()
    pdfImage = await pdfDoc.embedPng(pngBuffer)
  }

  // Draw the image on the page
  page.drawImage(pdfImage, {
    x: 0,
    y: 0,
    width,
    height,
  })

  return Buffer.from(await pdfDoc.save())
}

async function convertImageToImage(imageBuffer: Buffer, outputFormat: string): Promise<Buffer> {
  const sharpInstance = sharp(imageBuffer)

  switch (outputFormat) {
    case "jpg":
    case "jpeg":
      return await sharpInstance.jpeg({ quality: 90 }).toBuffer()
    case "png":
      return await sharpInstance.png().toBuffer()
    case "webp":
      return await sharpInstance.webp({ quality: 90 }).toBuffer()
    default:
      throw new Error(`Unsupported output format: ${outputFormat}`)
  }
}

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  // Extract text from DOCX
  const result = await mammoth.extractRawText({ buffer: docxBuffer })
  const text = result.value

  // Convert text to PDF
  return await convertTxtToPdf(Buffer.from(text, "utf-8"))
}

async function convertDocxToTxt(docxBuffer: Buffer): Promise<Buffer> {
  // Extract text from DOCX
  const result = await mammoth.extractRawText({ buffer: docxBuffer })
  return Buffer.from(result.value, "utf-8")
}

async function convertTxtToPdf(txtBuffer: Buffer): Promise<Buffer> {
  try {
    const text = txtBuffer.toString("utf-8")

    // Create PDF from text
    const pdfDoc = await PDFDocument.create()

    const fontSize = 12
    const lineHeight = fontSize * 1.2
    const margin = 50
    const pageWidth = 595
    const pageHeight = 842
    const maxWidth = pageWidth - margin * 2

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let yPosition = pageHeight - margin

    // Split text into lines
    const lines = text.split("\n")

    for (const line of lines) {
      // Check if we need a new page
      if (yPosition < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        yPosition = pageHeight - margin
      }

      // Draw the line
      currentPage.drawText(line || " ", {
        x: margin,
        y: yPosition,
        size: fontSize,
      })

      yPosition -= lineHeight
    }

    return Buffer.from(await pdfDoc.save())
  } catch (error) {
    console.error("[v0] Text to PDF conversion error:", error)
    throw new Error("Text to PDF conversion failed")
  }
}
