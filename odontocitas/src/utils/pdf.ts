import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { configuracionAPI, type ConfiguracionGeneral } from '../api/configuracion'

// Paleta de la aplicación (mismos colores que la UI).
const PRIMARY: [number, number, number] = [193, 122, 90] // #C17A5A
const DARK: [number, number, number] = [61, 43, 31] // #3D2B1F
const MUTED: [number, number, number] = [139, 115, 85] // #8B7355
const LIGHT: [number, number, number] = [245, 239, 230] // #F5EFE6
const BORDER: [number, number, number] = [212, 196, 176] // #D4C4B0

const MARGIN = 14
const TOP = 46
const BOTTOM = 18

export type BloquePDF =
  | { tipo: 'tabla'; titulo?: string; columnas: string[]; filas: (string | number)[][] }
  | { tipo: 'kv'; titulo?: string; filas: [string, string][] }
  | { tipo: 'texto'; titulo?: string; texto: string }

export interface OpcionesPDF {
  titulo: string
  subtitulo?: string
  archivo: string
  bloques: BloquePDF[]
  /** Nota reglamentaria que aparece en el pie de cada página. */
  notaLegal?: string
}

// Config de la clínica cacheada para no pedirla en cada exportación.
let clinicaCache: ConfiguracionGeneral | null = null
async function obtenerClinica(): Promise<ConfiguracionGeneral | null> {
  if (clinicaCache) return clinicaCache
  try {
    clinicaCache = await configuracionAPI.obtener()
  } catch {
    clinicaCache = null
  }
  return clinicaCache
}

function fechaLarga(): string {
  return new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
}

export async function exportarPDF(opts: OpcionesPDF): Promise<void> {
  const clinica = await obtenerClinica()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  let y = TOP

  const nuevaPaginaSiHaceFalta = (necesario: number) => {
    if (y + necesario > pageHeight - BOTTOM) {
      doc.addPage()
      y = TOP
    }
  }

  for (const bloque of opts.bloques) {
    if (bloque.titulo) {
      nuevaPaginaSiHaceFalta(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...PRIMARY)
      doc.text(bloque.titulo, MARGIN, y)
      y += 6
    }

    if (bloque.tipo === 'tabla') {
      autoTable(doc, {
        startY: y,
        head: [bloque.columnas],
        body: bloque.filas.map(f => f.map(c => String(c ?? ''))),
        margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
        styles: { fontSize: 8, textColor: DARK, cellPadding: 2, lineColor: BORDER, lineWidth: 0.1 },
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: LIGHT },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    } else if (bloque.tipo === 'kv') {
      autoTable(doc, {
        startY: y,
        body: bloque.filas.map(([k, v]) => [k, v]),
        margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
        theme: 'plain',
        styles: { fontSize: 9, textColor: DARK, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 55 },
          1: { textColor: DARK },
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...DARK)
      const lineas = doc.splitTextToSize(bloque.texto || '—', contentWidth)
      for (const linea of lineas as string[]) {
        nuevaPaginaSiHaceFalta(6)
        doc.text(linea, MARGIN, y)
        y += 5
      }
      y += 4
    }
  }

  // Encabezado y pie de página (se dibujan al final, en todas las páginas).
  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    dibujarEncabezado(doc, pageWidth, clinica, opts.titulo, opts.subtitulo)
    dibujarPie(doc, pageWidth, pageHeight, p, totalPaginas, clinica, opts.notaLegal)
  }

  doc.save(opts.archivo)
}

function dibujarEncabezado(
  doc: jsPDF,
  pageWidth: number,
  clinica: ConfiguracionGeneral | null,
  titulo: string,
  subtitulo?: string,
) {
  const nombre = clinica?.nombre_clinica || 'Clínica Odontocitas'
  // Banda superior con color primario.
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pageWidth, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(nombre, MARGIN, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const linea2 = [
    clinica?.nit ? `NIT: ${clinica.nit}` : null,
    clinica?.telefono ? `Tel: ${clinica.telefono}` : null,
    clinica?.email || null,
  ].filter(Boolean).join('   •   ')
  if (linea2) doc.text(linea2, MARGIN, 17)
  const linea3 = [clinica?.direccion, clinica?.ciudad].filter(Boolean).join(', ')
  if (linea3) doc.text(linea3, MARGIN, 22)

  // Título del documento debajo de la banda.
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(titulo, MARGIN, 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  if (subtitulo) doc.text(subtitulo, MARGIN, 41)
  doc.text(`Generado: ${fechaLarga()}`, pageWidth - MARGIN, 36, { align: 'right' })
}

function dibujarPie(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  pagina: number,
  total: number,
  clinica: ConfiguracionGeneral | null,
  notaLegal?: string,
) {
  const yLinea = pageHeight - 12
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, yLinea, pageWidth - MARGIN, yLinea)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  const nombre = clinica?.nombre_clinica || 'Clínica Odontocitas'
  const nota = notaLegal
    || `Documento generado por ${nombre}. Información confidencial de uso interno y reglamentario.`
  const notaLineas = doc.splitTextToSize(nota, pageWidth - MARGIN * 2 - 30) as string[]
  doc.text(notaLineas[0] ?? '', MARGIN, yLinea + 5)
  doc.text(`Página ${pagina} de ${total}`, pageWidth - MARGIN, yLinea + 5, { align: 'right' })
}
