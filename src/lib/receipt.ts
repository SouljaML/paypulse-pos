// Draws the customer receipt as a picture, so the printed slip looks exactly
// like the preview: big PayPulse logo, any shop name or address, no
// character-set problems. The picture is then sent to the printer as a bitmap.
//
// Paper: 58 mm roll = 384 dots wide (the default). An 80 mm roll is 576.

export interface ReceiptData {
  merchantName: string | null
  shopName: string | null
  shopAddress: string | null
  tillLabel: string | null
  receiptNumber: string
  providerName: string | null
  customerMsisdn: string
  amount: string
  currency: string
  reference: string | null
  confirmedAt: string | null
}

// Anything with the parts of the 2D drawing API used below (a browser canvas,
// or a canvas library when the sample is made on a computer).
type Ctx = CanvasRenderingContext2D

export const PAPER_58 = 384
export const PAPER_80 = 576

const INK = '#000'
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'

/** 266 58 123 456 -> 266 58*** *56: first digits and last two stay, middle is hidden. */
export function maskMsisdn(m: string): string {
  const d = m.replace(/\D/g, '')
  if (d.length <= 6) return d
  return d.slice(0, 5) + '*'.repeat(d.length - 7) + d.slice(-2)
}

export function formatDateTime(iso: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date()
  const tz = { timeZone: 'Africa/Maseru' } as const
  return {
    date: d.toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' }),
  }
}

function money(amount: string): string {
  const n = Number(amount)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount
}

/** The PayPulse mark in one colour: a P whose coin bowl gathers payment streams. */
export function drawMark(ctx: Ctx, x: number, y: number, size: number): void {
  const s = size / 100
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = INK
  ctx.beginPath()
  const r = 24
  ctx.moveTo(r, 0)
  ctx.lineTo(100 - r, 0)
  ctx.arcTo(100, 0, 100, r, r)
  ctx.lineTo(100, 100 - r)
  ctx.arcTo(100, 100, 100 - r, 100, r)
  ctx.lineTo(r, 100)
  ctx.arcTo(0, 100, 0, 100 - r, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath()
  ctx.fill()

  // Centre the artwork in the tile.
  ctx.translate(50 - 42.75, 50 - 52)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(36, 78)
  ctx.lineTo(36, 26)
  ctx.lineTo(52, 26)
  ctx.arc(52, 47, 21, -Math.PI / 2, Math.PI / 2, false)
  ctx.lineTo(36, 68)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(10, 40)
  ctx.lineTo(26, 40)
  ctx.moveTo(10, 60)
  ctx.lineTo(26, 60)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(54, 47, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width <= maxWidth || !line) line = test
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Paints the receipt. `make(width, height)` creates a canvas; the height is
 * found by measuring first, so the slip is exactly as long as it needs to be.
 */
export function drawReceipt<C extends { getContext(t: '2d'): unknown }>(
  r: ReceiptData,
  make: (w: number, h: number) => C,
  width = PAPER_58,
): C {
  const pad = Math.round(width * 0.04)
  const inner = width - pad * 2
  const k = width / PAPER_58 // text scales up on 80 mm paper

  // First pass measures, second pass paints; both run the same code.
  function paint(ctx: Ctx | null): number {
    // A measuring context is needed even in the first pass.
    const c = ctx ?? (make(width, 10).getContext('2d') as Ctx)
    const draw = ctx !== null
    let y = pad
    const font = (px: number, bold = false) => (c.font = `${bold ? '700 ' : '400 '}${Math.round(px * k)}px ${SANS}`)

    const center = (text: string, px: number, bold = false, gap = 6) => {
      font(px, bold)
      for (const line of wrap(c, text, inner)) {
        y += px * k
        if (draw) {
          c.textAlign = 'center'
          c.fillText(line, width / 2, y)
        }
        y += gap * k
      }
    }
    const rule = (dash = true) => {
      y += 8 * k
      if (draw) {
        c.save()
        c.strokeStyle = INK
        c.lineWidth = 2
        if (dash) c.setLineDash([6, 5])
        c.beginPath()
        c.moveTo(pad, y)
        c.lineTo(width - pad, y)
        c.stroke()
        c.restore()
      }
      y += 14 * k
    }
    const kv = (label: string, value: string) => {
      const px = 21
      font(px)
      const lw = c.measureText(label).width
      font(px, true)
      const vw = c.measureText(value).width
      y += px * k
      if (lw + vw + 12 * k <= inner) {
        if (draw) {
          font(px)
          c.textAlign = 'left'
          c.fillText(label, pad, y)
          font(px, true)
          c.textAlign = 'right'
          c.fillText(value, width - pad, y)
        }
      } else {
        // Long value (a provider reference): label above, value on its own line.
        if (draw) {
          font(px)
          c.textAlign = 'left'
          c.fillText(label, pad, y)
        }
        y += (px + 4) * k
        font(18, true)
        const lines = wrap(c, value, inner)
        for (const line of lines) {
          if (draw) {
            c.textAlign = 'right'
            c.fillText(line, width - pad, y)
          }
          y += 22 * k
        }
        y -= 22 * k
      }
      y += 10 * k
    }

    if (draw) {
      c.fillStyle = '#fff'
      c.fillRect(0, 0, width, 100000)
      c.fillStyle = INK
      c.textBaseline = 'alphabetic'
    }

    // Header: who you paid
    if (r.merchantName) center(r.merchantName, 28, true, 4)
    if (r.shopName && r.shopName !== r.merchantName) center(r.shopName, 22, true, 4)
    if (r.shopAddress) center(r.shopAddress, 19, false, 4)
    if (r.tillLabel) center(r.tillLabel, 19, false, 4)
    rule()

    // The payment
    center('PAYMENT RECEIPT', 20, true, 8)
    center(`${r.currency} ${money(r.amount)}`, 46, true, 8)
    // CONFIRMED stamp
    font(22, true)
    const stamp = 'CONFIRMED'
    const sw = c.measureText(stamp).width + 36 * k
    y += 4 * k
    if (draw) {
      c.lineWidth = 3
      c.strokeStyle = INK
      c.strokeRect(width / 2 - sw / 2, y, sw, 38 * k)
      c.textAlign = 'center'
      c.fillText(stamp, width / 2, y + 27 * k)
    }
    y += 38 * k + 6 * k
    rule()

    // The details
    const { date, time } = formatDateTime(r.confirmedAt)
    if (r.providerName) kv('Paid with', r.providerName)
    kv('Paid by', maskMsisdn(r.customerMsisdn))
    kv('Date', date)
    kv('Time', time)
    kv('Receipt no.', r.receiptNumber)
    if (r.reference) kv('Reference', r.reference)
    rule()

    center('Thank you!', 24, true, 6)
    center('Keep this slip as proof of payment.', 17, false, 8)
    y += 14 * k

    // Powered by PayPulse, with the logo big
    center('Powered by', 20, false, 8)
    const logo = Math.round(140 * k)
    if (draw) drawMark(c, width / 2 - logo / 2, y, logo)
    y += logo + 12 * k
    center('PayPulse', 44, true, 6)

    y += 56 * k // blank paper so the tear/cut clears the text
    return y
  }

  const height = Math.ceil(paint(null))
  const canvas = make(width, height)
  paint(canvas.getContext('2d') as Ctx)
  return canvas
}

/** Browser/Android WebView: the receipt as a PNG data URL, ready for the printer. */
export function receiptToDataUrl(r: ReceiptData, width = PAPER_58): string {
  const canvas = drawReceipt(r, (w, h) => {
    const el = document.createElement('canvas')
    el.width = w
    el.height = h
    return el
  }, width)
  return canvas.toDataURL('image/png')
}

export const SAMPLE_RECEIPT: ReceiptData = {
  merchantName: 'Moshoeshoe Trading',
  shopName: 'Maseru Mall branch',
  shopAddress: 'Shop 14, Maseru Mall, Kingsway, Maseru',
  tillLabel: 'Till 2',
  receiptNumber: 'RCP-000184',
  providerName: 'C-Pay',
  customerMsisdn: '26658123456',
  amount: '150',
  currency: 'LSL',
  reference: 'CP2910-77A4B2',
  confirmedAt: '2026-10-29T14:32:00+02:00',
}
