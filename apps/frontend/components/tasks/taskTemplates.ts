import type {
  Goal,
  GoalCadence,
  GoalMeasurementType,
  GoalTemplate,
  PeriodGoalProgress,
} from '@/store/useChallengeStore';

export interface ContextTaskTarget {
  kind: 'daily' | 'period';
  id: string;
  templateId?: string | null;
  title: string;
  description?: string | null;
  icon?: string | null;
  cadence: GoalCadence;
  measurementType: GoalMeasurementType;
  targetValue: number;
  targetUnit?: string | null;
  currentValue: number;
  completed: boolean;
  isFailed?: boolean;
  periodNumber?: number;
}

export interface TaskEditPatch {
  title: string;
  description: string;
  icon: string;
  measurementType: GoalMeasurementType;
  targetValue: number;
  targetUnit: string | null;
}

export function dailyGoalToContextTarget(goal: Goal): ContextTaskTarget {
  const measurementType: GoalMeasurementType =
    goal.measurementType === 'count' || goal.measurementType === 'numeric'
      ? goal.measurementType
      : 'boolean';
  const targetValue =
    typeof goal.targetValue === 'number' && goal.targetValue > 0 ? goal.targetValue : 1;
  const currentValue =
    typeof goal.currentValue === 'number'
      ? goal.currentValue
      : goal.completed
        ? targetValue
        : 0;

  return {
    kind: 'daily',
    id: goal.id,
    templateId: goal.templateId ?? null,
    title: goal.title,
    description: goal.description ?? '',
    icon: goal.icon ?? 'target',
    cadence: goal.cadence ?? 'daily',
    measurementType,
    targetValue,
    targetUnit: goal.targetUnit ?? null,
    currentValue,
    completed: Boolean(goal.completed),
    isFailed: false,
  };
}

export function periodGoalToContextTarget(pg: PeriodGoalProgress): ContextTaskTarget {
  const measurementType: GoalMeasurementType =
    pg.measurementType === 'count' || pg.measurementType === 'numeric'
      ? pg.measurementType
      : 'boolean';
  const targetValue =
    typeof pg.targetValue === 'number' && pg.targetValue > 0 ? pg.targetValue : 1;
  const currentValue = typeof pg.currentValue === 'number' ? pg.currentValue : 0;

  return {
    kind: 'period',
    id: pg.id,
    templateId: pg.templateId ?? null,
    title: pg.title,
    description: pg.description ?? '',
    icon: pg.icon ?? 'target',
    cadence: pg.cadence,
    measurementType,
    targetValue,
    targetUnit: pg.targetUnit ?? null,
    currentValue,
    completed: pg.status === 'success',
    isFailed: pg.status === 'fail',
    periodNumber: pg.periodNumber,
  };
}

function matchesTemplate(template: GoalTemplate, target: ContextTaskTarget): boolean {
  if (target.templateId && template.id && template.id === target.templateId) {
    return true;
  }
  if (template.id && template.id === target.id) {
    return true;
  }
  const tplCadence = template.cadence || 'daily';
  return (
    tplCadence === target.cadence &&
    template.title.trim().toLowerCase() === target.title.trim().toLowerCase()
  );
}

/**
 * Construye una lista completa de GoalTemplate actualizada tras editar o eliminar
 * una sola tarea, garantizando que el resto de las metas (diarias, semanales y mensuales)
 * se conserven intactas.
 */
export function buildUpdatedGoalTemplates(params: {
  currentTemplates: GoalTemplate[];
  fallbackDailyGoals?: Goal[];
  fallbackPeriodGoals?: PeriodGoalProgress[];
  target: ContextTaskTarget;
  mode: 'edit' | 'delete';
  patch?: TaskEditPatch;
}): GoalTemplate[] {
  const {
    currentTemplates,
    fallbackDailyGoals = [],
    fallbackPeriodGoals = [],
    target,
    mode,
    patch,
  } = params;

  const baseList: GoalTemplate[] =
    currentTemplates.length > 0
      ? currentTemplates.map((tpl, idx) => ({
          id: tpl.id,
          title: tpl.title,
          description: tpl.description ?? '',
          icon: tpl.icon ?? 'target',
          cadence: tpl.cadence ?? 'daily',
          measurementType: tpl.measurementType ?? 'boolean',
          targetValue:
            typeof tpl.targetValue === 'number' && tpl.targetValue > 0 ? tpl.targetValue : 1,
          targetUnit: tpl.targetUnit ?? null,
          order: typeof tpl.order === 'number' ? tpl.order : idx,
        }))
      : [
          ...fallbackDailyGoals.map((g, idx) => ({
            id: g.templateId ?? g.id,
            title: g.title,
            description: g.description ?? '',
            icon: g.icon ?? 'target',
            cadence: (g.cadence ?? 'daily') as GoalCadence,
            measurementType: (g.measurementType ?? 'boolean') as GoalMeasurementType,
            targetValue:
              typeof g.targetValue === 'number' && g.targetValue > 0 ? g.targetValue : 1,
            targetUnit: g.targetUnit ?? null,
            order: idx,
          })),
          ...fallbackPeriodGoals.map((pg, idx) => ({
            id: pg.templateId ?? pg.id,
            title: pg.title,
            description: pg.description ?? '',
            icon: pg.icon ?? 'target',
            cadence: pg.cadence,
            measurementType: pg.measurementType,
            targetValue: pg.targetValue > 0 ? pg.targetValue : 1,
            targetUnit: pg.targetUnit ?? null,
            order: fallbackDailyGoals.length + idx,
          })),
        ];

  const matchIdx = baseList.findIndex((tpl) => matchesTemplate(tpl, target));
  if (matchIdx === -1) {
    return baseList;
  }

  if (mode === 'delete') {
    return baseList
      .filter((_, idx) => idx !== matchIdx)
      .map((tpl, idx) => ({ ...tpl, order: idx }));
  }

  if (!patch) return baseList;

  const isBool = patch.measurementType === 'boolean';
  const normalizedTarget = isBool
    ? 1
    : patch.measurementType === 'count'
      ? Math.max(1, Math.round(patch.targetValue))
      : Math.max(0.1, Math.round(patch.targetValue * 100) / 100);

  return baseList.map((tpl, idx) =>
    idx === matchIdx
      ? {
          ...tpl,
          title: patch.title.trim(),
          description: patch.description.trim(),
          icon: patch.icon || tpl.icon || 'target',
          measurementType: patch.measurementType,
          targetValue: normalizedTarget,
          targetUnit: isBool ? null : patch.targetUnit?.trim() || null,
        }
      : tpl
  );
}

export interface ContextMenuLayout {
  cardTop: number;
  cardLeft: number;
  cardWidth: number;
  menuTop: number;
  menuLeft: number;
  menuWidth: number;
  menuPlacement: 'below' | 'above';
}

export interface SimpleRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Calcula las coordenadas exactas de la tarjeta destacada y su menú contextual
 * estilo WhatsApp/iOS dentro del viewport, garantizando márgenes seguros en 375×812px.
 */
export function computeContextMenuLayout(params: {
  anchorRect: SimpleRect;
  viewportWidth: number;
  viewportHeight: number;
  estimatedMenuHeight?: number;
  matchCardWidth?: boolean;
  safeTop?: number;
  safeBottom?: number;
}): ContextMenuLayout {
  const {
    anchorRect,
    viewportWidth,
    viewportHeight,
    estimatedMenuHeight = 250,
    matchCardWidth = false,
    safeTop = 16,
    safeBottom = 20,
  } = params;

  const horizontalMargin = 16;
  const gap = 12;

  const maxCardWidth = Math.max(240, viewportWidth - horizontalMargin * 2);
  const cardWidth = Math.min(anchorRect.width, maxCardWidth);
  const cardLeft = Math.max(
    horizontalMargin,
    Math.min(anchorRect.left, viewportWidth - cardWidth - horizontalMargin)
  );

  const menuWidth = matchCardWidth ? cardWidth : Math.min(284, maxCardWidth);
  // Alinear el menú con el borde izquierdo de la tarjeta (o derecho si está cerca del borde)
  const menuLeft = Math.max(
    horizontalMargin,
    Math.min(cardLeft, viewportWidth - menuWidth - horizontalMargin)
  );

  const cardHeight = Math.min(anchorRect.height, viewportHeight * 0.45);
  const totalStackHeight = cardHeight + gap + estimatedMenuHeight;
  const availableHeight = viewportHeight - safeTop - safeBottom;

  // Preferir menú debajo de la tarjeta (estilo WhatsApp); si no entra, desplazar la tarjeta hacia arriba
  let cardTop = anchorRect.top;
  let menuPlacement: 'below' | 'above' = 'below';

  if (totalStackHeight <= availableHeight) {
    const maxCardTop = viewportHeight - safeBottom - totalStackHeight;
    cardTop = Math.max(safeTop, Math.min(anchorRect.top, maxCardTop));
    menuPlacement = 'below';
  } else {
    // Pantalla muy baja: anclar arriba con scroll interno en el menú si hace falta
    cardTop = safeTop;
    menuPlacement = 'below';
  }

  const menuTop =
    menuPlacement === 'below'
      ? cardTop + cardHeight + gap
      : Math.max(safeTop, cardTop - gap - estimatedMenuHeight);

  return {
    cardTop: Math.round(cardTop),
    cardLeft: Math.round(cardLeft),
    cardWidth: Math.round(cardWidth),
    menuTop: Math.round(menuTop),
    menuLeft: Math.round(menuLeft),
    menuWidth: Math.round(menuWidth),
    menuPlacement,
  };
}
