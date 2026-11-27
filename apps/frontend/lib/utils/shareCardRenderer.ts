import type {
  ChallengeGridStatus,
  ChallengeSharePayload,
  DailySharePayload,
  ProfileSharePayload,
  ShareCardFormat,
  ShareCardTheme,
} from './shareCardData';

interface Palette {
  bgBase: string;
  bgGlowTop: string;
  bgGlowBottom: string;
  cardBg: string;
  cardBorder: string;
  rowBg: string;
  rowCompletedBg: string;
  rowCompletedBorder: string;
  pillBg: string;
  pillBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  track: string;
  accentRose: string;
  accentRoseSoft: string;
  accentEmerald: string;
  accentEmeraldSoft: string;
  accentAmber: string;
  accentAmberSoft: string;
  accentSky: string;
  gridFuture: string;
  gridPending: string;
  gridFail: string;
}

const DARK_PALETTE: Palette = {
  bgBase: '#090608',
  bgGlowTop: 'rgba(244, 63, 94, 0.24)',
  bgGlowBottom: 'rgba(136, 19, 55, 0.28)',
  cardBg: 'rgba(255, 255, 255, 0.045)',
  cardBorder: 'rgba(255, 255, 255, 0.11)',
  rowBg: 'rgba(255, 255, 255, 0.035)',
  rowCompletedBg: 'rgba(16, 185, 129, 0.09)',
  rowCompletedBorder: 'rgba(16, 185, 129, 0.22)',
  pillBg: 'rgba(255, 255, 255, 0.06)',
  pillBorder: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  track: 'rgba(255, 255, 255, 0.09)',
  accentRose: '#F43F5E',
  accentRoseSoft: 'rgba(244, 63, 94, 0.16)',
  accentEmerald: '#10B981',
  accentEmeraldSoft: 'rgba(16, 185, 129, 0.16)',
  accentAmber: '#F59E0B',
  accentAmberSoft: 'rgba(245, 158, 11, 0.16)',
  accentSky: '#38BDF8',
  gridFuture: 'rgba(255, 255, 255, 0.07)',
  gridPending: 'rgba(255, 255, 255, 0.22)',
  gridFail: 'rgba(239, 68, 68, 0.55)',
};

const LIGHT_PALETTE: Palette = {
  bgBase: '#FAF6F7',
  bgGlowTop: 'rgba(244, 63, 94, 0.12)',
  bgGlowBottom: 'rgba(251, 113, 133, 0.14)',
  cardBg: 'rgba(255, 255, 255, 0.92)',
  cardBorder: 'rgba(15, 23, 42, 0.09)',
  rowBg: 'rgba(15, 23, 42, 0.028)',
  rowCompletedBg: 'rgba(5, 150, 105, 0.065)',
  rowCompletedBorder: 'rgba(5, 150, 105, 0.20)',
  pillBg: 'rgba(15, 23, 42, 0.04)',
  pillBorder: 'rgba(15, 23, 42, 0.10)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  track: 'rgba(15, 23, 42, 0.08)',
  accentRose: '#E11D48',
  accentRoseSoft: 'rgba(225, 29, 72, 0.11)',
  accentEmerald: '#059669',
  accentEmeraldSoft: 'rgba(5, 150, 105, 0.12)',
  accentAmber: '#D97706',
  accentAmberSoft: 'rgba(217, 119, 6, 0.13)',
  accentSky: '#0284C7',
  gridFuture: 'rgba(15, 23, 42, 0.07)',
  gridPending: 'rgba(15, 23, 42, 0.20)',
  gridFail: 'rgba(220, 38, 38, 0.45)',
};

const FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function getCanvasDimensions(format: ShareCardFormat): { width: number; height: number } {
  return format === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
  lineWidth = 2
) {
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  accentColor: string
) {
  ctx.fillStyle = palette.bgBase;
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.12,
    40,
    width * 0.82,
    height * 0.12,
    width * 0.85
  );
  topGlow.addColorStop(0, palette.bgGlowTop);
  topGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const bottomGlow = ctx.createRadialGradient(
    width * 0.18,
    height * 0.86,
    40,
    width * 0.18,
    height * 0.86,
    width * 0.85
  );
  bottomGlow.addColorStop(0, palette.bgGlowBottom);
  bottomGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent line
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, width, 8);
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  border: string,
  textColor: string,
  fontSize = 24
): number {
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  const metrics = ctx.measureText(text);
  const padX = 28;
  const height = fontSize + 28;
  const width = metrics.width + padX * 2;
  fillRoundedRect(ctx, x, y, width, height, height / 2, bg, border, 2);
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + height / 2 + 1);
  return width;
}

function drawCheckIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  completed: boolean,
  palette: Palette
) {
  if (completed) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = palette.accentEmerald;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.42, cy + radius * 0.02);
    ctx.lineTo(cx - radius * 0.1, cy + radius * 0.34);
    ctx.lineTo(cx + radius * 0.44, cy - radius * 0.3);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(3, radius * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = palette.textMuted;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padX: number,
  handle: string | null,
  palette: Palette
) {
  const footerY = height - 88;
  ctx.strokeStyle = palette.cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, footerY - 36);
  ctx.lineTo(width - padX, footerY - 36);
  ctx.stroke();

  ctx.textBaseline = 'middle';

  if (handle) {
    ctx.font = `700 28px ${FONT_STACK}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = 'left';
    ctx.fillText(handle, padX, footerY);

    ctx.font = `600 22px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText('75 DAYS CHALLENGE · Lunita-Development', width - padX, footerY);
  } else {
    ctx.font = `600 24px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('75 DAYS CHALLENGE · Lunita-Development', width / 2, footerY);
  }
}

function drawCompactBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  border: string,
  textColor: string,
  fontSize = 18,
  padX = 18,
  padY = 10
): { width: number; height: number } {
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  const metrics = ctx.measureText(text);
  const height = fontSize + padY * 2;
  const width = metrics.width + padX * 2;
  fillRoundedRect(ctx, x, y, width, height, height / 2, bg, border, 1.5);
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + height / 2 + 1);
  return { width, height };
}

function drawFlameIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.bezierCurveTo(3.8, -6.5, 8.5, -3.5, 8.5, 2.5);
  ctx.bezierCurveTo(8.5, 7.6, 4.7, 11, 0, 11);
  ctx.bezierCurveTo(-4.7, 11, -8.5, 7.6, -8.5, 2.5);
  ctx.bezierCurveTo(-8.5, -1.2, -6.4, -4.5, -4.5, -6.5);
  ctx.bezierCurveTo(-4.4, -4.2, -3.2, -3.0, -2.2, -3.2);
  ctx.bezierCurveTo(-2.8, -6.2, -1.5, -9.2, 0, -11);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawSmallCheck(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.42, cy + size * 0.04);
  ctx.lineTo(cx - size * 0.1, cy + size * 0.36);
  ctx.lineTo(cx + size * 0.44, cy - size * 0.32);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, size * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawSmallCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  const r = size * 0.32;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, size * 0.2);
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function renderDailyShareCard(
  canvas: HTMLCanvasElement,
  payload: DailySharePayload,
  options: {
    format: ShareCardFormat;
    theme: ShareCardTheme;
    showGoalTitles: boolean;
  }
): HTMLCanvasElement {
  const { width, height } = getCanvasDimensions(options.format);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const palette = options.theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const accent = payload.isComplete ? palette.accentEmerald : palette.accentRose;
  const accentSoft = payload.isComplete ? palette.accentEmeraldSoft : palette.accentRoseSoft;
  const padX = 64;
  const contentW = width - padX * 2;
  const isStory = options.format === 'story';
  const cardRadius = 30;

  drawBackground(ctx, width, height, palette, accent);

  // --- Layout budget (optical vertical centering, zero dead void) ---
  const sectionGap = isStory ? 24 : 18;
  const headerH = isStory ? 112 : 94;
  const kpiRowH = isStory ? 216 : 178;
  const bottomBentoH = isStory ? 296 : 242;
  const footerReserve = isStory ? 124 : 104;
  const topMinY = isStory ? 72 : 52;
  const usableH = height - footerReserve - topMinY;

  const fixedNonTaskH = headerH + sectionGap + kpiRowH + sectionGap + sectionGap + bottomBentoH;
  const maxTasksCardH = Math.max(180, usableH - fixedNonTaskH);

  // Determine task row sizing & natural Tasks Card height
  const innerHeaderH = isStory ? 76 : 64;
  const innerBottomPad = isStory ? 30 : 22;
  let rowH = isStory ? 80 : 64;
  let rowGap = isStory ? 12 : 10;

  if (payload.items.length > 8) {
    rowH = isStory ? 64 : 52;
    rowGap = isStory ? 10 : 8;
  } else if (payload.items.length > 6) {
    rowH = isStory ? 72 : 58;
    rowGap = isStory ? 11 : 9;
  }

  let visibleItems = payload.items;
  let hiddenCount = 0;
  let tasksCardH: number;

  if (payload.totalCount === 0) {
    tasksCardH = isStory ? 190 : 156;
  } else if (!options.showGoalTitles) {
    tasksCardH = isStory ? 248 : 204;
  } else {
    const availForRows = maxTasksCardH - innerHeaderH - innerBottomPad;
    const maxFitAll = Math.max(1, Math.floor((availForRows + rowGap) / (rowH + rowGap)));
    if (payload.items.length <= maxFitAll) {
      visibleItems = payload.items;
      hiddenCount = 0;
    } else {
      const maxWithOverflow = Math.max(
        1,
        Math.floor((availForRows - 38 + rowGap) / (rowH + rowGap))
      );
      visibleItems = payload.items.slice(0, maxWithOverflow);
      hiddenCount = Math.max(0, payload.items.length - visibleItems.length);
    }

    const rowsBlockH =
      visibleItems.length * rowH +
      Math.max(0, visibleItems.length - 1) * rowGap +
      (hiddenCount > 0 ? 40 : 0);
    tasksCardH = Math.min(maxTasksCardH, innerHeaderH + rowsBlockH + innerBottomPad);
  }

  const totalStackH = fixedNonTaskH + tasksCardH;
  let cursorY = topMinY + Math.max(0, Math.round((usableH - totalStackH) * 0.44));

  // --- 1. Compact Top Header ---
  // Top micro-rail: status dot + date on left, plan pill on right
  ctx.beginPath();
  ctx.arc(padX + 6, cursorY + 13, 5, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.font = `700 ${isStory ? 20 : 18}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `ESTADO DEL DÍA  ·  ${payload.formattedDate.toUpperCase()}`,
    padX + 20,
    cursorY + 13
  );

  const planText = `PLAN ${payload.difficultyLabel.toUpperCase()}`;
  ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
  const planBadgeW = ctx.measureText(planText).width + 36;
  drawCompactBadge(
    ctx,
    width - padX - planBadgeW,
    cursorY - 5,
    planText,
    palette.pillBg,
    palette.pillBorder,
    palette.textSecondary,
    isStory ? 18 : 16,
    18,
    9
  );

  // Main title row: Día X / 75 on left, status pill on right
  const titleY = cursorY + (isStory ? 44 : 38);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `800 ${isStory ? 60 : 50}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  const dayTitle = `Día ${payload.dayNumber}`;
  ctx.fillText(dayTitle, padX, titleY);

  const dayTextW = ctx.measureText(dayTitle).width;
  ctx.font = `700 ${isStory ? 32 : 28}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(` / ${payload.totalDays}`, padX + dayTextW + 4, titleY + (isStory ? 22 : 17));

  ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
  const statusBadgeW = ctx.measureText(payload.statusLabel).width + 36;
  drawCompactBadge(
    ctx,
    width - padX - statusBadgeW,
    titleY + (isStory ? 12 : 8),
    payload.statusLabel,
    accentSoft,
    accent,
    accent,
    isStory ? 18 : 16,
    18,
    10
  );

  cursorY += headerH + sectionGap;

  // --- 2. Asymmetric Bento KPI Row (Today Progress 63% | Streak 37%) ---
  const kpiGap = isStory ? 20 : 16;
  const leftKpiW = Math.round((contentW - kpiGap) * 0.63);
  const rightKpiW = contentW - kpiGap - leftKpiW;

  // Left Bento Card: Compact Progress Ring + Daily Summary
  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    leftKpiW,
    kpiRowH,
    cardRadius,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const ringRadius = isStory ? 64 : 52;
  const ringStroke = isStory ? 14 : 12;
  const ringCx = padX + (isStory ? 40 : 32) + ringRadius;
  const ringCy = cursorY + kpiRowH / 2;

  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = palette.track;
  ctx.lineWidth = ringStroke;
  ctx.stroke();

  if (payload.progressPercent > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * payload.progressPercent) / 100;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = accent;
    ctx.lineWidth = ringStroke;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.font = `800 ${isStory ? 34 : 28}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${payload.progressPercent}%`, ringCx, ringCy + 1);

  const kpiInfoX = ringCx + ringRadius + (isStory ? 32 : 24);
  const kpiInfoMaxW = padX + leftKpiW - 28 - kpiInfoX;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${isStory ? 17 : 15}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('CUMPLIMIENTO', kpiInfoX, cursorY + (isStory ? 50 : 38));

  ctx.font = `800 ${isStory ? 38 : 32}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  const summaryMain =
    payload.totalCount === 0
      ? 'Sin tareas'
      : `${payload.completedCount} de ${payload.totalCount} tareas`;
  ctx.fillText(truncateText(ctx, summaryMain, kpiInfoMaxW), kpiInfoX, cursorY + (isStory ? 82 : 64));

  ctx.font = `500 ${isStory ? 22 : 19}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  const subSummary =
    payload.totalCount === 0
      ? 'Enfoque semanal / mensual'
      : payload.isComplete
        ? '¡Todas las metas cumplidas!'
        : `${payload.remainingCount} ${payload.remainingCount === 1 ? 'pendiente hoy' : 'pendientes hoy'}`;
  ctx.fillText(truncateText(ctx, subSummary, kpiInfoMaxW), kpiInfoX, cursorY + (isStory ? 134 : 108));

  // Right Bento Card: Streak Spotlight
  const rightKpiX = padX + leftKpiW + kpiGap;
  fillRoundedRect(
    ctx,
    rightKpiX,
    cursorY,
    rightKpiW,
    kpiRowH,
    cardRadius,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const streakPadX = isStory ? 32 : 26;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${isStory ? 17 : 15}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('RACHA ACTUAL', rightKpiX + streakPadX, cursorY + (isStory ? 36 : 28));

  // Amber flame badge top-right inside Streak card
  const flameBadgeR = isStory ? 22 : 18;
  const flameCx = rightKpiX + rightKpiW - streakPadX - flameBadgeR;
  const flameCy = cursorY + (isStory ? 46 : 36);
  ctx.beginPath();
  ctx.arc(flameCx, flameCy, flameBadgeR, 0, Math.PI * 2);
  ctx.fillStyle = palette.accentAmberSoft;
  ctx.fill();
  drawFlameIcon(ctx, flameCx, flameCy, isStory ? 24 : 20, palette.accentAmber);

  ctx.font = `800 ${isStory ? 62 : 52}px ${FONT_STACK}`;
  ctx.fillStyle = palette.accentAmber;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${payload.streak}`, rightKpiX + streakPadX, cursorY + (isStory ? 76 : 60));

  ctx.font = `600 ${isStory ? 22 : 19}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(
    payload.streak === 1 ? 'día seguido' : 'días seguidos',
    rightKpiX + streakPadX,
    cursorY + (isStory ? 152 : 124)
  );

  cursorY += kpiRowH + sectionGap;

  // --- 3. Compact Capsule Tasks Bento Card ---
  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    contentW,
    tasksCardH,
    cardRadius,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const innerPadX = padX + (isStory ? 36 : 30);
  const innerWidth = width - innerPadX * 2;
  const cardTopY = cursorY + (isStory ? 28 : 22);

  ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    options.showGoalTitles ? 'DETALLE DE TAREAS' : 'RESUMEN DE CUMPLIMIENTO',
    innerPadX,
    cardTopY
  );

  if (payload.totalCount > 0) {
    ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${payload.completedCount}/${payload.totalCount} LISTAS`,
      innerPadX + innerWidth,
      cardTopY
    );
  }

  const taskListStartY = cursorY + innerHeaderH;

  if (payload.totalCount === 0) {
    ctx.font = `500 ${isStory ? 26 : 22}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'No hay tareas diarias configuradas para este día.',
      innerPadX,
      taskListStartY + (tasksCardH - innerHeaderH - innerBottomPad) / 2
    );
  } else if (!options.showGoalTitles) {
    // Privacy mode: segmented bar + summary without exposing task names
    ctx.font = `700 ${isStory ? 30 : 25}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${payload.completedCount} completadas · ${payload.remainingCount} pendientes`,
      innerPadX,
      taskListStartY + 4
    );

    const segGap = 12;
    const segCount = payload.items.length;
    const segWidth = Math.max(22, (innerWidth - segGap * (segCount - 1)) / segCount);
    const segY = taskListStartY + (isStory ? 60 : 48);
    const segH = isStory ? 32 : 26;

    payload.items.forEach((item, idx) => {
      const sx = innerPadX + idx * (segWidth + segGap);
      fillRoundedRect(
        ctx,
        sx,
        segY,
        segWidth,
        segH,
        10,
        item.completed ? palette.accentEmerald : palette.track,
        item.completed ? undefined : palette.cardBorder,
        1.5
      );
    });

    ctx.font = `500 ${isStory ? 21 : 18}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText('Nombres de tareas ocultos por privacidad.', innerPadX, segY + segH + 18);
  } else {
    visibleItems.forEach((item, idx) => {
      const rowY = taskListStartY + idx * (rowH + rowGap);
      const centerY = rowY + rowH / 2;

      fillRoundedRect(
        ctx,
        innerPadX,
        rowY,
        innerWidth,
        rowH,
        isStory ? 20 : 16,
        item.completed ? palette.rowCompletedBg : palette.rowBg,
        item.completed ? palette.rowCompletedBorder : palette.cardBorder,
        1.5
      );

      const checkRadius = isStory ? 16 : 14;
      drawCheckIcon(ctx, innerPadX + 22 + checkRadius, centerY, checkRadius, item.completed, palette);

      let rightReserve = 24;
      if (item.progressText) {
        const pillFontSize = isStory ? 20 : 17;
        ctx.font = `700 ${pillFontSize}px ${FONT_STACK}`;
        const pillTextW = ctx.measureText(item.progressText).width;
        const pillPadX = 16;
        const pillW = pillTextW + pillPadX * 2;
        const pillH = pillFontSize + 18;
        const pillX = innerPadX + innerWidth - 18 - pillW;
        const pillY = centerY - pillH / 2;

        fillRoundedRect(
          ctx,
          pillX,
          pillY,
          pillW,
          pillH,
          pillH / 2,
          item.completed ? palette.accentEmeraldSoft : palette.pillBg,
          item.completed ? palette.rowCompletedBorder : palette.pillBorder,
          1.5
        );

        ctx.fillStyle = item.completed ? palette.accentEmerald : palette.textSecondary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.progressText, pillX + pillW / 2, centerY + 1);
        rightReserve = pillW + 34;
      }

      const titleX = innerPadX + 22 + checkRadius * 2 + 18;
      const titleMaxW = innerPadX + innerWidth - rightReserve - titleX;
      ctx.font = `${item.completed ? '600' : '500'} ${isStory ? 25 : 22}px ${FONT_STACK}`;
      ctx.fillStyle = item.completed ? palette.textPrimary : palette.textSecondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateText(ctx, item.title, titleMaxW), titleX, centerY + 1);
    });

    if (hiddenCount > 0) {
      ctx.font = `600 ${isStory ? 20 : 18}px ${FONT_STACK}`;
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `+${hiddenCount} ${hiddenCount === 1 ? 'tarea más' : 'tareas más'}`,
        width / 2,
        cursorY + tasksCardH - 26
      );
    }
  }

  cursorY += tasksCardH + sectionGap;

  // --- 4. Bottom Bento Card: 7-Day Activity Strip + 75-Day Challenge Progress Bar ---
  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    contentW,
    bottomBentoH,
    cardRadius,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const bottomTopY = cursorY + (isStory ? 28 : 22);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(payload.recentDaysLabel, innerPadX, bottomTopY);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(
    `${payload.recentCompletedCount}/${payload.recentDays.length} completados`,
    innerPadX + innerWidth,
    bottomTopY
  );

  // 7-day strip tiles
  const days = payload.recentDays;
  const dayCount = Math.max(1, days.length);
  const slotW = innerWidth / dayCount;
  const tileSize = isStory ? 58 : 48;
  const weekdayY = bottomTopY + (isStory ? 38 : 30);
  const tileY = weekdayY + (isStory ? 28 : 24);
  const dayNumY = tileY + tileSize + (isStory ? 12 : 10);

  days.forEach((day, idx) => {
    const slotCenterX = innerPadX + slotW * idx + slotW / 2;
    const tileX = slotCenterX - tileSize / 2;
    const tileCenterY = tileY + tileSize / 2;

    // Weekday label above tile
    ctx.font = `${day.isTargetDay ? '700' : '600'} ${isStory ? 18 : 16}px ${FONT_STACK}`;
    ctx.fillStyle = day.isTargetDay ? accent : palette.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(day.weekdayLabel, slotCenterX, weekdayY);

    // Optional outer highlight ring for the target day
    if (day.isTargetDay) {
      roundedRectPath(ctx, tileX - 5, tileY - 5, tileSize + 10, tileSize + 10, 18);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Tile fill & icon/number
    const tileRadius = isStory ? 15 : 13;
    if (day.status === 'success') {
      fillRoundedRect(ctx, tileX, tileY, tileSize, tileSize, tileRadius, palette.accentEmerald);
      drawSmallCheck(ctx, slotCenterX, tileCenterY, tileSize * 0.44, '#FFFFFF');
    } else if (day.status === 'current') {
      fillRoundedRect(
        ctx,
        tileX,
        tileY,
        tileSize,
        tileSize,
        tileRadius,
        palette.accentRoseSoft,
        palette.accentRose,
        2
      );
      ctx.font = `800 ${isStory ? 22 : 19}px ${FONT_STACK}`;
      ctx.fillStyle = palette.accentRose;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${day.dayNumber}`, slotCenterX, tileCenterY + 1);
    } else if (day.status === 'fail') {
      fillRoundedRect(ctx, tileX, tileY, tileSize, tileSize, tileRadius, palette.gridFail);
      drawSmallCross(ctx, slotCenterX, tileCenterY, tileSize * 0.44, '#FFFFFF');
    } else if (day.status === 'rest') {
      fillRoundedRect(ctx, tileX, tileY, tileSize, tileSize, tileRadius, palette.accentSky);
      ctx.font = `700 ${isStory ? 20 : 17}px ${FONT_STACK}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', slotCenterX, tileCenterY + 1);
    } else {
      fillRoundedRect(
        ctx,
        tileX,
        tileY,
        tileSize,
        tileSize,
        tileRadius,
        day.status === 'pending' ? palette.gridPending : palette.gridFuture
      );
      ctx.font = `600 ${isStory ? 20 : 17}px ${FONT_STACK}`;
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${day.dayNumber}`, slotCenterX, tileCenterY + 1);
    }

    // Day index label below tile
    ctx.font = `${day.isTargetDay ? '700' : '600'} ${isStory ? 17 : 15}px ${FONT_STACK}`;
    ctx.fillStyle = day.isTargetDay ? palette.textPrimary : palette.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`D${day.dayNumber}`, slotCenterX, dayNumY);
  });

  // Subtle divider inside Bottom Bento Card
  const dividerY = dayNumY + (isStory ? 34 : 28);
  ctx.strokeStyle = palette.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerPadX, dividerY);
  ctx.lineTo(innerPadX + innerWidth, dividerY);
  ctx.stroke();

  // Overall 75-day Challenge Progress Bar
  const progressLabelY = dividerY + (isStory ? 22 : 16);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `700 ${isStory ? 18 : 16}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('AVANCE DEL RETO', innerPadX, progressLabelY);

  const pctText = `${payload.challengeProgressPercent}%`;
  ctx.font = `800 ${isStory ? 20 : 18}px ${FONT_STACK}`;
  const pctW = ctx.measureText(pctText).width;
  ctx.fillStyle = accent;
  ctx.textAlign = 'right';
  ctx.fillText(pctText, innerPadX + innerWidth, progressLabelY - 1);

  ctx.font = `600 ${isStory ? 19 : 17}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(
    `Día ${payload.dayNumber}/${payload.totalDays}  ·  `,
    innerPadX + innerWidth - pctW,
    progressLabelY
  );

  const barY = progressLabelY + (isStory ? 32 : 26);
  const barH = isStory ? 16 : 13;
  fillRoundedRect(ctx, innerPadX, barY, innerWidth, barH, barH / 2, palette.track);
  if (payload.challengeProgressPercent > 0) {
    const fillW = Math.max(barH, (innerWidth * payload.challengeProgressPercent) / 100);
    fillRoundedRect(ctx, innerPadX, barY, fillW, barH, barH / 2, accent);
  }

  // Subtle 25%, 50%, 75% milestone markers on track
  [0.25, 0.5, 0.75].forEach((mark) => {
    const mx = innerPadX + innerWidth * mark;
    ctx.strokeStyle = palette.cardBg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, barY);
    ctx.lineTo(mx, barY + barH);
    ctx.stroke();
  });

  drawFooter(ctx, width, height, padX, payload.handle, palette);
  return canvas;
}

function getGridCellColor(status: ChallengeGridStatus, palette: Palette): string {
  switch (status) {
    case 'success':
      return palette.accentEmerald;
    case 'current':
      return palette.accentRose;
    case 'fail':
      return palette.gridFail;
    case 'rest':
      return palette.accentSky;
    case 'pending':
      return palette.gridPending;
    case 'future':
    default:
      return palette.gridFuture;
  }
}

export function renderChallengeShareCard(
  canvas: HTMLCanvasElement,
  payload: ChallengeSharePayload,
  options: {
    format: ShareCardFormat;
    theme: ShareCardTheme;
  }
): HTMLCanvasElement {
  const { width, height } = getCanvasDimensions(options.format);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const palette = options.theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const accent = payload.progressPercent === 100 ? palette.accentEmerald : palette.accentRose;
  const padX = 76;
  const isStory = options.format === 'story';

  drawBackground(ctx, width, height, palette, accent);

  let cursorY = isStory ? 96 : 74;
  ctx.font = `700 24px ${FONT_STACK}`;
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('PROGRESO DEL RETO', padX, cursorY);

  const planText = `PLAN ${payload.difficultyLabel.toUpperCase()}`;
  ctx.font = `700 22px ${FONT_STACK}`;
  const planWidth = ctx.measureText(planText).width + 52;
  drawBadge(
    ctx,
    width - padX - planWidth,
    cursorY - 8,
    planText,
    palette.pillBg,
    palette.pillBorder,
    palette.textSecondary,
    22
  );

  // Big Hero Day Counter
  cursorY += isStory ? 64 : 48;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `800 ${isStory ? 148 : 120}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  const dayStr = `${payload.currentDay}`;
  ctx.fillText(dayStr, padX, cursorY);
  const dayWidth = ctx.measureText(dayStr).width;

  ctx.font = `700 ${isStory ? 48 : 40}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(` / ${payload.totalDays} días`, padX + dayWidth + 8, cursorY + (isStory ? 84 : 66));

  // Progress bar + percentage
  cursorY += isStory ? 186 : 148;
  ctx.font = `700 28px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText('Avance general', padX, cursorY);

  ctx.font = `800 34px ${FONT_STACK}`;
  ctx.fillStyle = accent;
  ctx.textAlign = 'right';
  ctx.fillText(`${payload.progressPercent}%`, width - padX, cursorY - 4);

  cursorY += 48;
  const barWidth = width - padX * 2;
  fillRoundedRect(ctx, padX, cursorY, barWidth, 24, 12, palette.track);
  if (payload.progressPercent > 0) {
    const fillW = Math.max(24, (barWidth * payload.progressPercent) / 100);
    fillRoundedRect(ctx, padX, cursorY, fillW, 24, 12, accent);
  }

  // 3 Stats cards
  cursorY += isStory ? 64 : 48;
  const statGap = 24;
  const statWidth = (barWidth - statGap * 2) / 3;
  const statHeight = isStory ? 176 : 148;
  const stats = [
    {
      label: 'RACHA ACTUAL',
      value: `${payload.streak}`,
      sub: payload.streak === 1 ? 'día seguido' : 'días seguidos',
      color: palette.accentAmber,
    },
    {
      label: 'COMPLETADOS',
      value: `${payload.completedDaysCount}`,
      sub: 'días al 100%',
      color: palette.accentEmerald,
    },
    {
      label: 'PUNTOS',
      value: `${payload.points}`,
      sub: payload.difficultyLabel,
      color: palette.accentRose,
    },
  ];

  stats.forEach((stat, idx) => {
    const sx = padX + idx * (statWidth + statGap);
    fillRoundedRect(
      ctx,
      sx,
      cursorY,
      statWidth,
      statHeight,
      28,
      palette.cardBg,
      palette.cardBorder,
      2
    );

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 18px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(stat.label, sx + 26, cursorY + 26);

    ctx.font = `800 ${isStory ? 54 : 46}px ${FONT_STACK}`;
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, sx + 26, cursorY + (isStory ? 60 : 52));

    ctx.font = `500 22px ${FONT_STACK}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText(stat.sub, sx + 26, cursorY + (isStory ? 126 : 106));
  });

  // 75 Days Matrix Grid
  cursorY += statHeight + (isStory ? 44 : 32);
  const footerReserve = 148;
  const matrixHeight = height - footerReserve - cursorY;

  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    barWidth,
    matrixHeight,
    40,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const innerPadX = padX + 44;
  const innerW = width - innerPadX * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 22px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('MAPA DE 75 DÍAS', innerPadX, cursorY + 36);

  // Optional period summaries on top right of matrix card
  const periodBadges: string[] = [];
  if (payload.weeklySummary) {
    periodBadges.push(`Sem: ${payload.weeklySummary.completed}/${payload.weeklySummary.total}`);
  }
  if (payload.monthlySummary) {
    periodBadges.push(`Mes: ${payload.monthlySummary.completed}/${payload.monthlySummary.total}`);
  }
  if (periodBadges.length > 0) {
    ctx.font = `600 22px ${FONT_STACK}`;
    ctx.fillStyle = palette.accentSky;
    ctx.textAlign = 'right';
    ctx.fillText(periodBadges.join(' · '), innerPadX + innerW, cursorY + 36);
  }

  // Grid: 15 columns x 5 rows = 75 cells
  const cols = 15;
  const rows = 5;
  const gridTop = cursorY + 92;
  const gridBottom = cursorY + matrixHeight - 78;
  const availGridH = Math.max(120, gridBottom - gridTop);
  const cellGap = 12;
  const cellSizeW = (innerW - cellGap * (cols - 1)) / cols;
  const cellSizeH = (availGridH - cellGap * (rows - 1)) / rows;
  const cellSize = Math.min(cellSizeW, cellSizeH, isStory ? 56 : 44);
  const totalGridW = cols * cellSize + (cols - 1) * cellGap;
  const totalGridH = rows * cellSize + (rows - 1) * cellGap;
  const gridStartX = innerPadX + (innerW - totalGridW) / 2;
  const gridStartY = gridTop + (availGridH - totalGridH) / 2;

  payload.dayGrid.slice(0, 75).forEach((status, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cx = gridStartX + col * (cellSize + cellGap);
    const cy = gridStartY + row * (cellSize + cellGap);
    const color = getGridCellColor(status, palette);
    fillRoundedRect(ctx, cx, cy, cellSize, cellSize, 10, color);
  });

  // Legend
  const legendY = cursorY + matrixHeight - 44;
  const legendItems = [
    { label: 'Completado', color: palette.accentEmerald },
    { label: 'Actual', color: palette.accentRose },
    { label: 'Pendiente', color: palette.gridPending },
    { label: 'Restante', color: palette.gridFuture },
  ];
  let lx = innerPadX;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 20px ${FONT_STACK}`;
  legendItems.forEach((item) => {
    fillRoundedRect(ctx, lx, legendY - 8, 16, 16, 5, item.color);
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(item.label, lx + 24, legendY);
    lx += ctx.measureText(item.label).width + 54;
  });

  drawFooter(ctx, width, height, padX, payload.handle, palette);
  return canvas;
}

function loadCanvasImage(url: string | null | undefined, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous';
    }
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => finish(img.naturalWidth > 0 ? img : null);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const offsetX = dx + (dw - drawW) / 2;
  const offsetY = dy + (dh - drawH) / 2;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(truncateText(ctx, word, maxWidth));
        current = '';
      }
      if (lines.length === maxLines) {
        if (current) {
          lines[maxLines - 1] = truncateText(ctx, `${lines[maxLines - 1]} ${current}`, maxWidth);
        }
        return lines;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(truncateText(ctx, current, maxWidth));
  }
  return lines;
}

function drawDotGridPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean
) {
  ctx.save();
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(15, 23, 42, 0.045)';
  const spacing = 30;
  for (let y = 24; y < height; y += spacing) {
    for (let x = 24; x < width; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fillElevatedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke: string,
  isDark: boolean,
  lineWidth = 1.5
) {
  ctx.save();
  if (!isDark) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.075)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
  }
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawStatIcon(
  ctx: CanvasRenderingContext2D,
  type: 'flame' | 'trophy' | 'bolt' | 'medal',
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'flame') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.bezierCurveTo(cx + 8, cy - 5, cx + 11, cy + 2, cx + 8, cy + 9);
    ctx.bezierCurveTo(cx + 5, cy + 14, cx - 5, cy + 14, cx - 8, cy + 9);
    ctx.bezierCurveTo(cx - 11, cy + 3, cx - 7, cy - 4, cx - 3, cy - 7);
    ctx.bezierCurveTo(cx - 3, cy - 3, cx - 1, cy - 1, cx, cy - 13);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy + 2);
    ctx.bezierCurveTo(cx + 3, cy + 5, cx + 3, cy + 10, cx, cy + 10);
    ctx.bezierCurveTo(cx - 3, cy + 10, cx - 3, cy + 5, cx, cy + 2);
    ctx.fill();
  } else if (type === 'trophy') {
    // Cup
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 11);
    ctx.lineTo(cx + 8, cy - 11);
    ctx.lineTo(cx + 6, cy + 1);
    ctx.quadraticCurveTo(cx, cy + 6, cx - 6, cy + 1);
    ctx.closePath();
    ctx.stroke();
    // Handles
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 8);
    ctx.quadraticCurveTo(cx - 14, cy - 8, cx - 12, cy - 2);
    ctx.quadraticCurveTo(cx - 10, cy + 1, cx - 6, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 8);
    ctx.quadraticCurveTo(cx + 14, cy - 8, cx + 12, cy - 2);
    ctx.quadraticCurveTo(cx + 10, cy + 1, cx + 6, cy);
    ctx.stroke();
    // Stem & base
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx, cy + 10);
    ctx.moveTo(cx - 6, cy + 11);
    ctx.lineTo(cx + 6, cy + 11);
    ctx.stroke();
  } else if (type === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 13);
    ctx.lineTo(cx - 9, cy + 1);
    ctx.lineTo(cx - 1, cy + 1);
    ctx.lineTo(cx - 3, cy + 13);
    ctx.lineTo(cx + 9, cy - 2);
    ctx.lineTo(cx + 1, cy - 2);
    ctx.closePath();
    ctx.stroke();
  } else {
    // Medal / award
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 3);
    ctx.lineTo(cx - 6, cy + 13);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx + 6, cy + 13);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawProfileBrandFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padX: number,
  palette: Palette
) {
  const footerY = height - 64;
  ctx.save();
  ctx.strokeStyle = palette.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, footerY - 32);
  ctx.lineTo(width - padX, footerY - 32);
  ctx.stroke();

  // Brand dot + wordmark on left
  ctx.beginPath();
  ctx.arc(padX + 7, footerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = palette.accentRose;
  ctx.fill();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 22px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText('75 DAYS CHALLENGE', padX + 24, footerY + 1);

  ctx.textAlign = 'right';
  ctx.font = `600 21px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('Lunita-Development', width - padX, footerY + 1);
  ctx.restore();
}

export async function renderProfileShareCard(
  canvas: HTMLCanvasElement,
  payload: ProfileSharePayload,
  options: {
    format: ShareCardFormat;
    theme: ShareCardTheme;
    isCancelled?: () => boolean;
  }
): Promise<HTMLCanvasElement> {
  const [bannerImg, avatarImg] = await Promise.all([
    loadCanvasImage(payload.bannerUrl),
    loadCanvasImage(payload.avatarUrl),
  ]);

  if (options.isCancelled?.()) return canvas;

  const { width, height } = getCanvasDimensions(options.format);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isDark = options.theme === 'dark';
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const isStory = options.format === 'story';
  const padX = isStory ? 72 : 68;
  const contentW = width - padX * 2;

  drawBackground(ctx, width, height, palette, palette.accentRose);
  drawDotGridPattern(ctx, width, height, isDark);

  // 1. Top Header
  let cursorY = isStory ? 84 : 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(padX + 7, cursorY + 13, 6, 0, Math.PI * 2);
  ctx.fillStyle = palette.accentRose;
  ctx.fill();

  ctx.font = `800 23px ${FONT_STACK}`;
  ctx.fillStyle = palette.accentRose;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('PERFIL DE ATLETA', padX + 24, cursorY);

  const levelText = `★  NIVEL ${payload.level}`;
  ctx.font = `800 22px ${FONT_STACK}`;
  const levelW = ctx.measureText(levelText).width + 54;
  drawBadge(
    ctx,
    width - padX - levelW,
    cursorY - 10,
    levelText,
    palette.accentRoseSoft,
    palette.accentRose,
    palette.accentRose,
    22
  );
  ctx.restore();

  // 2. Hero Profile Bento Card (Banner + Horizontal Identity + Dynamic Editorial Quote)
  cursorY += isStory ? 62 : 48;
  const bannerH = isStory ? 310 : 215;
  const avatarR = isStory ? 84 : 68;
  const innerPadX = padX + 42;
  const innerW = contentW - 84;

  // Pre-measure quote lines so the hero card has exact dynamic height (no wasted void)
  const quoteFontSize = isStory ? 27 : 24;
  const quoteLineH = isStory ? 38 : 33;
  let quoteLines: string[] = [];
  if (payload.quote) {
    ctx.font = `italic 500 ${quoteFontSize}px ${FONT_STACK}`;
    quoteLines = wrapText(ctx, payload.quote, innerW - 72, 3);
  }
  const hasQuote = quoteLines.length > 0;
  const quoteBoxH = hasQuote ? quoteLines.length * quoteLineH + (isStory ? 44 : 36) : 0;
  const identityBandH = avatarR + (isStory ? 28 : 20);
  const heroBottomPad = hasQuote ? (isStory ? 32 : 24) : (isStory ? 28 : 22);
  const quoteTopGap = hasQuote ? (isStory ? 24 : 18) : 0;
  const heroCardH = bannerH + identityBandH + quoteTopGap + quoteBoxH + heroBottomPad;

  fillElevatedCard(
    ctx,
    padX,
    cursorY,
    contentW,
    heroCardH,
    36,
    palette.cardBg,
    palette.cardBorder,
    isDark,
    1.5
  );

  // Banner clipped cleanly to the top of the hero card
  ctx.save();
  roundedRectPath(ctx, padX, cursorY, contentW, heroCardH, 36);
  ctx.clip();

  if (bannerImg) {
    drawCoverImage(ctx, bannerImg, padX, cursorY, contentW, bannerH);
    const scrim = ctx.createLinearGradient(0, cursorY, 0, cursorY + bannerH);
    scrim.addColorStop(0, 'rgba(9, 6, 8, 0.22)');
    scrim.addColorStop(0.55, 'rgba(9, 6, 8, 0.14)');
    scrim.addColorStop(1, 'rgba(9, 6, 8, 0.62)');
    ctx.fillStyle = scrim;
    ctx.fillRect(padX, cursorY, contentW, bannerH);
  } else {
    const grad = ctx.createLinearGradient(padX, cursorY, padX + contentW, cursorY + bannerH);
    grad.addColorStop(0, isDark ? '#3B0F21' : '#FFE4E8');
    grad.addColorStop(0.55, isDark ? '#1A1118' : '#F8EEF1');
    grad.addColorStop(1, isDark ? '#0E2421' : '#DCFCE7');
    ctx.fillStyle = grad;
    ctx.fillRect(padX, cursorY, contentW, bannerH);
  }
  ctx.restore();

  // Frosted "Miembro desde" pill cleanly inside top-right of banner (never overlaps seam)
  if (payload.memberSince) {
    const memberText = `Miembro desde ${payload.memberSince}`;
    ctx.font = `600 20px ${FONT_STACK}`;
    const mW = ctx.measureText(memberText).width + 44;
    const mH = 42;
    const badgeX = padX + contentW - 24 - mW;
    const badgeY = cursorY + 22;
    fillRoundedRect(
      ctx,
      badgeX,
      badgeY,
      mW,
      mH,
      mH / 2,
      'rgba(9, 6, 8, 0.62)',
      'rgba(255, 255, 255, 0.24)',
      1.5
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(memberText, badgeX + mW / 2, badgeY + mH / 2 + 1);
  }

  // Avatar overlapping bottom-left of banner with soft shadow & accent ring
  const avatarCx = innerPadX + avatarR;
  const avatarCy = cursorY + bannerH;

  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 8, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? '#161114' : '#FFFFFF';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = palette.accentRose;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    drawCoverImage(
      ctx,
      avatarImg,
      avatarCx - avatarR,
      avatarCy - avatarR,
      avatarR * 2,
      avatarR * 2
    );
  } else {
    ctx.fillStyle = palette.accentRoseSoft;
    ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
    ctx.font = `800 ${Math.round(avatarR * 0.82)}px ${FONT_STACK}`;
    ctx.fillStyle = palette.accentRose;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(payload.initial, avatarCx, avatarCy + 3);
  }
  ctx.restore();

  // Horizontal Identity: Name & Handle cleanly placed to the right of the avatar
  const idX = avatarCx + avatarR + 28;
  const idMaxW = padX + contentW - 40 - idX;
  const nameFontSize = isStory ? 46 : 40;
  const nameY = cursorY + bannerH + (payload.handle ? (isStory ? 12 : 8) : (isStory ? 26 : 18));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${nameFontSize}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText(truncateText(ctx, payload.name, idMaxW), idX, nameY);

  if (payload.handle) {
    ctx.font = `600 ${isStory ? 25 : 22}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(
      truncateText(ctx, payload.handle, idMaxW),
      idX,
      nameY + nameFontSize + (isStory ? 6 : 4)
    );
  }

  // Editorial Dynamic-Height Quote Block
  if (hasQuote) {
    const qY = cursorY + bannerH + identityBandH + quoteTopGap;
    const quoteBg = isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(225, 29, 72, 0.045)';
    const quoteBorder = isDark ? 'rgba(244, 63, 94, 0.20)' : 'rgba(225, 29, 72, 0.14)';
    fillRoundedRect(ctx, innerPadX, qY, innerW, quoteBoxH, 22, quoteBg, quoteBorder, 1.5);
    fillRoundedRect(ctx, innerPadX + 14, qY + 14, 6, quoteBoxH - 28, 3, palette.accentRose);

    // Subtle oversized decorative opening quote mark
    ctx.save();
    ctx.font = `800 ${isStory ? 64 : 54}px Georgia, serif`;
    ctx.fillStyle = isDark ? 'rgba(244, 63, 94, 0.22)' : 'rgba(225, 29, 72, 0.14)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('”', innerPadX + innerW - 22, qY + 6);
    ctx.restore();

    ctx.font = `italic 500 ${quoteFontSize}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const totalTextH = quoteLines.length * quoteLineH;
    let lineY = qY + (quoteBoxH - totalTextH) / 2 + 2;
    quoteLines.forEach((line, idx) => {
      const decorated =
        quoteLines.length === 1
          ? `“${line}”`
          : idx === 0
            ? `“${line}`
            : idx === quoteLines.length - 1
              ? `${line}”`
              : line;
      ctx.fillText(decorated, innerPadX + 36, lineY);
      lineY += quoteLineH;
    });
  }

  cursorY += heroCardH + (isStory ? 30 : 22);

  // 3. High-Contrast Bento Centerpiece: Active Challenge + 75-Day Micro Grid
  const challengeCardH = payload.isChallengeActive
    ? isStory
      ? 290
      : 214
    : isStory
      ? 148
      : 118;

  const heroGrad = ctx.createLinearGradient(padX, cursorY, padX + contentW, cursorY + challengeCardH);
  if (isDark) {
    heroGrad.addColorStop(0, 'rgba(244, 63, 94, 0.22)');
    heroGrad.addColorStop(0.55, 'rgba(30, 14, 24, 0.92)');
    heroGrad.addColorStop(1, 'rgba(136, 19, 55, 0.26)');
  } else {
    // High-contrast obsidian-rose anchor block in light mode so the card pops
    heroGrad.addColorStop(0, '#140C11');
    heroGrad.addColorStop(0.65, '#1F101A');
    heroGrad.addColorStop(1, '#2D1020');
  }

  fillElevatedCard(
    ctx,
    padX,
    cursorY,
    contentW,
    challengeCardH,
    32,
    heroGrad,
    isDark ? 'rgba(244, 63, 94, 0.42)' : 'rgba(244, 63, 94, 0.30)',
    true,
    1.5
  );

  // Ambient rose glow inside centerpiece card
  ctx.save();
  roundedRectPath(ctx, padX, cursorY, contentW, challengeCardH, 32);
  ctx.clip();
  const cardGlow = ctx.createRadialGradient(
    padX + contentW * 0.88,
    cursorY + challengeCardH * 0.2,
    10,
    padX + contentW * 0.88,
    cursorY + challengeCardH * 0.2,
    contentW * 0.48
  );
  cardGlow.addColorStop(0, 'rgba(244, 63, 94, 0.30)');
  cardGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = cardGlow;
  ctx.fillRect(padX, cursorY, contentW, challengeCardH);
  ctx.restore();

  const chInnerX = padX + 38;
  const chInnerW = contentW - 76;

  if (payload.isChallengeActive) {
    const pct = Math.round((payload.currentDay / payload.totalDays) * 100);

    // Top metadata row inside centerpiece
    const topRowY = cursorY + (isStory ? 34 : 26);
    ctx.beginPath();
    ctx.arc(chInnerX + 6, topRowY + 11, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FB7185';
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 20px ${FONT_STACK}`;
    ctx.fillStyle = '#FDA4AF';
    ctx.fillText(
      `DESAFÍO 75 ACTIVO  ·  PLAN ${payload.difficultyLabel.toUpperCase()}`,
      chInnerX + 22,
      topRowY
    );

    // Percentage pill on top-right
    const pctText = `${pct}% COMPLETADO`;
    ctx.font = `800 18px ${FONT_STACK}`;
    const pctW = ctx.measureText(pctText).width + 32;
    const pctH = 34;
    fillRoundedRect(
      ctx,
      chInnerX + chInnerW - pctW,
      topRowY - 6,
      pctW,
      pctH,
      pctH / 2,
      'rgba(244, 63, 94, 0.24)',
      'rgba(251, 113, 133, 0.55)',
      1.5
    );
    ctx.fillStyle = '#FFE4E6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pctText, chInnerX + chInnerW - pctW / 2, topRowY - 6 + pctH / 2 + 1);

    // Big Day Counter + Progress Bar row
    const midY = topRowY + (isStory ? 44 : 36);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${isStory ? 62 : 48}px ${FONT_STACK}`;
    ctx.fillStyle = '#FFFFFF';
    const dayMain = `Día ${payload.currentDay}`;
    ctx.fillText(dayMain, chInnerX, midY);
    const dayMainW = ctx.measureText(dayMain).width;

    ctx.font = `700 ${isStory ? 30 : 25}px ${FONT_STACK}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
    ctx.fillText(` / ${payload.totalDays}`, chInnerX + dayMainW + 4, midY + (isStory ? 26 : 19));

    // Remaining days label on the right
    const remainingDays = Math.max(0, payload.totalDays - payload.currentDay);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = `600 ${isStory ? 22 : 19}px ${FONT_STACK}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(
      remainingDays === 0 ? '¡Meta alcanzada!' : `${remainingDays} días restantes`,
      chInnerX + chInnerW,
      midY + (isStory ? 56 : 44)
    );

    // 75-Day Micro Matrix (25 columns x 3 rows = 75 pills)
    const gridCols = 25;
    const gridRows = 3;
    const cellGapX = 7;
    const cellGapY = isStory ? 10 : 7;
    const cellW = (chInnerW - cellGapX * (gridCols - 1)) / gridCols;
    const cellH = isStory ? 22 : 15;
    const gridStartY = cursorY + challengeCardH - (isStory ? 30 : 24) - (gridRows * cellH + (gridRows - 1) * cellGapY);

    const gridSource: ChallengeGridStatus[] =
      payload.dayGrid.length > 0
        ? payload.dayGrid
        : Array.from({ length: payload.totalDays }, (_, i) => {
            const d = i + 1;
            if (d < payload.currentDay) return 'pending';
            if (d === payload.currentDay) return 'current';
            return 'future';
          });

    gridSource.slice(0, 75).forEach((status, idx) => {
      const row = Math.floor(idx / gridCols);
      const col = idx % gridCols;
      const gx = chInnerX + col * (cellW + cellGapX);
      const gy = gridStartY + row * (cellH + cellGapY);

      let cellColor = 'rgba(255, 255, 255, 0.11)';
      if (status === 'success') cellColor = '#10B981';
      else if (status === 'current') cellColor = '#F43F5E';
      else if (status === 'fail') cellColor = 'rgba(239, 68, 68, 0.55)';
      else if (status === 'rest') cellColor = '#38BDF8';
      else if (status === 'pending') cellColor = 'rgba(255, 255, 255, 0.30)';

      ctx.save();
      if (status === 'current') {
        ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = 10;
      }
      fillRoundedRect(ctx, gx, gy, cellW, cellH, isStory ? 6 : 4, cellColor);
      ctx.restore();
    });
  } else {
    // Inactive challenge high-contrast CTA/status anchor
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 20px ${FONT_STACK}`;
    ctx.fillStyle = '#FDA4AF';
    ctx.fillText('75 DAYS CHALLENGE', chInnerX, cursorY + (isStory ? 34 : 26));

    ctx.font = `800 ${isStory ? 38 : 30}px ${FONT_STACK}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Listo para el próximo desafío', chInnerX, cursorY + (isStory ? 72 : 58));
  }

  cursorY += challengeCardH + (isStory ? 30 : 22);

  // 4. Enriched 2x2 Bento Stats Grid (with icons, ambient tints, sub-labels & visual logros bar)
  const footerReserve = isStory ? 116 : 106;
  const availStatsH = height - footerReserve - cursorY;
  const statGap = isStory ? 24 : 20;
  const statW = (contentW - statGap) / 2;
  const maxStatH = isStory ? 248 : 190;
  const statH = Math.min(maxStatH, Math.max(142, (availStatsH - statGap) / 2));
  const totalGridH = statH * 2 + statGap;
  const gridOffsetY = Math.max(0, (availStatsH - totalGridH) / 2);
  const statsStartY = cursorY + gridOffsetY;

  const achievementsValue =
    payload.totalAchievements > 0
      ? `${payload.unlockedAchievements}/${payload.totalAchievements}`
      : `${payload.unlockedAchievements}`;

  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    accent: string;
    tintBg: string;
    icon: 'flame' | 'trophy' | 'bolt' | 'medal';
    isAchievements?: boolean;
  }> = [
    {
      label: 'RACHA ACTUAL',
      value: `${payload.streak} ${payload.streak === 1 ? 'día' : 'días'}`,
      sub: payload.streak > 0 ? 'Constancia activa' : 'Arrancando el ritmo',
      accent: palette.accentAmber,
      tintBg: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(217, 119, 6, 0.10)',
      icon: 'flame',
    },
    {
      label: 'RETOS COMPLETADOS',
      value: `${payload.challengesCompleted}`,
      sub:
        payload.challengesCompleted > 0
          ? payload.challengesCompleted === 1
            ? 'Desafío superado'
            : 'Desafíos superados'
          : payload.isChallengeActive
            ? 'Primer reto en curso'
            : 'Sin retos cerrados aún',
      accent: palette.accentEmerald,
      tintBg: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(5, 150, 105, 0.10)',
      icon: 'trophy',
    },
    {
      label: 'PUNTOS TOTALES',
      value: `${payload.points.toLocaleString('es-AR')} pts`,
      sub: `Nivel ${payload.level} · Atleta`,
      accent: palette.accentSky,
      tintBg: isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.10)',
      icon: 'bolt',
    },
    {
      label: 'LOGROS',
      value: achievementsValue,
      sub:
        payload.totalAchievements > 0
          ? `${Math.round((payload.unlockedAchievements / payload.totalAchievements) * 100)}% desbloqueados`
          : 'Insignias ganadas',
      accent: palette.accentRose,
      tintBg: isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(225, 29, 72, 0.10)',
      icon: 'medal',
      isAchievements: true,
    },
  ];

  stats.forEach((stat, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = padX + col * (statW + statGap);
    const sy = statsStartY + row * (statH + statGap);

    fillElevatedCard(ctx, sx, sy, statW, statH, 28, palette.cardBg, palette.cardBorder, isDark, 1.5);

    // Subtle corner accent glow clipped inside stat card
    ctx.save();
    roundedRectPath(ctx, sx, sy, statW, statH, 28);
    ctx.clip();
    const glow = ctx.createRadialGradient(
      sx + statW - 24,
      sy + 24,
      6,
      sx + statW - 24,
      sy + 24,
      statW * 0.55
    );
    glow.addColorStop(0, stat.tintBg);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(sx, sy, statW, statH);
    ctx.restore();

    // Top-right rounded icon badge (balances horizontal space cleanly)
    const iconBoxSize = isStory ? 54 : 48;
    const iconBoxX = sx + statW - 26 - iconBoxSize;
    const iconBoxY = sy + 24;
    fillRoundedRect(ctx, iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 16, stat.tintBg);
    drawStatIcon(
      ctx,
      stat.icon,
      iconBoxX + iconBoxSize / 2,
      iconBoxY + iconBoxSize / 2,
      stat.accent
    );

    // Label top-left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${isStory ? 20 : 18}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(truncateText(ctx, stat.label, statW - iconBoxSize - 72), sx + 28, sy + 28);

    // Big value
    const valY = sy + (isStory ? 76 : 62);
    ctx.font = `800 ${isStory ? 54 : 44}px ${FONT_STACK}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, stat.value, statW - 56), sx + 28, valY);

    // Bottom detail: Segmented achievements bar for Logros, contextual sub-label for others
    if (stat.isAchievements && payload.totalAchievements > 0) {
      const barX = sx + 28;
      const barW = statW - 56;
      const barH = isStory ? 12 : 10;
      const barY = sy + statH - (isStory ? 34 : 28);

      if (payload.totalAchievements <= 12) {
        const segGap = 8;
        const segCount = payload.totalAchievements;
        const segW = (barW - segGap * (segCount - 1)) / segCount;
        for (let i = 0; i < segCount; i++) {
          const isUnlocked = i < payload.unlockedAchievements;
          fillRoundedRect(
            ctx,
            barX + i * (segW + segGap),
            barY,
            segW,
            barH,
            barH / 2,
            isUnlocked ? stat.accent : palette.track
          );
        }
      } else {
        fillRoundedRect(ctx, barX, barY, barW, barH, barH / 2, palette.track);
        const pctFill = Math.min(1, payload.unlockedAchievements / payload.totalAchievements);
        if (pctFill > 0) {
          fillRoundedRect(ctx, barX, barY, Math.max(barH, barW * pctFill), barH, barH / 2, stat.accent);
        }
      }
    } else {
      ctx.font = `500 ${isStory ? 22 : 19}px ${FONT_STACK}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.textBaseline = 'bottom';
      ctx.fillText(truncateText(ctx, stat.sub, statW - 56), sx + 28, sy + statH - (isStory ? 26 : 20));
    }
  });

  drawProfileBrandFooter(ctx, width, height, padX, palette);
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen PNG.'));
      },
      'image/png',
      1
    );
  });
}

export function downloadPngBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareFilesNatively(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const testFile = new File([new Uint8Array(1)], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

export async function sharePngBlob(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
    if (canShareFiles) {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      return 'shared';
    }
  }
  downloadPngBlob(blob, filename);
  return 'downloaded';
}

export function canCopyImageToClipboard(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  if (!canCopyImageToClipboard()) {
    throw new Error('Tu navegador no soporta copiar imágenes al portapapeles.');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
