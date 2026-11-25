import type {
  ChallengeGridStatus,
  ChallengeSharePayload,
  DailySharePayload,
  ShareCardFormat,
  ShareCardTheme,
} from './shareCardData';

interface Palette {
  bgBase: string;
  bgGlowTop: string;
  bgGlowBottom: string;
  cardBg: string;
  cardBorder: string;
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
  const padX = 76;
  const isStory = options.format === 'story';

  drawBackground(ctx, width, height, palette, accent);

  // Header
  let cursorY = isStory ? 96 : 74;
  ctx.font = `700 24px ${FONT_STACK}`;
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ESTADO DEL DÍA', padX, cursorY);

  // Plan pill on right
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

  cursorY += 42;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `800 ${isStory ? 74 : 64}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText(`Día ${payload.dayNumber}`, padX, cursorY);

  const dayTextWidth = ctx.measureText(`Día ${payload.dayNumber}`).width;
  ctx.font = `700 ${isStory ? 38 : 34}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(` / ${payload.totalDays}`, padX + dayTextWidth + 6, cursorY + (isStory ? 28 : 22));

  cursorY += isStory ? 92 : 78;
  ctx.font = `500 28px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(payload.formattedDate, padX, cursorY);

  // Hero progress ring card
  cursorY += isStory ? 72 : 56;
  const heroCardHeight = isStory ? 360 : 300;
  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    width - padX * 2,
    heroCardHeight,
    40,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const ringRadius = isStory ? 112 : 94;
  const ringCx = padX + 56 + ringRadius;
  const ringCy = cursorY + heroCardHeight / 2;

  // Ring track
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = palette.track;
  ctx.lineWidth = 22;
  ctx.stroke();

  // Ring progress
  if (payload.progressPercent > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * payload.progressPercent) / 100;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Ring center percentage
  ctx.font = `800 ${isStory ? 56 : 48}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${payload.progressPercent}%`, ringCx, ringCy + 2);

  // Right side of hero card
  const infoX = ringCx + ringRadius + 56;
  const infoMaxW = width - padX - 44 - infoX;

  drawBadge(
    ctx,
    infoX,
    cursorY + (isStory ? 68 : 48),
    payload.statusLabel,
    accentSoft,
    accent,
    accent,
    22
  );

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${isStory ? 46 : 40}px ${FONT_STACK}`;
  ctx.fillStyle = palette.textPrimary;
  const summaryMain =
    payload.totalCount === 0
      ? 'Sin tareas'
      : `${payload.completedCount} de ${payload.totalCount} tareas`;
  ctx.fillText(
    truncateText(ctx, summaryMain, infoMaxW),
    infoX,
    cursorY + (isStory ? 142 : 114)
  );

  ctx.font = `500 26px ${FONT_STACK}`;
  ctx.fillStyle = palette.textSecondary;
  const subSummary =
    payload.totalCount === 0
      ? 'Enfoque semanal / mensual'
      : payload.isComplete
        ? '¡Todas las metas cumplidas!'
        : `${payload.remainingCount} ${payload.remainingCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}`;
  ctx.fillText(
    truncateText(ctx, subSummary, infoMaxW),
    infoX,
    cursorY + (isStory ? 204 : 168)
  );

  ctx.font = `600 24px ${FONT_STACK}`;
  ctx.fillStyle = palette.accentAmber;
  ctx.fillText(
    `Racha actual: ${payload.streak} ${payload.streak === 1 ? 'día' : 'días'}`,
    infoX,
    cursorY + (isStory ? 260 : 218)
  );

  // Tasks section
  cursorY += heroCardHeight + (isStory ? 44 : 32);
  const footerReserve = 148;
  const availableTasksHeight = height - footerReserve - cursorY;

  fillRoundedRect(
    ctx,
    padX,
    cursorY,
    width - padX * 2,
    availableTasksHeight,
    40,
    palette.cardBg,
    palette.cardBorder,
    2
  );

  const innerPadX = padX + 44;
  const innerWidth = width - innerPadX * 2;
  let taskY = cursorY + 40;

  ctx.font = `700 22px ${FONT_STACK}`;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    options.showGoalTitles ? 'DETALLE DE TAREAS' : 'RESUMEN DE CUMPLIMIENTO',
    innerPadX,
    taskY
  );
  taskY += 48;

  if (payload.totalCount === 0) {
    ctx.font = `500 30px ${FONT_STACK}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText('No hay tareas diarias configuradas para este día.', innerPadX, taskY + 24);
  } else if (!options.showGoalTitles) {
    // Privacy mode: segmented bar + summary without exposing task names
    ctx.font = `700 34px ${FONT_STACK}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.fillText(
      `${payload.completedCount} completadas · ${payload.remainingCount} pendientes`,
      innerPadX,
      taskY + 12
    );

    const segGap = 14;
    const segCount = payload.items.length;
    const segWidth = Math.max(24, (innerWidth - segGap * (segCount - 1)) / segCount);
    const segY = taskY + 84;
    const segH = 36;

    payload.items.forEach((item, idx) => {
      const sx = innerPadX + idx * (segWidth + segGap);
      fillRoundedRect(
        ctx,
        sx,
        segY,
        segWidth,
        segH,
        12,
        item.completed ? palette.accentEmerald : palette.track,
        item.completed ? undefined : palette.cardBorder,
        2
      );
    });

    ctx.font = `500 25px ${FONT_STACK}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(
      'Nombres de tareas ocultos por privacidad.',
      innerPadX,
      segY + 64
    );
  } else {
    const rowHeight = isStory ? 96 : 74;
    const maxVisible = Math.max(
      1,
      Math.floor((availableTasksHeight - 104) / rowHeight)
    );
    const visibleItems = payload.items.slice(0, maxVisible);
    const hiddenCount = Math.max(0, payload.items.length - visibleItems.length);

    visibleItems.forEach((item, idx) => {
      const rowY = taskY + idx * rowHeight;
      const centerY = rowY + rowHeight / 2 - 4;

      if (idx > 0) {
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(innerPadX, rowY - 4);
        ctx.lineTo(innerPadX + innerWidth, rowY - 4);
        ctx.stroke();
      }

      drawCheckIcon(ctx, innerPadX + 20, centerY, 20, item.completed, palette);

      ctx.textBaseline = 'middle';
      let rightLabelWidth = 0;
      if (item.progressText) {
        ctx.font = `700 24px ${FONT_STACK}`;
        rightLabelWidth = ctx.measureText(item.progressText).width + 24;
        ctx.fillStyle = item.completed ? palette.accentEmerald : palette.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(item.progressText, innerPadX + innerWidth, centerY);
      }

      ctx.font = `${item.completed ? '600' : '500'} ${isStory ? 30 : 27}px ${FONT_STACK}`;
      ctx.fillStyle = item.completed ? palette.textPrimary : palette.textSecondary;
      ctx.textAlign = 'left';
      const titleMaxW = innerWidth - 64 - rightLabelWidth;
      ctx.fillText(truncateText(ctx, item.title, titleMaxW), innerPadX + 60, centerY);
    });

    if (hiddenCount > 0) {
      ctx.font = `600 24px ${FONT_STACK}`;
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `+${hiddenCount} ${hiddenCount === 1 ? 'tarea más' : 'tareas más'}`,
        width / 2,
        cursorY + availableTasksHeight - 28
      );
    }
  }

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
